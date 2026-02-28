'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Lightbulb, Loader2, Search, Wand2, Info, ArrowUpDown, ArrowUp, ArrowDown, Target, Clock, Sparkles, Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getCompBadge, getCategoryBadge, getScoreColor, getScoreTooltip, formatNumber } from '@/components/keywords/keyword-utils'
import Link from 'next/link'
import { useKeywordHistory } from '@/hooks/use-keyword-history'
import { PlanGateAlert } from '@/components/plan-gate-alert'

const OpportunityMatrixChart = dynamic(() => import('@/components/charts/OpportunityMatrixChart'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[340px] flex items-center justify-center bg-muted/50 rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
})

interface OpportunityItem {
  keyword: string
  monthlySearch: number
  monthlyPc: number
  monthlyMobile: number
  compIdx: string
  score: number
  category: string
  reason: string
  source?: 'ai' | 'naver'
}

interface OpportunityResult {
  topic: string
  opportunities: OpportunityItem[]
  summary: string
  isDemo: boolean
  seedCount?: number
  naverExpandedCount?: number
  filteredCount?: number
  blogName?: string
}

type SortKey = 'monthlySearch' | 'compIdx' | 'score'
type SortDir = 'asc' | 'desc'

const EXAMPLE_TOPICS = ['캠핑', '다이어트', '인테리어', '육아', '요리', '부업']
const EXAMPLE_BLOG_URL = 'blog.naver.com/example'


export default function OpportunitiesPage() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planGateMessage, setPlanGateMessage] = useState('')
  const [result, setResult] = useState<OpportunityResult | null>(null)
  const [progress, setProgress] = useState<{ step: number; totalSteps: number; message: string } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // 키워드 발굴 히스토리
  const { history, addKeyword } = useKeywordHistory('keyword-discovery-history')

  const handleSearch = async (searchTopic?: string) => {
    const t = (searchTopic || topic).trim()
    if (!t || loading) return
    addKeyword(t)

    if (searchTopic) setTopic(searchTopic)
    setLoading(true)
    setError('')
    setPlanGateMessage('')
    setProgress({ step: 0, totalSteps: 3, message: '분석 준비 중...' })

    try {
      // URL 감지: blog.naver.com 포함 여부
      const isBlogUrl = t.includes('blog.naver.com')
      const payload = isBlogUrl ? { blogUrl: t } : { topic: t }

      const res = await fetch('/api/ai/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.planGate) {
          setPlanGateMessage(data.error)
        } else {
          setError(data.error || '키워드 발굴 분석에 실패했습니다.')
        }
        return
      }

      const contentType = res.headers.get('Content-Type') || ''

      if (contentType.includes('ndjson') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += decoder.decode()
          } else {
            buffer += decoder.decode(value, { stream: true })
          }

          const lines = buffer.split('\n')
          buffer = done ? '' : (lines.pop() || '')

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)
              if (event.type === 'progress') {
                setProgress(event)
              } else if (event.type === 'result') {
                setResult(event)
              } else if (event.type === 'error') {
                setError(event.error || '키워드 발굴 분석에 실패했습니다.')
              }
            } catch { /* JSON 파싱 실패 무시 */ }
          }

          if (done) break
        }
      } else {
        // 폴백: 일반 JSON 응답
        const data = await res.json()
        setResult(data)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch()
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    if (!result) return []

    return [...result.opportunities].sort((a, b) => {
      let aVal: number
      let bVal: number

      if (sortKey === 'compIdx') {
        const compOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
        aVal = compOrder[a.compIdx] || 0
        bVal = compOrder[b.compIdx] || 0
      } else {
        aVal = a[sortKey]
        bVal = b[sortKey]
      }

      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [result, sortKey, sortDir])

  // 데이터 품질 분석: 검색량이 충분한지 판단
  const dataQuality = useMemo(() => {
    if (!result) return { isLowData: false, lowDataCount: 0 }
    const lowDataCount = result.opportunities.filter(o => o.monthlySearch <= 20).length
    return {
      isLowData: lowDataCount > result.opportunities.length * 0.7,
      lowDataCount,
    }
  }, [result])

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 inline text-primary" />
      : <ArrowDown className="ml-1 h-3 w-3 inline text-primary" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 sm:text-2xl">
          <Lightbulb className="h-5 w-5 text-yellow-500 sm:h-6 sm:w-6" />
          키워드 발굴
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          주제를 입력하면 AI가 경쟁이 낮고 검색량이 충분한 블루오션 키워드를 찾아드립니다
        </p>
      </div>

      {/* 검색 폼 */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="주제 또는 블로그 URL (예: 캠핑)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                className="flex-1 min-w-0"
              />
              <Button type="submit" disabled={loading || !topic.trim()} className="shrink-0">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <Search className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">{loading ? '분석 중...' : '블루오션 키워드 찾기'}</span>
              </Button>
            </div>

            {/* 최근 검색 히스토리 + 예시 주제 */}
            {!result && !loading && (
              <div className="space-y-2">
                {history.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      최근:
                    </span>
                    {history.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="cursor-pointer border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                        onClick={() => handleSearch(t)}
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">예시:</span>
                  {EXAMPLE_TOPICS.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handleSearch(t)}
                    >
                      {t}
                    </Badge>
                  ))}
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-accent transition-colors border-dashed"
                    onClick={() => handleSearch(EXAMPLE_BLOG_URL)}
                  >
                    {EXAMPLE_BLOG_URL}
                  </Badge>
                </div>
              </div>
            )}
          </form>

          {planGateMessage && (
            <div className="mt-4">
              <PlanGateAlert message={planGateMessage} />
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 프로그레스 */}
      {loading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="w-full max-w-md space-y-3">
                <p className="text-center text-sm font-medium">
                  {progress?.message || 'AI 키워드 발굴 중...'}
                </p>
                {progress && (
                  <>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${Math.round((progress.step / progress.totalSteps) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>단계 {progress.step}/{progress.totalSteps}</span>
                      <span>AI + 네이버 데이터 조합</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결과 */}
      {result && !loading && (
        <>
          {/* AI 요약 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-yellow-100 p-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">
                      {result.blogName ? `"${result.blogName}" 블로그 분석` : 'AI 분석 요약'}
                    </h3>
                    {result.isDemo && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="gap-1 cursor-help">
                            <Info className="h-3 w-3" />
                            데모 데이터
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent><p>API 키 미설정 시 표시되는 예시 데이터입니다</p></TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{result.summary}</p>
                  {/* 엔진 통계 */}
                  {result.seedCount && (
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple-500" />
                        AI 시드: {result.seedCount}개
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-blue-500" />
                        네이버 확장: {result.naverExpandedCount}개
                      </span>
                      <span>
                        → 상위 {result.opportunities.length}개 선별
                        {result.filteredCount ? ` (${result.filteredCount}개 필터링)` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 기회 매트릭스 */}
          {result.opportunities.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  기회 매트릭스
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  오른쪽 위(높은 점수 + 높은 검색량)에 위치할수록 추천 키워드입니다
                </p>
              </CardHeader>
              <CardContent>
                {dataQuality.isLowData && (
                  <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">검색 데이터가 제한적입니다</p>
                      <p className="text-xs mt-0.5 text-amber-700">
                        {dataQuality.lowDataCount}개 키워드의 검색량이 10 미만입니다. 니치 키워드는 경쟁이 낮아 상위 노출에 유리할 수 있습니다.
                      </p>
                    </div>
                  </div>
                )}
                <OpportunityMatrixChart opportunities={result.opportunities} />
                {/* 범례 */}
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 text-xs">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200">
                    <span className="inline-block h-3 w-3 rounded-full bg-purple-500 shadow-sm" />
                    <span className="font-medium text-purple-700">AI 추천</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
                    <span className="font-medium text-emerald-700">네이버 연관</span>
                  </div>
                  <div className="h-4 w-px bg-border mx-1" />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="inline-block h-2.5 w-5 rounded-sm bg-emerald-500/10 border border-emerald-500/30" />
                    <span>최고 기회</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="inline-block h-2.5 w-5 rounded-sm bg-blue-500/10 border border-blue-500/30" />
                    <span>틈새</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="inline-block h-2.5 w-5 rounded-sm bg-amber-500/10 border border-amber-500/30" />
                    <span>경쟁</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 기회 키워드 테이블 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg">
                  블루오션 키워드 ({result.opportunities.length}개)
                </CardTitle>
                {/* 모바일 정렬 버튼 */}
                <div className="flex items-center gap-1 md:hidden">
                  <span className="text-xs text-muted-foreground shrink-0">정렬:</span>
                  {([['score', '점수'], ['monthlySearch', '검색량'], ['compIdx', '경쟁도']] as const).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={sortKey === key ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      {sortKey === key && (sortDir === 'asc' ? <ArrowUp className="ml-0.5 h-3 w-3" /> : <ArrowDown className="ml-0.5 h-3 w-3" />)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 모바일: 카드 리스트 */}
              <div className="space-y-3 md:hidden">
                {sorted.map((opp, i) => (
                  <div key={i} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{opp.keyword}</span>
                        {opp.source === 'ai' ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-600 bg-purple-50 shrink-0">
                            AI
                          </Badge>
                        ) : opp.source === 'naver' ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-600 bg-green-50 shrink-0">
                            N
                          </Badge>
                        ) : null}
                      </div>
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 ${getScoreColor(opp.score)}`}>
                        {opp.score}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {getCategoryBadge(opp.category)}
                      <span className="tabular-nums">
                        검색량 {opp.monthlySearch <= 20 ? '< 10' : formatNumber(opp.monthlySearch)}
                      </span>
                      <span className="flex items-center gap-1">경쟁 {getCompBadge(opp.compIdx)}</span>
                    </div>
                    {opp.reason && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{opp.reason}</p>
                    )}
                    <div className="mt-2">
                      <Link href={`/content?keyword=${encodeURIComponent(opp.keyword)}`}>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs w-full">
                          <Wand2 className="h-3 w-3" />
                          이 키워드로 글쓰기
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크탑: 테이블 */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">키워드</th>
                      <th className="pb-3 px-3 font-medium text-muted-foreground">카테고리</th>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <th
                            className="cursor-pointer pb-3 px-3 text-right font-medium text-muted-foreground whitespace-nowrap"
                            onClick={() => handleSort('monthlySearch')}
                          >
                            월간 검색량<SortIcon columnKey="monthlySearch" />
                          </th>
                        </TooltipTrigger>
                        <TooltipContent><p>네이버 기준 월간 총 검색 횟수입니다</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <th
                            className="cursor-pointer pb-3 px-3 text-center font-medium text-muted-foreground whitespace-nowrap"
                            onClick={() => handleSort('compIdx')}
                          >
                            경쟁도<SortIcon columnKey="compIdx" />
                          </th>
                        </TooltipTrigger>
                        <TooltipContent><p>검색 광고 기준 경쟁 정도입니다. 낮을수록 상위 노출에 유리합니다</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <th
                            className="cursor-pointer pb-3 px-3 text-center font-medium text-muted-foreground whitespace-nowrap"
                            onClick={() => handleSort('score')}
                          >
                            기회 점수<SortIcon columnKey="score" />
                          </th>
                        </TooltipTrigger>
                        <TooltipContent><p>검색량 대비 경쟁이 낮을수록 높은 점수를 받습니다 (0~100)</p></TooltipContent>
                      </Tooltip>
                      <th className="pb-3 px-3 font-medium text-muted-foreground hidden lg:table-cell">추천 이유</th>
                      <th className="pb-3 pl-3 font-medium text-muted-foreground">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((opp, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{opp.keyword}</span>
                            {opp.source === 'ai' ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-600 bg-purple-50 shrink-0">
                                    AI
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent><p>AI가 전략적으로 추천한 시드 키워드입니다</p></TooltipContent>
                              </Tooltip>
                            ) : opp.source === 'naver' ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-600 bg-green-50 shrink-0">
                                    N
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent><p>네이버 검색 데이터에서 발견된 실제 연관 키워드입니다</p></TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-3">{getCategoryBadge(opp.category)}</td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {opp.monthlySearch <= 20 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-muted-foreground cursor-help">{'< 10'}</span>
                              </TooltipTrigger>
                              <TooltipContent><p>네이버에서 월간 검색량이 10 미만인 키워드는 정확한 수치를 제공하지 않습니다</p></TooltipContent>
                            </Tooltip>
                          ) : formatNumber(opp.monthlySearch)}
                        </td>
                        <td className="py-3 px-3 text-center">{getCompBadge(opp.compIdx)}</td>
                        <td className="py-3 px-3 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold cursor-help ${getScoreColor(opp.score)}`}>
                                {opp.score}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent><p>{getScoreTooltip(opp.score)}</p></TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground max-w-[250px] hidden lg:table-cell">
                          {opp.reason}
                        </td>
                        <td className="py-3 pl-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/content?keyword=${encodeURIComponent(opp.keyword)}`}>
                                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                  <Wand2 className="h-3 w-3" />
                                  글쓰기
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent><p>이 키워드로 SEO 최적화된 블로그 글을 AI가 작성합니다</p></TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 빈 상태 */}
      {!result && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-yellow-100 p-4">
              <Lightbulb className="h-8 w-8 text-yellow-500" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">블루오션 키워드를 찾아보세요</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              관심 주제를 입력하면 AI가 경쟁이 낮으면서 검색량이 충분한 블루오션 키워드를 분석해드립니다.
              발견된 키워드로 바로 SEO 최적화 글을 작성할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
