import { NextRequest, NextResponse } from 'next/server'

// 네이버 자동완성 API 호출
async function checkAutocomplete(keyword: string): Promise<{
    included: boolean
    suggestions: string[]
}> {
    try {
        const url = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(keyword)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&q_enc=UTF-8&st=100`

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.naver.com/',
            },
        })

        if (!response.ok) {
            return { included: false, suggestions: [] }
        }

        const data = await response.json()

        // 네이버 자동완성 응답 형식: { items: [[ [keyword1], [keyword2], ... ]] }
        // 실제 형식은 배열의 배열
        let suggestions: string[] = []

        if (Array.isArray(data?.items)) {
            // items[0]이 자동완성 목록
            const items = data.items[0]
            if (Array.isArray(items)) {
                suggestions = items
                    .map((item: unknown) => {
                        if (Array.isArray(item) && item.length > 0) {
                            return String(item[0])
                        }
                        if (typeof item === 'string') {
                            return item
                        }
                        return ''
                    })
                    .filter((s: string) => s.length > 0)
            }
        }

        // 입력 키워드가 자동완성 목록에 포함되어 있는지 확인
        const cleanKeyword = keyword.replace(/\s+/g, '').toLowerCase()
        const included = suggestions.some((s) => {
            const cleanSuggestion = s.replace(/\s+/g, '').toLowerCase()
            return cleanSuggestion === cleanKeyword || cleanSuggestion.startsWith(cleanKeyword)
        })

        return { included, suggestions: suggestions.slice(0, 5) }
    } catch {
        return { included: false, suggestions: [] }
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

        const results: Record<string, { included: boolean; suggestions: string[] }> = {}

        for (const keyword of keywords.slice(0, 100)) {
            results[keyword] = await checkAutocomplete(keyword)
            // Rate limit 방지
            await new Promise((resolve) => setTimeout(resolve, 100))
        }

        return NextResponse.json({ results })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[Autocomplete API] 오류:', errorMessage)
        return NextResponse.json(
            { error: `자동완성 조회 중 오류가 발생했습니다: ${errorMessage}` },
            { status: 500 }
        )
    }
}
