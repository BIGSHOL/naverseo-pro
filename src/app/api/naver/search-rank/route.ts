import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import type { SearchRankResult } from '@/types/search-rank'

// 블로그 URL에서 유형 판별
function classifyBlogType(url: string, bloggerName?: string): { type: string; typeDetail: string } {
    const lowerUrl = url.toLowerCase()

    if (lowerUrl.includes('post.naver.com')) {
        return { type: '포스트', typeDetail: '포스트' }
    }
    if (lowerUrl.includes('cafe.naver.com')) {
        return { type: '카페', typeDetail: '카페' }
    }
    if (lowerUrl.includes('blog.naver.com') || lowerUrl.includes('m.blog.naver.com')) {
        // 네이버 블로그 — 최적/준최 판별은 추가 분석 필요
        // 간이 판별: 블로그명 길이 등으로 추정 (정확한 판별은 블로그 지수 API 필요)
        return { type: '최적', typeDetail: '최적' }
    }
    if (lowerUrl.includes('tistory.com') || lowerUrl.includes('velog.io') || lowerUrl.includes('brunch.co.kr')) {
        return { type: '외부', typeDetail: '외부' }
    }

    return { type: '외부', typeDetail: '외부' }
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
        // 네이버 모바일 검색
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

        // 인기글 스마트블록 탐색
        const smartBlockSelectors = [
            '.api_subject_bx',           // 인기글 영역
            '.sp_nreview',               // VIEW/인기글 블록
            '#_blog_list',               // 블로그 리스트
            '.lst_view',                 // VIEW 목록
            '.blog_list',                // 블로그 목록
            '.view_wrap',                // VIEW 래핑
        ]

        let hasSmartBlock = false
        let smartBlockOrder: number | null = null
        const topResults: SearchRankResult['topResults'] = []

        // 스마트블록 순서 확인
        const sections = $('section, .api_subject_bx, .sc_new')
        sections.each((index, el) => {
            const $section = $(el)
            const text = $section.text().toLowerCase()
            if (text.includes('인기글') || text.includes('블로그') || $section.find('.blog_list, .lst_view, .view_wrap').length > 0) {
                hasSmartBlock = true
                if (smartBlockOrder === null) {
                    smartBlockOrder = index + 1
                }
            }
        })

        // 상위 블로그 항목 추출
        const blogItemSelectors = [
            '.view_wrap .view_item',     // VIEW 아이템
            '.blog_list .bx',            // 블로그 목록 아이템
            '.lst_view li',              // VIEW 목록 아이템
            '.api_txt_lines',            // 텍스트 라인
            'li.bx',                     // 일반 리스트 아이템
        ]

        for (const selector of blogItemSelectors) {
            const items = $(selector)
            if (items.length > 0) {
                items.slice(0, 5).each((index, el) => {
                    const $item = $(el)
                    const link = $item.find('a').attr('href') || ''
                    const bloggerName = $item.find('.sub_txt, .writer_info, .blog_name').text().trim()

                    if (link) {
                        const { type, typeDetail } = classifyBlogType(link, bloggerName)
                        let fullUrl: string
                        try {
                            fullUrl = new URL(link, 'https://m.naver.com').href
                        } catch {
                            fullUrl = link
                        }
                        topResults.push({
                            rank: index + 1,
                            type,
                            typeDetail,
                            source: new URL(link, 'https://m.naver.com').hostname,
                            url: fullUrl,
                        })
                    }
                })
                break // 첫 번째 매칭되는 셀렉터만 사용
            }
        }

        // 인기글 블록을 못 찾았으면 대체 방법
        if (!hasSmartBlock) {
            // 어떤 블로그 컨텐츠든 있으면 포함으로 간주
            const anyBlogContent = $('a[href*="blog.naver.com"], a[href*="post.naver.com"]')
            if (anyBlogContent.length > 0) {
                hasSmartBlock = true
                smartBlockOrder = 1

                if (topResults.length === 0) {
                    anyBlogContent.slice(0, 5).each((index, el) => {
                        const href = $(el).attr('href') || ''
                        if (href) {
                            const { type, typeDetail } = classifyBlogType(href)
                            let fullUrl: string
                            try {
                                fullUrl = new URL(href, 'https://m.naver.com').href
                            } catch {
                                fullUrl = href
                            }
                            topResults.push({
                                rank: index + 1,
                                type,
                                typeDetail,
                                source: (() => {
                                    try {
                                        return new URL(href, 'https://m.naver.com').hostname
                                    } catch {
                                        return 'unknown'
                                    }
                                })(),
                                url: fullUrl,
                            })
                        }
                    })
                }
            }
        }

        return {
            keyword,
            hasSmartBlock,
            smartBlockOrder: hasSmartBlock ? (smartBlockOrder || 1) : null,
            topResults: topResults.slice(0, 5),
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
