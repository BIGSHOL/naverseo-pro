'use client'

import { useState } from 'react'
import { ArrowUpDown, ArrowDown, ArrowUp, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface KeywordData {
  relKeyword: string
  monthlyPcQcCnt: number
  monthlyMobileQcCnt: number
  monthlyAvePcClkCnt: number
  monthlyAveMobileClkCnt: number
  compIdx: string
  totalSearch: number
  score: number
}

interface KeywordResultsProps {
  keywords: KeywordData[]
  isDemo: boolean
}

type SortKey = 'totalSearch' | 'monthlyPcQcCnt' | 'monthlyMobileQcCnt' | 'compIdx' | 'score'
type SortDir = 'asc' | 'desc'

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

function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}만`
  return num.toLocaleString()
}

export function KeywordResults({ keywords, isDemo }: KeywordResultsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...keywords].sort((a, b) => {
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

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 inline text-primary" />
      : <ArrowDown className="ml-1 h-3 w-3 inline text-primary" />
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            검색 결과 ({keywords.length}개)
          </CardTitle>
          {isDemo && (
            <Badge variant="outline" className="gap-1">
              <Info className="h-3 w-3" />
              데모 데이터
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 pr-4 font-medium text-muted-foreground">키워드</th>
                <th
                  className="cursor-pointer pb-3 px-3 text-right font-medium text-muted-foreground whitespace-nowrap"
                  onClick={() => handleSort('totalSearch')}
                >
                  총 검색량<SortIcon columnKey="totalSearch" />
                </th>
                <th
                  className="cursor-pointer pb-3 px-3 text-right font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell"
                  onClick={() => handleSort('monthlyPcQcCnt')}
                >
                  PC<SortIcon columnKey="monthlyPcQcCnt" />
                </th>
                <th
                  className="cursor-pointer pb-3 px-3 text-right font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell"
                  onClick={() => handleSort('monthlyMobileQcCnt')}
                >
                  모바일<SortIcon columnKey="monthlyMobileQcCnt" />
                </th>
                <th
                  className="cursor-pointer pb-3 px-3 text-center font-medium text-muted-foreground whitespace-nowrap"
                  onClick={() => handleSort('compIdx')}
                >
                  경쟁도<SortIcon columnKey="compIdx" />
                </th>
                <th
                  className="cursor-pointer pb-3 pl-3 text-center font-medium text-muted-foreground whitespace-nowrap"
                  onClick={() => handleSort('score')}
                >
                  추천 점수<SortIcon columnKey="score" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kw, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-4 font-medium">{kw.relKeyword}</td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {formatNumber(kw.totalSearch)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                    {formatNumber(kw.monthlyPcQcCnt)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                    {formatNumber(kw.monthlyMobileQcCnt)}
                  </td>
                  <td className="py-3 px-3 text-center">{getCompBadge(kw.compIdx)}</td>
                  <td className="py-3 pl-3 text-center">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${getScoreColor(kw.score)}`}>
                      {kw.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
