'use client'

import { useState } from 'react'
import { Lightbulb, Loader2, Search, Wand2, Info, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

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

function getCompBadge(compIdx: string) {
  switch (compIdx) {
    case 'HIGH':
      return <Badge variant="destructive" className="text-xs">높음</Badge>
    case 'MEDIUM':
      return <Badge variant="secondary" className="text-xs">보통</Badge>
    case 'LOW':
      return <Badge className="bg-green-100 text-green-700 text-xs hover:bg-green-100">낮음</Badge>
    default:
      return <Badge variant="outline" className="text-xs">-</Badge>
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600 bg-green-50'
  if (score >= 40) return 'text-yellow-600 bg-yellow-50'
  return 'text-red-600 bg-red-50'
}

function getCategoryBadge(category: string) {
  const colors: Record<string, string> = {
    '정보형': 'bg-blue-100 text-blue-700',
    '비교형': 'bg-purple-100 text-purple-700',
    '구매형': 'bg-orange-100 text-orange-700',
    '경험형': 'bg-pink-100 text-pink-700',
  }
  return (
    <Badge className={`text-xs ${colors[category] || 'bg-gray-100 text-gray-700'} hover:opacity-80`}>
      {category}
    </Badge>
  )
}

function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}만`
  return num.toLocaleString()
}

export default function OpportunitiesPage() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<OpportunityResult | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSearch = async (searchTopic?: string) => {
    const t = (searchTopic || topic).trim()
    if (!t || loading) return

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
        setError(data.error || '키워드 기회 분석에 실패했습니다.')
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
          키워드 기회 발견
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

            {/* 예시 주제 */}
            {!result && !loading && (
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
                      <Badge variant="outline" className="gap-1">
                        <Info className="h-3 w-3" />
                        데모 데이터
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{result.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                      <th
                        className="cursor-pointer pb-3 px-3 text-right font-medium text-muted-foreground whitespace-nowrap"
                        onClick={() => handleSort('monthlySearch')}
                      >
                        월간 검색량<SortIcon columnKey="monthlySearch" />
                      </th>
                      <th
                        className="cursor-pointer pb-3 px-3 text-center font-medium text-muted-foreground whitespace-nowrap"
                        onClick={() => handleSort('compIdx')}
                      >
                        경쟁도<SortIcon columnKey="compIdx" />
                      </th>
                      <th
                        className="cursor-pointer pb-3 px-3 text-center font-medium text-muted-foreground whitespace-nowrap"
                        onClick={() => handleSort('score')}
                      >
                        기회 점수<SortIcon columnKey="score" />
                      </th>
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
                          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${getScoreColor(opp.score)}`}>
                            {opp.score}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground max-w-[250px] hidden lg:table-cell">
                          {opp.reason}
                        </td>
                        <td className="py-3 pl-3">
                          <Link href={`/content?keyword=${encodeURIComponent(opp.keyword)}`}>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs">
                              <Wand2 className="h-3 w-3" />
                              글쓰기
                            </Button>
                          </Link>
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
