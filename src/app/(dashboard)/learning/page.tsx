'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BrainCircuit, Database, Tag, TrendingUp, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
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
  keyword_research: '키워드 리서치',
  content_generation: '콘텐츠 생성',
  competitor_analysis: '경쟁사 분석',
  blog_index: '블로그 지수',
  rank_tracking: '순위 트래킹',
  unknown: '기타',
}

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#6b7280']
const SOURCE_COLORS: Record<string, string> = {
  keyword_research: '#3b82f6',
  content_generation: '#8b5cf6',
  competitor_analysis: '#ef4444',
  blog_index: '#06b6d4',
  rank_tracking: '#f59e0b',
  unknown: '#6b7280',
}

export default function LearningPage() {
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
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
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">학습 데이터</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BrainCircuit className="h-7 w-7" />
          학습 데이터
        </h1>
        <p className="mt-1 text-muted-foreground">
          상위 노출 블로그 포스트 패턴이 자동으로 수집되어 AI 콘텐츠 생성 품질을 향상시킵니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">분석된 포스트</p>
                <p className="text-3xl font-bold">{stats.totalPosts.toLocaleString()}</p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
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
              <Tag className="h-8 w-8 text-purple-500" />
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
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">평균 품질 점수</p>
                <p className="text-3xl font-bold">{stats.avgQualityScore}/12</p>
              </div>
              <BrainCircuit className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 카테고리 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">콘텐츠 카테고리 분포</CardTitle>
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
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {categoryChartData.map((_entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
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
          </CardHeader>
          <CardContent>
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sourceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="포스트 수">
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
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            최근 수집 내역
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentCollections.length > 0 ? (
            <div className="space-y-3">
              {stats.recentCollections.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.keyword}</span>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[item.keyword_category] || item.keyword_category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {SOURCE_LABELS[item.collected_from] || item.collected_from}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.post_url}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <Badge variant={item.quality_score >= 9 ? 'default' : item.quality_score >= 5 ? 'secondary' : 'outline'}>
                      품질 {item.quality_score}/12
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.collected_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-muted-foreground">
              아직 수집된 데이터가 없습니다. 키워드 리서치, 콘텐츠 생성, 경쟁사 분석 등을 사용하면 자동으로 데이터가 수집됩니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 안내 */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <BrainCircuit className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">자동 학습 시스템</p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                키워드 리서치, AI 콘텐츠 생성, 상위노출 분석, 블로그 지수, 순위 트래킹을 사용할 때마다
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
