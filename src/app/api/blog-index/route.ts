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
    const isDemo = !hasNaverApi

    if (!hasNaverApi) {
      // 데모 모드
      const blogId = blogUrl.trim().replace(/.*\//, '') || 'demo_blog'
      posts = generateDemoPosts(blogId)
      keywordResults = generateDemoKeywordResults(keywords)
    } else {
      // 실제 API 호출
      const { searchNaverBlog, extractBlogId } = await import(
        '@/lib/naver/blog-search'
      )
      const blogId = extractBlogId(blogUrl.trim())
      const matchTarget = blogId
        ? blogId.toLowerCase()
        : blogUrl
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')

      // 1. 블로그 포스트 가져오기 (블로그 ID로 검색)
      try {
        const blogSearchQuery = blogId || blogUrl.trim()
        const postResult = await searchNaverBlog(blogSearchQuery, 30)
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
            const normalizedLink = link.replace(/^https?:\/\//, '').replace(/\/$/, '')
            return normalizedLink.startsWith(matchTarget)
          })
          .map((item) => ({
            title: item.title,
            link: item.link,
            description: item.description,
            postdate: item.postdate,
          }))
      } catch {
        posts = []
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
    const result = analyzeBlogIndex(blogUrl.trim(), posts, keywordResults, isDemo)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[BlogIndex] 오류:', error)
    return NextResponse.json(
      { error: '블로그 지수 측정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
