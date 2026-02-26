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
 * 블로그의 실제 최초 포스팅 날짜 조회
 *
 * 전략 1 (1순위): PostTitleListAsync — 블로그 자체 포스트 목록의 마지막 페이지 조회
 *   - 해당 블로그 글만 100% 정확하게 조회 (다른 블로그 혼입 없음)
 *   - totalPostCount 필요
 *
 * 전략 2 (폴백): 네이버 검색 API — blogId를 키워드로 검색
 *   - blogId가 포스트 본문에 없으면 매칭률 낮아서 실패 가능
 *
 * @returns { date: string (YYYYMMDD), accurate: boolean } | null
 */
export async function fetchOldestPostDate(
  blogId: string,
  totalPostCount?: number | null,
): Promise<{ date: string; accurate: boolean } | null> {
  // 전략 1: 블로그 자체 포스트 목록 (가장 신뢰도 높음)
  if (totalPostCount && totalPostCount > 0) {
    try {
      const result = await fetchFromBlogPostList(blogId, totalPostCount)
      if (result) return result
    } catch (err) {
      console.warn('[OldestPost] PostList 실패, 검색 API로 폴백:', err instanceof Error ? err.message : err)
    }
  }

  // 전략 2: 네이버 검색 API 폴백
  return fetchFromSearchApi(blogId, totalPostCount)
}

/**
 * 블로그 자체 PostTitleListAsync 엔드포인트로 마지막 페이지 조회
 * - 해당 블로그의 글 목록을 직접 페이징 → 가장 오래된 글의 날짜 추출
 * - 다른 블로그 혼입 없이 100% 정확
 */
async function fetchFromBlogPostList(
  blogId: string,
  totalPostCount: number,
): Promise<{ date: string; accurate: boolean } | null> {
  const postsPerPage = 30
  const lastPage = Math.ceil(totalPostCount / postsPerPage)

  const url = `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}&currentPage=${lastPage}&countPerPage=${postsPerPage}&categoryNo=0`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'Referer': `https://blog.naver.com/${blogId}`,
    },
  })

  clearTimeout(timer)

  if (!res.ok) {
    console.warn(`[OldestPost] PostList HTTP ${res.status}`)
    return null
  }

  const html = await res.text()

  // PostTitleListAsync 응답에서 날짜 추출
  // 날짜 형식: "2024. 1. 15." 또는 "2024.01.15" 또는 "2024-01-15"
  const datePattern = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/g
  const dates: string[] = []
  let match
  while ((match = datePattern.exec(html)) !== null) {
    const y = parseInt(match[1])
    const m = parseInt(match[2])
    const d = parseInt(match[3])
    if (y >= 2000 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      dates.push(`${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`)
    }
  }

  if (dates.length === 0) {
    console.warn('[OldestPost] PostList에서 날짜 추출 실패')
    return null
  }

  // 오름차순 정렬 → 가장 오래된 날짜
  dates.sort()
  const oldest = dates[0]

  console.log(`[OldestPost] PostList: 최초 포스팅일 ${oldest} (${lastPage}페이지, ${dates.length}개 날짜 파싱)`)
  return { date: oldest, accurate: true }
}

/**
 * 네이버 검색 API로 최초 포스팅 날짜 조회 (폴백)
 * - blogId를 키워드로 검색 → 해당 블로그 글 필터링
 * - blogId가 포스트 본문에 없으면 매칭률 낮아서 실패 가능
 */
async function fetchFromSearchApi(
  blogId: string,
  totalPostCount?: number | null,
): Promise<{ date: string; accurate: boolean } | null> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null

  try {
    const total = totalPostCount ?? 0

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

    const firstItems = (firstData.items || []) as Array<{ link: string; postdate?: string }>
    const blogPattern = new RegExp(`blog\\.naver\\.com/${blogId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    const matchRate = firstItems.length > 0
      ? firstItems.filter(item => blogPattern.test(item.link)).length / firstItems.length
      : 0

    if (matchRate < 0.3 && firstItems.length >= 5) {
      console.log(`[OldestPost] 검색 매칭률 낮음 (${Math.round(matchRate * 100)}%), 스킵`)
      return null
    }

    const estimatedBlogPosts = total > 0 ? total : Math.round(searchTotal * matchRate)

    let start: number
    let accurate: boolean

    if (estimatedBlogPosts <= 100) {
      start = 1
      accurate = true
    } else if (estimatedBlogPosts <= 1100) {
      const adjustedStart = matchRate > 0 ? Math.round(estimatedBlogPosts / matchRate) - 99 : estimatedBlogPosts - 99
      start = Math.max(1, Math.min(adjustedStart, 1000))
      accurate = true
    } else {
      start = 901
      accurate = false
    }

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
    const items = (data.items || []) as Array<{ link: string; postdate?: string }>
    const blogPosts = items.filter(item => blogPattern.test(item.link))

    if (blogPosts.length === 0) return null

    const oldestPost = blogPosts[blogPosts.length - 1]
    const postdate = oldestPost.postdate

    if (postdate && /^\d{8}$/.test(postdate)) {
      console.log(`[OldestPost] SearchAPI: 최초 포스팅일 ${postdate} (${accurate ? '정확' : '근사'}, 총 ${estimatedBlogPosts}개 추정)`)
      return { date: postdate, accurate }
    }

    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown'
    console.warn(`[OldestPost] SearchAPI 실패: ${msg}`)
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
