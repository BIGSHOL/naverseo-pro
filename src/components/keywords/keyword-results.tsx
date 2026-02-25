'use client'

import { useState } from 'react'
import { ArrowUpDown, ArrowDown, ArrowUp, Info, Wand2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getCompBadge, getSaturationBadge, getScoreColor, getScoreTooltip, formatNumber } from '@/components/keywords/keyword-utils'
import Link from 'next/link'

export interface KeywordData {
  relKeyword: string
  monthlyPcQcCnt: number
  monthlyMobileQcCnt: number
  monthlyAvePcClkCnt: number
  monthlyAveMobileClkCnt: number
  compIdx: string
  plAvgDepth: number
  totalSearch: number
  score: number
}

interface KeywordResultsProps {
  keywords: KeywordData[]
  isDemo: boolean
}

type SortKey = 'totalSearch' | 'monthlyPcQcCnt' | 'monthlyMobileQcCnt' | 'compIdx' | 'plAvgDepth' | 'score'
type SortDir = 'asc' | 'desc'


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
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">
            검색 결과 ({keywords.length}개)
          </CardTitle>
          <div className="flex items-center gap-2">
            {isDemo && (
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
        </div>
        {/* 모바일 정렬 버튼 */}
        <div className="flex items-center gap-1 mt-2 md:hidden">
          <span className="text-xs text-muted-foreground shrink-0">정렬:</span>
          {([['score', '점수'], ['totalSearch', '검색량'], ['compIdx', '경쟁도'], ['plAvgDepth', '포화도']] as const).map(([key, label]) => (
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
      </CardHeader>
      <CardContent>
        {/* 모바일: 카드 리스트 */}
        <div className="space-y-3 md:hidden">
          {sorted.map((kw, i) => (
            <div key={i} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{kw.relKeyword}</span>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 ${getScoreColor(kw.score)}`}>
                  {kw.score}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="tabular-nums">검색량 {formatNumber(kw.totalSearch)}</span>
                <span className="flex items-center gap-1">경쟁 {getCompBadge(kw.compIdx)}</span>
                <span className="flex items-center gap-1">포화 {getSaturationBadge(kw.plAvgDepth)}</span>
                <span className="tabular-nums text-muted-foreground/70">
                  PC {formatNumber(kw.monthlyPcQcCnt)} / M {formatNumber(kw.monthlyMobileQcCnt)}
                </span>
              </div>
              <div className="mt-2">
                <Link href={`/content?keyword=${encodeURIComponent(kw.relKeyword)}`}>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th
                      className="cursor-pointer pb-3 px-3 text-right font-medium text-muted-foreground whitespace-nowrap"
                      onClick={() => handleSort('totalSearch')}
                    >
                      총 검색량<SortIcon columnKey="totalSearch" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>PC + 모바일 월간 검색량 합계입니다</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th
                      className="cursor-pointer pb-3 px-3 text-right font-medium text-muted-foreground whitespace-nowrap"
                      onClick={() => handleSort('monthlyPcQcCnt')}
                    >
                      PC<SortIcon columnKey="monthlyPcQcCnt" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>PC에서의 월간 검색 횟수입니다</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th
                      className="cursor-pointer pb-3 px-3 text-right font-medium text-muted-foreground whitespace-nowrap"
                      onClick={() => handleSort('monthlyMobileQcCnt')}
                    >
                      모바일<SortIcon columnKey="monthlyMobileQcCnt" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>모바일에서의 월간 검색 횟수입니다</p></TooltipContent>
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
                      onClick={() => handleSort('plAvgDepth')}
                    >
                      포화도<SortIcon columnKey="plAvgDepth" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>검색 광고 평균 노출 깊이입니다. 높을수록 경쟁이 치열한 포화 시장입니다</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th
                      className="cursor-pointer pb-3 pl-3 text-center font-medium text-muted-foreground whitespace-nowrap"
                      onClick={() => handleSort('score')}
                    >
                      추천 점수<SortIcon columnKey="score" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>검색량과 경쟁도를 종합한 블로그 상위 노출 추천 점수입니다 (0~100)</p></TooltipContent>
                </Tooltip>
                <th className="pb-3 pl-3 font-medium text-muted-foreground whitespace-nowrap">
                  액션
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
                  <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(kw.monthlyPcQcCnt)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(kw.monthlyMobileQcCnt)}
                  </td>
                  <td className="py-3 px-3 text-center">{getCompBadge(kw.compIdx)}</td>
                  <td className="py-3 px-3 text-center">{getSaturationBadge(kw.plAvgDepth)}</td>
                  <td className="py-3 pl-3 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold cursor-help ${getScoreColor(kw.score)}`}>
                          {kw.score}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent><p>{getScoreTooltip(kw.score)}</p></TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="py-3 pl-3 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/content?keyword=${encodeURIComponent(kw.relKeyword)}`}>
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
  )
}
