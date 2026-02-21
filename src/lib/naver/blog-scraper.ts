/**
 * 네이버 블로그 본문 스크래퍼
 *
 * 2단계 파이프라인:
 * 1단계: RSS/검색 API로 포스트 목록 수집 (기존)
 * 2단계: 모바일 URL로 개별 포스트 본문 파싱 (신규)
 *
 * 특징:
 * - 모바일 URL은 데스크탑보다 HTML이 가볍고 파싱이 쉬움
 * - 500ms Rate Limiting으로 네이버 차단 방지
 * - 429 응답 시 백오프 재시도 (최대 2회)
 * - 인메모리 캐시로 24시간 중복 요청 방지
 * - 태그/카테고리/링크 메타 데이터 추출
 */

import { checkCrawlCacheBatch, setCrawlCache, getCrawlCacheStats } from './crawl-cache'
import { extractPostMetaData, type PostMetaData } from './post-meta-extractor'

export interface ScrapedPostData {
    charCount: number    // 실제 본문 글자수
    imageCount: number   // 실제 이미지 개수
    hasImage: boolean
    isScrapped: true     // 스크래핑 성공 여부 (폴백과 구분)
    meta?: PostMetaData  // 메타 데이터 (태그, 카테고리, 링크 분석)
}

/**
 * 네이버 블로그 포스트 링크 → 모바일 URL 변환
 *
 * 지원 형식:
 * - https://blog.naver.com/blogId/123456
 * - https://blog.naver.com/PostView.naver?blogId=xxx&logNo=123456
 * - <![CDATA[https://...]]> (RSS 피드)
 */
export function toMobileUrl(link: string): string | null {
    try {
        // CDATA 제거 (RSS 피드에서 오는 경우)
        let cleanLink = link.trim()
        if (cleanLink.startsWith('<![CDATA[')) {
            cleanLink = cleanLink.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
        }

        const url = new URL(cleanLink)

        // 형식 1: /blogId/logNo 경로
        const pathMatch = url.pathname.match(/^\/([^/]+)\/(\d+)$/)
        if (pathMatch) {
            return `https://m.blog.naver.com/${pathMatch[1]}/${pathMatch[2]}`
        }

        // 형식 2: PostView.naver?blogId=xxx&logNo=123456
        const blogId = url.searchParams.get('blogId')
        const logNo = url.searchParams.get('logNo')
        if (blogId && logNo) {
            return `https://m.blog.naver.com/${blogId}/${logNo}`
        }

        return null
    } catch {
        return null
    }
}

/**
 * 모바일 블로그 HTML에서 본문 텍스트와 이미지 수 추출
 *
 * 네이버 블로그 에디터 유형:
 * - SmartEditor 3: .se-main-container (div 깊이 추적으로 정확한 범위 추출)
 * - 구형 에디터: #postViewArea, .post-view
 */
function parsePostHtml(html: string): { charCount: number; imageCount: number } {
    // 이미지 카운트 (전체 HTML에서)
    const imgMatches = html.match(/<img[\s>]/gi)
    const imageCount = imgMatches ? imgMatches.length : 0

    let bodyHtml = ''

    // SmartEditor 3: div 깊이 추적으로 se-main-container 전체 범위 추출
    const seContainerIdx = html.indexOf('se-main-container')
    if (seContainerIdx > -1) {
        const divStart = html.lastIndexOf('<div', seContainerIdx)
        const contentStart = html.indexOf('>', divStart) + 1

        // 중첩 div를 추적하여 올바른 닫힘 위치 찾기
        let depth = 1
        let pos = contentStart
        while (depth > 0 && pos < html.length) {
            const nextOpen = html.indexOf('<div', pos)
            const nextClose = html.indexOf('</div>', pos)

            if (nextClose === -1) break

            if (nextOpen !== -1 && nextOpen < nextClose) {
                depth++
                pos = nextOpen + 4
            } else {
                depth--
                if (depth === 0) {
                    bodyHtml = html.substring(contentStart, nextClose)
                }
                pos = nextClose + 6
            }
        }
    }

    // 구형 에디터 폴백
    if (!bodyHtml) {
        const postViewIdx = html.indexOf('id="postViewArea"') !== -1
            ? html.indexOf('id="postViewArea"')
            : html.indexOf('class="post-view')
        if (postViewIdx > -1) {
            const divStart = html.lastIndexOf('<div', postViewIdx)
            const contentStart = html.indexOf('>', divStart) + 1
            let depth = 1
            let pos = contentStart
            while (depth > 0 && pos < html.length) {
                const nextOpen = html.indexOf('<div', pos)
                const nextClose = html.indexOf('</div>', pos)
                if (nextClose === -1) break
                if (nextOpen !== -1 && nextOpen < nextClose) {
                    depth++
                    pos = nextOpen + 4
                } else {
                    depth--
                    if (depth === 0) bodyHtml = html.substring(contentStart, nextClose)
                    pos = nextClose + 6
                }
            }
        }
    }

    // 최종 폴백: 스크립트/스타일/헤더/푸터 제거
    if (!bodyHtml) {
        bodyHtml = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    }

    // HTML 태그 제거 후 순수 텍스트
    const text = bodyHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    return { charCount: text.length, imageCount }
}

/** 요청 간 딜레이 (ms) - 네이버 차단 방지 */
const REQUEST_DELAY_MS = 500

/** 딜레이 유틸리티 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 단일 포스트 본문 스크래핑 (재시도 로직 포함)
 * - 4초 타임아웃
 * - 429 응답 시 백오프 재시도 (최대 2회)
 * - 실패 시 null 반환 (폴백 처리는 호출부에서)
 *
 * @param link 블로그 포스트 URL
 * @param options.maxRetries 최대 재시도 횟수 (기본: 2)
 * @param options.extractMeta 메타 데이터 추출 여부 (기본: false)
 * @param options.blogId 블로그 ID (메타 추출 시 내부 링크 판별용)
 */
export async function scrapeBlogPost(
    link: string,
    options?: { maxRetries?: number; extractMeta?: boolean; blogId?: string }
): Promise<ScrapedPostData | null> {
    const mobileUrl = toMobileUrl(link)
    if (!mobileUrl) {
        console.warn(`[Scraper] URL 변환 실패: ${link}`)
        return null
    }

    const maxRetries = options?.maxRetries ?? 2
    const extractMeta = options?.extractMeta ?? false

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)  // 10초 타임아웃

        try {
            const res = await fetch(mobileUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'ko-KR,ko;q=0.9',
                },
                redirect: 'follow',
                cache: 'no-store' as RequestCache,  // Next.js fetch 캐시 우회
            })

            // 429 Too Many Requests → 백오프 후 재시도
            if (res.status === 429) {
                clearTimeout(timer)
                if (attempt < maxRetries) {
                    const backoffMs = 2000 * (attempt + 1) // 2초, 4초
                    console.warn(`[Scraper] 429 응답, ${backoffMs}ms 후 재시도 (${attempt + 1}/${maxRetries})`)
                    await delay(backoffMs)
                    continue
                }
                return null
            }

            if (!res.ok) {
                console.warn(`[Scraper] HTTP ${res.status}: ${mobileUrl}`)
                return null
            }

            const html = await res.text()
            const { charCount, imageCount } = parsePostHtml(html)
            console.log(`[Scraper] 파싱 성공: ${charCount}자, ${imageCount}이미지 ← ${mobileUrl}`)

            const result: ScrapedPostData = {
                charCount,
                imageCount,
                hasImage: imageCount > 0,
                isScrapped: true,
            }

            // 메타 데이터 추출 (선택적)
            if (extractMeta) {
                result.meta = extractPostMetaData(html, options?.blogId)
            }

            return result
        } catch (err) {
            // AbortError(타임아웃) 또는 네트워크 오류
            const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : 'Unknown error'
            console.warn(`[Scraper] 오류 (attempt ${attempt + 1}/${maxRetries + 1}): ${errMsg} ← ${mobileUrl}`)
            if (attempt < maxRetries) {
                await delay(1000 * (attempt + 1))
                continue
            }
            return null
        } finally {
            clearTimeout(timer)
        }
    }

    return null
}

/**
 * 여러 포스트 순차 스크래핑 (Rate Limiting + 캐시 적용)
 * - 최대 maxCount개만 처리 (최신 포스트 우선)
 * - 캐시 히트 시 네이버 재요청 없이 즉시 반환
 * - 캐시 미스만 순차적으로 크롤링 (500ms 딜레이)
 * - 일부 실패해도 계속 진행
 * - 반환: link → ScrapedPostData 맵
 *
 * @param links 블로그 포스트 URL 배열
 * @param maxCount 스크래핑할 최대 포스트 수 (기본: 10)
 * @param options.extractMeta 메타 데이터 추출 여부
 * @param options.blogId 블로그 ID
 */
export async function scrapeMultiplePosts(
    links: string[],
    maxCount = 10,
    options?: { extractMeta?: boolean; blogId?: string }
): Promise<Map<string, ScrapedPostData>> {
    const targets = links.slice(0, maxCount)

    // 1단계: 캐시에서 먼저 조회
    const { cached, uncached } = checkCrawlCacheBatch(targets)
    const map = new Map<string, ScrapedPostData>(cached)

    const stats = getCrawlCacheStats()
    if (cached.size > 0) {
        console.log(`[Scraper] 캐시 히트: ${cached.size}/${targets.length}개 (캐시 크기: ${stats.size}/${stats.maxSize})`)
    }

    // 2단계: 캐시 미스만 순차 크롤링
    for (let i = 0; i < uncached.length; i++) {
        const link = uncached[i]
        try {
            const result = await scrapeBlogPost(link, options)
            if (result) {
                map.set(link, result)
                setCrawlCache(link, result)  // 캐시에 저장
            }
        } catch {
            // 개별 실패는 무시하고 계속 진행
        }

        // 마지막 요청 후에는 딜레이 불필요
        if (i < uncached.length - 1) {
            await delay(REQUEST_DELAY_MS)
        }
    }

    return map
}
