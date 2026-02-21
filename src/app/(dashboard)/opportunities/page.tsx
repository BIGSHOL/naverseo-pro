'use client'

import { useState, useMemo } from 'react'
import { Lightbulb, Loader2, Search, Wand2, Info, ArrowUpDown, ArrowUp, ArrowDown, Target, Clock, Sparkles, Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getCompBadge, getCategoryBadge, getScoreColor, getScoreTooltip, formatNumber } from '@/components/keywords/keyword-utils'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, ReferenceArea, ReferenceLine } from 'recharts'
import Link from 'next/link'
import { useKeywordHistory } from '@/hooks/use-keyword-history'

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
}

type SortKey = 'monthlySearch' | 'compIdx' | 'score'
type SortDir = 'asc' | 'desc'

const EXAMPLE_TOPICS = ['캠핑', '다이어트', '인테리어', '육아', '요리', '부업', '여행', '운동']


export default function OpportunitiesPage() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<OpportunityResult | null>(null)
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

    try {
      const res = await fetch('/api/ai/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '키워드 발굴 분석에 실패했습니다.')
        return
      }

      setResult(data)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
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

  const sorted = result
    ? [...result.opportunities].sort((a, b) => {
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
    : []

  // 산점도 매트릭스 데이터: X=기회점수, Y=검색량
  const matrixData = useMemo(() => {
    if (!result) return []
    return result.opportunities.map((opp, i) => {
      // 같은 점수에서 겹침 방지용 소폭 jitter
      const jitterX = ((i % 3) - 1) * 0.4
      const jitterY = ((Math.floor(i / 3) % 3) - 1) * 0.015
      return {
        x: opp.score + jitterX,
        y: opp.monthlySearch * (1 + jitterY),
        rawScore: opp.score,
        rawSearch: opp.monthlySearch,
        keyword: opp.keyword,
        compIdx: opp.compIdx,
        category: opp.category,
        source: opp.source,
        isTopRanked: i < 5,
      }
    })
  }, [result])

  // 데이터 품질 분석: 검색량이 충분한지 판단
  const dataQuality = useMemo(() => {
    if (!result) return { isLowData: false, lowDataCount: 0 }
    const lowDataCount = result.opportunities.filter(o => o.monthlySearch <= 20).length
    return {
      isLowData: lowDataCount > result.opportunities.length * 0.7,
      lowDataCount,
    }
  }, [result])

  // Y축 최대값
  const yAxisMax = useMemo(() => {
    if (!result) return 100
    const maxSearch = Math.max(...result.opportunities.map(o => o.monthlySearch))
    return Math.max(100, Math.ceil(maxSearch * 1.2 / 100) * 100)
  }, [result])

  // 차트 X축 범위 + 존 경계선
  const scoreRange = useMemo(() => {
    if (!result || result.opportunities.length === 0) return { min: 40, max: 80, threshold: 60 }
    const scores = result.opportunities.map(o => o.score)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    return {
      min: Math.max(0, minScore - 5),
      max: Math.min(100, maxScore + 8),
      threshold: Math.round((minScore + maxScore) / 2),
    }
  }, [result])

  // 검색량 중앙값 (존 경계용)
  const searchMedian = useMemo(() => {
    if (!result || result.opportunities.length === 0) return 500
    const sorted = [...result.opportunities].map(o => o.monthlySearch).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
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
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          키워드 발굴
        </h1>
        <p className="mt-1 text-muted-foreground">
          주제를 입력하면 AI가 경쟁이 낮고 검색량이 충분한 블루오션 키워드를 찾아드립니다
        </p>
      </div>

      {/* 검색 폼 */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="주제 키워드를 입력하세요 (예: 캠핑, 다이어트, 인테리어)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !topic.trim()}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {loading ? '분석 중...' : '블루오션 키워드 찾기'}
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
                </div>
              </div>
            )}
          </form>

          {error && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 로딩 */}
      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              AI 시드 키워드 생성 → 네이버 연관 키워드 확장 중...
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              AI 전략 키워드 + 네이버 실제 데이터 조합 (약 10~20초)
            </p>
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
                    <h3 className="font-semibold">AI 분석 요약</h3>
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
          {matrixData.length > 0 && (
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
                <div className="relative w-full h-[420px]">
                  {/* 존 라벨 (HTML 오버레이) */}
                  <span className="absolute top-7 right-12 z-10 text-[11px] font-semibold text-emerald-600/50 pointer-events-none select-none">최고 기회</span>
                  <span className="absolute bottom-[68px] right-12 z-10 text-[11px] font-semibold text-blue-500/50 pointer-events-none select-none">틈새 기회</span>
                  <span className="absolute top-7 left-[58px] z-10 text-[11px] font-semibold text-amber-500/50 pointer-events-none select-none">경쟁 치열</span>
                  <span className="absolute bottom-[68px] left-[58px] z-10 text-[11px] font-semibold text-gray-400/50 pointer-events-none select-none">관망</span>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 24, right: 30, bottom: 50, left: 40 }}>
                      {/* 4분면 배경 존 */}
                      <ReferenceArea x1={scoreRange.threshold} x2={scoreRange.max + 2} y1={searchMedian} y2={yAxisMax} fill="#10b981" fillOpacity={0.06} stroke="none" />
                      <ReferenceArea x1={scoreRange.threshold} x2={scoreRange.max + 2} y1={0} y2={searchMedian} fill="#3b82f6" fillOpacity={0.05} stroke="none" />
                      <ReferenceArea x1={scoreRange.min - 2} x2={scoreRange.threshold} y1={searchMedian} y2={yAxisMax} fill="#f59e0b" fillOpacity={0.04} stroke="none" />
                      <ReferenceArea x1={scoreRange.min - 2} x2={scoreRange.threshold} y1={0} y2={searchMedian} fill="#9ca3af" fillOpacity={0.03} stroke="none" />
                      {/* 존 경계선 */}
                      <ReferenceLine x={scoreRange.threshold} stroke="#e5e7eb" strokeDasharray="6 4" />
                      <ReferenceLine y={searchMedian} stroke="#e5e7eb" strokeDasharray="6 4" />
                      <CartesianGrid strokeDasharray="3 3" opacity={0.06} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[scoreRange.min, scoreRange.max]}
                        label={{ value: '기회 점수 →', position: 'insideBottom', offset: -32, style: { fontSize: 12, fontWeight: 500, fill: '#6b7280' } }}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        domain={[0, yAxisMax]}
                        tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v >= 1000 ? `${(v / 1000).toFixed(0)}천` : String(Math.round(v))}
                        label={{ value: '월간 검색량', angle: -90, position: 'insideLeft', offset: -22, style: { fontSize: 12, fontWeight: 500, fill: '#6b7280' } }}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickLine={false}
                        width={50}
                      />
                      <RechartsTooltip
                        cursor={{ strokeDasharray: '3 3', stroke: '#d1d5db' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as (typeof matrixData)[0]
                          const compLabel = d.compIdx === 'LOW' ? '낮음' : d.compIdx === 'MEDIUM' ? '보통' : d.compIdx === 'HIGH' ? '높음' : '미확인'
                          return (
                            <div className="rounded-xl border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-xl text-sm min-w-[200px]">
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${d.source === 'ai' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                                <span className="font-semibold truncate">{d.keyword}</span>
                                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${d.source === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {d.source === 'ai' ? 'AI' : 'N'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                <span className="text-muted-foreground">기회 점수</span>
                                <span className={`font-bold text-right ${d.rawScore >= 65 ? 'text-emerald-600' : d.rawScore >= 55 ? 'text-amber-600' : 'text-red-500'}`}>{d.rawScore}점</span>
                                <span className="text-muted-foreground">월간 검색량</span>
                                <span className="font-medium text-right">{d.rawSearch <= 20 ? '< 10' : formatNumber(d.rawSearch)}</span>
                                <span className="text-muted-foreground">경쟁도</span>
                                <span className="font-medium text-right">{compLabel}</span>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Scatter
                        data={matrixData}
                        shape={(props: unknown) => {
                          const { cx, cy, payload } = props as { cx: number; cy: number; payload: (typeof matrixData)[0] }
                          if (!cx || !cy) return <g />
                          const isAi = payload.source === 'ai'
                          const isTop = payload.isTopRanked
                          const r = isTop ? 9 : 6
                          const fill = isAi ? '#a855f7' : '#10b981'
                          const stroke = isAi ? '#7c3aed' : '#059669'
                          return (
                            <g>
                              {isTop && <circle cx={cx} cy={cy} r={r + 5} fill={fill} fillOpacity={0.1} />}
                              <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={0.75} stroke={stroke} strokeWidth={1.5} />
                              {isTop && (
                                <text x={cx + r + 4} y={cy + 4} fontSize={10} fontWeight={500} fill="#374151">
                                  {payload.keyword.length > 8 ? payload.keyword.slice(0, 8) + '…' : payload.keyword}
                                </text>
                              )}
                            </g>
                          )
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                {/* 범례 */}
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-purple-500" /> AI 추천
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" /> 네이버 연관
                  </span>
                  <span className="border-l pl-4 ml-1 flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-5 rounded-sm bg-emerald-500/15 border border-emerald-500/20" /> 최고 기회
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-5 rounded-sm bg-blue-500/15 border border-blue-500/20" /> 틈새 기회
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-5 rounded-sm bg-amber-500/15 border border-amber-500/20" /> 경쟁 치열
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 기회 키워드 테이블 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                블루오션 키워드 ({result.opportunities.length}개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
