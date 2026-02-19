import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeBlogIndex,
  generateDemoPosts,
  generateDemoKeywordResults,
  type BlogPost,
  type KeywordRankResult,
} from '@/lib/blog-index/engine'

// 테스트용 기본 키워드 (다양한 경쟁도)
const DEFAULT_TEST_KEYWORDS = [
  '맛집 추천',
  '여행 후기',
  '다이어트 방법',
  '자기계발 책',
  '인테리어 팁',
  '육아 정보',
  '재테크 방법',
  '카페 추천',
]

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

    // 설명 추출
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)
      || itemXml.match(/<description>([\s\S]*?)<\/description>/)
    const rawDesc = descMatch ? descMatch[1].trim() : ''
    // HTML 태그 제거
    const description = rawDesc.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim()

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

    const { blogUrl, testKeywords = [] } = await request.json()

    if (!blogUrl?.trim()) {
      return NextResponse.json(
        { error: '블로그 URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 테스트할 키워드 목록 (사용자 입력 + 기본 키워드)
    const userKeywords = (testKeywords as string[])
      .map((k: string) => k.trim())
      .filter(Boolean)
    const keywords =
      userKeywords.length > 0
        ? userKeywords
        : DEFAULT_TEST_KEYWORDS.slice(0, 5) // 기본 5개

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

      // 1. 블로그 포스트 가져오기 - RSS 피드 사용 (정확한 최신 포스트)
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
          // blogId가 있으면 "site:blog.naver.com/blogId" 형태로 검색 시도
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

      // 2. 키워드별 순위 체크
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

    // 5축 블로그 지수 분석 엔진 실행
    const result = analyzeBlogIndex(blogUrl.trim(), posts, keywordResults, isDemo, blogName)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[BlogIndex] 오류:', error)
    return NextResponse.json(
      { error: '블로그 지수 측정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
