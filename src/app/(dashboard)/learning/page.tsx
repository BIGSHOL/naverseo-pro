'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BrainCircuit, Database, Tag, TrendingUp, Clock, ChevronDown, Info, ExternalLink } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'

interface LearningStats {
  totalPosts: number
  uniqueKeywords: number
  categoryDistribution: Record<string, number>
  sourceDistribution: Record<string, number>
  patternCount: number
  avgQualityScore: number
  recentCollections: Array<{
    keyword: string
    keyword_category: string
    post_url: string
    quality_score: number
    collected_from: string
    collected_at: string
  }>
  lastCollectedAt: string | null
  dailyTrend: Array<{ date: string; count: number }>
}

const CATEGORY_LABELS: Record<string, string> = {
  informational: '정보형',
  comparison: '비교/추천형',
  review: '후기/리뷰형',
  howto: '방법/가이드형',
  listicle: '리스트형',
  local: '지역업종형',
  unknown: '미분류',
}

const SOURCE_LABELS: Record<string, string> = {
  keyword_research: '키워드 검색',
  keyword_bulk: '키워드 일괄검색',
  content_generation: '콘텐츠 생성',
  competitor_analysis: '경쟁사 분석',
  blog_index: '블로그 지수',
  rank_tracking: '순위 트래킹',
  unknown: '기타',
}

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#6b7280']
const SOURCE_COLORS: Record<string, string> = {
  keyword_research: '#3b82f6',
  keyword_bulk: '#60a5fa',
  content_generation: '#8b5cf6',
  competitor_analysis: '#ef4444',
  blog_index: '#06b6d4',
  rank_tracking: '#f59e0b',
  unknown: '#6b7280',
}

function qualityColor(score: number) {
  if (score >= 9) return 'text-green-600 dark:text-green-400'
  if (score >= 5) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-500 dark:text-red-400'
}

function qualityBadgeVariant(score: number): 'default' | 'secondary' | 'outline' {
  if (score >= 9) return 'default'
  if (score >= 5) return 'secondary'
  return 'outline'
}

function formatRelativeTime(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

export default function LearningPage() {
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCount, setShowCount] = useState(10)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/blog-learning/stats')
      if (res.ok) {
        setStats(await res.json())
      } else {
        setError('통계를 불러오는데 실패했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">학습 데이터</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-[250px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">학습 데이터</h1>
        <div className="mt-4 rounded-lg bg-destructive/10 p-4 text-destructive">
          {error || '통계를 불러올 수 없습니다.'}
        </div>
      </div>
    )
  }

  // 차트 데이터 준비
  const categoryChartData = Object.entries(stats.categoryDistribution)
    .map(([key, value]) => ({
      name: CATEGORY_LABELS[key] || key,
      value,
    }))
    .sort((a, b) => b.value - a.value)

  const sourceChartData = Object.entries(stats.sourceDistribution)
    .map(([key, value]) => ({
      name: SOURCE_LABELS[key] || key,
      fullKey: key,
      count: value,
    }))
    .sort((a, b) => b.count - a.count)

  const dailyTrendData = (stats.dailyTrend || []).map(d => ({
    ...d,
    label: `${parseInt(d.date.slice(5, 7))}/${parseInt(d.date.slice(8, 10))}`,
  }))

  const visibleCollections = stats.recentCollections.slice(0, showCount)
  const hasMore = stats.recentCollections.length > showCount

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BrainCircuit className="h-7 w-7" />
            학습 데이터
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            상위 노출 블로그 포스트 패턴이 자동 수집되어 AI 콘텐츠 품질을 향상시킵니다.
          </p>
        </div>
        {stats.lastCollectedAt && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            마지막 수집: {formatRelativeTime(stats.lastCollectedAt)}
          </p>
        )}
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">분석된 포스트</p>
                <p className="text-3xl font-bold">{stats.totalPosts.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">학습된 키워드</p>
                <p className="text-3xl font-bold">{stats.uniqueKeywords.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/30">
                <Tag className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">집계 패턴</p>
                <p className="text-3xl font-bold">{stats.patternCount}</p>
              </div>
              <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        평균 품질 점수
                        <Info className="h-3.5 w-3.5" />
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">0~12점 범위 (9점 이상: 우수, 5~8점: 보통, 4점 이하: 미흡)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className={`text-3xl font-bold ${qualityColor(stats.avgQualityScore)}`}>
                  {stats.avgQualityScore}
                  <span className="text-lg font-normal text-muted-foreground">/12</span>
                </p>
              </div>
              <div className="rounded-lg bg-orange-100 p-2.5 dark:bg-orange-900/30">
                <BrainCircuit className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 수집 추이 차트 (14일) */}
      {dailyTrendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 14일 수집 추이</CardTitle>
            <CardDescription>일별 포스트 수집 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyTrendData}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} width={30} />
                <RechartsTooltip
                  formatter={(value: any) => [`${value}건`, '수집']}
                  labelFormatter={(label: any) => `날짜: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#trendGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 차트 영역 2열 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 카테고리 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">콘텐츠 카테고리 분포</CardTitle>
            <CardDescription>수집된 포스트의 유형별 비율</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {categoryChartData.map((_entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => [`${value}건`, '포스트']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-muted-foreground">아직 데이터가 없습니다</p>
            )}
          </CardContent>
        </Card>

        {/* 수집 출처 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">수집 출처별 포스트 수</CardTitle>
            <CardDescription>어떤 기능에서 데이터가 수집되었는지</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sourceChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} width={30} />
                  <RechartsTooltip formatter={(value: any) => [`${value}건`, '포스트']} />
                  <Bar dataKey="count" name="포스트 수" radius={[4, 4, 0, 0]}>
                    {sourceChartData.map((entry, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[entry.fullKey] || '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-muted-foreground">아직 데이터가 없습니다</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 수집 내역 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                최근 수집 내역
              </CardTitle>
              <CardDescription>최근 수집된 상위 노출 포스트 패턴</CardDescription>
            </div>
            {stats.recentCollections.length > 0 && (
              <Badge variant="secondary">{stats.recentCollections.length}건</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {visibleCollections.length > 0 ? (
            <div className="space-y-2">
              {visibleCollections.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{item.keyword}</span>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[item.keyword_category] || item.keyword_category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {SOURCE_LABELS[item.collected_from] || item.collected_from}
                      </Badge>
                    </div>
                    <a
                      href={item.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {item.post_url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <Badge variant={qualityBadgeVariant(item.quality_score)}>
                      품질 {item.quality_score}/12
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(item.collected_at)}
                    </p>
                  </div>
                </div>
              ))}

              {hasMore && (
                <div className="pt-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCount(prev => prev + 10)}
                    className="text-muted-foreground"
                  >
                    <ChevronDown className="mr-1 h-4 w-4" />
                    더보기
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Database className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                아직 수집된 데이터가 없습니다.
              </p>
              <p className="mt-1 text-sm text-muted-foreground/80">
                키워드 검색, 콘텐츠 생성, 경쟁사 분석 등을 사용하면 자동으로 수집됩니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 안내 카드 */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <BrainCircuit className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">자동 학습 시스템</p>
              <p className="mt-1 leading-relaxed text-blue-700 dark:text-blue-300">
                키워드 검색, AI 콘텐츠 생성, 상위노출 분석, 블로그 지수, 순위 트래킹을 사용할 때마다
                상위 블로그 포스트의 구조 패턴(글자 수, 이미지 수, 소제목 수, 톤 등)이 자동으로 수집됩니다.
                충분한 데이터가 쌓이면 AI 콘텐츠 생성 시 검증된 패턴이 프롬프트에 자동 주입되어 더 높은 품질의 콘텐츠를 생성합니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
