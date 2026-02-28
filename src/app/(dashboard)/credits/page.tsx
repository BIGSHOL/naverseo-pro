'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins, TrendingDown, Clock, Zap, Ticket, CheckCircle2, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import { CREDIT_COSTS, CREDIT_FEATURE_LABELS, PLANS, type CreditFeature, type Plan } from '@/types/database'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CreditsData {
  balance: number
  quota: number
  resetAt: string | null
  createdAt: string | null
  plan: string
  featureSummary: Record<string, { count: number; totalSpent: number }>
  dailyStats: { date: string; spent: number }[]
  logs: {
    feature: string
    credits_spent: number
    credits_before: number
    credits_after: number
    created_at: string
  }[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const PAGE_SIZE = 15

const FEATURE_COLORS: Record<string, string> = {
  keyword_research: '#3b82f6',
  keyword_discovery: '#f59e0b',
  content_generation: '#8b5cf6',
  seo_check: '#22c55e',
  competitor_analysis: '#ef4444',
  blog_index: '#06b6d4',
  tracking_per_keyword: '#f97316',
  seo_report: '#14b8a6',
  content_improve: '#ec4899',
}

export default function CreditsPage() {
  const [data, setData] = useState<CreditsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [promoSuccess, setPromoSuccess] = useState('')
  const [featureFilter, setFeatureFilter] = useState('all')
  const [page, setPage] = useState(0)

  const loadCredits = async (currentPage = page, filter = featureFilter) => {
    try {
      setError('')
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(currentPage * PAGE_SIZE),
      })
      if (filter && filter !== 'all') params.set('feature', filter)
      const res = await fetch(`/api/credits?${params}`)
      if (!res.ok) throw new Error('로드 실패')
      setData(await res.json())
    } catch {
      setError('크레딧 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (value: string) => {
    setFeatureFilter(value)
    setPage(0)
    loadCredits(0, value)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadCredits(newPage)
  }

  useEffect(() => {
    loadCredits()
  }, [])

  const handlePromoRedeem = async () => {
    setPromoError('')
    setPromoSuccess('')
    setPromoLoading(true)
    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput.trim() }),
      })
      const result = await res.json()
      if (!res.ok) {
        setPromoError(result.error || '코드 적용 실패')
      } else {
        setPromoSuccess(result.message)
        setPromoInput('')
        loadCredits()
      }
    } catch {
      setPromoError('프로모 코드 적용 중 오류가 발생했습니다.')
    } finally {
      setPromoLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {error || '크레딧 데이터를 불러올 수 없습니다.'}
      </div>
    )
  }

  const plan = data.plan as Plan
  const planInfo = PLANS[plan]
  const usedCredits = data.quota - data.balance
  const usagePercent = data.quota > 0 ? (usedCredits / data.quota) * 100 : 0
  // 리셋 날짜 계산
  // - Free: 가입일 기준 매월 같은 날
  // - 유료: 매월 1일 (또는 DB에 저장된 값)
  function calcResetDate(): Date {
    // DB에 저장된 리셋일이 미래면 그대로 사용
    // 과거(lazy reset 트리거용 epoch 등)이면 새로 계산
    if (data!.resetAt) {
      const stored = new Date(data!.resetAt)
      if (stored > new Date()) return stored
    }
    if (data!.plan === 'free' && data!.createdAt) {
      const signup = new Date(data!.createdAt)
      const signupDay = signup.getDate()
      const now = new Date()
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const day = Math.min(signupDay, lastDay)
      let next = new Date(now.getFullYear(), now.getMonth(), day)
      if (next <= now) {
        const nextLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()
        next = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(signupDay, nextLastDay))
      }
      return next
    }
    return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  }
  const resetDate = calcResetDate()
  const daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  // 기능별 사용 비율 차트 데이터
  const featureChartData = Object.entries(data.featureSummary)
    .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
    .map(([feature, stats]) => ({
      feature: CREDIT_FEATURE_LABELS[feature as CreditFeature] || feature,
      featureKey: feature,
      spent: stats.totalSpent,
      count: stats.count,
    }))

  const totalSpent = featureChartData.reduce((sum, d) => sum + d.spent, 0)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">크레딧 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          크레딧 잔여량과 사용 내역을 확인합니다
        </p>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* 크레딧 잔여 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 shrink-0">
                <Coins className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">크레딧 잔여</p>
                <p className="text-2xl font-bold">
                  {data.balance.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}/ {data.quota.toLocaleString()}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  data.balance / data.quota <= 0.2 ? 'bg-red-500' : data.balance / data.quota <= 0.5 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, (data.balance / data.quota) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* 이번 달 사용량 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 shrink-0">
                <TrendingDown className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">이번 달 사용</p>
                <p className="text-2xl font-bold">
                  {usedCredits.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}크레딧
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-purple-500 transition-all"
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* 리셋까지 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 shrink-0">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">리셋까지</p>
                <p className="text-2xl font-bold">
                  {daysUntilReset}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}일
                  </span>
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {planInfo.name} 플랜 · 매월 {data.quota.toLocaleString()} 크레딧 충전
              <br />
              다음 리셋: {resetDate.toLocaleDateString('ko-KR')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 프로모 코드 입력 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4" />
            프로모 코드
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promoError && (
            <div className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
              {promoError}
            </div>
          )}
          {promoSuccess && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-2.5 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {promoSuccess}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="프로모 코드를 입력하세요"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              className="max-w-xs"
            />
            <Button
              size="sm"
              disabled={promoLoading || !promoInput.trim()}
              onClick={handlePromoRedeem}
            >
              {promoLoading ? '적용 중...' : '적용'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 7일간 크레딧 소모 추이 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">7일간 크레딧 소모</CardTitle>
        </CardHeader>
        <CardContent>
          {data.dailyStats.every(d => d.spent === 0) ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <Zap className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">최근 7일간 사용 내역이 없습니다</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.dailyStats} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value} 크레딧`, '소모']}
                />
                <Area
                  type="monotone" dataKey="spent" name="크레딧 소모"
                  stroke="#8b5cf6" fill="url(#creditGrad)" strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 기능별 사용 비율 + 비용 안내 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 기능별 소모 비율 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">기능별 크레딧 소모</CardTitle>
          </CardHeader>
          <CardContent>
            {featureChartData.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">사용 내역이 없습니다</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={featureChartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    tick={{ fontSize: 11 }}
                    width={90}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, _name: any, props: any) =>
                      [`${value} 크레딧 (${props?.payload?.count ?? 0}회)`, '소모']
                    }
                  />
                  <Bar dataKey="spent" radius={[0, 4, 4, 0]}>
                    {featureChartData.map((entry) => (
                      <Cell
                        key={entry.featureKey}
                        fill={FEATURE_COLORS[entry.featureKey] || '#94a3b8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {totalSpent > 0 && (
              <p className="mt-2 text-xs text-muted-foreground text-right">
                총 {totalSpent.toLocaleString()} 크레딧 소모
              </p>
            )}
          </CardContent>
        </Card>

        {/* 기능별 비용 안내 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">기능별 크레딧 비용</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(Object.entries(CREDIT_COSTS) as [CreditFeature, number][]).map(([feature, cost]) => (
                <div key={feature} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: FEATURE_COLORS[feature] || '#94a3b8' }}
                    />
                    <span className="text-sm">{CREDIT_FEATURE_LABELS[feature]}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {cost} 크레딧
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 최근 사용 내역 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">최근 사용 내역</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={featureFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="전체 기능" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 기능</SelectItem>
                  {(Object.entries(CREDIT_FEATURE_LABELS) as [CreditFeature, string][]).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.logs.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                {featureFilter !== 'all' ? '해당 기능의 사용 내역이 없습니다' : '사용 내역이 없습니다'}
              </p>
              {featureFilter === 'all' && (
                <Link href="/keywords">
                  <Button variant="link" size="sm" className="mt-1 text-xs">
                    키워드 검색 시작하기
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {/* 헤더 */}
              <div className="hidden rounded-lg bg-muted p-2.5 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-4 sm:gap-4">
                <span>기능</span>
                <span>소모</span>
                <span>잔여</span>
                <span>시간</span>
              </div>
              {data.logs.map((log, i) => (
                <div key={i} className="rounded-lg border p-2.5 text-sm sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: FEATURE_COLORS[log.feature] || '#94a3b8' }}
                    />
                    <span className="text-sm">
                      {CREDIT_FEATURE_LABELS[log.feature as CreditFeature] || log.feature}
                    </span>
                  </div>
                  <div>
                    <span className="text-red-600 font-medium">-{log.credits_spent}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {log.credits_after}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {data.pagination.total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <p className="text-xs text-muted-foreground">
                총 {data.pagination.total}건 중 {page * PAGE_SIZE + 1}~{Math.min((page + 1) * PAGE_SIZE, data.pagination.total)}건
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 0}
                  onClick={() => handlePageChange(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground">
                  {page + 1} / {Math.ceil(data.pagination.total / PAGE_SIZE)}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!data.pagination.hasMore}
                  onClick={() => handlePageChange(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
