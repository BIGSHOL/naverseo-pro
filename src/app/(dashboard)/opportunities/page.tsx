'use client'

import { useState, useMemo } from 'react'
import { Lightbulb, Loader2, Search, Wand2, Info, ArrowUpDown, ArrowUp, ArrowDown, Target, Clock, Sparkles, Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getCompBadge, getCategoryBadge, getScoreColor, getScoreTooltip, formatNumber } from '@/components/keywords/keyword-utils'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell, ZAxis } from 'recharts'
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

  // 산점도 매트릭스 데이터: X=경쟁도(낮을수록 좋음), Y=검색량, 버블크기=기회점수
  const matrixData = useMemo(() => {
    if (!result) return []
    // '-'(미확인)은 별도 위치(0)에 표시
    const compMap: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }
    return result.opportunities.map((opp, i) => {
      const baseX = compMap[opp.compIdx] ?? 0
      // 같은 위치에 겹치는 점들을 분산시키기 위한 jitter
      const jitterX = ((i % 5) - 2) * 0.08
      const jitterY = ((Math.floor(i / 5) % 3) - 1) * 0.06
      return {
        x: baseX + jitterX,
        y: opp.monthlySearch * (1 + jitterY),
        rawY: opp.monthlySearch,
        z: opp.score,
        keyword: opp.keyword,
        compIdx: opp.compIdx,
        category: opp.category,
        source: opp.source,
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

  // Y축 최대값: 데이터 기반 동적 계산 (최소 100)
  const yAxisMax = useMemo(() => {
    if (!result) return 100
    const maxSearch = Math.max(...result.opportunities.map(o => o.monthlySearch))
    return Math.max(100, Math.ceil(maxSearch * 1.2 / 50) * 50)
  }, [result])

  // X축에 "미확인" 축이 필요한지
  const hasUnknownComp = useMemo(() => {
    if (!result) return false
    return result.opportunities.some(o => o.compIdx !== 'LOW' && o.compIdx !== 'MEDIUM' && o.compIdx !== 'HIGH')
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

          {/* 기회 매트릭스 산점도 */}
          {matrixData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  기회 매트릭스
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  왼쪽 위(검색량 높음 + 경쟁 낮음)에 위치할수록 블루오션 키워드입니다. 원 크기 = 기회 점수
                </p>
              </CardHeader>
              <CardContent>
                {/* 데이터 품질 안내 */}
                {dataQuality.isLowData && (
                  <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">검색 데이터가 제한적입니다</p>
                      <p className="text-xs mt-0.5 text-amber-700">
                        {dataQuality.lowDataCount}개 키워드의 월간 검색량이 10 미만으로, 네이버가 정확한 데이터를 제공하지 않습니다.
                        니치/지역 키워드는 검색량이 적더라도 경쟁이 낮아 상위 노출에 유리할 수 있습니다.
                      </p>
                    </div>
                  </div>
                )}
                <div className="w-full h-[380px] overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[hasUnknownComp ? -0.5 : 0.5, 3.5]}
                        ticks={hasUnknownComp ? [0, 1, 2, 3] : [1, 2, 3]}
                        tickFormatter={(v: number) => v === 0 ? '미확인' : v === 1 ? '낮음' : v === 2 ? '보통' : '높음'}
                        label={{ value: '경쟁도 →', position: 'insideBottom', offset: -30, style: { fontSize: 13, fontWeight: 500, fill: '#6b7280' } }}
                        tick={{ fontSize: 13, fontWeight: 500, fill: '#374151' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        tickLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        domain={[0, yAxisMax]}
                        tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v >= 1000 ? `${(v / 1000).toFixed(0)}천` : String(Math.round(v))}
                        label={{ value: '월간 검색량', angle: -90, position: 'insideLeft', offset: -10, style: { fontSize: 13, fontWeight: 500, fill: '#6b7280' } }}
                        tick={{ fontSize: 12, fill: '#374151' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        tickLine={{ stroke: '#d1d5db' }}
                        width={55}
                      />
                      <ZAxis type="number" dataKey="z" range={[40, 220]} />
                      <RechartsTooltip
                        cursor={{ strokeDasharray: '3 3', stroke: '#9ca3af' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as (typeof matrixData)[0]
                          const compLabel = d.compIdx === 'LOW' ? '낮음' : d.compIdx === 'MEDIUM' ? '보통' : d.compIdx === 'HIGH' ? '높음' : '미확인'
                          const sourceLabel = d.source === 'ai' ? 'AI 추천' : d.source === 'naver' ? '네이버 발견' : ''
                          return (
                            <div className="rounded-lg border bg-background/95 backdrop-blur p-3 shadow-lg text-sm min-w-[180px]">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="font-semibold text-foreground">{d.keyword}</p>
                                {sourceLabel && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${d.source === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>{sourceLabel}</span>}
                              </div>
                              <div className="space-y-0.5 text-muted-foreground">
                                <p>검색량: <span className="font-medium text-foreground">{d.rawY <= 20 ? '< 10' : formatNumber(d.rawY)}</span>/월</p>
                                <p>경쟁도: <span className="font-medium text-foreground">{compLabel}</span></p>
                                <p>기회 점수: <span className={`font-bold ${d.z >= 70 ? 'text-green-600' : d.z >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{d.z}점</span></p>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Scatter data={matrixData}>
                        {matrixData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.z >= 70 ? '#22c55e' : entry.z >= 40 ? '#f59e0b' : '#ef4444'}
                            fillOpacity={0.65}
                            stroke={entry.z >= 70 ? '#16a34a' : entry.z >= 40 ? '#d97706' : '#dc2626'}
                            strokeWidth={1.5}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                {/* 범례 */}
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> 높은 기회 (70+)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" /> 보통 (40~69)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> 낮은 기회 (&lt;40)
                  </span>
                  <span className="border-l pl-4 ml-2 flex items-center gap-1.5">
                    <span className="inline-block px-1 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 font-medium">AI</span> AI 추천
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block px-1 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-medium">N</span> 네이버 연관
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
