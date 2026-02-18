import { NextRequest, NextResponse } from 'next/server'
import {
  getKeywordStats,
  calculateKeywordScore,
  type NaverKeywordResult,
} from '@/lib/naver/search-ad'

// 데모 데이터 (API 키 없을 때 사용)
function generateDemoData(keyword: string): NaverKeywordResult[] {
  const variations = [
    keyword,
    `${keyword} 추천`,
    `${keyword} 방법`,
    `${keyword} 후기`,
    `${keyword} 비교`,
    `${keyword} 가격`,
    `${keyword} 순위`,
    `${keyword} 블로그`,
    `${keyword} 팁`,
    `${keyword} 정보`,
  ]

  return variations.map((kw, i) => ({
    relKeyword: kw,
    monthlyPcQcCnt: Math.floor(Math.random() * 5000) + (i === 0 ? 3000 : 100),
    monthlyMobileQcCnt: Math.floor(Math.random() * 15000) + (i === 0 ? 8000 : 300),
    monthlyAvePcClkCnt: Math.floor(Math.random() * 200) + 10,
    monthlyAveMobileClkCnt: Math.floor(Math.random() * 500) + 30,
    monthlyAvePcCtr: Math.random() * 5 + 0.5,
    monthlyAveMobileCtr: Math.random() * 8 + 1,
    plAvgDepth: Math.floor(Math.random() * 15) + 1,
    compIdx: ['HIGH', 'MEDIUM', 'LOW'][Math.floor(Math.random() * 3)],
  }))
}

// Supabase에 키워드 검색 결과 저장 + 사용량 증가
async function saveKeywordResearch(seedKeyword: string, results: unknown[]) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // 키워드 리서치 결과 저장
    await supabase.from('keyword_research').insert({
      user_id: user.id,
      seed_keyword: seedKeyword,
      results: { keywords: results },
    })

    // 사용량 증가
    await supabase.rpc('increment_keyword_usage', { uid: user.id }).maybeSingle()
  } catch {
    // DB 저장 실패해도 API 응답은 정상 반환
    console.error('[Keywords] DB 저장 실패')
  }
}

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
    let resultsWithScore

    // 네이버 API 키가 없으면 데모 데이터 반환
    if (
      !process.env.NAVER_AD_API_KEY ||
      !process.env.NAVER_AD_SECRET_KEY ||
      !process.env.NAVER_AD_CUSTOMER_ID
    ) {
      const demoResults = generateDemoData(keyword.trim())
      resultsWithScore = demoResults.map((kw) => ({
        ...kw,
        totalSearch: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
        score: calculateKeywordScore(kw),
      }))
      resultsWithScore.sort((a, b) => b.score - a.score)

      // 데모라도 DB에 저장 시도
      await saveKeywordResearch(keyword.trim(), resultsWithScore)

      return NextResponse.json({
        keywords: resultsWithScore,
        isDemo: true,
        message: '데모 데이터입니다. 실제 데이터는 네이버 API 키 설정 후 사용 가능합니다.',
      })
    }

    const trimmed = keyword.trim()
    const hasSpaces = /\s/.test(trimmed)
    const results = await getKeywordStats(trimmed)
    resultsWithScore = results.map((kw) => ({
      ...kw,
      totalSearch: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
      score: calculateKeywordScore(kw),
    }))
    resultsWithScore.sort((a, b) => b.score - a.score)

    // DB에 저장
    await saveKeywordResearch(trimmed, resultsWithScore)

    return NextResponse.json({
      keywords: resultsWithScore,
      isDemo: false,
      // 공백이 포함된 키워드는 네이버 API 제한으로 공백 제거 후 검색됨
      ...(hasSpaces && {
        searchedAs: trimmed.replace(/\s+/g, ''),
        spaceNotice: `네이버 API 제한으로 "${trimmed.replace(/\s+/g, '')}"(으)로 검색되었습니다.`,
      }),
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
