'use client'

import { useState, useMemo } from 'react'
import { Lightbulb, Loader2, Search, Wand2, Info, ArrowUpDown, ArrowUp, ArrowDown, Target, Clock } from 'lucide-react'
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
}

interface OpportunityResult {
  topic: string
  opportunities: OpportunityItem[]
  summary: string
  isDemo: boolean
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
    const compMap: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }
    return result.opportunities.map(opp => ({
      x: compMap[opp.compIdx] || 2,
      y: opp.monthlySearch,
      z: opp.score,
      keyword: opp.keyword,
      compIdx: opp.compIdx,
      category: opp.category,
    }))
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
              AI가 블루오션 키워드를 분석하고 있습니다...
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              15~20개 키워드 생성 + 실제 검색량 조회 중 (약 10~20초)
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
                <div className="w-full h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[0.5, 3.5]}
                        ticks={[1, 2, 3]}
                        tickFormatter={(v: number) => v === 1 ? '낮음' : v === 2 ? '보통' : '높음'}
                        label={{ value: '경쟁도 →', position: 'insideBottom', offset: -20, fontSize: 12 }}
                        fontSize={12}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v >= 1000 ? `${(v / 1000).toFixed(1)}천` : String(v)}
                        label={{ value: '월간 검색량 →', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12 }}
                        fontSize={11}
                      />
                      <ZAxis type="number" dataKey="z" range={[80, 500]} />
                      <RechartsTooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as (typeof matrixData)[0]
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
                              <p className="font-semibold">{d.keyword}</p>
                              <p className="text-muted-foreground">
                                검색량: {formatNumber(d.y)} · 경쟁: {d.compIdx === 'LOW' ? '낮음' : d.compIdx === 'MEDIUM' ? '보통' : '높음'}
                              </p>
                              <p className="text-primary font-medium">기회 점수: {d.z}점</p>
                            </div>
                          )
                        }}
                      />
                      <Scatter data={matrixData}>
                        {matrixData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.z >= 70 ? '#22c55e' : entry.z >= 40 ? '#eab308' : '#ef4444'}
                            fillOpacity={0.7}
                            stroke={entry.z >= 70 ? '#16a34a' : entry.z >= 40 ? '#ca8a04' : '#dc2626'}
                            strokeWidth={1}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                {/* 범례 */}
                <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> 높은 기회 (70+)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" /> 보통 (40~69)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> 낮은 기회 (&lt;40)
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
                        <td className="py-3 pr-4 font-medium">{opp.keyword}</td>
                        <td className="py-3 px-3">{getCategoryBadge(opp.category)}</td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {formatNumber(opp.monthlySearch)}
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
