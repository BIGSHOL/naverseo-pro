import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeBlogIndex,
  determineLevelInfo,
  generateDemoPosts,
  generateDemoKeywordResults,
  generateDemoKeywordCompetition,
  generateDemoVisitorData,
  generateDemoBlogProfileData,
  generateDemoScrapedData,
  type BlogPost,
  type KeywordRankResult,
  type KeywordCompetitionData,
  type VisitorData,
  type BlogProfileData,
} from '@/lib/blog-index/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/blog-index/ai-analyzer'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { extractBlogId } from '@/lib/utils/text'
import { fetchBlogPosts, extractKeywordsFromPosts } from '@/lib/naver/blog-crawler'
import { scheduleCollection, collectFromSearchResults, collectFromScrapedPosts } from '@/lib/blog-learning'
import { detectBlogCategory, BLOG_CATEGORY_LABELS } from '@/lib/blog-index/categories'
import { getCategoryBenchmark } from '@/lib/blog-index/benchmark-provider'
import { accumulateBenchmarkData } from '@/lib/blog-index/benchmark-accumulator'

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
    let blogProfileData: BlogProfileData | null = null
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
      blogProfileData = generateDemoBlogProfileData()
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

      // === 5단계: 방문자 데이터 + 블로그 프로필 조회 (병렬 실행) ===
      if (blogId) {
        const [visitorResult, profileResult] = await Promise.allSettled([
          import('@/lib/naver/visitor-stats').then(m => m.fetchBlogVisitors(blogId)),
          import('@/lib/naver/blog-profile-scraper').then(m => m.scrapeBlogProfile(blogId)),
        ])

        if (visitorResult.status === 'fulfilled') {
          visitorData = visitorResult.value
          if (visitorData.isAvailable) {
            console.log(`[BlogIndex] 방문자 데이터 조회 완료 (일평균: ${visitorData.avgDailyVisitors}명)`)
          }
        } else {
          console.error('[BlogIndex] 방문자 데이터 조회 실패 (무시):', visitorResult.reason)
        }

        if (profileResult.status === 'fulfilled') {
          blogProfileData = profileResult.value
          console.log(`[BlogIndex] 프로필 크롤링 완료: 총 ${blogProfileData.totalPostCount ?? '?'}개 포스트, 연차 ${blogProfileData.blogAgeDays ?? '?'}일, 오늘 방문자 ${blogProfileData.dayVisitorCount ?? '?'}명`)
        } else {
          console.error('[BlogIndex] 프로필 크롤링 실패 (무시):', profileResult.reason)
        }

        // 방문자 API 실패 시 프로필 페이지의 dayVisitorCount를 폴백으로 사용
        if ((!visitorData || !visitorData.isAvailable) && blogProfileData?.dayVisitorCount) {
          visitorData = {
            dailyVisitors: [blogProfileData.dayVisitorCount],
            avgDailyVisitors: blogProfileData.dayVisitorCount,
            isAvailable: true,
          }
          console.log(`[BlogIndex] 방문자 데이터 폴백 (프로필): 오늘 ${blogProfileData.dayVisitorCount}명`)
        }

        // === 5.5단계: 실제 최초 포스팅 날짜 조회 (검색 API) ===
        try {
          const { fetchOldestPostDate } = await import('@/lib/naver/blog-profile-scraper')
          const oldestResult = await fetchOldestPostDate(blogId, blogProfileData?.totalPostCount)
          if (oldestResult && blogProfileData) {
            blogProfileData.firstPostDate = oldestResult.date
            blogProfileData.firstPostDateAccurate = oldestResult.accurate
            console.log(`[BlogIndex] 최초 포스팅일: ${oldestResult.date} (${oldestResult.accurate ? '정확' : '근사'})`)
          }
        } catch (err) {
          console.warn('[BlogIndex] 최초 포스팅일 조회 실패 (무시):', err)
        }
      }
    }

    // === 6단계: 블로그 포스트 본문 스크래핑 (Rate Limited, 댓글/공감 포함) ===
    let scrapedData: Map<string, import('@/lib/naver/blog-scraper').ScrapedPostData> | null = null
    if (isDemo && posts.length > 0) {
      // 데모 모드: 댓글/공감 포함 스크래핑 데이터 생성
      scrapedData = generateDemoScrapedData(posts)
    } else if (!isDemo && posts.length > 0) {
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

    // === 7단계: 카테고리 감지 + 카테고리별 벤치마크 조회 ===
    const topicKeywords = posts.length > 0 ? extractKeywordsFromPosts(posts) : []
    const blogCategory = detectBlogCategory(topicKeywords, userKeywords)
    const categoryBenchmark = await getCategoryBenchmark(blogCategory)
    console.log(`[BlogIndex] 카테고리: ${blogCategory} (${BLOG_CATEGORY_LABELS[blogCategory]}, ${categoryBenchmark.source}, 샘플 ${categoryBenchmark.sampleCount}개)`)

    // v9: 4축 블로그 지수 분석 엔진 실행 (카테고리별 벤치마크)
    const result = analyzeBlogIndex(
      blogUrl.trim(), posts, keywordResults, isDemo, blogName,
      keywordCompetition.length > 0 ? keywordCompetition : undefined,
      visitorData,
      scrapedData,
      blogProfileData,
      categoryBenchmark.values,
    )

    // 카테고리 + 벤치마크 소스 정보 주입
    result.blogCategory = blogCategory
    result.benchmarkSource = categoryBenchmark.source
    result.benchmarkSampleCount = categoryBenchmark.sampleCount

    // AI 심층 분석은 별도 API(/api/blog-index/ai)에서 온디맨드로 실행

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'blog_index', { blogUrl: blogUrl.trim() })

    // 벤치마크 데이터 축적 (fire-and-forget, 데모 제외)
    if (!isDemo) {
      scheduleCollection(() => accumulateBenchmarkData(blogCategory, result.benchmark, result.totalScore))
    }

    // 히스토리 자동 저장 (에러 나도 측정 결과에 영향 없음)
    let historySaved = false
    try {
      // v9: 4축 점수 추출 (콘텐츠 품질 / 방문자 활동 / SEO 최적화 / 신뢰도)
      const contentCat = result.categories.find((c: { name: string }) => c.name === '콘텐츠 품질')
      const popCat = result.categories.find((c: { name: string }) => c.name === '방문자 활동')
      const seoCat = result.categories.find((c: { name: string }) => c.name === 'SEO 최적화')
      const trustCat = result.categories.find((c: { name: string }) => c.name === '신뢰도')

      const historyRow = {
        user_id: user.id,
        blog_url: blogUrl.trim(),
        blog_id: blogId || null,
        total_score: result.totalScore,
        search_score: seoCat?.score ?? null,          // v9: SEO 최적화 본축 점수
        popularity_score: popCat?.score ?? null,       // v9: 방문자 활동
        content_score: contentCat?.score ?? null,      // v9: 콘텐츠 품질 (전문성 병합)
        activity_score: trustCat?.score ?? null,       // v9: 신뢰도 (활동성+신뢰도 통합)
        abuse_penalty: result.abusePenalty?.score ?? 0,
        level_tier: result.level.tier,
        level_label: result.level.label,
        metrics: {
          keywords: result.keywordResults?.map((kr: { keyword: string }) => kr.keyword) ?? [],
          avgCommentCount: result.postAnalysis.avgCommentCount ?? null,
          avgSympathyCount: result.postAnalysis.avgSympathyCount ?? null,
          totalPostCount: result.blogProfile?.totalPostCount ?? result.postAnalysis.totalFound,
          postsPerWeek: result.blogProfile?.postsPerWeek ?? null,
          trustScore: trustCat?.score ?? null,
          seoScore: seoCat?.score ?? null,
          diaScore: result.diaScore?.score ?? null,
          crankScore: result.crankScore?.score ?? null,
          searchBonusScore: result.searchBonus?.score ?? null,
        },
        full_result: result,
        is_demo: isDemo,
        checked_at: new Date().toISOString(),
      }

      // 항상 새 레코드 삽입 (갱신할 때마다 히스토리로 쌓임)
      const { error: insertError } = await supabase
        .from('blog_index_history')
        .insert(historyRow)

      if (insertError) {
        console.error('[BlogIndex] 히스토리 저장 실패:', insertError.message, insertError.details, insertError.hint)
      } else {
        historySaved = true
        console.log(`[BlogIndex] 히스토리 저장 성공: blog_id=${blogId}, score=${result.totalScore}`)
      }
    } catch (historyError) {
      console.error('[BlogIndex] 히스토리 저장 예외:', historyError)
    }

    // historySaved를 결과에 포함하여 클라이언트에서 DB 저장 상태 확인 가능
    return NextResponse.json({ ...result, _historySaved: historySaved })
  } catch (error) {
    console.error('[BlogIndex] 오류:', error)
    return NextResponse.json(
      { error: '블로그 지수 측정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
