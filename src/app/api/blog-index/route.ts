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

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // 인증 + 크레딧 체크 (에러 시 즉시 JSON 반환)
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

  const creditCheck = await checkCredits(supabase, user.id, 'blog_index')
  if (!creditCheck.allowed) {
    return NextResponse.json(
      { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
      { status: 403 }
    )
  }

  let body: { blogUrl?: string; testKeywords?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { blogUrl, testKeywords = [] } = body

  if (!blogUrl?.trim()) {
    return NextResponse.json(
      { error: '블로그 URL을 입력해주세요.' },
      { status: 400 }
    )
  }

  // NDJSON 스트리밍 응답
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        } catch { /* controller closed */ }
      }

      try {
        const totalSteps = 6

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
        const topCompetitorUrls: string[] = []
        const isDemo = !hasNaverApi

        // blogId 추출
        const blogId = extractBlogId(blogUrl.trim())

        if (!hasNaverApi) {
          // 데모 모드 — 프로그레스 없이 빠르게 처리
          const demoBlogId = blogId || blogUrl.trim().replace(/.*\//, '') || 'demo_blog'
          posts = generateDemoPosts(demoBlogId)
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

          // === Step 1: 블로그 포스트 크롤링 ===
          send({ type: 'progress', step: 1, totalSteps, message: '블로그 포스트 수집 중...' })

          if (blogId) {
            const crawlResult = await fetchBlogPosts(blogId, 100)
            posts = crawlResult.posts
            blogName = crawlResult.blogName
            console.log(`[BlogIndex] 크롤링 완료: ${posts.length}개 포스트 (${crawlResult.source}), 블로그명: ${blogName || '(없음)'}`)
            send({ type: 'progress', step: 1, totalSteps, message: `${posts.length}개 포스트 발견` })
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

          // 키워드 결정
          const keywords = userKeywords.length > 0
            ? userKeywords
            : extractKeywordsFromPosts(posts)

          if (userKeywords.length === 0 && keywords.length > 0) {
            console.log(`[BlogIndex] 포스트에서 자동 추출 키워드: ${keywords.join(', ')}`)
          }

          // === Step 2: 키워드 순위 체크 ===
          send({ type: 'progress', step: 2, totalSteps, message: '키워드 순위 분석 중...', current: 0, total: keywords.length })
          keywordResults = []

          for (let ki = 0; ki < keywords.length; ki++) {
            const keyword = keywords[ki]
            send({ type: 'progress', step: 2, totalSteps, message: `키워드 순위 분석: "${keyword}"`, current: ki + 1, total: keywords.length })
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

              // 상위 포스팅 URL 수집
              if (topCompetitorUrls.length < 5) {
                for (const item of searchResult.items.slice(0, 3)) {
                  if (topCompetitorUrls.length >= 5) break
                  const itemLink = item.link.toLowerCase()
                  if (blogId) {
                    const myPattern = new RegExp(`blog\\.naver\\.com/${matchTarget}(?:/|$)`, 'i')
                    if (myPattern.test(itemLink)) continue
                  } else {
                    const normalizedItem = itemLink.replace(/^https?:\/\//, '').replace(/\/$/, '')
                    if (normalizedItem.startsWith(matchTarget)) continue
                  }
                  if (!topCompetitorUrls.includes(item.link)) {
                    topCompetitorUrls.push(item.link)
                  }
                }
              }

              // 블로그 학습 파이프라인
              scheduleCollection(() => collectFromSearchResults(keyword, searchResult.items.slice(0, 5), 'blog_index'))

              await new Promise((resolve) => setTimeout(resolve, 200))
            } catch (error) {
              console.error(`[BlogIndex] 키워드 "${keyword}" 검색 오류:`, error)
              keywordResults.push({ keyword, rank: null, totalResults: 0 })
            }
          }

          // === Step 3: 블로그 프로필 + 경쟁도 분석 ===
          send({ type: 'progress', step: 3, totalSteps, message: '블로그 프로필 분석 중...' })

          // 키워드 경쟁도 조회
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
            }
          }

          // 방문자 데이터 + 블로그 프로필 조회
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

            // 방문자 API 실패 시 프로필 페이지의 dayVisitorCount + DB 히스토리 평균으로 보완
            if ((!visitorData || !visitorData.isAvailable) && blogProfileData?.dayVisitorCount) {
              const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
              const hourKST = nowKST.getHours() + nowKST.getMinutes() / 60
              const elapsedRatio = hourKST / 24

              const estimatedDailyVisitors = elapsedRatio >= 0.25
                ? Math.round(blogProfileData.dayVisitorCount / elapsedRatio)
                : null

              let historyAvg: number | null = null
              let historyDays = 0
              try {
                const { data: pastRecords } = await supabase
                  .from('blog_index_history')
                  .select('checked_at, full_result')
                  .eq('user_id', user.id)
                  .eq('blog_id', blogId)
                  .eq('is_demo', false)
                  .order('checked_at', { ascending: false })
                  .limit(30)

                if (pastRecords && pastRecords.length > 0) {
                  const dailyMap = new Map<string, number>()
                  for (const rec of pastRecords) {
                    const dateKey = rec.checked_at.substring(0, 10)
                    const fr = rec.full_result as Record<string, unknown> | null
                    const vd = fr?.visitorData as { avgDailyVisitors?: number } | null
                    if (vd?.avgDailyVisitors && vd.avgDailyVisitors > 0) {
                      const existing = dailyMap.get(dateKey) || 0
                      dailyMap.set(dateKey, Math.max(existing, vd.avgDailyVisitors))
                    }
                  }

                  if (estimatedDailyVisitors !== null) {
                    const todayKey = new Date().toISOString().substring(0, 10)
                    dailyMap.set(todayKey, estimatedDailyVisitors)
                  }

                  if (dailyMap.size >= 2) {
                    const values = Array.from(dailyMap.values())
                    historyAvg = Math.round(values.reduce((s, v) => s + v, 0) / values.length)
                    historyDays = dailyMap.size
                  }
                }
              } catch (err) {
                console.warn('[BlogIndex] 방문자 히스토리 조회 실패 (무시):', err)
              }

              if (historyAvg !== null && historyDays >= 2) {
                visitorData = {
                  dailyVisitors: [blogProfileData.dayVisitorCount],
                  avgDailyVisitors: historyAvg,
                  isAvailable: true,
                  source: 'history',
                  historyDays,
                }
                console.log(`[BlogIndex] 방문자 데이터 (히스토리 ${historyDays}일 평균): ${historyAvg}명`)
              } else if (estimatedDailyVisitors !== null) {
                visitorData = {
                  dailyVisitors: [blogProfileData.dayVisitorCount],
                  avgDailyVisitors: estimatedDailyVisitors,
                  isAvailable: true,
                  source: 'today',
                }
                console.log(`[BlogIndex] 방문자 데이터 (오늘 ${blogProfileData.dayVisitorCount}명 → 추정 ${estimatedDailyVisitors}명, ${hourKST.toFixed(1)}시 기준)`)
              } else {
                console.log(`[BlogIndex] 방문자 데이터 미사용 (새벽 ${hourKST.toFixed(1)}시, 오늘 ${blogProfileData.dayVisitorCount}명 - 추정 불가)`)
              }
            } else if (visitorData?.isAvailable) {
              visitorData.source = 'api'
            }

            // 최초 포스팅 날짜 조회
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

        // === Step 4: 포스트 본문 스크래핑 ===
        send({ type: 'progress', step: 4, totalSteps, message: '포스트 본문 분석 중...' })

        let scrapedData: Map<string, import('@/lib/naver/blog-scraper').ScrapedPostData> | null = null
        let topPostsScrapedData: Map<string, import('@/lib/naver/blog-scraper').ScrapedPostData> | null = null

        if (isDemo && posts.length > 0) {
          scrapedData = generateDemoScrapedData(posts)
        } else if (!isDemo && posts.length > 0) {
          try {
            const { scrapeMultiplePosts } = await import('@/lib/naver/blog-scraper')
            const postUrls = posts.slice(0, 20).map(p => p.link)
            console.log(`[BlogIndex] 스크래핑 대상 URL 샘플:`, postUrls.slice(0, 3))

            const [myResult, topResult] = await Promise.allSettled([
              scrapeMultiplePosts(postUrls, 20, {
                extractMeta: true,
                blogId: blogId || undefined,
              }),
              topCompetitorUrls.length > 0
                ? scrapeMultiplePosts(topCompetitorUrls, 5)
                : Promise.resolve(null),
            ])

            if (myResult.status === 'fulfilled') {
              scrapedData = myResult.value
              console.log(`[BlogIndex] 포스트 스크래핑 완료: ${scrapedData.size}/${postUrls.length}개 성공`)
              send({ type: 'progress', step: 4, totalSteps, message: `${scrapedData.size}개 포스트 분석 완료` })
            } else {
              console.error('[BlogIndex] 포스트 스크래핑 실패 (폴백 사용):', myResult.reason)
            }

            if (topResult.status === 'fulfilled' && topResult.value) {
              topPostsScrapedData = topResult.value
              console.log(`[BlogIndex] 상위 포스팅 스크래핑 완료: ${topPostsScrapedData.size}/${topCompetitorUrls.length}개`)
            } else if (topResult.status === 'rejected') {
              console.error('[BlogIndex] 상위 포스팅 스크래핑 실패 (무시):', topResult.reason)
            }
          } catch (scrapeError) {
            console.error('[BlogIndex] 스크래핑 실패 (폴백 사용):', scrapeError)
          }
        }

        // === Step 5: 블로그 지수 계산 ===
        send({ type: 'progress', step: 5, totalSteps, message: '블로그 지수 계산 중...' })

        const topicKeywords = posts.length > 0 ? extractKeywordsFromPosts(posts) : []
        const blogCategory = detectBlogCategory(topicKeywords, userKeywords)
        const categoryBenchmark = await getCategoryBenchmark(blogCategory)
        console.log(`[BlogIndex] 카테고리: ${blogCategory} (${BLOG_CATEGORY_LABELS[blogCategory]}, ${categoryBenchmark.source}, 샘플 ${categoryBenchmark.sampleCount}개)`)

        const result = analyzeBlogIndex(
          blogUrl.trim(), posts, keywordResults, isDemo, blogName,
          keywordCompetition.length > 0 ? keywordCompetition : undefined,
          visitorData,
          scrapedData,
          blogProfileData,
          categoryBenchmark.values,
          topPostsScrapedData,
        )

        result.blogCategory = blogCategory
        result.benchmarkSource = categoryBenchmark.source
        result.benchmarkSampleCount = categoryBenchmark.sampleCount

        // === Step 6: 저장 + 크레딧 차감 ===
        send({ type: 'progress', step: 6, totalSteps, message: '결과 저장 중...' })

        await deductCredits(supabase, user.id, 'blog_index', { blogUrl: blogUrl.trim() })

        // 벤치마크 데이터 축적
        if (!isDemo) {
          scheduleCollection(() => accumulateBenchmarkData(blogCategory, result.benchmark, result.totalScore))
        }

        // 히스토리 저장
        let historySaved = false
        try {
          const contentCat = result.categories.find((c: { name: string }) => c.name === '콘텐츠 품질')
          const popCat = result.categories.find((c: { name: string }) => c.name === '방문자 활동')
          const seoCat = result.categories.find((c: { name: string }) => c.name === 'SEO 최적화')
          const trustCat = result.categories.find((c: { name: string }) => c.name === '신뢰도')

          const historyRow = {
            user_id: user.id,
            blog_url: blogUrl.trim(),
            blog_id: blogId || null,
            total_score: result.totalScore,
            search_score: seoCat?.score ?? null,
            popularity_score: popCat?.score ?? null,
            content_score: contentCat?.score ?? null,
            activity_score: trustCat?.score ?? null,
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

        // 최종 결과 전송
        send({ type: 'result', ...result, _historySaved: historySaved })
      } catch (error) {
        console.error('[BlogIndex] 오류:', error)
        send({ type: 'error', error: '블로그 지수 측정 중 오류가 발생했습니다.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  })
}
