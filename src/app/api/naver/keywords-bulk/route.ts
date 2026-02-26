import { NextRequest, NextResponse } from 'next/server'
import {
    getKeywordStats,
    calculateKeywordScore,
    type NaverKeywordResult,
} from '@/lib/naver/search-ad'
import { searchNaverBlog } from '@/lib/naver/blog-search'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { scheduleCollection, collectFromSearchResults } from '@/lib/blog-learning'

// 데모 데이터 생성
function generateBulkDemoData(keyword: string): NaverKeywordResult {
    const pcBase = Math.floor(Math.random() * 5000) + 10
    const mobileBase = Math.floor(Math.random() * 15000) + 30
    return {
        relKeyword: keyword,
        monthlyPcQcCnt: pcBase,
        monthlyMobileQcCnt: mobileBase,
        monthlyAvePcClkCnt: Math.floor(Math.random() * 200) + 5,
        monthlyAveMobileClkCnt: Math.floor(Math.random() * 500) + 10,
        monthlyAvePcCtr: Math.random() * 5 + 0.5,
        monthlyAveMobileCtr: Math.random() * 8 + 1,
        plAvgDepth: Math.floor(Math.random() * 15) + 1,
        compIdx: (['HIGH', 'MEDIUM', 'LOW'] as const)[Math.floor(Math.random() * 3)],
    }
}

interface BulkKeywordResult {
    keyword: string
    pcSearchVolume: number
    mobileSearchVolume: number
    totalSearchVolume: number
    compIdx: string
    plAvgDepth: number
    score: number
    monthlyPostCount: number | null
    avgPostDate: string | null
}

// 네이버 블로그 검색으로 월발행수 + 평균 발행일 조회
async function getBlogStats(keyword: string): Promise<{
    monthlyPostCount: number | null
    avgPostDate: string | null
}> {
    try {
        const clientId = process.env.NAVER_CLIENT_ID?.trim()
        const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
        if (!clientId || !clientSecret) {
            return { monthlyPostCount: null, avgPostDate: null }
        }

        const result = await searchNaverBlog(keyword, 10)
        const monthlyPostCount = result.total

        // 블로그 학습 파이프라인: 백그라운드 수집
        if (result.items.length > 0) {
            scheduleCollection(async () => {
                await collectFromSearchResults(keyword, result.items, 'keyword_bulk')
            })
        }

        // 상위 10개 게시물의 평균 발행일 계산
        let avgPostDate: string | null = null
        if (result.items.length > 0) {
            const dates = result.items
                .map((item) => {
                    // postdate 형식: "20240101"
                    const d = item.postdate
                    if (d && d.length === 8) {
                        return new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`)
                    }
                    return null
                })
                .filter((d): d is Date => d !== null && !isNaN(d.getTime()))

            if (dates.length > 0) {
                const avgTimestamp = dates.reduce((sum, d) => sum + d.getTime(), 0) / dates.length
                const avgDate = new Date(avgTimestamp)
                const now = new Date()
                const diffDays = Math.round((now.getTime() - avgDate.getTime()) / (1000 * 60 * 60 * 24))

                if (diffDays <= 1) avgPostDate = '오늘'
                else if (diffDays <= 7) avgPostDate = `${diffDays}일 전`
                else if (diffDays <= 30) avgPostDate = `${Math.round(diffDays / 7)}주 전`
                else if (diffDays <= 365) avgPostDate = `${Math.round(diffDays / 30)}개월 전`
                else avgPostDate = `${Math.round(diffDays / 365)}년 전`
            }
        }

        return { monthlyPostCount, avgPostDate }
    } catch {
        return { monthlyPostCount: null, avgPostDate: null }
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const rawKeywords: string = body.keywords || ''

        // 키워드 파싱 (줄바꿈, 쉼표 구분)
        const keywords = rawKeywords
            .split(/[\n,]/)
            .map((kw: string) => kw.trim())
            .filter((kw: string) => kw.length > 0)
            .slice(0, 100) // 최대 100개

        if (keywords.length === 0) {
            return NextResponse.json(
                { error: '키워드를 입력해주세요.' },
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

        // 크레딧 체크 (10개당 3크레딧)
        const batchCount = Math.ceil(keywords.length / 10)
        const creditCheck = await checkCredits(supabase, user.id, 'keyword_bulk')
        if (!creditCheck.allowed) {
            return NextResponse.json(
                {
                    error: creditCheck.message,
                    creditLimit: true,
                    balance: creditCheck.balance,
                    cost: creditCheck.cost * batchCount,
                    planGate: creditCheck.planGate,
                },
                { status: 403 }
            )
        }

        const isDemo = !process.env.NAVER_AD_API_KEY ||
            !process.env.NAVER_AD_SECRET_KEY ||
            !process.env.NAVER_AD_CUSTOMER_ID

        const results: BulkKeywordResult[] = []

        if (isDemo) {
            // 데모 데이터
            for (const kw of keywords) {
                const demoData = generateBulkDemoData(kw)
                const totalSearch = demoData.monthlyPcQcCnt + demoData.monthlyMobileQcCnt
                results.push({
                    keyword: kw,
                    pcSearchVolume: demoData.monthlyPcQcCnt,
                    mobileSearchVolume: demoData.monthlyMobileQcCnt,
                    totalSearchVolume: totalSearch,
                    compIdx: demoData.compIdx,
                    plAvgDepth: demoData.plAvgDepth,
                    score: calculateKeywordScore(demoData),
                    monthlyPostCount: Math.floor(Math.random() * 50000) + 100,
                    avgPostDate: `${Math.floor(Math.random() * 30) + 1}일 전`,
                })
            }
        } else {
            // 실제 API 호출 - 5개씩 배치
            const batchSize = 5
            for (let i = 0; i < keywords.length; i += batchSize) {
                const batch = keywords.slice(i, i + batchSize)
                const hintKeywords = batch.join(',')

                try {
                    const apiResults = await getKeywordStats(hintKeywords)

                    // 입력 키워드만 필터링 (네이버 API는 연관 키워드도 반환)
                    for (const kw of batch) {
                        const cleanKw = kw.replace(/\s+/g, '')
                        const matched = apiResults.find(
                            (r) => r.relKeyword === cleanKw || r.relKeyword === kw
                        )

                        if (matched) {
                            const totalSearch = matched.monthlyPcQcCnt + matched.monthlyMobileQcCnt

                            // 블로그 통계 조회 (100ms 딜레이)
                            const blogStats = await getBlogStats(kw)
                            await new Promise((resolve) => setTimeout(resolve, 100))

                            results.push({
                                keyword: kw,
                                pcSearchVolume: matched.monthlyPcQcCnt,
                                mobileSearchVolume: matched.monthlyMobileQcCnt,
                                totalSearchVolume: totalSearch,
                                compIdx: matched.compIdx,
                                plAvgDepth: matched.plAvgDepth,
                                score: calculateKeywordScore(matched),
                                monthlyPostCount: blogStats.monthlyPostCount,
                                avgPostDate: blogStats.avgPostDate,
                            })
                        } else {
                            // 네이버 API에서 결과 없음
                            results.push({
                                keyword: kw,
                                pcSearchVolume: 0,
                                mobileSearchVolume: 0,
                                totalSearchVolume: 0,
                                compIdx: '-',
                                plAvgDepth: 0,
                                score: 0,
                                monthlyPostCount: null,
                                avgPostDate: null,
                            })
                        }
                    }
                } catch (error) {
                    // 배치 실패 시 해당 키워드는 빈 결과
                    console.error(`[Bulk Keywords] 배치 실패:`, error)
                    for (const kw of batch) {
                        results.push({
                            keyword: kw,
                            pcSearchVolume: 0,
                            mobileSearchVolume: 0,
                            totalSearchVolume: 0,
                            compIdx: '-',
                            plAvgDepth: 0,
                            score: 0,
                            monthlyPostCount: null,
                            avgPostDate: null,
                        })
                    }
                }

                // 배치 간 딜레이 (rate limit 방지)
                if (i + batchSize < keywords.length) {
                    await new Promise((resolve) => setTimeout(resolve, 200))
                }
            }
        }

        // 크레딧 차감
        for (let i = 0; i < batchCount; i++) {
            await deductCredits(supabase, user.id, 'keyword_bulk', {
                keywords: keywords.slice(i * 10, (i + 1) * 10),
                count: Math.min(10, keywords.length - i * 10),
            })
        }

        return NextResponse.json({
            results,
            totalKeywords: keywords.length,
            isDemo,
            ...(isDemo && {
                message: '데모 데이터입니다. 실제 데이터는 네이버 API 키 설정 후 사용 가능합니다.',
            }),
        })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[Bulk Keywords API] 오류:', errorMessage)
        return NextResponse.json(
            { error: `대량 키워드 조회 중 오류가 발생했습니다: ${errorMessage}` },
            { status: 500 }
        )
    }
}
