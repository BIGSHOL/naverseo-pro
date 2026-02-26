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
 * HTML에서 블로그 개설일 추출 (추정)
 * 프로필 페이지에 명시된 날짜 정보를 찾음
 */
function extractBlogStartDate(html: string): string | null {
    const patterns = [
        // "블로그 시작일" 또는 "개설일" 관련
        /(?:시작일|개설일|since)\s*[:：]?\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/i,
        // "YYYY.MM.DD부터" 패턴
        /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*(?:부터|~|개설)/,
        // JSON 데이터 내 blogStart 관련
        /"blogStart(?:Date)?"\s*:\s*"(\d{4}-\d{2}-\d{2})"/,
    ]

    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
            if (match[1] && match[1].includes('-') && match[1].length === 10) {
                return match[1] // YYYY-MM-DD 형식
            }
            if (match[1] && match[2] && match[3]) {
                const year = parseInt(match[1], 10)
                const month = parseInt(match[2], 10)
                const day = parseInt(match[3], 10)
                if (year >= 2000 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                }
            }
        }
    }

    return null
}
