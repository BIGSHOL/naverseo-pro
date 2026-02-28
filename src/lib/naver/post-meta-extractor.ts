/**
 * 네이버 블로그 포스트 메타 데이터 추출기
 *
 * 블로그 HTML에서 추출 가능한 메타 데이터:
 * - 태그 (해시태그)
 * - 카테고리
 * - 내부/외부 링크 분석
 * - Open Graph 메타 정보
 *
 * 상위노출 분석의 정밀도를 높이기 위해 사용
 */

/** 추출된 포스트 메타 데이터 */
export interface PostMetaData {
    tags: string[]                    // 블로그 태그/해시태그 목록
    category: string | null           // 블로그 카테고리
    linkAnalysis: LinkAnalysis        // 링크 분석 결과
    ogData: OpenGraphData             // OG 메타 정보
}

/** 링크 분석 결과 */
export interface LinkAnalysis {
    totalLinks: number                // 총 링크 수
    internalLinks: InternalLink[]     // 내부 링크 (blog.naver.com)
    externalLinks: ExternalLink[]     // 외부 링크
    internalCount: number
    externalCount: number
    hasNaverMap: boolean              // 네이버 지도 링크 포함 여부
    hasNaverShopping: boolean         // 네이버 쇼핑 링크 포함 여부
    hasYoutubeEmbed: boolean          // 유튜브 임베드 포함 여부
}

/** 내부 링크 (같은 블로그 내) */
export interface InternalLink {
    url: string
    text: string
    isSameBlog: boolean               // 같은 블로그 내부 링크인지
}

/** 외부 링크 */
export interface ExternalLink {
    url: string
    text: string
    domain: string                    // 링크의 도메인
}

/** Open Graph 메타 정보 */
export interface OpenGraphData {
    title: string | null
    description: string | null
    image: string | null
    type: string | null
    url: string | null
}

/**
 * 블로그 포스트 HTML에서 태그 추출
 *
 * 네이버 블로그 태그 위치 (우선순위):
 * 1. JSON 임베딩 (logTagList, postTagList 등 — 모바일 SSR 데이터)
 * 2. DOM 태그 영역 (post_tag, se-tag-area 등)
 * 3. og:keyword / meta keywords
 * 4. 본문 내 #해시태그 (폴백)
 */
export function extractTags(html: string): string[] {
    const tags = new Set<string>()

    // 패턴 1: JSON 임베딩 (네이버 모바일의 SSR/초기 state 데이터)
    // 네이버 모바일 블로그는 태그를 JSON 배열로 페이지에 삽입
    const jsonTagPatterns = [
        /["'](?:logTagList|postTagList|hashTagList|tagList)["']\s*:\s*\[([^\]]+)\]/g,
    ]
    for (const pattern of jsonTagPatterns) {
        let jMatch: RegExpExecArray | null
        while ((jMatch = pattern.exec(html)) !== null) {
            const arr = jMatch[1]
            const strRegex = /["']([^"']{2,30})["']/g
            let sMatch: RegExpExecArray | null
            while ((sMatch = strRegex.exec(arr)) !== null) {
                const t = sMatch[1].replace(/^#/, '').trim()
                if (t.length >= 2 && t.length <= 30) tags.add(t)
            }
        }
    }

    // 패턴 2: 포스트 태그 영역 (데스크톱/모바일 - 다양한 클래스명 대응)
    if (tags.size === 0) {
        const tagAreaPatterns = [
            /<div[^>]*class=["'][^"']*(?:post_tag|tag_area|se-tag-area|post-tag|_postTag|post_tag_area|_tag_list|tag_wrap|chip_tag|se-module-tag|se-section-tag)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<ul[^>]*class=["'][^"']*(?:tag_list|post_tag_list|_tag_list_body)[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi,
        ]

        for (const pattern of tagAreaPatterns) {
            let match: RegExpExecArray | null
            while ((match = pattern.exec(html)) !== null) {
                const tagHtml = match[1]
                // 태그 영역 내의 <a> 태그에서 텍스트 추출
                const linkRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi
                let linkMatch: RegExpExecArray | null
                while ((linkMatch = linkRegex.exec(tagHtml)) !== null) {
                    const tagText = linkMatch[1]
                        .replace(/<[^>]+>/g, '')
                        .replace(/^#/, '')        // # 접두사 제거
                        .trim()
                    if (tagText.length >= 2 && tagText.length <= 30) {
                        tags.add(tagText)
                    }
                }
                // <span> 태그에서도 추출 (모바일에서 span 사용하는 경우)
                const spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/gi
                let spanMatch: RegExpExecArray | null
                while ((spanMatch = spanRegex.exec(tagHtml)) !== null) {
                    const tagText = spanMatch[1]
                        .replace(/<[^>]+>/g, '')
                        .replace(/^#/, '')
                        .trim()
                    if (tagText.length >= 2 && tagText.length <= 30) {
                        tags.add(tagText)
                    }
                }
            }
        }
    }

    // 패턴 3: og:keyword 또는 meta keywords
    if (tags.size === 0) {
        const ogKeywords = html.match(/<meta\s+(?:property|name)=["'](?:og:keyword|keywords)["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:keyword|keywords)["']/i)
        if (ogKeywords) {
            const metaTags = ogKeywords[1].split(/[,，]/).map((t) => t.trim()).filter(Boolean)
            metaTags.forEach((t) => {
                if (t.length >= 2 && t.length <= 30) tags.add(t)
            })
        }
    }

    // 패턴 4: 해시태그 형태 (#태그) - style/script 제거 후 본문 텍스트에서만 검색
    // (전체 HTML에서 검색하면 CSS 색상코드 #004e82, ID 셀렉터 #ct 등이 오탐됨)
    if (tags.size === 0) {
        const bodyText = html
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            // HTML 엔티티 디코딩 (&#x3D; → =, &#39; → ' 등이 #x3D 같은 오탐 방지)
            .replace(/&#x[0-9a-fA-F]+;?/g, ' ')
            .replace(/&#\d+;?/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
        const hashtagRegex = /#([가-힣a-zA-Z0-9_]{2,20})/g
        let hashMatch: RegExpExecArray | null
        while ((hashMatch = hashtagRegex.exec(bodyText)) !== null) {
            const tag = hashMatch[1]
            // hex 색상코드 필터 (3~8자리 hex)
            if (/^[0-9a-fA-F]{3,8}$/.test(tag)) continue
            // HTML 엔티티 잔여물 필터 (x3D, x27 등)
            if (/^x[0-9a-fA-F]{1,4}$/i.test(tag)) continue
            // CSS/HTML 예약어 필터
            if (/^(ct|px|em|rem|vh|vw|nafullscreen|postlist_block|important)$/i.test(tag)) continue
            tags.add(tag)
        }
    }

    return Array.from(tags).slice(0, 30)  // 최대 30개
}

/**
 * 블로그 포스트 HTML에서 카테고리 추출
 */
export function extractCategory(html: string): string | null {
    // 패턴 1: 카테고리 링크
    const catPatterns = [
        /<a[^>]*class="[^"]*(?:blog_category|pcol2|cate)[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
        /<span[^>]*class="[^"]*(?:category_name|cate_name)[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
        /<div[^>]*class="[^"]*(?:post_category|category_area)[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
    ]

    for (const pattern of catPatterns) {
        const match = html.match(pattern)
        if (match) {
            const category = match[1].replace(/<[^>]+>/g, '').trim()
            if (category.length >= 1 && category.length <= 50) {
                return category
            }
        }
    }

    // 패턴 2: article:section 메타 태그
    const sectionMeta = html.match(/<meta\s+property=["']article:section["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']article:section["']/i)
    if (sectionMeta) {
        return sectionMeta[1].trim()
    }

    return null
}

/**
 * 블로그 포스트 HTML에서 링크 분석
 * @param html 블로그 포스트 HTML
 * @param blogId 해당 블로그 ID (내부 링크 판별용)
 */
export function analyzeLinks(html: string, blogId?: string): LinkAnalysis {
    const internalLinks: InternalLink[] = []
    const externalLinks: ExternalLink[] = []

    // 본문 영역에서만 링크 추출 (헤더/푸터/네비게이션 제외)
    const bodyHtml = extractBodySection(html)

    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let match: RegExpExecArray | null

    while ((match = linkRegex.exec(bodyHtml)) !== null) {
        const url = match[1].trim()
        const text = match[2].replace(/<[^>]+>/g, '').trim()

        // javascript:void(0) 등 무효 링크 제외
        if (url.startsWith('javascript:') || url.startsWith('#') || url.length < 5) {
            continue
        }

        try {
            const parsedUrl = url.startsWith('http') ? new URL(url) : null
            if (!parsedUrl) continue

            const domain = parsedUrl.hostname.toLowerCase()

            // 네이버 블로그 내부 링크 판별
            if (domain.includes('blog.naver.com')) {
                const isSameBlog = blogId
                    ? url.toLowerCase().includes(`blog.naver.com/${blogId.toLowerCase()}`)
                    : false
                internalLinks.push({ url, text, isSameBlog })
            } else {
                externalLinks.push({ url, text, domain })
            }
        } catch {
            // URL 파싱 실패 → 무시
        }
    }

    // 특수 링크 감지
    const hasNaverMap = /(?:map\.naver\.com|m?\.?place\.naver\.com)/i.test(bodyHtml)
    const hasNaverShopping = /(?:shopping\.naver\.com|smartstore\.naver\.com)/i.test(bodyHtml)
    const hasYoutubeEmbed = /(?:youtube\.com|youtu\.be)/i.test(bodyHtml)

    return {
        totalLinks: internalLinks.length + externalLinks.length,
        internalLinks,
        externalLinks,
        internalCount: internalLinks.length,
        externalCount: externalLinks.length,
        hasNaverMap,
        hasNaverShopping,
        hasYoutubeEmbed,
    }
}

/**
 * Open Graph 메타 데이터 추출
 */
export function extractOpenGraph(html: string): OpenGraphData {
    return {
        title: extractMetaContent(html, 'og:title'),
        description: extractMetaContent(html, 'og:description'),
        image: extractMetaContent(html, 'og:image'),
        type: extractMetaContent(html, 'og:type'),
        url: extractMetaContent(html, 'og:url'),
    }
}

/**
 * 블로그 포스트 HTML에서 모든 메타 데이터 추출 (통합 함수)
 * @param html 블로그 포스트 HTML
 * @param blogId 블로그 ID (선택사항, 내부 링크 판별용)
 */
export function extractPostMetaData(html: string, blogId?: string): PostMetaData {
    return {
        tags: extractTags(html),
        category: extractCategory(html),
        linkAnalysis: analyzeLinks(html, blogId),
        ogData: extractOpenGraph(html),
    }
}

// ===== 내부 헬퍼 =====

/** HTML에서 본문 영역만 추출 (네비게이션/헤더/푸터 제외) */
function extractBodySection(html: string): string {
    // 본문 컨테이너 패턴
    const bodyPatterns = [
        /<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*)/i,
        /<div[^>]*id="postViewArea"[^>]*>([\s\S]*)/i,
        /<div[^>]*class="[^"]*post-view[^"]*"[^>]*>([\s\S]*)/i,
    ]

    for (const pattern of bodyPatterns) {
        const match = html.match(pattern)
        if (match) return match[1]
    }

    // 폴백: 전체 HTML에서 nav/header/footer 제거
    return html
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
}

/** 메타 태그에서 content 값 추출 */
function extractMetaContent(html: string, property: string): string | null {
    const pattern1 = new RegExp(
        `<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i'
    )
    const pattern2 = new RegExp(
        `<meta\\s+content=["']([^"']+)["']\\s+property=["']${property}["']`, 'i'
    )

    const match = html.match(pattern1) || html.match(pattern2)
    return match ? match[1].trim() : null
}
