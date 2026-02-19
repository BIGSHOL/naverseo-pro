import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeBlogIndex,
  determineLevelInfo,
  generateDemoPosts,
  generateDemoKeywordResults,
  type BlogPost,
  type KeywordRankResult,
} from '@/lib/blog-index/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/blog-index/ai-analyzer'
import { checkAnalysisLimit, incrementAnalysisUsage } from '@/lib/plan-check'

/**
 * 수집된 블로그 포스트 제목에서 검색용 키워드를 자동 추출
 * 빈출 바이그램(2단어 조합) 우선, 부족하면 단일 키워드로 보충
 */
function extractKeywordsFromPosts(posts: BlogPost[]): string[] {
  const stopwords = new Set([
    '그리고', '하지만', '그래서', '때문에', '입니다', '합니다',
    '있습니다', '됩니다', '것입니다', '블로그', '포스팅', '오늘은',
    '안녕하세요', '이번에', '정말', '진짜', '같은', '통해', '대한',
    '위한', '하는', '있는', '되는', '만들기', '사용', '방법', '추천',
    '후기', '리뷰', '정보', '이야기', '소개', '관련', '대해',
  ])

  const wordFreq: Record<string, number> = {}
  const bigramFreq: Record<string, number> = {}

  posts.forEach((p) => {
    const title = p.title.replace(/<[^>]*>/g, '')
    const words = (title.match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || [])
      .map((w) => w.toLowerCase())
      .filter((w) => !stopwords.has(w))

    words.forEach((w) => {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })

    // 인접 단어 바이그램 생성 (더 구체적인 검색 키워드)
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`
      bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1
    }
  })

  const keywords: string[] = []

  // 1단계: 빈도 2회 이상 바이그램 (구체적인 검색어)
  const topBigrams = Object.entries(bigramFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([phrase]) => phrase)
  keywords.push(...topBigrams)

  // 2단계: 바이그램에 포함되지 않은 단일 키워드로 보충
  const usedWords = new Set(topBigrams.flatMap((b) => b.split(' ')))
  const topWords = Object.entries(wordFreq)
    .filter(([word]) => !usedWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5 - keywords.length)
    .map(([word]) => word)
  keywords.push(...topWords)

  return keywords.slice(0, 5)
}

/**
 * 블로그 URL에서 blogId 추출
 */
function extractBlogIdFromUrl(url: string): string | null {
  const match = url.match(
    /(?:blog\.naver\.com|m\.blog\.naver\.com)\/([a-zA-Z0-9_-]+)/
  )
  return match ? match[1] : null
}

/**
 * 네이버 블로그 RSS 피드로 실제 포스트 가져오기
 * RSS URL: https://rss.blog.naver.com/{blogId}.xml
 *
 * 이전 방식(검색 API에 blogId를 키워드로 넣음)은 해당 블로그의 포스트를
 * 찾지 못하는 문제가 있었음. RSS는 해당 블로그의 실제 최근 포스트를 반환.
 */
async function fetchBlogPostsViaRss(blogId: string): Promise<{ posts: BlogPost[]; blogName: string | null }> {
  try {
    const rssUrl = `https://rss.blog.naver.com/${blogId}.xml`
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'NaverSEO-Pro/1.0' },
    })

    if (!res.ok) {
      console.error(`[BlogIndex] RSS 피드 오류: ${res.status}`)
      return { posts: [], blogName: null }
    }

    const xml = await res.text()
    const posts = parseRssXml(xml, blogId)
    const blogName = extractBlogNameFromRss(xml)
    return { posts, blogName }
  } catch (error) {
    console.error('[BlogIndex] RSS 피드 가져오기 실패:', error)
    return { posts: [], blogName: null }
  }
}

/**
 * RSS XML에서 블로그 이름(title) 추출
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function extractBlogNameFromRss(xml: string): string | null {
  // <channel> 내의 <title> (첫 번째 title이 블로그 이름)
  const channelMatch = xml.match(/<channel>([\s\S]*?)<item>/)
  if (channelMatch) {
    const channelXml = channelMatch[1]
    const titleMatch = channelXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
      || channelXml.match(/<title>([\s\S]*?)<\/title>/)
    if (titleMatch) return titleMatch[1].trim()
  }
  return null
}

/**
 * RSS XML을 파싱하여 BlogPost 배열로 변환
 */
function parseRssXml(xml: string, blogId: string): BlogPost[] {
  const posts: BlogPost[] = []

  // <item> 블록 추출
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let itemMatch: RegExpExecArray | null

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1]

    // 제목 추출
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
      || itemXml.match(/<title>([\s\S]*?)<\/title>/)
    const title = titleMatch ? titleMatch[1].trim() : ''

    // 링크 추출
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/)
    const link = linkMatch ? linkMatch[1].trim() : `https://blog.naver.com/${blogId}`

    // 설명 추출 (HTML 원본 보존 - 이미지 태그 감지에 필요)
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)
      || itemXml.match(/<description>([\s\S]*?)<\/description>/)
    const description = descMatch ? descMatch[1].trim() : ''

    // 날짜 추출 (pubDate)
    const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
    let postdate = ''
    if (dateMatch) {
      try {
        const d = new Date(dateMatch[1].trim())
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          postdate = `${y}${m}${day}`
        }
      } catch {
        // 날짜 파싱 실패 시 빈 문자열 유지
      }
    }

    if (title) {
      posts.push({ title, link, description, postdate })
    }
  }

  return posts
}

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
    let blogName: string | null = null
    const isDemo = !hasNaverApi

    // blogId 추출
    const blogId = extractBlogIdFromUrl(blogUrl.trim())

    if (!hasNaverApi) {
      // 데모 모드
      const demoBlogId = blogId || blogUrl.trim().replace(/.*\//, '') || 'demo_blog'
      posts = generateDemoPosts(demoBlogId)
      // 사용자 키워드가 없으면 데모 포스트에서 자동 추출
      const keywords = userKeywords.length > 0
        ? userKeywords
        : extractKeywordsFromPosts(posts)
      keywordResults = generateDemoKeywordResults(keywords)
      blogName = '데모 블로그'
    } else {
      const { searchNaverBlog } = await import('@/lib/naver/blog-search')

      const matchTarget = blogId
        ? blogId.toLowerCase()
        : blogUrl
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')

      // === 1단계: 블로그 포스트 수집 (RSS 우선, 검색 API 폴백) ===
      if (blogId) {
        const rssResult = await fetchBlogPostsViaRss(blogId)
        posts = rssResult.posts
        blogName = rssResult.blogName
        console.log(`[BlogIndex] RSS에서 ${posts.length}개 포스트 수집 (blogId: ${blogId}, name: ${blogName})`)
      } else {
        posts = []
      }

      // RSS에서 포스트를 못 가져온 경우 검색 API 폴백
      if (posts.length === 0) {
        try {
          const searchQuery = blogId
            ? `site:blog.naver.com/${blogId}`
            : blogUrl.trim()
          const postResult = await searchNaverBlog(searchQuery, 30)

          posts = postResult.items
            .filter((item) => {
              const link = item.link.toLowerCase()
              const bloggerlink = item.bloggerlink.toLowerCase()
              if (blogId) {
                const pattern = new RegExp(
                  `blog\\.naver\\.com/${matchTarget}(?:/|$)`,
                  'i'
                )
                return pattern.test(link) || pattern.test(bloggerlink)
              }
              const normalizedLink = link
                .replace(/^https?:\/\//, '')
                .replace(/\/$/, '')
              return normalizedLink.startsWith(matchTarget)
            })
            .map((item) => ({
              title: item.title,
              link: item.link,
              description: item.description,
              postdate: item.postdate,
            }))

          console.log(`[BlogIndex] 검색 API 폴백: ${posts.length}개 포스트 수집`)
        } catch {
          posts = []
        }
      }

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
    }

    // 5축 블로그 지수 분석 엔진 실행 (알고리즘 기반)
    const result = analyzeBlogIndex(blogUrl.trim(), posts, keywordResults, isDemo, blogName)

    // AI 심층 분석 (v2.5) — 알고리즘 분석과 병렬이 아닌 순차 실행 (결과에 보정값 적용)
    try {
      const aiAnalysis = isDemo
        ? generateDemoAiAnalysis()
        : await analyzeWithAi(posts, isDemo)

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
