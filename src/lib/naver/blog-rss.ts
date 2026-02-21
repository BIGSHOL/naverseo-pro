/**
 * 네이버 블로그 RSS 피드 모듈
 *
 * 블로그의 RSS 피드를 통해 최신 포스트 목록을 조회합니다.
 * - URL: https://rss.blog.naver.com/{blogId}.xml
 * - 인증 불필요, 공개 엔드포인트
 * - 최신 10~30개 포스트 제공 (블로그 설정에 따라 다름)
 *
 * 활용 시나리오:
 * - 경쟁 블로그의 포스팅 빈도 분석 (주간/월간 발행 수)
 * - 콘텐츠 캘린더에서 경쟁사 발행 일정 모니터링
 * - 순위 트래킹 대상 블로그의 신규 글 감지
 * - 블로그 지수 분석 시 정확한 포스트 목록 확보
 */

/** RSS 피드에서 파싱된 블로그 포스트 */
export interface RssPost {
    title: string
    link: string
    description: string    // HTML 포함 가능
    pubDate: string        // YYYYMMDD 형식 (변환 완료)
    rawPubDate: string     // 원본 날짜 문자열 (예: "Mon, 20 Feb 2026 03:00:00 +0900")
}

/** RSS 피드 조회 결과 */
export interface RssFeedResult {
    blogName: string | null       // 블로그 이름
    blogDescription: string | null // 블로그 소개
    posts: RssPost[]
    isAvailable: boolean          // RSS 활성화 여부
    totalPosts: number            // 조회된 포스트 수
}

/** 포스팅 빈도 분석 결과 */
export interface PostingFrequencyAnalysis {
    postsPerWeek: number          // 주간 평균 포스팅 수
    postsPerMonth: number         // 월간 평균 포스팅 수
    lastPostDaysAgo: number | null // 최근 포스트가 며칠 전인지
    isActive: boolean             // 최근 30일 내 포스팅 여부
    regularity: 'very-regular' | 'regular' | 'irregular' | 'inactive'
    analysisNote: string          // 분석 요약 코멘트
}

/**
 * 네이버 블로그 RSS 피드 조회
 * @param blogId 네이버 블로그 ID (예: "myblog123")
 * @returns RssFeedResult (RSS 비활성화 시 isAvailable: false)
 */
export async function fetchBlogRss(blogId: string): Promise<RssFeedResult> {
    const emptyResult: RssFeedResult = {
        blogName: null,
        blogDescription: null,
        posts: [],
        isAvailable: false,
        totalPosts: 0,
    }

    try {
        const url = `https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000) // 5초 타임아웃

        const res = await fetch(url, {
            headers: { 'User-Agent': 'NaverSEO-Pro/1.0' },
            signal: controller.signal,
        })

        clearTimeout(timer)

        if (!res.ok) {
            // 404 = RSS 비활성화, 그 외 = 서버 오류
            if (res.status === 404) {
                console.log(`[RSS] 블로그 "${blogId}"의 RSS가 비활성화되어 있습니다.`)
            } else {
                console.error(`[RSS] HTTP 오류: ${res.status}`)
            }
            return emptyResult
        }

        const xml = await res.text()

        // XML인지 확인 (HTML 응답이 오는 경우 방어)
        if (!xml.includes('<rss') && !xml.includes('<channel>')) {
            console.error('[RSS] 유효하지 않은 RSS 응답')
            return emptyResult
        }

        const blogName = extractChannelField(xml, 'title')
        const blogDescription = extractChannelField(xml, 'description')
        const posts = parseRssItems(xml)

        return {
            blogName,
            blogDescription,
            posts,
            isAvailable: true,
            totalPosts: posts.length,
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[RSS] 타임아웃 (5초)')
        } else {
            console.error('[RSS] 조회 실패:', error)
        }
        return emptyResult
    }
}

/**
 * 여러 블로그의 RSS를 병렬 조회 (경쟁 블로그 모니터링용)
 * @param blogIds 블로그 ID 배열
 * @returns blogId → RssFeedResult 맵
 */
export async function fetchMultipleBlogRss(
    blogIds: string[]
): Promise<Map<string, RssFeedResult>> {
    const results = await Promise.allSettled(
        blogIds.map((id) => fetchBlogRss(id))
    )

    const map = new Map<string, RssFeedResult>()
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            map.set(blogIds[i], result.value)
        }
    })

    return map
}

/**
 * RSS 데이터로 포스팅 빈도 분석
 * @param rssResult fetchBlogRss() 결과
 * @returns PostingFrequencyAnalysis
 */
export function analyzePostingFrequency(rssResult: RssFeedResult): PostingFrequencyAnalysis {
    const noData: PostingFrequencyAnalysis = {
        postsPerWeek: 0,
        postsPerMonth: 0,
        lastPostDaysAgo: null,
        isActive: false,
        regularity: 'inactive',
        analysisNote: 'RSS 데이터가 없거나 비활성화됨',
    }

    if (!rssResult.isAvailable || rssResult.posts.length === 0) {
        return noData
    }

    const now = new Date()
    const posts = rssResult.posts

    // 날짜 파싱 (YYYYMMDD → Date)
    const dates = posts
        .map((p) => parseDateYYYYMMDD(p.pubDate))
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime()) // 최신순

    if (dates.length === 0) return noData

    const lastPostDaysAgo = Math.floor((now.getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24))
    const isActive = lastPostDaysAgo <= 30

    // 기간 계산 (첫 포스트 ~ 마지막 포스트)
    const spanDays = Math.max(1,
        Math.floor((dates[0].getTime() - dates[dates.length - 1].getTime()) / (1000 * 60 * 60 * 24))
    )

    const postsPerWeek = Math.round((dates.length / spanDays) * 7 * 10) / 10
    const postsPerMonth = Math.round((dates.length / spanDays) * 30 * 10) / 10

    // 규칙성 판단: 포스팅 간격의 표준편차 기반
    let regularity: PostingFrequencyAnalysis['regularity'] = 'inactive'
    let analysisNote = ''

    if (!isActive) {
        regularity = 'inactive'
        analysisNote = `최근 ${lastPostDaysAgo}일간 포스팅 없음`
    } else if (postsPerWeek >= 3) {
        regularity = 'very-regular'
        analysisNote = `주 ${postsPerWeek}회 포스팅, 매우 활발한 블로그`
    } else if (postsPerWeek >= 1) {
        regularity = 'regular'
        analysisNote = `주 ${postsPerWeek}회 포스팅, 꾸준한 활동`
    } else {
        regularity = 'irregular'
        analysisNote = `월 ${postsPerMonth}회 포스팅, 비정기적 활동`
    }

    return {
        postsPerWeek,
        postsPerMonth,
        lastPostDaysAgo,
        isActive,
        regularity,
        analysisNote,
    }
}

// ===== 내부 헬퍼 함수 =====

/** RSS XML에서 <channel> 내 특정 필드 추출 */
function extractChannelField(xml: string, field: string): string | null {
    // <channel> 내의 필드 (첫 번째 <item> 이전)
    const channelMatch = xml.match(/<channel>([\s\S]*?)<item>/)
    if (!channelMatch) return null

    const channelXml = channelMatch[1]

    // CDATA 형식
    const cdataMatch = channelXml.match(
        new RegExp(`<${field}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${field}>`)
    )
    if (cdataMatch) return cdataMatch[1].trim()

    // 일반 형식
    const plainMatch = channelXml.match(
        new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`)
    )
    if (plainMatch) return plainMatch[1].trim()

    return null
}

/** RSS XML에서 모든 <item> 파싱 */
function parseRssItems(xml: string): RssPost[] {
    const posts: RssPost[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let itemMatch: RegExpExecArray | null

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const itemXml = itemMatch[1]

        // 제목 (CDATA 또는 일반)
        const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
            || itemXml.match(/<title>([\s\S]*?)<\/title>/)
        const title = titleMatch ? titleMatch[1].trim() : ''

        // 링크
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/)
        const link = linkMatch ? linkMatch[1].trim() : ''

        // 설명 (CDATA 또는 일반)
        const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)
            || itemXml.match(/<description>([\s\S]*?)<\/description>/)
        const description = descMatch ? descMatch[1].trim() : ''

        // 날짜
        const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
        const rawPubDate = dateMatch ? dateMatch[1].trim() : ''
        const pubDate = convertToYYYYMMDD(rawPubDate)

        if (title) {
            posts.push({ title, link, description, pubDate, rawPubDate })
        }
    }

    return posts
}

/** RFC 2822 날짜 → YYYYMMDD 변환 */
function convertToYYYYMMDD(dateStr: string): string {
    if (!dateStr) return ''
    try {
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return ''
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}${m}${day}`
    } catch {
        return ''
    }
}

/** YYYYMMDD → Date 변환 */
function parseDateYYYYMMDD(dateStr: string): Date | null {
    if (!dateStr || dateStr.length !== 8) return null
    const y = parseInt(dateStr.substring(0, 4))
    const m = parseInt(dateStr.substring(4, 6)) - 1
    const d = parseInt(dateStr.substring(6, 8))
    return new Date(y, m, d)
}
