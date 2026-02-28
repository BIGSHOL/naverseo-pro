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

/** 본문 서식 사용 메트릭 (v11) */
export interface FormattingMetrics {
    hasBold: boolean       // 볼드체 사용
    hasHeading: boolean    // 소제목(H2/H3) 사용
    hasFontSize: boolean   // 글자 크기 변경
    hasColor: boolean      // 글자 색상 변경
    hasHighlight: boolean  // 배경색/하이라이트 사용
    hasUnderline: boolean  // 밑줄 사용
    count: number          // 서식 종류 총 개수 (0~6)
}

export interface ScrapedPostData {
    charCount: number    // 실제 본문 글자수
    imageCount: number   // 실제 이미지 개수
    videoCount: number   // 동영상 개수 (네이버 동영상, 유튜브 임베드 등)
    linkCount: number    // 본문 내 링크 개수
    tableCount: number   // 표 개수
    hasImage: boolean
    imageUrls: string[]  // 콘텐츠 이미지 URL 목록 (AI 분석용)
    isScrapped: true     // 스크래핑 성공 여부 (폴백과 구분)
    meta?: PostMetaData  // 메타 데이터 (태그, 카테고리, 링크 분석)
    commentCount: number | null   // v4: 댓글 수 (추출 실패 시 null)
    sympathyCount: number | null  // v4: 공감 수 (추출 실패 시 null)
    readCount: number | null      // v10: 조회수 (추출 실패 시 null)
    formatting?: FormattingMetrics // v11: 서식 사용 메트릭
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
/**
 * 댓글 수 추출 (모바일 HTML에서)
 *
 * 네이버 모바일 블로그 HTML 내 댓글 수 존재 형태:
 * 1. HTML 속성: commentCount="11" (가장 신뢰도 높음)
 * 2. 이스케이프 JSON (JS 내): \"commentCount\":11
 * 3. 순수 JSON: "commentCount": 11
 * 4. 기타 DOM 패턴
 */
function extractCommentCount(html: string): number | null {
    const patterns = [
        /commentCount="(\d+)"/,                          // HTML 속성 (네이버 모바일 실제 패턴)
        /"commentCount"\s*:\s*(\d+)/,                    // 순수 JSON
        /\\?"commentCount\\?"\s*:\s*(\d+)/,              // 이스케이프 JSON
        /["']commentCount["']\s*:\s*["']?(\d+)/,         // 다양한 따옴표 조합
        /comment_count['"]\s*:\s*(\d+)/i,                // snake_case 변형
        /u_cbox_count[^>]*>(\d+)/i,                      // 네이버 댓글 박스 카운트
        /data-comment-count=["'](\d+)["']/i,             // data 속성
        /class="[^"]*comment[^"]*count[^"]*"[^>]*>(\d+)/i, // 댓글 카운트 클래스
        /comment_count["'][^>]*>(\d+)/i,                 // 구형 패턴
        /btn_comment[^>]*>[\s\S]*?(\d+)/i,                 // 댓글 버튼 내 숫자
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) return parseInt(match[1], 10)
    }
    return null
}

/**
 * 공감 수 추출 (모바일 HTML에서)
 *
 * 네이버 모바일 블로그의 공감(좋아요) 수 존재 형태:
 * 1. HTML 속성: sympathyCount="5"
 * 2. 이스케이프 JSON (JS 내): \"sympathyCount\":5
 * 3. 순수 JSON: "sympathyCount": 5
 * 4. likeCount 변형 패턴
 *
 * 주의: 공감 수는 동적 로딩(Like API)되는 경우가 많아
 * 정적 HTML에서 추출 실패할 수 있음 → null 반환 → 중립 점수 부여
 */
function extractSympathyCount(html: string): number | null {
    const patterns = [
        /sympathyCount="(\d+)"/,                         // HTML 속성
        /"sympathyCount"\s*:\s*(\d+)/,                   // 순수 JSON
        /\\?"sympathyCount\\?"\s*:\s*(\d+)/,             // 이스케이프 JSON
        /"likeItCount"\s*:\s*(\d+)/,                     // likeItCount 순수 JSON
        /\\?"likeItCount\\?"\s*:\s*(\d+)/,               // likeItCount 이스케이프
        /"reactionCount"\s*:\s*(\d+)/,                   // reactionCount 순수 JSON
        /\\?"reactionCount\\?"\s*:\s*(\d+)/,             // reactionCount 이스케이프
        /area_sympathy[\s\S]{0,200}?(\d+)\s*<\//i,      // 공감 영역 내 숫자 (범위 제한)
        /data-sympathy-count=["'](\d+)["']/i,            // data 속성
        /btn_like[^>]*>[\s\S]*?(\d+)/i,                    // 좋아요 버튼 내 숫자
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) return parseInt(match[1], 10)
    }
    return null
}

/**
 * 조회수 추출 (모바일 HTML에서)
 *
 * 네이버 모바일 블로그의 조회수 존재 형태:
 * 1. JSON: "readCount": 123 또는 "readCnt": 123
 * 2. HTML 속성: data-read-count="123"
 * 3. 조회 영역 DOM 내 숫자
 */
function extractReadCount(html: string): number | null {
    const patterns = [
        /"readCount"\s*:\s*(\d+)/,                       // 순수 JSON (가장 일반적)
        /\\?"readCount\\?"\s*:\s*(\d+)/,                 // 이스케이프 JSON
        /"readCnt"\s*:\s*(\d+)/,                         // readCnt 변형
        /\\?"readCnt\\?"\s*:\s*(\d+)/,                   // readCnt 이스케이프
        /readCount="(\d+)"/,                             // HTML 속성
        /data-read-count=["'](\d+)["']/i,                // data 속성
        /class="[^"]*read[_-]?count[^"]*"[^>]*>(\d+)/i, // 조회수 클래스
        /view_count[^>]*>[\s\S]*?(\d+)/i,                  // 조회수 영역
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) return parseInt(match[1], 10)
    }
    return null
}

function parsePostHtml(html: string): { charCount: number; imageCount: number; videoCount: number; linkCount: number; tableCount: number; imageUrls: string[]; commentCount: number | null; sympathyCount: number | null; readCount: number | null; formatting: FormattingMetrics } {
    // 이미지 URL 추출 (콘텐츠 이미지만 — UI 아이콘/placeholder 제외)
    // 모바일에서는 data-lazy-src에 실제 URL이 있고 src는 placeholder인 경우가 많음
    const imageUrls: string[] = []
    const seenUrls = new Set<string>()
    const imgTagRegex = /<img[^>]*>/gi
    let imgTagMatch: RegExpExecArray | null
    while ((imgTagMatch = imgTagRegex.exec(html)) !== null) {
        const tag = imgTagMatch[0]
        // data-lazy-src > data-src > src 순으로 실제 이미지 URL 확인
        const srcMatch = tag.match(/data-lazy-src=["']([^"']+)["']/)
            || tag.match(/data-src=["']([^"']+)["']/)
            || tag.match(/\ssrc=["']([^"']+)["']/)
        if (!srcMatch) continue
        const src = srcMatch[1]
        if (src.startsWith('data:')) continue  // placeholder 제외
        // 네이버 블로그 콘텐츠 이미지만 (아이콘/UI 이미지 제외)
        const isContentImage = src.includes('postfiles') || src.includes('blogfiles')
            || src.includes('pstatic.net/mblogthumb') || src.includes('storep-phinf.pstatic.net')
            || /se-image-resource/.test(tag)
        if (isContentImage && !seenUrls.has(src)) {
            seenUrls.add(src)
            imageUrls.push(src)
        }
    }
    // imageCount = 실제 콘텐츠 이미지 수 (imageUrls 표시 개수와 일치)
    const imageCount = imageUrls.length

    // 동영상 카운트 (SE3 컴포넌트 기반 — 중복 방지)
    // SE3에서는 각 동영상이 개별 se-component로 감싸짐
    const componentMatches = html.match(/class="[^"]*\bse-component\b[^"]*"/gi) || []
    let videoCount = 0
    for (const cls of componentMatches) {
        if (/\bse-video\b|\bse-oembed\b/.test(cls)) videoCount++
    }
    // SE3 외 에디터 폴백 (구형 에디터)
    if (videoCount === 0) {
        const html5 = (html.match(/<video[\s>]/gi) || []).length
        const youtube = (html.match(/youtube\.com\/embed/gi) || []).length
        videoCount = html5 + youtube
    }

    // 본문 내 링크 카운트
    const linkMatches = html.match(/<a\s+[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi)
    const linkCount = linkMatches ? linkMatches.length : 0

    // 표 카운트
    const tablePatterns = [/<table[\s>]/gi, /se-table/gi]
    let tableCount = 0
    for (const pattern of tablePatterns) {
        const matches = html.match(pattern)
        if (matches) tableCount += matches.length
    }

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

    // v11: 서식 사용 감지 (bodyHtml에서 태그 제거 전에 수행)
    const hasBold = /<b[\s>]|<strong[\s>]|se-text-paragraph-mark-bold|font-weight:\s*bold|font-weight:\s*[6-9]00/i.test(bodyHtml)
    const hasHeading = /<h[23][\s>]|se-section-title|se-text-heading/i.test(bodyHtml)
    const hasFontSize = /se-fs-fs|font-size:\s*[^;]*[2-9]\d+/i.test(bodyHtml)
    const hasColor = /se-text-paragraph-mark-color|(?:^|[;"\s])color:\s*(?!inherit|currentcolor|transparent|#000|rgb\(0)/im.test(bodyHtml)
    const hasHighlight = /se-text-paragraph-mark-highlight|<mark[\s>]|background-color:\s*(?!transparent|inherit|rgba?\(0)/i.test(bodyHtml)
    const hasUnderline = /<u[\s>]|text-decoration:\s*underline|se-text-paragraph-mark-underline/i.test(bodyHtml)
    const formattingCount = [hasBold, hasHeading, hasFontSize, hasColor, hasHighlight, hasUnderline].filter(Boolean).length
    const formatting: FormattingMetrics = { hasBold, hasHeading, hasFontSize, hasColor, hasHighlight, hasUnderline, count: formattingCount }

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

    // 댓글/공감/조회수 추출 (전체 HTML에서)
    const commentCount = extractCommentCount(html)
    const sympathyCount = extractSympathyCount(html)
    const readCount = extractReadCount(html)

    return { charCount: text.length, imageCount, videoCount, linkCount, tableCount, imageUrls, commentCount, sympathyCount, readCount, formatting }
}

/**
 * 네이버 Like API를 통한 공감(좋아요) 수 조회
 * 정적 HTML에 공감 수가 포함되지 않으므로 별도 API 호출 필요
 *
 * API 형식: q=BLOG[blogId_postNo]
 * 응답 구조: { contents: [{ reactions: [{ reactionType: "like", count: N }] }] }
 *
 * @param contentsId "blogId_postNo" 형식 (예: "mardukas_224130580320")
 * @returns 공감 수 또는 null
 */
async function fetchSympathyFromLikeApi(contentsId: string): Promise<number | null> {
    try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3000) // 3초 타임아웃

        // q=BLOG[contentsId] 형식 (대괄호 URL 인코딩 필수)
        const url = `https://blog.like.naver.com/v1/search/contents?q=BLOG%5B${encodeURIComponent(contentsId)}%5D`
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Referer': 'https://m.blog.naver.com/',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
            },
        })

        clearTimeout(timer)

        if (!res.ok) return null

        const data = await res.json()
        // 응답 구조: { contents: [{ reactions: [{ reactionType: "like", count: N }] }] }
        const reactions = data?.contents?.[0]?.reactions
        if (Array.isArray(reactions) && reactions.length > 0) {
            // 첫 번째 reaction (보통 "like" 타입)의 count 사용
            const count = reactions[0]?.count
            if (typeof count === 'number') return count
        }
        // 레거시 폴백
        const legacyCount = data?.contents?.[0]?.count ?? data?.likeCount ?? null
        if (typeof legacyCount === 'number') return legacyCount
        return null
    } catch {
        return null
    }
}

/**
 * HTML에서 data-likeContentsId 추출
 * 공감 수 Like API 호출에 사용
 */
function extractLikeContentsId(html: string): string | null {
    const match = html.match(/data-likeContentsId=["']([^"']+)["']/)
    return match ? match[1] : null
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
            const { charCount, imageCount, videoCount, linkCount, tableCount, imageUrls, commentCount, sympathyCount, readCount, formatting } = parsePostHtml(html)

            // 공감 수: HTML에서 추출 실패 시 Like API로 폴백
            let finalSympathyCount = sympathyCount
            if (finalSympathyCount === null) {
                const likeContentsId = extractLikeContentsId(html)
                if (likeContentsId) {
                    finalSympathyCount = await fetchSympathyFromLikeApi(likeContentsId)
                }
            }

            console.log(`[Scraper] 파싱 성공: ${charCount}자, ${imageCount}이미지, ${videoCount}동영상, ${linkCount}링크, ${tableCount}표, 댓글${commentCount ?? '?'}, 공감${finalSympathyCount ?? '?'}, 조회${readCount ?? '?'} ← ${mobileUrl}`)

            const result: ScrapedPostData = {
                charCount,
                imageCount,
                videoCount,
                linkCount,
                tableCount,
                hasImage: imageCount > 0,
                imageUrls,
                isScrapped: true,
                commentCount,
                sympathyCount: finalSympathyCount,
                readCount,
                formatting,
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
