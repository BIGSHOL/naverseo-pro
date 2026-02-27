'use client'

import { useState } from 'react'
import { ArrowUpDown, ArrowDown, ArrowUp, Info, Wand2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getCompBadge, getSaturationBadge, getScoreColor, getScoreTooltip, formatNumber, getKeywordGrade } from '@/components/keywords/keyword-utils'
import Link from 'next/link'

export interface TopSearchResult {
  rank: number
  type: '블로그' | '카페' | '외부' | '포스트' | '지식인'
  source: string
  link?: string
}

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
  topResults?: TopSearchResult[]
}

interface KeywordResultsProps {
  keywords: KeywordData[]
  isDemo: boolean
}

type SortKey = 'totalSearch' | 'monthlyPcQcCnt' | 'monthlyMobileQcCnt' | 'compIdx' | 'plAvgDepth' | 'score'
type SortDir = 'asc' | 'desc'

// 비블로그 타입 배지 스타일
function getResultTypeBadgeStyle(type: string): string {
  switch (type) {
    case '카페': return 'bg-green-600 text-white'
    case '외부': return 'bg-yellow-600 text-white'
    case '포스트': return 'bg-purple-500 text-white'
    case '지식인': return 'bg-orange-500 text-white'
    default: return 'bg-gray-400 text-white'
  }
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

  const hasTopResults = keywords.some(kw => kw.topResults && kw.topResults.length > 0)

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 inline text-primary" />
      : <ArrowDown className="ml-1 h-3 w-3 inline text-primary" />
  }

  // 1위~5위 셀 렌더링: 블로그면 16등급 배지, 나머지는 타입 배지 (클릭 시 링크 이동)
  const renderTopResultCell = (result: TopSearchResult | undefined, kwScore: number) => {
    if (!result) return <span className="text-[10px] text-muted-foreground">-</span>

    const badge = result.type === '블로그' ? (() => {
      const grade = getKeywordGrade(kwScore)
      return (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold leading-tight ${grade.bgColor} ${grade.color}`}>
          {grade.label}
        </span>
      )
    })() : (
      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${getResultTypeBadgeStyle(result.type)}`}>
        {result.type}
      </span>
    )

    if (result.link) {
      return (
        <a href={result.link} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity cursor-pointer" title={result.source}>
          {badge}
        </a>
      )
    }

    return badge
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
          {sorted.map((kw, i) => {
            const grade = getKeywordGrade(kw.score)
            return (
              <div key={i} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{kw.relKeyword}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={`text-[10px] px-1.5 py-0 ${grade.bgColor} ${grade.color} border-0`}>
                      {grade.label}
                    </Badge>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${getScoreColor(kw.score)}`}>
                      {kw.score}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">검색량 {formatNumber(kw.totalSearch)}</span>
                  <span className="flex items-center gap-1">경쟁 {getCompBadge(kw.compIdx)}</span>
                  <span className="flex items-center gap-1">포화 {getSaturationBadge(kw.plAvgDepth)}</span>
                </div>
                {/* 상위 5개 결과 (모바일) */}
                {kw.topResults && kw.topResults.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[10px] text-muted-foreground mr-1">상위:</span>
                    {kw.topResults.map((r, idx) => (
                      <span key={idx}>
                        {renderTopResultCell(r, kw.score)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <Link href={`/content?keyword=${encodeURIComponent(kw.relKeyword)}`}>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs w-full">
                      <Wand2 className="h-3 w-3" />
                      이 키워드로 글쓰기
                    </Button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* 데스크탑: 테이블 */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[160px]" /> {/* 키워드 */}
              <col className="w-[72px]" />  {/* PC */}
              <col className="w-[72px]" />  {/* 모바일 */}
              <col className="w-[88px]" />  {/* 월 검색량 */}
              <col className="w-[68px]" />  {/* 경쟁도 */}
              <col className="w-[68px]" />  {/* 포화도 */}
              {hasTopResults && <>{[1,2,3,4,5].map(r => <col key={r} className="w-[52px]" />)}</>}
              <col className="w-[52px]" />  {/* 점수 */}
              <col className="w-[56px]" />  {/* 등급 */}
              <col className="w-[72px]" />  {/* 글쓰기 */}
            </colgroup>
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 pr-2 font-medium text-muted-foreground text-xs">키워드</th>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="cursor-pointer pb-3 px-1 text-right font-medium text-muted-foreground whitespace-nowrap text-xs" onClick={() => handleSort('monthlyPcQcCnt')}>
                      PC<SortIcon columnKey="monthlyPcQcCnt" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>PC 월간 검색 횟수</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="cursor-pointer pb-3 px-1 text-right font-medium text-muted-foreground whitespace-nowrap text-xs" onClick={() => handleSort('monthlyMobileQcCnt')}>
                      모바일<SortIcon columnKey="monthlyMobileQcCnt" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>모바일 월간 검색 횟수</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="cursor-pointer pb-3 px-1 text-right font-medium text-muted-foreground whitespace-nowrap text-xs" onClick={() => handleSort('totalSearch')}>
                      월 검색량<SortIcon columnKey="totalSearch" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>PC + 모바일 월간 검색량 합계</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="cursor-pointer pb-3 px-1 text-center font-medium text-muted-foreground whitespace-nowrap text-xs" onClick={() => handleSort('compIdx')}>
                      경쟁도<SortIcon columnKey="compIdx" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>검색 광고 기준 경쟁 정도. 낮을수록 유리</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="cursor-pointer pb-3 px-1 text-center font-medium text-muted-foreground whitespace-nowrap text-xs" onClick={() => handleSort('plAvgDepth')}>
                      포화도<SortIcon columnKey="plAvgDepth" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>광고 평균 노출 깊이. 높을수록 포화 시장</p></TooltipContent>
                </Tooltip>
                {hasTopResults && [1, 2, 3, 4, 5].map(rank => (
                  <th key={rank} className="pb-3 px-0.5 text-center font-medium text-muted-foreground whitespace-nowrap text-xs">
                    {rank}위
                  </th>
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="cursor-pointer pb-3 px-1 text-center font-medium text-muted-foreground whitespace-nowrap text-xs" onClick={() => handleSort('score')}>
                      점수<SortIcon columnKey="score" />
                    </th>
                  </TooltipTrigger>
                  <TooltipContent><p>검색량·경쟁도 종합 추천 점수 (0~100)</p></TooltipContent>
                </Tooltip>
                <th className="pb-3 px-1 font-medium text-muted-foreground whitespace-nowrap text-center text-xs">등급</th>
                <th className="pb-3 pl-1"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kw, i) => {
                const grade = getKeywordGrade(kw.score)
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2 pr-2 font-medium text-sm truncate" title={kw.relKeyword}>{kw.relKeyword}</td>
                    <td className="py-2 px-1 text-right tabular-nums text-xs text-muted-foreground">
                      {formatNumber(kw.monthlyPcQcCnt)}
                    </td>
                    <td className="py-2 px-1 text-right tabular-nums text-xs text-muted-foreground">
                      {formatNumber(kw.monthlyMobileQcCnt)}
                    </td>
                    <td className="py-2 px-1 text-right tabular-nums text-xs font-medium">
                      {formatNumber(kw.totalSearch)}
                    </td>
                    <td className="py-2 px-1 text-center">{getCompBadge(kw.compIdx)}</td>
                    <td className="py-2 px-1 text-center">{getSaturationBadge(kw.plAvgDepth)}</td>
                    {hasTopResults && [0, 1, 2, 3, 4].map(idx => (
                      <td key={idx} className="py-2 px-0.5 text-center">
                        {renderTopResultCell(kw.topResults?.[idx], kw.score)}
                      </td>
                    ))}
                    <td className="py-2 px-1 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold cursor-help ${getScoreColor(kw.score)}`}>
                            {kw.score}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent><p>{getScoreTooltip(kw.score)}</p></TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="py-2 px-1 text-center">
                      <Badge className={`text-[10px] px-1.5 py-0 ${grade.bgColor} ${grade.color} border-0`}>
                        {grade.label}
                      </Badge>
                    </td>
                    <td className="py-2 pl-1 text-center">
                      <Link href={`/content?keyword=${encodeURIComponent(kw.relKeyword)}`}>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
                          <Wand2 className="h-3 w-3" />
                          글쓰기
                        </Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
