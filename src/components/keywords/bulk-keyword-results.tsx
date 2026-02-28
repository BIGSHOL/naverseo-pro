'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Download,
    BarChart3,
    Check,
    X,
    Minus,
} from 'lucide-react'
import type { SearchRankResult } from '@/types/search-rank'
import { ensureUrl } from '@/lib/utils/text'
import { getScoreColor, getKeywordGrade } from '@/components/keywords/keyword-utils'

export interface BulkKeywordData {
    keyword: string
    pcSearchVolume: number
    mobileSearchVolume: number
    totalSearchVolume: number
    compIdx: string
    plAvgDepth: number
    score: number
    monthlyPostCount: number | null
    avgPostDate: string | null
    // 자동완성
    autocomplete?: {
        included: boolean
        suggestions: string[]
    }
    // 인기글 순서 + 상위 유형
    searchRank?: SearchRankResult
}

interface BulkKeywordResultsProps {
    results: BulkKeywordData[]
    isDemo: boolean
}

type SortField =
    | 'keyword'
    | 'pcSearchVolume'
    | 'mobileSearchVolume'
    | 'totalSearchVolume'
    | 'compIdx'
    | 'monthlyPostCount'
    | 'avgPostDate'
    | 'avgPostDate'
    | 'smartBlockOrder'
    | 'autocomplete'
    | 'rank1'
    | 'rank2'
    | 'rank3'
    | 'rank4'
    | 'rank5'
    | 'score'

type SortDirection = 'asc' | 'desc'

// 경쟁도 정렬값
function compIdxValue(compIdx: string): number {
    switch (compIdx) {
        case 'HIGH': return 3
        case 'MEDIUM': return 2
        case 'LOW': return 1
        default: return 0
    }
}

// 경쟁도 라벨
function getCompLabel(compIdx: string): string {
    switch (compIdx) {
        case 'HIGH': return '높음'
        case 'MEDIUM': return '보통'
        case 'LOW': return '낮음'
        default: return '-'
    }
}

// 경쟁도 색상
function getCompColor(compIdx: string): string {
    switch (compIdx) {
        case 'HIGH': return 'text-red-600 bg-red-50'
        case 'MEDIUM': return 'text-amber-600 bg-amber-50'
        case 'LOW': return 'text-green-600 bg-green-50'
        default: return 'text-muted-foreground bg-muted'
    }
}

// 비블로그 타입 배지 스타일 (keyword-results.tsx와 동일)
function getResultTypeBadgeStyle(type: string): string {
    switch (type) {
        case '카페': return 'bg-green-600 text-white'
        case '외부': return 'bg-yellow-600 text-white'
        case '포스트': return 'bg-purple-500 text-white'
        case '지식인': return 'bg-orange-500 text-white'
        default: return 'bg-gray-400 text-white'
    }
}

// 유형 정렬용 숫자값
function typeOrderValue(type?: string): number {
    switch (type) {
        case '블로그': return 5
        case '카페': return 4
        case '포스트': return 3
        case '외부': return 1
        default: return 0
    }
}

export function BulkKeywordResults({ results, isDemo }: BulkKeywordResultsProps) {
    const [sortField, setSortField] = useState<SortField>('totalSearchVolume')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortField(field)
            setSortDirection('desc')
        }
    }

    const sortedResults = useMemo(() => {
        return [...results].sort((a, b) => {
            let aVal: number | string = 0
            let bVal: number | string = 0

            switch (sortField) {
                case 'keyword':
                    aVal = a.keyword
                    bVal = b.keyword
                    break
                case 'pcSearchVolume':
                    aVal = a.pcSearchVolume
                    bVal = b.pcSearchVolume
                    break
                case 'mobileSearchVolume':
                    aVal = a.mobileSearchVolume
                    bVal = b.mobileSearchVolume
                    break
                case 'totalSearchVolume':
                    aVal = a.totalSearchVolume
                    bVal = b.totalSearchVolume
                    break
                case 'compIdx':
                    aVal = compIdxValue(a.compIdx)
                    bVal = compIdxValue(b.compIdx)
                    break
                case 'monthlyPostCount':
                    aVal = a.monthlyPostCount ?? -1
                    bVal = b.monthlyPostCount ?? -1
                    break
                case 'avgPostDate':
                    aVal = a.avgPostDate || ''
                    bVal = b.avgPostDate || ''
                    break
                case 'smartBlockOrder':
                    aVal = a.searchRank?.smartBlockOrder ?? 999
                    bVal = b.searchRank?.smartBlockOrder ?? 999
                    break
                case 'autocomplete':
                    aVal = a.autocomplete?.included ? 1 : 0
                    bVal = b.autocomplete?.included ? 1 : 0
                    break
                case 'rank1':
                case 'rank2':
                case 'rank3':
                case 'rank4':
                case 'rank5': {
                    const ri = Number(sortField.replace('rank', '')) - 1
                    aVal = typeOrderValue(a.searchRank?.topResults?.[ri]?.type)
                    bVal = typeOrderValue(b.searchRank?.topResults?.[ri]?.type)
                    break
                }
                case 'score':
                    aVal = a.score
                    bVal = b.score
                    break
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc'
                    ? aVal.localeCompare(bVal, 'ko')
                    : bVal.localeCompare(aVal, 'ko')
            }

            return sortDirection === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number)
        })
    }, [results, sortField, sortDirection])

    // CSV 내보내기
    const handleExportCSV = () => {
        const headers = [
            '키워드', 'PC조회수', 'MB조회수', '월 검색량', '경쟁도',
            '발행량', '평균 발행일', '인기글 순서', '자동완성',
            '1위 유형', '1위 URL', '2위 유형', '2위 URL',
            '3위 유형', '3위 URL', '4위 유형', '4위 URL',
            '5위 유형', '5위 URL', '추천점수',
        ]

        const rows = sortedResults.map((r) => {
            const topResults = r.searchRank?.topResults || []
            const rankCols: (string | number)[] = []
            for (let i = 0; i < 5; i++) {
                rankCols.push(topResults[i]?.typeDetail || '-')
                rankCols.push(topResults[i]?.url || '-')
            }
            return [
                r.keyword,
                r.pcSearchVolume,
                r.mobileSearchVolume,
                r.totalSearchVolume,
                getCompLabel(r.compIdx),
                r.monthlyPostCount ?? '-',
                r.avgPostDate ?? '-',
                r.searchRank?.hasSmartBlock
                    ? `${r.searchRank.smartBlockOrder}번째`
                    : '미포함',
                r.autocomplete?.included ? '포함' : '미포함',
                ...rankCols,
                r.score,
            ]
        })

        // BOM + CSV
        const csvContent = '\ufeff' + [
            headers.join(','),
            ...rows.map((row) =>
                row.map((cell) =>
                    typeof cell === 'string' && cell.includes(',')
                        ? `"${cell}"`
                        : cell
                ).join(',')
            ),
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `키워드_대량조회_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
        return sortDirection === 'asc'
            ? <ArrowUp className="ml-1 h-3 w-3" />
            : <ArrowDown className="ml-1 h-3 w-3" />
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-1.5 text-base sm:text-lg">
                        <BarChart3 className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                        <span className="whitespace-nowrap">조회 결과</span>
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">{results.length}개</Badge>
                        {isDemo && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 sm:text-xs">
                                데모
                            </Badge>
                        )}
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={handleExportCSV} className="shrink-0 h-8 px-2 text-xs sm:px-3">
                        <Download className="h-3.5 w-3.5 sm:mr-2" />
                        <span className="hidden sm:inline">CSV 내보내기</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table style={{ tableLayout: 'fixed', minWidth: 1100 }}>
                        <colgroup>
                            <col style={{ width: 110 }} />{/* 키워드 */}
                            <col style={{ width: 72 }} />{/* PC조회수 */}
                            <col style={{ width: 72 }} />{/* MB조회수 */}
                            <col style={{ width: 82 }} />{/* 월 검색량 */}
                            <col style={{ width: 68 }} />{/* 발행량 */}
                            <col style={{ width: 60 }} />{/* 경쟁도 */}
                            <col style={{ width: 76 }} />{/* 평균 발행일 */}
                            <col style={{ width: 72 }} />{/* 인기글 순서 */}
                            <col style={{ width: 60 }} />{/* 자동완성 */}
                            <col style={{ width: 56 }} />{/* 1위 */}
                            <col style={{ width: 56 }} />{/* 2위 */}
                            <col style={{ width: 56 }} />{/* 3위 */}
                            <col style={{ width: 56 }} />{/* 4위 */}
                            <col style={{ width: 56 }} />{/* 5위 */}
                            <col style={{ width: 48 }} />{/* 점수 */}
                        </colgroup>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="sticky left-0 z-10 bg-muted/50 text-center px-1">
                                    <button
                                        onClick={() => handleSort('keyword')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        키워드 <SortIcon field="keyword" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('pcSearchVolume')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        PC조회수 <SortIcon field="pcSearchVolume" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('mobileSearchVolume')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        MB조회수 <SortIcon field="mobileSearchVolume" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('totalSearchVolume')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        월 검색량 <SortIcon field="totalSearchVolume" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('monthlyPostCount')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        발행량 <SortIcon field="monthlyPostCount" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('compIdx')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        경쟁도 <SortIcon field="compIdx" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('avgPostDate')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        평균 발행일 <SortIcon field="avgPostDate" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('smartBlockOrder')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        인기글 순서 <SortIcon field="smartBlockOrder" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('autocomplete')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        자동완성 <SortIcon field="autocomplete" />
                                    </button>
                                </TableHead>
                                {([1, 2, 3, 4, 5] as const).map((n) => (
                                    <TableHead key={n} className="text-center px-1">
                                        <button
                                            onClick={() => handleSort(`rank${n}` as SortField)}
                                            className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                        >
                                            {n}위 <SortIcon field={`rank${n}` as SortField} />
                                        </button>
                                    </TableHead>
                                ))}
                                <TableHead className="text-center px-1">
                                    <button
                                        onClick={() => handleSort('score')}
                                        className="flex items-center justify-center text-xs font-semibold whitespace-nowrap w-full"
                                    >
                                        점수 <SortIcon field="score" />
                                    </button>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedResults.map((row, idx) => {
                                const topResults = row.searchRank?.topResults || []
                                const isHighVolume = row.totalSearchVolume >= 5000

                                return (
                                    <TableRow
                                        key={idx}
                                        className={isHighVolume ? 'bg-blue-50/30 font-medium' : ''}
                                    >
                                        {/* 키워드 (sticky) */}
                                        <TableCell className={`sticky left-0 z-10 whitespace-nowrap text-center text-sm px-1 truncate ${isHighVolume ? 'bg-blue-50/80 font-semibold' : 'bg-background'}`}>
                                            {row.keyword}
                                        </TableCell>

                                        {/* PC 조회수 */}
                                        <TableCell className="text-center tabular-nums text-sm px-1">
                                            {row.pcSearchVolume.toLocaleString()}
                                        </TableCell>

                                        {/* 모바일 조회수 */}
                                        <TableCell className="text-center tabular-nums text-sm px-1">
                                            {row.mobileSearchVolume.toLocaleString()}
                                        </TableCell>

                                        {/* 월 검색량 */}
                                        <TableCell className="text-center tabular-nums text-sm font-semibold px-1">
                                            {row.totalSearchVolume.toLocaleString()}
                                        </TableCell>

                                        {/* 발행량 */}
                                        <TableCell className="text-center tabular-nums text-sm px-1">
                                            {row.monthlyPostCount !== null
                                                ? row.monthlyPostCount.toLocaleString()
                                                : <Minus className="mx-auto h-3 w-3 text-muted-foreground" />
                                            }
                                        </TableCell>

                                        {/* 경쟁도 */}
                                        <TableCell className="text-center px-1">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getCompColor(row.compIdx)}`}>
                                                {getCompLabel(row.compIdx)}
                                            </span>
                                        </TableCell>

                                        {/* 평균 발행일 */}
                                        <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap px-1">
                                            {row.avgPostDate || '-'}
                                        </TableCell>

                                        {/* 인기글 순서 */}
                                        <TableCell className="text-center text-xs px-1">
                                            {row.searchRank?.hasSmartBlock ? (
                                                <span className="text-blue-600 font-medium">
                                                    {row.searchRank.smartBlockOrder}번째
                                                </span>
                                            ) : row.searchRank ? (
                                                <span className="text-muted-foreground">미포함</span>
                                            ) : (
                                                <Minus className="mx-auto h-3 w-3 text-muted-foreground" />
                                            )}
                                        </TableCell>

                                        {/* 자동완성 */}
                                        <TableCell className="text-center px-1">
                                            {row.autocomplete ? (
                                                row.autocomplete.included ? (
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Check className="mx-auto h-4 w-4 text-green-600" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="text-xs">자동완성에 포함됨</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <X className="mx-auto h-4 w-4 text-muted-foreground/50" />
                                                )
                                            ) : (
                                                <Minus className="mx-auto h-3 w-3 text-muted-foreground" />
                                            )}
                                        </TableCell>

                                        {/* 1~5위: 블로그→16등급 라벨, 비블로그→타입 배지 */}
                                        {[0, 1, 2, 3, 4].map((rankIdx) => {
                                            const item = topResults[rankIdx]
                                            return (
                                                <TableCell key={rankIdx} className="text-center px-1">
                                                    {item ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <a
                                                                    href={ensureUrl(item.url)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-block cursor-pointer hover:opacity-70 transition-opacity"
                                                                >
                                                                    {item.type === '블로그' ? (
                                                                        (() => {
                                                                            const grade = getKeywordGrade(row.score)
                                                                            return (
                                                                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold leading-tight ${grade.bgColor} ${grade.color}`}>
                                                                                    {grade.label}
                                                                                </span>
                                                                            )
                                                                        })()
                                                                    ) : (
                                                                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${getResultTypeBadgeStyle(item.type)}`}>
                                                                            {item.type}
                                                                        </span>
                                                                    )}
                                                                </a>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="bottom" className="max-w-[280px]">
                                                                {item.title && (
                                                                    <p className="text-xs font-medium truncate">{item.title}</p>
                                                                )}
                                                                <p className="text-[10px] text-muted-foreground truncate">{item.source}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        <Minus className="mx-auto h-3 w-3 text-muted-foreground" />
                                                    )}
                                                </TableCell>
                                            )
                                        })}

                                        {/* 추천 점수 */}
                                        <TableCell className="text-center px-1">
                                            <span className={`text-sm font-bold ${getScoreColor(row.score, true)}`}>
                                                {row.score}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
