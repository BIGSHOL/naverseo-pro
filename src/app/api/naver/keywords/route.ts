import { NextRequest, NextResponse } from 'next/server'
import {
  getKeywordStats,
  calculateKeywordScore,
  type NaverKeywordResult,
} from '@/lib/naver/search-ad'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { scheduleCollection, collectFromSearchResults } from '@/lib/blog-learning'

export const maxDuration = 60

// === 상위 5개 검색결과 타입 조회 ===

interface TopSearchResult {
  rank: number
  type: '블로그' | '카페' | '외부' | '포스트' | '지식인'
  source: string
  link?: string
}

function classifyUrl(url: string): { type: TopSearchResult['type']; source: string } {
  if (url.includes('blog.naver.com')) return { type: '블로그', source: '네이버 블로그' }
  if (url.includes('cafe.naver.com')) return { type: '카페', source: '네이버 카페' }
  if (url.includes('post.naver.com')) return { type: '포스트', source: '네이버 포스트' }
  if (url.includes('kin.naver.com')) return { type: '지식인', source: '네이버 지식인' }
  try {
    const domain = new URL(url).hostname.replace('www.', '')
    return { type: '외부', source: domain }
  } catch {
    return { type: '외부', source: '외부' }
  }
}

async function fetchTopResults(keyword: string): Promise<TopSearchResult[]> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return []

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/webkr.json?query=${encodeURIComponent(keyword)}&display=5`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []).map((item: { link: string }, i: number) => {
      const classified = classifyUrl(item.link)
      return { rank: i + 1, ...classified, link: item.link }
    })
  } catch {
    return []
  }
}

// 데모 상위 5개 결과 생성
function generateDemoTopResults(): TopSearchResult[] {
  const typePool: { type: TopSearchResult['type']; source: string; weight: number }[] = [
    { type: '블로그', source: '네이버 블로그', weight: 0.4 },
    { type: '카페', source: '네이버 카페', weight: 0.3 },
    { type: '외부', source: '외부 블로그', weight: 0.15 },
    { type: '포스트', source: '네이버 포스트', weight: 0.1 },
    { type: '지식인', source: '네이버 지식인', weight: 0.05 },
  ]
  return Array.from({ length: 5 }, (_, i) => {
    const rand = Math.random()
    let cumulative = 0
    let selected = typePool[0]
    for (const t of typePool) {
      cumulative += t.weight
      if (rand < cumulative) { selected = t; break }
    }
    return { rank: i + 1, type: selected.type, source: selected.source }
  })
}

// === 데모 데이터 ===

function generateDemoData(keyword: string): NaverKeywordResult[] {
  const suffixes = [
    '', ' 추천', ' 방법', ' 후기', ' 비교', ' 가격',
    ' 순위', ' 블로그', ' 팁', ' 정보', ' 하는법',
    ' 종류', ' 장단점', ' 총정리', ' 2026', ' 리뷰',
    ' 초보', ' 가이드', ' 효과', ' 주의사항',
    ' TOP5', ' 선택법', ' 꿀팁', ' 실제', ' 경험',
    ' 정리', ' 차이', ' 맛집', ' 솔직후기', ' BEST',
  ]

  return suffixes.map((suffix, i) => {
    const kw = `${keyword}${suffix}`
    const isSeed = i === 0
    const tier = i < 5 ? 'high' : i < 15 ? 'mid' : 'low'

    const pcBase = isSeed ? 3000 : tier === 'high' ? 800 : tier === 'mid' ? 200 : 50
    const mobileBase = isSeed ? 8000 : tier === 'high' ? 2500 : tier === 'mid' ? 600 : 150

    return {
      relKeyword: kw,
      monthlyPcQcCnt: pcBase + Math.floor(Math.random() * pcBase * 0.5),
      monthlyMobileQcCnt: mobileBase + Math.floor(Math.random() * mobileBase * 0.5),
      monthlyAvePcClkCnt: Math.floor(Math.random() * 200) + 10,
      monthlyAveMobileClkCnt: Math.floor(Math.random() * 500) + 30,
      monthlyAvePcCtr: Math.random() * 5 + 0.5,
      monthlyAveMobileCtr: Math.random() * 8 + 1,
      plAvgDepth: Math.floor(Math.random() * 15) + 1,
      compIdx: tier === 'low' ? 'LOW' : tier === 'mid'
        ? (['MEDIUM', 'LOW'] as const)[Math.floor(Math.random() * 2)]
        : (['HIGH', 'MEDIUM'] as const)[Math.floor(Math.random() * 2)],
    }
  })
}

// === DB 저장 ===

async function saveKeywordResearch(seedKeyword: string, results: unknown[]) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    await supabase.from('keyword_research').insert({
      user_id: user.id,
      seed_keyword: seedKeyword,
      results: { keywords: results },
    })

    await deductCredits(supabase, user.id, 'keyword_research', { keyword: seedKeyword })
  } catch {
    console.error('[Keywords] DB 저장 실패')
  }
}

// 상위 노출 분석 대상 최대 키워드 수 (성능 최적화)
const TOP_RESULTS_LIMIT = 100
const BATCH_SIZE = 5

// === API 핸들러 ===

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')

  if (!keyword || keyword.trim().length === 0) {
    return NextResponse.json(
      { error: '키워드를 입력해주세요.' },
      { status: 400 }
    )
  }

  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'keyword_research')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    // 데모 모드: 스트리밍 불필요 (즉시 반환)
    if (
      !process.env.NAVER_AD_API_KEY ||
      !process.env.NAVER_AD_SECRET_KEY ||
      !process.env.NAVER_AD_CUSTOMER_ID
    ) {
      const demoResults = generateDemoData(keyword.trim())
      const resultsWithScore = demoResults.map((kw) => ({
        ...kw,
        totalSearch: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
        score: calculateKeywordScore(kw),
        topResults: generateDemoTopResults(),
      }))
      resultsWithScore.sort((a, b) => b.score - a.score)

      await saveKeywordResearch(keyword.trim(), resultsWithScore)

      return NextResponse.json({
        keywords: resultsWithScore,
        isDemo: true,
        message: '데모 데이터입니다. 실제 데이터는 네이버 API 키 설정 후 사용 가능합니다.',
      })
    }

    // === 실제 API: NDJSON 스트리밍으로 프로그레스 전송 ===
    const trimmed = keyword.trim()
    const hasSpaces = /\s/.test(trimmed)
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        try {
          // Step 1: 키워드 검색량 조회
          send({
            type: 'progress',
            step: 1,
            totalSteps: 3,
            message: '네이버 키워드 검색량 조회 중...',
          })

          const results = await getKeywordStats(trimmed)
          let resultsWithScore = results.map((kw) => ({
            ...kw,
            totalSearch: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
            score: calculateKeywordScore(kw),
          }))
          resultsWithScore.sort((a, b) => b.score - a.score)

          // 연관 키워드가 너무 적으면 핵심 단어로 확장 검색
          let expandedNotice = ''
          if (resultsWithScore.length <= 3 && hasSpaces) {
            const words = trimmed.split(/\s+/).filter(w => w.length >= 2)
            // 가장 긴 단어를 핵심 키워드로 선택
            const sorted = [...words].sort((a, b) => b.length - a.length)
            const expandKeyword = sorted[0]

            if (expandKeyword && expandKeyword !== trimmed.replace(/\s+/g, '')) {
              send({
                type: 'progress',
                step: 1,
                totalSteps: 3,
                message: `연관 키워드가 적어 "${expandKeyword}" 키워드로 확장 검색 중...`,
              })

              try {
                const expandedResults = await getKeywordStats(expandKeyword)
                const expandedWithScore = expandedResults.map(kw => ({
                  ...kw,
                  totalSearch: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
                  score: calculateKeywordScore(kw),
                }))

                // 중복 제거 후 병합 (원본 키워드 우선)
                const existingKeywords = new Set(resultsWithScore.map(r => r.relKeyword))
                const newResults = expandedWithScore.filter(r => !existingKeywords.has(r.relKeyword))
                resultsWithScore = [...resultsWithScore, ...newResults]
                resultsWithScore.sort((a, b) => b.score - a.score)

                expandedNotice = `연관 키워드가 적어 "${expandKeyword}" 키워드로 확장 검색했습니다. (${newResults.length}개 추가)`
                console.log(`[Keywords] 확장 검색: "${expandKeyword}" → ${newResults.length}개 추가, 총 ${resultsWithScore.length}개`)
              } catch (e) {
                console.error('[Keywords] 확장 검색 실패:', e)
              }
            }
          }

          // Step 2: 상위 노출 분석 (상위 100개만)
          const hasSearchApi = process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET
          const topResultsMap = new Map<string, TopSearchResult[]>()

          if (hasSearchApi) {
            const keywordsForTopResults = resultsWithScore.slice(0, TOP_RESULTS_LIMIT)
            const totalToAnalyze = keywordsForTopResults.length

            send({
              type: 'progress',
              step: 2,
              totalSteps: 3,
              message: `${resultsWithScore.length.toLocaleString()}개 키워드 발견! 상위 노출 분석 중...`,
              keywordCount: resultsWithScore.length,
              current: 0,
              total: totalToAnalyze,
            })

            for (let i = 0; i < keywordsForTopResults.length; i += BATCH_SIZE) {
              const batch = keywordsForTopResults.slice(i, i + BATCH_SIZE)
              const batchResults = await Promise.allSettled(
                batch.map(kw => fetchTopResults(kw.relKeyword))
              )
              batch.forEach((kw, idx) => {
                const result = batchResults[idx]
                if (result.status === 'fulfilled' && result.value.length > 0) {
                  topResultsMap.set(kw.relKeyword, result.value)
                }
              })

              const processed = Math.min(i + BATCH_SIZE, totalToAnalyze)
              send({
                type: 'progress',
                step: 2,
                totalSteps: 3,
                message: `상위 노출 분석 중... (${processed}/${totalToAnalyze})`,
                keywordCount: resultsWithScore.length,
                current: processed,
                total: totalToAnalyze,
              })

              // 배치 간 딜레이 (rate limit 방지)
              if (i + BATCH_SIZE < keywordsForTopResults.length) {
                await new Promise(r => setTimeout(r, 100))
              }
            }

            console.log(`[Keywords] 상위 5개 결과 조회 완료: ${topResultsMap.size}/${totalToAnalyze}개`)
          } else {
            send({
              type: 'progress',
              step: 2,
              totalSteps: 3,
              message: `${resultsWithScore.length.toLocaleString()}개 키워드 발견!`,
              keywordCount: resultsWithScore.length,
            })
          }

          // Step 3: 결과 정리 + DB 저장
          send({
            type: 'progress',
            step: 3,
            totalSteps: 3,
            message: '결과 저장 중...',
          })

          // topResults 병합
          const keywordsWithTopResults = resultsWithScore.map(kw => ({
            ...kw,
            topResults: topResultsMap.get(kw.relKeyword) || [],
          }))

          // 블로그 학습 파이프라인: 백그라운드 수집
          if (hasSearchApi) {
            scheduleCollection(async () => {
              const { searchNaverBlog } = await import('@/lib/naver/blog-search')
              const blogResults = await searchNaverBlog(trimmed, 5)
              await collectFromSearchResults(trimmed, blogResults.items, 'keyword_research')
            })
          }

          // DB에 저장
          await saveKeywordResearch(trimmed, keywordsWithTopResults)

          // 최종 결과 전송
          send({
            type: 'result',
            keywords: keywordsWithTopResults,
            isDemo: false,
            ...(hasSpaces && {
              searchedAs: trimmed.replace(/\s+/g, ''),
              spaceNotice: `네이버 API 제한으로 "${trimmed.replace(/\s+/g, '')}"(으)로 검색되었습니다.`,
            }),
            ...(expandedNotice && { expandedNotice }),
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error('[Keywords API] 스트리밍 오류:', errorMessage)
          send({
            type: 'error',
            error: `키워드 조회 중 오류가 발생했습니다: ${errorMessage}`,
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Keywords API] 오류:', errorMessage)
    return NextResponse.json(
      { error: `키워드 조회 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
