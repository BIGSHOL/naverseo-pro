import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeBlogIndex,
  determineLevelInfo,
  generateDemoPosts,
  generateDemoKeywordResults,
  generateDemoKeywordCompetition,
  generateDemoVisitorData,
  type BlogPost,
  type KeywordRankResult,
  type KeywordCompetitionData,
  type VisitorData,
} from '@/lib/blog-index/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/blog-index/ai-analyzer'
import { getUserAiProvider } from '@/lib/ai/gemini'
import { checkAnalysisLimit, incrementAnalysisUsage } from '@/lib/plan-check'
import { extractBlogId } from '@/lib/utils/text'
import { fetchBlogPosts, extractKeywordsFromPosts } from '@/lib/naver/blog-crawler'

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },

        { status: 401 }
      )
    }

    // 사용자의 AI 제공자 조회
    const provider = await getUserAiProvider(supabase, user.id)

    // 일간 분석 제한 체크
    const limitCheck = await checkAnalysisLimit(supabase, user.id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.message, limit: limitCheck.limit, used: limitCheck.used },
        { status: 429 }
      )
    }

    const { blogUrl, testKeywords = [] } = await request.json()

    if (!blogUrl?.trim()) {
      return NextResponse.json(
        { error: '블로그 URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 사용자 입력 키워드 파싱
    const userKeywords = (testKeywords as string[])
      .map((k: string) => k.trim())
      .filter(Boolean)

    // 네이버 API 키 확인
    const hasNaverApi =
      process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET

    let posts: BlogPost[]
    let keywordResults: KeywordRankResult[]
    let keywordCompetition: KeywordCompetitionData[] = []
    let visitorData: VisitorData | null = null
    let blogName: string | null = null
    const isDemo = !hasNaverApi

    // blogId 추출
    const blogId = extractBlogId(blogUrl.trim())

    if (!hasNaverApi) {
      // 데모 모드
      const demoBlogId = blogId || blogUrl.trim().replace(/.*\//, '') || 'demo_blog'
      posts = generateDemoPosts(demoBlogId)
      // 사용자 키워드가 없으면 데모 포스트에서 자동 추출
      const keywords = userKeywords.length > 0
        ? userKeywords
        : extractKeywordsFromPosts(posts)
      keywordResults = generateDemoKeywordResults(keywords)
      keywordCompetition = generateDemoKeywordCompetition(keywords)
      visitorData = generateDemoVisitorData()
      blogName = '데모 블로그'
    } else {
      const { searchNaverBlog } = await import('@/lib/naver/blog-search')

      // === 1단계: 통합 블로그 크롤러 사용 (RSS → 검색 API → 페이지 크롤링) ===
      if (blogId) {
        const crawlResult = await fetchBlogPosts(blogId, 100)
        posts = crawlResult.posts
        blogName = crawlResult.blogName
        console.log(`[BlogIndex] 크롤링 완료: ${posts.length}개 포스트 (${crawlResult.source}), 블로그명: ${blogName || '(없음)'}`)
      } else {
        posts = []
      }

      const matchTarget = blogId
        ? blogId.toLowerCase()
        : blogUrl
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '')

      // === 2단계: 키워드 결정 (사용자 입력 또는 포스트에서 자동 추출) ===
      const keywords = userKeywords.length > 0
        ? userKeywords
        : extractKeywordsFromPosts(posts)

      if (userKeywords.length === 0 && keywords.length > 0) {
        console.log(`[BlogIndex] 포스트에서 자동 추출 키워드: ${keywords.join(', ')}`)
      }

      // === 3단계: 키워드별 순위 체크 ===
      keywordResults = []
      for (const keyword of keywords) {
        try {
          const searchResult = await searchNaverBlog(keyword, 100)
          let rank: number | null = null

          for (let i = 0; i < searchResult.items.length; i++) {
            const item = searchResult.items[i]
            const itemLink = item.link.toLowerCase()
            const bloggerLink = item.bloggerlink.toLowerCase()

            if (blogId) {
              const pattern = new RegExp(
                `blog\\.naver\\.com/${matchTarget}(?:/[0-9]*)?(?:\\?|$)`,
                'i'
              )
              if (pattern.test(itemLink) || pattern.test(bloggerLink)) {
                rank = i + 1
                break
              }
            } else {
              const normalizedItem = itemLink
                .replace(/^https?:\/\//, '')
                .replace(/\/$/, '')
              const normalizedBlogger = bloggerLink
                .replace(/^https?:\/\//, '')
                .replace(/\/$/, '')
              if (
                normalizedItem.startsWith(matchTarget) ||
                normalizedBlogger.startsWith(matchTarget)
              ) {
                rank = i + 1
                break
              }
            }
          }

          keywordResults.push({
            keyword,
            rank,
            totalResults: searchResult.total,
          })

          // API 호출 간 딜레이 (네이버 rate limit 방지)
          await new Promise((resolve) => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`[BlogIndex] 키워드 "${keyword}" 검색 오류:`, error)
          keywordResults.push({ keyword, rank: null, totalResults: 0 })
        }
      }

      // === 4단계: 키워드 경쟁도 조회 (검색광고 API) ===
      const hasAdApi = process.env.NAVER_AD_API_KEY && process.env.NAVER_AD_SECRET_KEY && process.env.NAVER_AD_CUSTOMER_ID
      if (hasAdApi && keywords.length > 0) {
        try {
          const { getKeywordStats } = await import('@/lib/naver/search-ad')
          const adResults = await getKeywordStats(keywords.join(','))
          keywordCompetition = keywords.map((kw) => {
            const match = adResults.find((r) => r.relKeyword === kw)
            return {
              keyword: kw,
              compIdx: match?.compIdx || '-',
              searchVolume: match ? match.monthlyPcQcCnt + match.monthlyMobileQcCnt : 0,
            }
          })
          console.log(`[BlogIndex] 키워드 경쟁도 ${keywordCompetition.length}개 조회 완료`)
        } catch (adError) {
          console.error('[BlogIndex] 키워드 경쟁도 조회 실패 (무시):', adError)
          // 실패해도 빈 배열 → engine에서 중립 점수
        }
      }

      // === 5단계: 방문자 데이터 조회 (XML API) ===
      if (blogId) {
        try {
          const { fetchBlogVisitors } = await import('@/lib/naver/visitor-stats')
          visitorData = await fetchBlogVisitors(blogId)
          if (visitorData.isAvailable) {
            console.log(`[BlogIndex] 방문자 데이터 조회 완료 (일평균: ${visitorData.avgDailyVisitors}명)`)
          }
        } catch (visitorError) {
          console.error('[BlogIndex] 방문자 데이터 조회 실패 (무시):', visitorError)
          // 실패해도 null → engine에서 중립 점수
        }
      }
    }

    // === 6단계: 블로그 포스트 본문 스크래핑 (Rate Limited) ===
    let scrapedData: Map<string, import('@/lib/naver/blog-scraper').ScrapedPostData> | null = null
    if (!isDemo && posts.length > 0) {
      try {
        const { scrapeMultiplePosts } = await import('@/lib/naver/blog-scraper')
        const postUrls = posts.slice(0, 20).map(p => p.link)
        console.log(`[BlogIndex] 스크래핑 대상 URL 샘플:`, postUrls.slice(0, 3))
        scrapedData = await scrapeMultiplePosts(postUrls, 20, {
          extractMeta: true,
          blogId: blogId || undefined,
        })
        const successCount = scrapedData.size
        console.log(`[BlogIndex] 포스트 스크래핑 완료: ${successCount}/${postUrls.length}개 성공`)
      } catch (scrapeError) {
        console.error('[BlogIndex] 포스트 스크래핑 실패 (폴백 사용):', scrapeError)
        // 실패해도 scrapedData는 null → engine에서 description 기반 추정값 사용
      }
    }

    // 4축 블로그 지수 분석 엔진 실행 (알고리즘 기반)
    const result = analyzeBlogIndex(
      blogUrl.trim(), posts, keywordResults, isDemo, blogName,
      keywordCompetition.length > 0 ? keywordCompetition : undefined,
      visitorData,
      scrapedData  // 스크래핑 데이터 전달 (null이면 description 기반 폴백)
    )

    // AI 심층 분석 (v2.5) — 알고리즘 분석과 병렬이 아닌 순차 실행 (결과에 보정값 적용)
    try {
      const aiAnalysis = isDemo
        ? generateDemoAiAnalysis()
        : await analyzeWithAi(posts, isDemo, provider)

      if (aiAnalysis) {
        result.aiAnalysis = aiAnalysis

        // AI 점수 보정 적용 (알고리즘 점수에 AI 보정값 가산/감산)
        if (aiAnalysis.scoreAdjustment !== 0) {
          const adjusted = Math.max(0, Math.min(100, result.totalScore + aiAnalysis.scoreAdjustment))
          console.log(`[BlogIndex AI] 점수 보정: ${result.totalScore} → ${adjusted} (${aiAnalysis.scoreAdjustment > 0 ? '+' : ''}${aiAnalysis.scoreAdjustment})`)
          result.totalScore = adjusted
          // 등급도 보정된 점수로 재계산
          result.level = determineLevelInfo(result.totalScore)
        }

        // AI 추천을 기존 추천에 병합 (중복 제거)
        if (aiAnalysis.recommendations.length > 0) {
          const existingSet = new Set(result.recommendations.map(r => r.substring(0, 20)))
          const newRecs = aiAnalysis.recommendations.filter(
            r => !existingSet.has(r.substring(0, 20))
          )
          result.recommendations = [...result.recommendations, ...newRecs].slice(0, 8)
        }
      }
    } catch (aiError) {
      // AI 분석 실패해도 알고리즘 결과는 정상 반환
      console.error('[BlogIndex AI] AI 분석 오류 (무시):', aiError)
    }

    // 분석 사용량 증가
    await incrementAnalysisUsage(supabase, user.id)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[BlogIndex] 오류:', error)
    return NextResponse.json(
      { error: '블로그 지수 측정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
