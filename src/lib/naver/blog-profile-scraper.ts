/**
 * 네이버 블로그 프로필 스크래퍼
 *
 * 블로그 프로필 페이지에서 총 포스팅 수, 블로그 개설일 추출
 * URL: https://m.blog.naver.com/{blogId}
 */

import type { BlogProfileData } from '@/lib/blog-index/types'

/**
 * 블로그 프로필 페이지 스크래핑
 * 총 포스팅 수, 블로그 개설일(추정)을 추출
 *
 * @param blogId 네이버 블로그 ID
 * @returns 프로필 데이터 (실패 시 모든 필드 null)
 */
export async function scrapeBlogProfile(blogId: string): Promise<BlogProfileData> {
    const fallback: BlogProfileData = {
        totalPostCount: null,
        blogStartDate: null,
        blogAgeDays: null,
    }

    const profileUrl = `https://m.blog.naver.com/${blogId}`

    try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)

        const res = await fetch(profileUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ko-KR,ko;q=0.9',
            },
            redirect: 'follow',
            cache: 'no-store' as RequestCache,
        })

        clearTimeout(timer)

        if (!res.ok) {
            console.warn(`[ProfileScraper] HTTP ${res.status}: ${profileUrl}`)
            return fallback
        }

        const html = await res.text()

        // 총 포스팅 수 추출
        const totalPostCount = extractTotalPostCount(html)

        // 블로그 개설일 추출
        const blogStartDate = extractBlogStartDate(html)

        // 일일 방문자 수 추출 (__INITIAL_STATE__ 내 dayVisitorCount)
        const dayVisitorCount = extractDayVisitorCount(html)

        // 이웃 수 / 구독자 수 추출
        const buddyCount = extractBuddyCount(html)
        const subscriberCount = extractSubscriberCount(html)

        // 블로그 연차 계산
        let blogAgeDays: number | null = null
        if (blogStartDate) {
            const startDate = new Date(blogStartDate)
            if (!isNaN(startDate.getTime())) {
                blogAgeDays = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            }
        }

        console.log(`[ProfileScraper] 프로필 추출: 총 ${totalPostCount ?? '?'}개 포스트, 개설일 ${blogStartDate ?? '추정 불가'}, 연차 ${blogAgeDays ?? '?'}일, 오늘 방문자 ${dayVisitorCount ?? '?'}명, 이웃 ${buddyCount ?? '?'}명, 구독자 ${subscriberCount ?? '?'}명`)

        return { totalPostCount, blogStartDate, blogAgeDays, dayVisitorCount, buddyCount, subscriberCount }
    } catch (err) {
        const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : 'Unknown error'
        console.warn(`[ProfileScraper] 오류: ${errMsg}`)
        return fallback
    }
}

/**
 * HTML에서 총 포스팅 수 추출
 * 네이버 블로그 프로필 페이지의 여러 패턴을 시도
 */
function extractTotalPostCount(html: string): number | null {
    const patterns = [
        // __INITIAL_STATE__ 내 JSON 패턴 (가장 신뢰도 높음)
        /"postCount"\s*:\s*(\d+)/,
        // 기존 패턴들
        /게시글\s*(\d[\d,]*)/,
        /전체글\s*\((\d[\d,]*)\)/,
        /전체\s*(?:글|게시글)\s*(\d[\d,]*)/,
        /postCnt["']\s*:\s*(\d+)/,
        /"totalCount"\s*:\s*(\d+)/,
        /글\s*(\d[\d,]*)\s*개/,
    ]

    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
            return parseInt(match[1].replace(/,/g, ''), 10)
        }
    }

    return null
}

/**
 * HTML에서 일일 방문자 수 추출
 * __INITIAL_STATE__ 내 dayVisitorCount 또는 "오늘 N" 텍스트에서 추출
 */
function extractDayVisitorCount(html: string): number | null {
    const patterns = [
        /"dayVisitorCount"\s*:\s*(\d+)/,           // __INITIAL_STATE__ JSON
        /오늘\s+([\d,]+)/,                          // "오늘 6,623" 텍스트
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
            return parseInt(match[1].replace(/,/g, ''), 10)
        }
    }
    return null
}

/**
 * HTML에서 이웃 수 추출
 * __INITIAL_STATE__ 내 buddyCount 또는 "이웃 N" 텍스트에서 추출
 */
function extractBuddyCount(html: string): number | null {
    const patterns = [
        /"buddyCount"\s*:\s*(\d+)/,              // __INITIAL_STATE__ JSON
        /"neighborCount"\s*:\s*(\d+)/,           // 대안 키 이름
        /이웃\s+([\d,]+)/,                         // "이웃 1,234" 텍스트
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
            return parseInt(match[1].replace(/,/g, ''), 10)
        }
    }
    return null
}

/**
 * HTML에서 구독자 수 추출
 * __INITIAL_STATE__ 내 subscriberCount 관련 패턴에서 추출
 */
function extractSubscriberCount(html: string): number | null {
    const patterns = [
        /"subscriberCount"\s*:\s*(\d+)/,         // __INITIAL_STATE__ JSON
        /"followerCount"\s*:\s*(\d+)/,           // 대안 키 이름
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
            return parseInt(match[1].replace(/,/g, ''), 10)
        }
    }
    return null
}

/**
 * 네이버 검색 API를 이용해 블로그의 실제 최초 포스팅 날짜 조회
 *
 * 전략: sort=date (최신순)으로 검색 후 start를 높여서 가장 오래된 포스트에 접근
 * - totalPostCount <= 1100: 정확한 최초 포스팅 날짜 취득 가능
 * - totalPostCount > 1100: API start 한계(1000)로 근사값만 취득
 *
 * @returns { date: string (YYYYMMDD), accurate: boolean } | null
 */
export async function fetchOldestPostDate(
  blogId: string,
  totalPostCount?: number | null,
): Promise<{ date: string; accurate: boolean } | null> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null

  try {
    const total = totalPostCount ?? 0

    // 1차: sort=date로 검색해서 total 확인 (blogId로 검색, 해당 블로그 필터링)
    const firstRes = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(blogId)}&display=10&start=1&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      },
    )

    if (!firstRes.ok) return null
    const firstData = await firstRes.json()
    const searchTotal = firstData.total || 0

    // 검색 결과에서 해당 블로그 포스트 비율 확인 (쿼리가 blogId이므로 다른 블로그도 포함될 수 있음)
    const firstItems = (firstData.items || []) as Array<{ link: string; bloggerlink?: string; postdate?: string }>
    const blogPattern = new RegExp(`blog\\.naver\\.com/${blogId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    const matchRate = firstItems.length > 0
      ? firstItems.filter(item => blogPattern.test(item.link)).length / firstItems.length
      : 0

    // 해당 블로그 글이 거의 없으면 (매칭률 30% 미만) 포기
    if (matchRate < 0.3 && firstItems.length >= 5) {
      console.log(`[OldestPost] 검색 매칭률 낮음 (${Math.round(matchRate * 100)}%), 스킵`)
      return null
    }

    // 실제 접근 가능한 최대 범위 계산
    // 검색 총 결과 수에서 해당 블로그 비율로 추정
    const estimatedBlogPosts = total > 0 ? total : Math.round(searchTotal * matchRate)

    let start: number
    let accurate: boolean

    if (estimatedBlogPosts <= 100) {
      // 한 페이지에 다 들어옴 - 같은 결과에서 마지막 것 사용
      start = 1
      accurate = true
    } else if (estimatedBlogPosts <= 1100) {
      // API로 최초 포스팅까지 도달 가능
      // 검색 결과에서 해당 블로그 비율을 고려해 start 계산
      const adjustedStart = matchRate > 0 ? Math.round(estimatedBlogPosts / matchRate) - 99 : estimatedBlogPosts - 99
      start = Math.max(1, Math.min(adjustedStart, 1000))
      accurate = true
    } else {
      // 1100개 초과 - 최대한 뒤로 가지만 정확하지 않음
      start = 901
      accurate = false
    }

    // 2차: 마지막 페이지 조회
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(blogId)}&display=100&start=${start}&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      },
    )

    if (!res.ok) return null
    const data = await res.json()
    const items = (data.items || []) as Array<{ link: string; bloggerlink?: string; postdate?: string }>

    // 해당 블로그 포스트만 필터링
    const blogPosts = items.filter(item => blogPattern.test(item.link))

    if (blogPosts.length === 0) return null

    // sort=date는 최신순 → 마지막 항목이 가장 오래된 포스트
    const oldestPost = blogPosts[blogPosts.length - 1]
    const postdate = oldestPost.postdate

    if (postdate && /^\d{8}$/.test(postdate)) {
      console.log(`[OldestPost] 최초 포스팅일: ${postdate} (${accurate ? '정확' : '근사'}, 총 ${estimatedBlogPosts}개 추정)`)
      return { date: postdate, accurate }
    }

    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown'
    console.warn(`[OldestPost] 최초 포스팅일 조회 실패: ${msg}`)
    return null
  }
}

/**
 * HTML에서 블로그 개설일 추출 (추정)
 * 프로필 페이지에 명시된 날짜 정보를 찾음
 */
function extractBlogStartDate(html: string): string | null {
    // 1) __INITIAL_STATE__ JSON에서 ISO 날짜 형식 필드 추출 (가장 신뢰도 높음)
    const jsonDatePatterns = [
        /"blogStart(?:Date)?"\s*:\s*"(\d{4}-\d{2}-\d{2})/,
        /"createDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/,
        /"createYmdt"\s*:\s*"(\d{4}-\d{2}-\d{2})/,
        /"blogCreateYmdt"\s*:\s*"(\d{4}-\d{2}-\d{2})/,
        /"openDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/,
        /"blogOpenDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/,
        /"firstPublishDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/,
    ]

    for (const pattern of jsonDatePatterns) {
        const match = html.match(pattern)
        if (match && match[1]) {
            const [y, m, d] = match[1].split('-').map(Number)
            if (y >= 2000 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return match[1]
            }
        }
    }

    // 2) 텍스트 패턴에서 추출
    const textPatterns = [
        /(?:시작일|개설일|since)\s*[:：]?\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/i,
        /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*(?:부터|~|개설)/,
    ]

    for (const pattern of textPatterns) {
        const match = html.match(pattern)
        if (match && match[1] && match[2] && match[3]) {
            const year = parseInt(match[1], 10)
            const month = parseInt(match[2], 10)
            const day = parseInt(match[3], 10)
            if (year >= 2000 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            }
        }
    }

    return null
}
