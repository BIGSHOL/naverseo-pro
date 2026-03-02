import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import type { SearchRankResult } from '@/types/search-rank'
import { batchGetCachedScores, setCachedScore, calculateLightweightScore } from '@/lib/seo/post-score-cache'

// API Route는 항상 동적으로 실행 (cookies 사용으로 인한 정적 빌드 방지)
export const dynamic = 'force-dynamic'

// URL에서 유형 판별
function classifyByUrl(url: string): { type: string; typeDetail: string; source: string } {
    const lower = url.toLowerCase()

    if (lower.includes('blog.naver.com') || lower.includes('m.blog.naver.com')) {
        return { type: '블로그', typeDetail: '블로그', source: 'blog.naver.com' }
    }
    if (lower.includes('cafe.naver.com') || lower.includes('m.cafe.naver.com')) {
        return { type: '카페', typeDetail: '카페', source: 'cafe.naver.com' }
    }
    if (lower.includes('post.naver.com')) {
        return { type: '포스트', typeDetail: '포스트', source: 'post.naver.com' }
    }
    if (lower.includes('tistory.com')) {
        return { type: '외부', typeDetail: '티스토리', source: 'tistory.com' }
    }
    if (lower.includes('brunch.co.kr')) {
        return { type: '외부', typeDetail: '브런치', source: 'brunch.co.kr' }
    }
    if (lower.includes('velog.io')) {
        return { type: '외부', typeDetail: 'velog', source: 'velog.io' }
    }

    // 호스트명 추출
    try {
        const hostname = new URL(url).hostname
        return { type: '외부', typeDetail: '외부', source: hostname }
    } catch {
        return { type: '외부', typeDetail: '외부', source: 'unknown' }
    }
}

// data-cr-on 속성에서 순위(r=) 파싱
function parseRank(crOn: string): number | null {
    const match = crOn.match(/r=(\d+)/)
    return match ? parseInt(match[1], 10) : null
}

// 게시글 SEO 점수 분석 (캐시 우선, 블로그만)
async function analyzeSeoScores(
    topResults: Array<{
        url: string
        type: string
        title?: string
        seoScore?: number
    }>
): Promise<void> {
    try {
        // Supabase 클라이언트 생성 (admin 권한)
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = createClient()

        // 블로그 URL만 필터링
        const blogUrls = topResults.filter(r => r.type === '블로그').map(r => r.url)
        if (blogUrls.length === 0) return

        // 1. 캐시 일괄 조회
        const cachedScores = await batchGetCachedScores(supabase, blogUrls)

        // 2. 캐시 없는 URL만 스크래핑 + 점수 계산
        const { scrapeBlogPost } = await import('@/lib/naver/blog-scraper')

        for (const result of topResults) {
            if (result.type !== '블로그') continue

            // 캐시 확인
            const cached = cachedScores.get(result.url)
            if (cached !== undefined) {
                result.seoScore = cached
                continue
            }

            // 스크래핑 + 점수 계산
            try {
                const scraped = await scrapeBlogPost(result.url)
                if (!scraped) continue

                const score = calculateLightweightScore(
                    result.title || '',
                    '',  // ScrapedPostData에 content 필드 없음 — charCount 기반 추정
                    scraped.imageCount || 0
                )

                result.seoScore = score

                // 캐시 저장 (백그라운드, 실패해도 무방)
                setCachedScore(supabase, result.url, score, {
                    title: result.title,
                    charCount: scraped.charCount,
                    imageCount: scraped.imageCount,
                }).catch(() => {})

                // Rate limit 방지 (100ms 딜레이)
                await new Promise(resolve => setTimeout(resolve, 100))
            } catch {
                // 스크래핑 실패 시 점수 없음 (null 유지)
            }
        }
    } catch (err) {
        console.error('[Search Rank] SEO 점수 분석 실패:', err)
    }
}

// 네이버 모바일 검색 결과 파싱
async function analyzeSearchResult(keyword: string): Promise<SearchRankResult> {
    const defaultResult: SearchRankResult = {
        keyword,
        hasSmartBlock: false,
        smartBlockOrder: null,
        topResults: [],
    }

    try {
        // 네이버 모바일 블로그 탭 검색
        const searchUrl = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&where=m_blog`
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ko-KR,ko;q=0.9',
                'Referer': 'https://m.naver.com/',
            },
        })

        if (!response.ok) {
            return defaultResult
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        const topResults: SearchRankResult['topResults'] = []

        // ── URL → 제목 맵 구축 (모든 <a> 링크에서 제목 수집) ──
        const urlTitleMap = new Map<string, string>()
        $('a[href]').each((_i, el) => {
            const href = $(el).attr('href') || ''
            const text = $(el).text().trim()
            // 제목으로 보이는 텍스트만 (3~150자)
            if (!href || !text || text.length < 3 || text.length > 150) return
            let fullHref = href
            if (!href.startsWith('http')) {
                try { fullHref = new URL(href, 'https://m.naver.com').href } catch { return }
            }
            if (!urlTitleMap.has(fullHref)) {
                urlTitleMap.set(fullHref, text)
            }
        })

        // URL로 제목 검색 (정확 매칭 → 부분 매칭)
        function findTitle(url: string): string {
            if (urlTitleMap.has(url)) return urlTitleMap.get(url)!
            // URL 끝부분으로 부분 매칭 시도
            for (const [mapUrl, mapTitle] of urlTitleMap) {
                if (mapUrl.includes(url) || url.includes(mapUrl)) return mapTitle
            }
            return ''
        }

        // ── 방법 1: _keep_trigger 버튼의 data-url + data-cr-on 사용 (가장 정확) ──
        const keepBtns = $('button._keep_trigger[data-url]')
        if (keepBtns.length > 0) {
            const seen = new Set<string>()
            keepBtns.each((_i, el) => {
                const dataUrl = $(el).attr('data-url') || ''
                const crOn = $(el).attr('data-cr-on') || ''
                if (!dataUrl || seen.has(dataUrl)) return
                seen.add(dataUrl)

                const rank = parseRank(crOn)
                const { type, typeDetail, source } = classifyByUrl(dataUrl)
                const title = findTitle(dataUrl) || $(el).attr('data-title') || ''

                topResults.push({
                    rank: rank ?? topResults.length + 1,
                    type,
                    typeDetail,
                    source,
                    url: dataUrl,
                    title,
                })
            })
        }

        // ── 방법 2: _keep_trigger가 없으면 data-heatmap-target=".link" 링크 사용 ──
        if (topResults.length === 0) {
            const linkEls = $('a[data-heatmap-target=".link"]')
            const seen = new Set<string>()
            linkEls.each((_i, el) => {
                const href = $(el).attr('href') || ''
                if (!href || seen.has(href) || href.startsWith('#') || href.startsWith('javascript')) return
                // 블로그/카페 URL만 수집
                if (!href.includes('blog.naver.com') && !href.includes('cafe.naver.com') && !href.includes('post.naver.com')) return
                seen.add(href)

                let fullUrl: string
                try {
                    fullUrl = new URL(href, 'https://m.naver.com').href
                } catch {
                    fullUrl = href
                }
                const { type, typeDetail, source } = classifyByUrl(fullUrl)
                const title = $(el).text().trim() || findTitle(fullUrl)
                topResults.push({
                    rank: topResults.length + 1,
                    type,
                    typeDetail,
                    source,
                    url: fullUrl,
                    title,
                })
            })
        }

        // ── 방법 3: 최후 폴백 - blog.naver.com/cafe.naver.com 링크 전체 탐색 ──
        if (topResults.length === 0) {
            const blogLinks = $('a[href*="blog.naver.com"], a[href*="cafe.naver.com"], a[href*="post.naver.com"]')
            const seen = new Set<string>()
            blogLinks.each((_i, el) => {
                const href = $(el).attr('href') || ''
                if (!href || seen.has(href)) return
                // 프로필 링크가 아닌 게시물 링크만 (숫자 ID 포함)
                if (!/\/\d+/.test(href)) return
                seen.add(href)

                let fullUrl: string
                try {
                    fullUrl = new URL(href, 'https://m.naver.com').href
                } catch {
                    fullUrl = href
                }
                const { type, typeDetail, source } = classifyByUrl(fullUrl)
                const title = $(el).text().trim() || findTitle(fullUrl)
                topResults.push({
                    rank: topResults.length + 1,
                    type,
                    typeDetail,
                    source,
                    url: fullUrl,
                    title,
                })
            })
        }

        // 순위로 정렬 후 상위 5개
        topResults.sort((a, b) => a.rank - b.rank)
        const top5 = topResults.slice(0, 5).map((r, i) => ({ ...r, rank: i + 1 }))

        // 인기글 블록 존재 여부: 결과가 1개 이상이면 있다고 판단
        const hasSmartBlock = top5.length > 0

        // 스마트블록 순서: 통합검색이 아닌 블로그 탭이므로 항상 1번째
        const smartBlockOrder = hasSmartBlock ? 1 : null

        // ── 게시글 SEO 점수 분석 (경량, 캐시 우선) ──
        await analyzeSeoScores(top5)

        return {
            keyword,
            hasSmartBlock,
            smartBlockOrder,
            topResults: top5,
        }
    } catch (error) {
        console.error(`[Search Rank] 파싱 실패 (${keyword}):`, error)
        return defaultResult
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const keywords: string[] = body.keywords || []

        if (!Array.isArray(keywords) || keywords.length === 0) {
            return NextResponse.json(
                { error: '키워드 목록이 필요합니다.' },
                { status: 400 }
            )
        }

        // 인증 체크
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
        }

        const results: Record<string, SearchRankResult> = {}

        // 순차 처리 (과도한 요청 방지)
        for (const keyword of keywords.slice(0, 100)) {
            results[keyword] = await analyzeSearchResult(keyword)
            // 200ms 딜레이 (네이버 차단 방지)
            await new Promise((resolve) => setTimeout(resolve, 200))
        }

        return NextResponse.json({ results })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[Search Rank API] 오류:', errorMessage)
        return NextResponse.json(
            { error: `검색 순위 분석 중 오류가 발생했습니다: ${errorMessage}` },
            { status: 500 }
        )
    }
}
