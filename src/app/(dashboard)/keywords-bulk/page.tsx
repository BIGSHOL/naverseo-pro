'use client'

import { useState, useCallback, useEffect } from 'react'
import { BulkKeywordInput } from '@/components/keywords/bulk-keyword-input'
import { BulkKeywordResults, type BulkKeywordData } from '@/components/keywords/bulk-keyword-results'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ListChecks, Search, TrendingUp, BarChart3, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import type { BlogCategory } from '@/lib/blog-index/categories'

export default function KeywordsBulkPage() {
    const [results, setResults] = useState<BulkKeywordData[]>([])
    const [loading, setLoading] = useState(false)
    const [isDemo, setIsDemo] = useState(false)
    const [error, setError] = useState('')
    const [searched, setSearched] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' })
    const [blogCategory, setBlogCategory] = useState<BlogCategory | null>(null)

    // 마운트 시 블로그 카테고리 조회
    useEffect(() => {
        async function fetchBlogCategory() {
            try {
                const res = await fetch('/api/profile/blog')
                if (!res.ok) return
                const { blogProfile } = await res.json()
                if (!blogProfile?.blogUrl) return

                const histRes = await fetch(
                    `/api/blog-index/history?blogUrl=${encodeURIComponent(blogProfile.blogUrl)}&latest=true`
                )
                if (!histRes.ok) return
                const { cached } = await histRes.json()
                if (cached?.blogCategory) {
                    setBlogCategory(cached.blogCategory as BlogCategory)
                }
            } catch {
                // 실패 시 기본 키워드 사용
            }
        }
        fetchBlogCategory()
    }, [])

    const handleSubmit = useCallback(async (keywords: string[]) => {
        setLoading(true)
        setError('')
        setSearched(true)
        setResults([])

        try {
            // Stage 1: 기본 검색량 조회
            setProgress({ current: 0, total: 3, stage: '검색량 조회 중...' })
            const bulkRes = await fetch('/api/naver/keywords-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords: keywords.join('\n') }),
            })

            const bulkData = await bulkRes.json()

            if (!bulkRes.ok) {
                setError(bulkData.error || '대량 키워드 조회에 실패했습니다.')
                setLoading(false)
                return
            }

            const baseResults: BulkKeywordData[] = bulkData.results || []
            setIsDemo(bulkData.isDemo || false)
            setProgress({ current: 1, total: 3, stage: '자동완성 확인 중...' })

            // Stage 2: 자동완성 조회 (병렬)
            let autocompleteData: Record<string, { included: boolean; suggestions: string[] }> = {}
            try {
                const acRes = await fetch('/api/naver/autocomplete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keywords }),
                })
                if (acRes.ok) {
                    const acData = await acRes.json()
                    autocompleteData = acData.results || {}
                }
            } catch {
                // 자동완성 실패해도 계속 진행
            }
            setProgress({ current: 2, total: 3, stage: '인기글 분석 중...' })

            // Stage 3: 인기글 순서 + 상위 유형 조회
            let searchRankData: Record<string, BulkKeywordData['searchRank']> = {}
            try {
                const srRes = await fetch('/api/naver/search-rank', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keywords }),
                })
                if (srRes.ok) {
                    const srData = await srRes.json()
                    searchRankData = srData.results || {}
                }
            } catch {
                // 인기글 분석 실패해도 계속 진행
            }
            setProgress({ current: 3, total: 3, stage: '완료!' })

            // 데이터 병합
            const mergedResults = baseResults.map((r) => ({
                ...r,
                autocomplete: autocompleteData[r.keyword] || undefined,
                searchRank: searchRankData[r.keyword] || undefined,
            }))

            setResults(mergedResults)
        } catch (err) {
            setError(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }, [])

    // 요약 통계
    const totalVolume = results.reduce((sum, r) => sum + r.totalSearchVolume, 0)
    const lowCompCount = results.filter((r) => r.compIdx === 'LOW').length
    const avgScore = results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
        : 0

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">키워드 대량조회</h1>
                <p className="mt-1 text-muted-foreground">
                    여러 키워드의 검색량, 경쟁도, 인기글 순서를 한번에 조회하세요
                </p>
            </div>

            {/* 입력 영역 */}
            <BulkKeywordInput onSubmit={handleSubmit} loading={loading} blogCategory={blogCategory} />

            {/* 에러 메시지 */}
            {error && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* 로딩 진행률 */}
            {loading && (
                <Card>
                    <CardContent className="py-8">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div className="w-full max-w-xs space-y-2">
                                <Progress
                                    value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                                    className="h-2"
                                />
                                <p className="text-center text-sm text-muted-foreground">
                                    {progress.stage} ({progress.current}/{progress.total})
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 요약 통계 */}
            {results.length > 0 && !loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center gap-3 pt-6">
                            <div className="rounded-lg bg-blue-50 p-2.5">
                                <ListChecks className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">조회 키워드</p>
                                <p className="text-xl font-bold">{results.length}개</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 pt-6">
                            <div className="rounded-lg bg-purple-50 p-2.5">
                                <Search className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">총 검색량</p>
                                <p className="text-xl font-bold">{totalVolume.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 pt-6">
                            <div className="rounded-lg bg-green-50 p-2.5">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">낮은 경쟁 키워드</p>
                                <p className="text-xl font-bold">{lowCompCount}개</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 pt-6">
                            <div className="rounded-lg bg-amber-50 p-2.5">
                                <BarChart3 className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">평균 추천 점수</p>
                                <p className="text-xl font-bold">{avgScore}점</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 결과 테이블 */}
            {results.length > 0 && !loading && (
                <BulkKeywordResults results={results} isDemo={isDemo} />
            )}

            {/* 검색 전 안내 */}
            {!searched && results.length === 0 && !loading && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-primary/10 p-4">
                            <ListChecks className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">대량 키워드 조회</h3>
                        <p className="mt-2 text-center text-sm text-muted-foreground max-w-md">
                            여러 키워드를 한번에 입력하면 검색량, 경쟁도, 월발행수, 인기글 순서,
                            자동완성 여부, 상위 블로그 유형까지 한눈에 확인할 수 있습니다.
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            <Badge variant="secondary">PC/모바일 검색량</Badge>
                            <Badge variant="secondary">월발행수</Badge>
                            <Badge variant="secondary">인기글 순서</Badge>
                            <Badge variant="secondary">자동완성</Badge>
                            <Badge variant="secondary">상위 블로그 유형</Badge>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
