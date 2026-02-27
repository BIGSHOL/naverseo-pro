'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Wand2, BarChart3, TrendingUp, ArrowRight, Clock, FileText,
  CalendarDays, FileDown, Activity, Users, Lightbulb,
  Globe, ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Link from 'next/link'
import { PLANS, type Plan } from '@/types/database'
import { timeAgo } from '@/lib/utils/date'
import { ensureUrl } from '@/lib/utils/text'

// ---------- 타입 ----------

interface RecentKeyword {
  id: string
  seed_keyword: string
  created_at: string
}

interface RecentContent {
  id: string
  target_keyword: string
  title: string
  content: string
  status: string
  seo_score: number | null
  created_at: string
}

interface ContentStats {
  total: number
  draft: number
  published: number
  archived: number
  avgSeoScore: number
}

interface DailyActivity {
  date: string
  keywords: number
  content: number
  seo: number
  tracking: number
}

interface BlogProfile {
  blogUrl: string
  blogId: string | null
  blogName: string
  blogThumbnail: string | null
  totalPosts: number
  blogScore: number
  blogLevel: string
  categoryKeywords: string[]
  lastPostDate: string | null
  updatedAt: string | null
}

// ---------- 인라인 컴포넌트 ----------

function CircularProgress({ percent, size = 48, stroke = 4, color = '#3b82f6' }: {
  percent: number; size?: number; stroke?: number; color?: string
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(percent, 100) / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="currentColor" strokeWidth={stroke}
        className="text-muted/20" />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        className="fill-foreground text-[10px] font-semibold">
        {percent === Infinity ? '∞' : `${Math.round(percent)}%`}
      </text>
    </svg>
  )
}

// ---------- 빠른 시작 데이터 ----------

const quickActions = [
  { title: '키워드 검색', href: '/keywords', icon: Search, bg: 'bg-blue-100 text-blue-600' },
  { title: '키워드 발굴', href: '/opportunities', icon: Lightbulb, bg: 'bg-amber-100 text-amber-600' },
  { title: 'AI 콘텐츠', href: '/content', icon: Wand2, bg: 'bg-purple-100 text-purple-600' },
  { title: 'SEO 체크', href: '/seo-check', icon: BarChart3, bg: 'bg-green-100 text-green-600' },
  { title: '상위노출 분석', href: '/competitors', icon: Users, bg: 'bg-rose-100 text-rose-600' },
  { title: '블로그 지수', href: '/blog-index', icon: Activity, bg: 'bg-cyan-100 text-cyan-600' },
  { title: '순위 트래킹', href: '/tracking', icon: TrendingUp, bg: 'bg-orange-100 text-orange-600' },
  { title: '캘린더', href: '/content/calendar', icon: CalendarDays, bg: 'bg-indigo-100 text-indigo-600' },
  { title: 'SEO 리포트', href: '/report', icon: FileDown, bg: 'bg-teal-100 text-teal-600' },
]

// ---------- 메인 컴포넌트 ----------

export default function DashboardPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<Plan>('free')
  const [creditsBalance, setCreditsBalance] = useState(0)
  const [creditsQuota, setCreditsQuota] = useState(30)
  const [recentKeywords, setRecentKeywords] = useState<RecentKeyword[]>([])
  const [recentContent, setRecentContent] = useState<RecentContent[]>([])
  const [contentStats, setContentStats] = useState<ContentStats>({ total: 0, draft: 0, published: 0, archived: 0, avgSeoScore: 0 })
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [trackedKeywordsCount, setTrackedKeywordsCount] = useState(0)
  const [recommendedKeywords, setRecommendedKeywords] = useState<string[]>([])
  const [blogProfile, setBlogProfile] = useState<BlogProfile | null>(null)
  const [greeting, setGreeting] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('좋은 아침입니다')
    else if (hour < 18) setGreeting('좋은 오후입니다')
    else setGreeting('좋은 저녁입니다')

    async function loadDashboard() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) {
          setError('대시보드 데이터를 불러오지 못했습니다.')
          return
        }
        const data = await res.json()

        setPlan((data.profile?.plan || 'free') as Plan)
        setCreditsBalance(data.profile?.credits_balance ?? 30)
        setCreditsQuota(data.profile?.credits_monthly_quota ?? 30)
        setRecentKeywords(data.recentKeywords || [])
        setRecentContent(data.recentContent || [])
        setContentStats(data.contentStats || { total: 0, draft: 0, published: 0, archived: 0, avgSeoScore: 0 })
        setDailyActivity(data.dailyActivity || [])
        setTrackedKeywordsCount(data.trackedKeywordsCount || 0)
        setRecommendedKeywords(data.recommendedKeywords || [])
        setBlogProfile(data.blogProfile || null)
      } catch {
        setError('대시보드 데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const planInfo = PLANS[plan]
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

  // 크레딧 사용량 계산
  const creditsUsed = creditsQuota - creditsBalance
  const creditPercent = creditsQuota > 0 ? (creditsBalance / creditsQuota) * 100 : 0

  // ---------- 로딩 스켈레톤 ----------

  if (loading) {
    return (
      <div className="space-y-6">
        {/* 헤더 스켈레톤 */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        </div>
        {/* 통계 카드 스켈레톤 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* 차트 스켈레톤 */}
        <div className="grid gap-4 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardContent className="p-6">
              <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
              <div className="h-52 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardContent className="p-6">
              <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
              <div className="h-52 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
        {error}
      </div>
    )
  }

  // ---------- 타임라인 통합 ----------

  const timelineItems = [
    ...recentKeywords.map(kw => ({
      type: 'keyword' as const,
      id: kw.id,
      title: kw.seed_keyword,
      body: null as string | null,
      targetKeyword: null as string | null,
      date: kw.created_at,
      status: null as string | null,
      seoScore: null as number | null,
      actionHref: `/content?keyword=${encodeURIComponent(kw.seed_keyword)}`,
      actionLabel: '글쓰기',
    })),
    ...recentContent.map(c => ({
      type: 'content' as const,
      id: c.id,
      title: c.title,
      body: c.content as string | null,
      targetKeyword: c.target_keyword as string | null,
      date: c.created_at,
      status: c.status,
      seoScore: c.seo_score,
      actionHref: `/seo-check?keyword=${encodeURIComponent(c.target_keyword)}`,
      actionLabel: 'SEO 체크',
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)

  // ---------- 렌더 ----------

  return (
    <div className="space-y-6">

      {/* ===== 섹션 1: 헤더 + 워크플로우 ===== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{greeting}</h1>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 cursor-help">
                  <Clock className="h-3 w-3" />
                  {planInfo.name} 플랜
                </Badge>
              </TooltipTrigger>
              <TooltipContent><p>현재 구독 중인 요금제입니다</p></TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{dateStr} — 오늘도 SEO 최적화를 시작하세요</p>
        </div>

        {/* 워크플로우 3단계 */}
        <div className="flex items-center gap-1 sm:gap-2">
          {[
            { label: '키워드 검색', icon: Search, href: '/keywords' },
            { label: 'AI 콘텐츠', icon: Wand2, href: '/content' },
            { label: 'SEO 체크', icon: BarChart3, href: '/seo-check' },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-1 sm:gap-2">
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              <Link href={step.href}>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <step.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{step.label}</span>
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 섹션 2: 크레딧 + 주요 지표 (4카드) ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 크레딧 잔여 */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <CircularProgress percent={creditPercent} color="#3b82f6" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">크레딧 잔여</p>
              <p className="text-lg font-bold">
                {creditsBalance.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {creditsQuota.toLocaleString()}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
        {/* 콘텐츠 현황 */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 shrink-0">
              <Wand2 className="h-5 w-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">총 콘텐츠</p>
              <p className="text-lg font-bold">{contentStats.total}편</p>
            </div>
          </CardContent>
        </Card>
        {/* 평균 SEO 점수 */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full shrink-0 ${
              contentStats.avgSeoScore >= 80 ? 'bg-green-100' : contentStats.avgSeoScore >= 60 ? 'bg-amber-100' : 'bg-red-100'
            }`}>
              <BarChart3 className={`h-5 w-5 ${
                contentStats.avgSeoScore >= 80 ? 'text-green-600' : contentStats.avgSeoScore >= 60 ? 'text-amber-600' : 'text-red-600'
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">평균 SEO</p>
              <p className="text-lg font-bold">
                {contentStats.avgSeoScore > 0 ? `${contentStats.avgSeoScore}점` : '-'}
              </p>
            </div>
          </CardContent>
        </Card>
        {/* 순위 트래킹 */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 shrink-0">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">트래킹 키워드</p>
              <p className="text-lg font-bold">{trackedKeywordsCount}개</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== 블로그 프로필 (등록된 경우에만 표시) ===== */}
      {blogProfile && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              내 블로그
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {blogProfile.blogThumbnail && (
                  <img
                    src={blogProfile.blogThumbnail}
                    alt={blogProfile.blogName}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                )}
                <div className="space-y-2">
                  <div>
                    <h3 className="font-semibold text-lg">{blogProfile.blogName}</h3>
                    <a
                      href={ensureUrl(blogProfile.blogUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      {blogProfile.blogUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">총 포스트:</span>{' '}
                      <span className="font-semibold">{blogProfile.totalPosts.toLocaleString()}개</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">블로그 점수:</span>{' '}
                      <span className="font-semibold">{blogProfile.blogScore}점</span>
                      {blogProfile.blogLevel && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {blogProfile.blogLevel}
                        </Badge>
                      )}
                    </div>
                    {blogProfile.lastPostDate && (
                      <div>
                        <span className="text-muted-foreground">마지막 포스트:</span>{' '}
                        <span className="font-medium">
                          {new Date(blogProfile.lastPostDate).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    )}
                  </div>
                  {blogProfile.categoryKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {blogProfile.categoryKeywords.slice(0, 5).map((keyword, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="shrink-0">
                  관리
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 섹션 3: 주간 활동 차트 ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">주간 활동</CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {dailyActivity.every(d => d.keywords === 0 && d.content === 0 && d.seo === 0 && d.tracking === 0) ? (
            <div className="flex h-52 flex-col items-center justify-center text-center">
              <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">최근 7일간 활동이 없습니다</p>
              <Link href="/keywords">
                <Button variant="link" size="sm" className="mt-1 text-xs">
                  키워드 검색 시작하기 <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyActivity} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="kwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ctGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="seoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="trkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
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
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone" dataKey="keywords" name="키워드"
                  stroke="#3b82f6" fill="url(#kwGrad)" strokeWidth={2}
                />
                <Area
                  type="monotone" dataKey="content" name="콘텐츠"
                  stroke="#a855f7" fill="url(#ctGrad)" strokeWidth={2}
                />
                <Area
                  type="monotone" dataKey="seo" name="SEO 분석"
                  stroke="#22c55e" fill="url(#seoGrad)" strokeWidth={2}
                />
                <Area
                  type="monotone" dataKey="tracking" name="순위 트래킹"
                  stroke="#f97316" fill="url(#trkGrad)" strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ===== 섹션 4: 오늘의 추천 (개인화된 키워드) ===== */}
      <Card className="border-l-4 border-l-primary border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">오늘의 추천</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {recommendedKeywords.length > 0 && recentKeywords.length > 0
                ? '최근 검색 기록을 바탕으로 추천 키워드를 준비했습니다. 클릭하면 바로 콘텐츠 생성을 시작할 수 있습니다.'
                : contentStats.total === 0 && recentKeywords.length === 0
                  ? '키워드 검색부터 시작해보세요! 검색량과 경쟁도를 분석하면 효과적인 콘텐츠 전략을 세울 수 있습니다.'
                  : recentKeywords.length > 0 && contentStats.total === 0
                    ? '키워드를 조회하셨네요! 이제 AI 콘텐츠 생성으로 SEO 최적화된 블로그 글을 만들어보세요.'
                    : contentStats.total > 0 && recentContent.some(c => c.status === 'draft')
                      ? '초안 상태의 콘텐츠가 있습니다. SEO 점수를 확인하고 발행해보세요!'
                      : `총 ${contentStats.total}편의 콘텐츠를 작성했습니다. 꾸준한 포스팅이 상위 노출의 핵심입니다!`
              }
            </p>

            {/* 추천 키워드 목록 */}
            {recommendedKeywords.length > 0 && recentKeywords.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {recommendedKeywords.slice(0, 6).map((kw, idx) => (
                  <Link key={idx} href={`/content?keyword=${encodeURIComponent(kw)}`}>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs px-2.5 py-1"
                    >
                      <Wand2 className="mr-1 h-3 w-3" />
                      {kw}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-3">
              <Link href={
                contentStats.total === 0 && recentKeywords.length === 0 ? '/keywords'
                  : recentKeywords.length > 0 && contentStats.total === 0 ? '/content'
                    : contentStats.total > 0 && recentContent.some(c => c.status === 'draft') ? '/seo-check'
                      : '/keywords'
              }>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  {contentStats.total === 0 && recentKeywords.length === 0 ? '키워드 조회하기'
                    : recentKeywords.length > 0 && contentStats.total === 0 ? '글 작성하기'
                      : contentStats.total > 0 && recentContent.some(c => c.status === 'draft') ? 'SEO 체크하기'
                        : '더 많은 키워드 찾기'
                  }
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== 섹션 5: 콘텐츠 현황 + 최근 활동 통합 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">콘텐츠 현황</CardTitle>
            {contentStats.total > 0 && (
              <span className="text-xs text-muted-foreground">총 {contentStats.total}개</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 콘텐츠 통계 요약 (상태 바 + 평균 SEO) */}
          {contentStats.total > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* 상태 바 */}
              <div className="flex-1 min-w-0">
                <div className="flex h-2.5 rounded-full overflow-hidden">
                  {contentStats.draft > 0 && (
                    <div className="bg-amber-400" style={{ width: `${(contentStats.draft / contentStats.total) * 100}%` }} />
                  )}
                  {contentStats.published > 0 && (
                    <div className="bg-green-500" style={{ width: `${(contentStats.published / contentStats.total) * 100}%` }} />
                  )}
                  {contentStats.archived > 0 && (
                    <div className="bg-gray-400" style={{ width: `${(contentStats.archived / contentStats.total) * 100}%` }} />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" /> 초안 {contentStats.draft}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" /> 발행 {contentStats.published}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-gray-400" /> 보관 {contentStats.archived}
                  </span>
                </div>
              </div>
              {/* 평균 SEO 점수 */}
              <div className="flex items-center gap-3 rounded-lg border px-4 py-2.5 shrink-0">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-bold shrink-0 ${
                  contentStats.avgSeoScore >= 80 ? 'bg-green-500'
                    : contentStats.avgSeoScore >= 60 ? 'bg-yellow-500'
                      : contentStats.avgSeoScore >= 40 ? 'bg-orange-500'
                        : 'bg-red-500'
                }`}>
                  {contentStats.avgSeoScore}
                </div>
                <div>
                  <p className="text-xs font-medium">평균 SEO</p>
                  <p className="text-[10px] text-muted-foreground">
                    {contentStats.avgSeoScore >= 80 ? '최적화 우수'
                      : contentStats.avgSeoScore >= 60 ? '개선 가능'
                        : contentStats.avgSeoScore >= 40 ? '보완 필요'
                          : '개선 필요'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 구분선 */}
          {contentStats.total > 0 && timelineItems.length > 0 && (
            <div className="border-t" />
          )}

          {/* 최근 활동 타임라인 */}
          {timelineItems.length === 0 && contentStats.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">아직 활동 기록이 없습니다</p>
              <Link href="/keywords">
                <Button variant="link" size="sm" className="mt-1 text-xs">
                  키워드 검색 시작하기 <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="relative space-y-0">
              {timelineItems.map((item, idx) => (
                <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {/* 세로선 */}
                  {idx < timelineItems.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                  )}
                  {/* 컬러 dot */}
                  <div className={`relative z-10 mt-1 h-[22px] w-[22px] shrink-0 rounded-full flex items-center justify-center ${
                    item.type === 'keyword' ? 'bg-blue-100' : 'bg-purple-100'
                  }`}>
                    {item.type === 'keyword'
                      ? <Search className="h-3 w-3 text-blue-600" />
                      : <FileText className="h-3 w-3 text-purple-600" />
                    }
                  </div>
                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {item.type === 'content' && item.body ? (
                          <p
                            className="text-sm font-medium truncate cursor-pointer hover:text-primary hover:underline"
                            onClick={() => {
                              sessionStorage.setItem('naverseo-workflow:content-body', item.body!)
                              sessionStorage.setItem('naverseo-workflow:content-title', item.title)
                              sessionStorage.setItem('naverseo-workflow:content-keyword', item.targetKeyword!)
                              router.push('/seo-check?keyword=' + encodeURIComponent(item.targetKeyword!))
                            }}
                          >
                            {item.title}
                          </p>
                        ) : (
                          <p className="text-sm font-medium truncate">{item.title}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {item.type === 'keyword' ? '키워드 검색' : '콘텐츠 생성'} · {timeAgo(item.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.seoScore != null && (
                          <Badge variant="secondary" className={`text-[10px] px-1.5 ${
                            item.seoScore >= 80 ? 'bg-green-100 text-green-700'
                              : item.seoScore >= 60 ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            SEO {item.seoScore}
                          </Badge>
                        )}
                        {item.status && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">
                            {item.status === 'draft' ? '초안' : item.status === 'published' ? '발행' : '보관'}
                          </Badge>
                        )}
                        {item.type === 'content' && item.body ? (
                          <Button
                            variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-primary"
                            onClick={() => {
                              sessionStorage.setItem('naverseo-workflow:content-body', item.body!)
                              sessionStorage.setItem('naverseo-workflow:content-title', item.title)
                              sessionStorage.setItem('naverseo-workflow:content-keyword', item.targetKeyword!)
                              router.push('/seo-check?keyword=' + encodeURIComponent(item.targetKeyword!))
                            }}
                          >
                            SEO 체크
                          </Button>
                        ) : (
                          <Link href={item.actionHref}>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-primary">
                              {item.actionLabel}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 섹션 6: 컴팩트 빠른 시작 ===== */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">빠른 시작</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href}>
              <div className="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
                <div className={`rounded-lg p-2 ${action.bg}`}>
                  <action.icon className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-medium leading-tight">{action.title}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
