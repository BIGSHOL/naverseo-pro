// 네이버 블로그 검색 API - 순위 트래킹용

import { extractBlogId } from '@/lib/utils/text'

export interface NaverBlogSearchItem {
  title: string
  link: string
  description: string
  bloggername: string
  bloggerlink: string
  postdate: string
}

interface NaverBlogSearchResponse {
  lastBuildDate: string
  total: number
  start: number
  display: number
  items: NaverBlogSearchItem[]
}

// 네이버 블로그 검색 (최대 100개까지 조회)
export async function searchNaverBlog(
  query: string,
  display: number = 100,
  start: number = 1
): Promise<NaverBlogSearchResponse> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error('네이버 검색 API 키가 설정되지 않았습니다.')
  }

  const params = new URLSearchParams({
    query,
    display: String(Math.min(display, 100)),
    start: String(start),
    sort: 'sim', // 정확도순 (네이버 기본 랭킹)
  })

  const response = await fetch(
    `https://openapi.naver.com/v1/search/blog.json?${params.toString()}`,
    {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Naver Blog Search] 오류:', response.status, errorText)
    throw new Error(`네이버 블로그 검색 오류: ${response.status}`)
  }

  return response.json()
}

// 키워드로 검색하여 특정 블로그의 순위 확인
export async function checkBlogRank(
  keyword: string,
  blogUrl: string
): Promise<{ rank: number | null; section: string | null; totalResults: number }> {
  const blogId = extractBlogId(blogUrl)

  // blogId가 없으면 URL 자체로 매칭 시도
  const matchTarget = blogId
    ? blogId.toLowerCase()
    : blogUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')

  try {
    const result = await searchNaverBlog(keyword, 100)

    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i]
      const itemLink = item.link.toLowerCase()
      const bloggerLink = item.bloggerlink.toLowerCase()

      // 블로그 ID로 매칭 (가장 정확)
      if (blogId) {
        // blog.naver.com/blogId 또는 blog.naver.com/blogId/ 뒤에 숫자(포스트ID)만 허용
        // includes()는 "myblog"가 "myblog2"에도 매칭되므로 정규식으로 엄격 매칭
        const blogIdPattern = new RegExp(`blog\\.naver\\.com/${matchTarget}(?:/[0-9]*)?(?:\\?|$)`, 'i')
        if (
          blogIdPattern.test(itemLink) ||
          blogIdPattern.test(bloggerLink)
        ) {
          return {
            rank: i + 1,
            section: 'blog',
            totalResults: result.total,
          }
        }
      } else {
        // URL 전체 매칭 (호스트+경로 기준)
        const normalizedItem = itemLink.replace(/^https?:\/\//, '').replace(/\/$/, '')
        const normalizedBlogger = bloggerLink.replace(/^https?:\/\//, '').replace(/\/$/, '')
        if (
          normalizedItem.startsWith(matchTarget) ||
          normalizedBlogger.startsWith(matchTarget)
        ) {
          return {
            rank: i + 1,
            section: 'blog',
            totalResults: result.total,
          }
        }
      }
    }

    // 100위 안에 없음
    return { rank: null, section: null, totalResults: result.total }
  } catch (error) {
    console.error('[RankCheck] 오류:', error)
    throw error
  }
}

// 데모 순위 결과 생성
export function generateDemoRank(): {
  rank: number | null
  section: string | null
  totalResults: number
} {
  const rand = Math.random()
  // 현실적 분포: 40% 100위 밖, 25% 50~100위, 20% 10~50위, 15% 상위 10위
  if (rand < 0.4) {
    return { rank: null, section: null, totalResults: Math.floor(Math.random() * 50000) + 5000 }
  } else if (rand < 0.65) {
    return {
      rank: Math.floor(Math.random() * 50) + 51,
      section: 'blog',
      totalResults: Math.floor(Math.random() * 50000) + 5000,
    }
  } else if (rand < 0.85) {
    return {
      rank: Math.floor(Math.random() * 40) + 11,
      section: 'blog',
      totalResults: Math.floor(Math.random() * 50000) + 5000,
    }
  } else {
    return {
      rank: Math.floor(Math.random() * 10) + 1,
      section: 'blog',
      totalResults: Math.floor(Math.random() * 50000) + 5000,
    }
  }
}
