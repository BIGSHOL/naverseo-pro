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
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { extractBlogId } from '@/lib/utils/text'
import { fetchBlogPosts, extractKeywordsFromPosts } from '@/lib/naver/blog-crawler'
import { scheduleCollection, collectFromSearchResults } from '@/lib/blog-learning'

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

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'blog_index')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
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

          // 블로그 학습 파이프라인: 각 키워드 검색 결과에서 상위 포스트 수집
          scheduleCollection(() => collectFromSearchResults(keyword, searchResult.items.slice(0, 5), 'blog_index'))

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

    // AI 심층 분석은 별도 API(/api/blog-index/ai)에서 온디맨드로 실행

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'blog_index', { blogUrl: blogUrl.trim() })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[BlogIndex] 오류:', error)
    return NextResponse.json(
      { error: '블로그 지수 측정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
