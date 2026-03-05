'use client'

import { useEffect, useState, useRef } from 'react'
import {
  FileDown,
  RefreshCw,
  FileText,
  Award,
  Target,
  Coins,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  Search,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'
import { PLANS, type Plan } from '@/types/database'
import { PlanGateAlert } from '@/components/plan-gate-alert'

// ─── 타입 ───

interface ReportData {
  profile: {
    plan: Plan
    email: string
    credits_balance: number
    credits_monthly_quota: number
  }
  generatedAt: string

  summary: {
    thisMonth: { contentCount: number; avgSeoScore: number | null; top10Count: number; creditsUsed: number }
    lastMonth: { contentCount: number; avgSeoScore: number | null; top10Count: number; creditsUsed: number }
  }

  seoPerformance: {
    gradeDistribution: Array<{ grade: string; label: string; color: string; count: number }>
    weeklyAvg: Array<{ week: string; avg: number; count: number }>
  }

  rankingPerformance: {
    distribution: Array<{ range: string; count: number }>
    sectionDistribution: Array<{ section: string; count: number }>
  }

  insights: string[]

  keywords: Array<{ id: string; seed_keyword: string; created_at: string }>
  contents: Array<{ id: string; target_keyword: string; title: string; status: string; seo_score: number | null; created_at: string }>
  tracking: Array<{ keyword: string; blog_url: string; rank_position: number | null; section: string | null; checked_at: string }>
}

// ─── 상수 ───

const RANK_COLORS: Record<string, string> = {
  'TOP 5': '#22c55e',
  'TOP 6-10': '#3b82f6',
  '11-20위': '#eab308',
  '21-50위': '#f97316',
  '100+': '#ef4444',
}

const SECTION_COLORS: Record<string, string> = {
  '블로그탭': '#3b82f6',
  '스마트블록': '#8b5cf6',
  'VIEW탭': '#22c55e',
}

const PAGE_SIZE = 10

// ─── 트렌드 배지 컴포넌트 ───

function TrendBadge({ current, previous, unit = '', invertColor = false }: {
  current: number; previous: number; unit?: string; invertColor?: boolean
}) {
  if (previous === 0 && current === 0) return null
  const diff = current - previous
  if (diff === 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground whitespace-nowrap">
      <Minus className="h-3 w-3" /> 변동없음
    </span>
  )
  const isUp = diff > 0
  const colorClass = invertColor
    ? (isUp ? 'text-red-500' : 'text-green-600')
    : (isUp ? 'text-green-600' : 'text-red-500')
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs whitespace-nowrap ${colorClass}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? '+' : ''}{diff}{unit} vs 지난달
    </span>
  )
}

// ─── 페이지네이션 컴포넌트 ───

function Pagination({ page, totalPages, onPageChange }: {
  page: number; totalPages: number; onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3 print:hidden">
      <p className="text-xs text-muted-foreground">{page} / {totalPages} 페이지</p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 w-7 p-0"
          disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0"
          disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── 차트 커스텀 Tooltip 스타일 ───

const tooltipStyle = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
}

// ─── 메인 컴포넌트 ───

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [planGateMessage, setPlanGateMessage] = useState('')
  const reportRef = useRef<HTMLDivElement>(null)
  const [keywordsPage, setKeywordsPage] = useState(1)
  const [contentsPage, setContentsPage] = useState(1)
  const [trackingPage, setTrackingPage] = useState(1)

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await fetch('/api/report')
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          if (json.planGate) {
            setPlanGateMessage(json.error)
          } else {
            setError(json.error || '리포트 데이터를 불러오지 못했습니다.')
          }
          return
        }
        const json = await res.json()
        setData(json)
      } catch {
        setError('리포트를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (planGateMessage) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">SEO 리포트</h1>
        <PlanGateAlert message={planGateMessage} />
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

  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        리포트 데이터를 불러올 수 없습니다.
      </div>
    )
  }

  const { summary, seoPerformance, rankingPerformance, insights } = data
  const planInfo = PLANS[data.profile.plan]

  return (
    <div className="space-y-6">
      {/* 헤더 (프린트 시 숨김) */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">SEO 리포트 <span className="text-sm font-normal text-muted-foreground">(1크레딧)</span></h1>
          <p className="mt-1 text-sm text-muted-foreground truncate">
            SEO 성과를 한눈에 파악하고 전략적 인사이트를 확인하세요
          </p>
        </div>
        <Button onClick={() => window.print()} className="gap-2 shrink-0">
          <FileDown className="h-4 w-4" />
          <span className="hidden sm:inline">PDF 저장</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>

      {/* 리포트 본문 */}
      <div ref={reportRef} className="space-y-6 print:space-y-4">
        {/* 프린트 헤더 */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">NaverSEO Pro - SEO 전략 리포트</h1>
          <p className="text-sm text-muted-foreground">
            생성일: {new Date(data.generatedAt).toLocaleDateString('ko-KR')} · {data.profile.email} · {planInfo.name}
          </p>
          <hr className="mt-2" />
        </div>

        {/* ═══ Section 1: Executive Summary ═══ */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
          {/* 콘텐츠 생성 */}
          <Card className="print:border print:shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <p className="text-sm text-muted-foreground">콘텐츠 생성</p>
              </div>
              <p className="mt-1 text-2xl font-bold">{summary.thisMonth.contentCount}편</p>
              <TrendBadge
                current={summary.thisMonth.contentCount}
                previous={summary.lastMonth.contentCount}
                unit="편"
              />
            </CardContent>
          </Card>

          {/* 평균 SEO 점수 */}
          <Card className="print:border print:shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-green-600" />
                <p className="text-sm text-muted-foreground">평균 SEO 점수</p>
              </div>
              <p className="mt-1 text-2xl font-bold">
                {summary.thisMonth.avgSeoScore !== null ? `${summary.thisMonth.avgSeoScore}점` : '-'}
              </p>
              {summary.thisMonth.avgSeoScore !== null && summary.lastMonth.avgSeoScore !== null && (
                <TrendBadge
                  current={summary.thisMonth.avgSeoScore}
                  previous={summary.lastMonth.avgSeoScore}
                  unit="점"
                />
              )}
            </CardContent>
          </Card>

          {/* TOP10 키워드 */}
          <Card className="print:border print:shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-muted-foreground">TOP10 키워드</p>
              </div>
              <p className="mt-1 text-2xl font-bold">{summary.thisMonth.top10Count}개</p>
              <TrendBadge
                current={summary.thisMonth.top10Count}
                previous={summary.lastMonth.top10Count}
                unit="개"
              />
            </CardContent>
          </Card>

          {/* 크레딧 사용 */}
          <Card className="print:border print:shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-orange-600" />
                <p className="text-sm text-muted-foreground">크레딧 사용</p>
              </div>
              <p className="mt-1 text-2xl font-bold">{summary.thisMonth.creditsUsed}</p>
              <TrendBadge
                current={summary.thisMonth.creditsUsed}
                previous={summary.lastMonth.creditsUsed}
                invertColor
              />
            </CardContent>
          </Card>
        </div>

        {/* ═══ Section 2: SEO 성과 ═══ */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 print:grid-cols-2">
          {/* SEO 등급 분포 (도넛) */}
          <Card className="print:border print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">SEO 등급 분포</CardTitle>
            </CardHeader>
            <CardContent>
              {seoPerformance.gradeDistribution.length > 0 ? (
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={seoPerformance.gradeDistribution}
                        cx="50%" cy="50%"
                        outerRadius={75} innerRadius={38}
                        dataKey="count"
                        label={false}
                      >
                        {seoPerformance.gradeDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: any, _: any, props: any) =>
                          [`${value}편`, props?.payload?.label || '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                    {seoPerformance.gradeDistribution.map((g, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                        {g.label} ({g.count})
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">콘텐츠를 생성하면 등급 분포를 확인할 수 있습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 주간 평균 SEO 점수 (AreaChart) */}
          <Card className="print:border print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">주간 평균 SEO 점수 (8주)</CardTitle>
            </CardHeader>
            <CardContent>
              {seoPerformance.weeklyAvg.some(w => w.count > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={seoPerformance.weeklyAvg} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="seoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} fontSize={11} tickLine={false} width={35} />
                    <RechartsTooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: any, _: any, props: any) =>
                        [`${value}점 (${props?.payload?.count || 0}편)`, '평균']}
                    />
                    <Area type="monotone" dataKey="avg" stroke="#3b82f6" fill="url(#seoGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] flex-col items-center justify-center text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">콘텐츠를 생성하면 점수 추이를 확인할 수 있습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══ Section 3: 순위 성과 ═══ */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 print:grid-cols-2 print:break-before-page">
          {/* 순위 분포 (가로 BarChart) */}
          <Card className="print:border print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">순위 분포</CardTitle>
            </CardHeader>
            <CardContent>
              {rankingPerformance.distribution.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={rankingPerformance.distribution} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={11} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="range" width={65} fontSize={11} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: any) => [`${value}개`, '키워드']}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {rankingPerformance.distribution.map((entry, i) => (
                        <Cell key={i} fill={RANK_COLORS[entry.range] || '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] flex-col items-center justify-center text-center">
                  <Search className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">순위 트래킹을 설정하면 분포를 확인할 수 있습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 섹션 분포 (도넛) */}
          <Card className="print:border print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">검색 섹션 분포</CardTitle>
            </CardHeader>
            <CardContent>
              {rankingPerformance.sectionDistribution.length > 0 ? (
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={rankingPerformance.sectionDistribution}
                        cx="50%" cy="50%"
                        outerRadius={75} innerRadius={38}
                        dataKey="count"
                        label={false}
                      >
                        {rankingPerformance.sectionDistribution.map((entry, i) => (
                          <Cell key={i} fill={SECTION_COLORS[entry.section] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: any) => [`${value}개`, '키워드']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                    {rankingPerformance.sectionDistribution.map((s, i) => {
                      const total = rankingPerformance.sectionDistribution.reduce((sum, e) => sum + e.count, 0)
                      const pct = total > 0 ? ((s.count / total) * 100).toFixed(0) : '0'
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: SECTION_COLORS[s.section] || '#94a3b8' }} />
                          {s.section} {pct}%
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center text-center">
                  <Target className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">순위 트래킹을 설정하면 섹션별 노출을 확인할 수 있습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══ Section 4: 전략적 인사이트 ═══ */}
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              전략적 인사이트
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{insight}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ═══ Section 5: 상세 데이터 (Accordion) ═══ */}
        <Accordion type="multiple" defaultValue={[]} className="space-y-2">
          {/* 키워드 검색 */}
          {data.keywords.length > 0 && (() => {
            const kwTotalPages = Math.ceil(data.keywords.length / PAGE_SIZE)
            const kwSlice = data.keywords.slice((keywordsPage - 1) * PAGE_SIZE, keywordsPage * PAGE_SIZE)
            const kwOffset = (keywordsPage - 1) * PAGE_SIZE
            return (
              <AccordionItem value="keywords" className="rounded-lg border px-4 print:border print:shadow-none">
                <AccordionTrigger className="text-sm font-medium print:pointer-events-none">
                  키워드 검색 ({data.keywords.length}건)
                </AccordionTrigger>
                <AccordionContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">시드 키워드</th>
                          <th className="pb-2 font-medium">조회일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kwSlice.map((kw, i) => (
                          <tr key={kw.id} className="border-b last:border-0">
                            <td className="py-2 text-muted-foreground">{kwOffset + i + 1}</td>
                            <td className="py-2 font-medium">{kw.seed_keyword}</td>
                            <td className="py-2 text-muted-foreground">
                              {new Date(kw.created_at).toLocaleDateString('ko-KR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={keywordsPage} totalPages={kwTotalPages} onPageChange={setKeywordsPage} />
                </AccordionContent>
              </AccordionItem>
            )
          })()}

          {/* 생성된 콘텐츠 */}
          {data.contents.length > 0 && (() => {
            const ctTotalPages = Math.ceil(data.contents.length / PAGE_SIZE)
            const ctSlice = data.contents.slice((contentsPage - 1) * PAGE_SIZE, contentsPage * PAGE_SIZE)
            const ctOffset = (contentsPage - 1) * PAGE_SIZE
            return (
              <AccordionItem value="contents" className="rounded-lg border px-4 print:border print:shadow-none">
                <AccordionTrigger className="text-sm font-medium print:pointer-events-none">
                  생성된 콘텐츠 ({data.contents.length}건)
                </AccordionTrigger>
                <AccordionContent>
                  {/* 모바일 */}
                  <div className="space-y-3 md:hidden">
                    {ctSlice.map((c, i) => (
                      <div key={c.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm line-clamp-2 flex-1">
                            <span className="text-muted-foreground mr-1">{ctOffset + i + 1}.</span>
                            {c.title}
                          </p>
                          {c.seo_score !== null ? (
                            <span className={`text-sm font-bold shrink-0 ${
                              c.seo_score >= 70 ? 'text-green-600' : c.seo_score >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {c.seo_score}점
                            </span>
                          ) : <span className="text-muted-foreground shrink-0">-</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                          <Badge variant="outline" className="text-[10px] max-w-[120px] truncate">{c.target_keyword}</Badge>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {c.status === 'draft' ? '초안' : c.status === 'published' ? '발행' : '보관'}
                          </Badge>
                          <span className="shrink-0">{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 데스크탑 */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">제목</th>
                          <th className="pb-2 font-medium">키워드</th>
                          <th className="pb-2 font-medium">상태</th>
                          <th className="pb-2 font-medium">SEO</th>
                          <th className="pb-2 font-medium">생성일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ctSlice.map((c, i) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="py-2 text-muted-foreground">{ctOffset + i + 1}</td>
                            <td className="max-w-[200px] truncate py-2 font-medium">{c.title}</td>
                            <td className="py-2">{c.target_keyword}</td>
                            <td className="py-2">
                              <Badge variant="secondary" className="text-xs">
                                {c.status === 'draft' ? '초안' : c.status === 'published' ? '발행' : '보관'}
                              </Badge>
                            </td>
                            <td className="py-2">
                              {c.seo_score !== null ? (
                                <span className={`font-medium ${
                                  c.seo_score >= 70 ? 'text-green-600' : c.seo_score >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {c.seo_score}점
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString('ko-KR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={contentsPage} totalPages={ctTotalPages} onPageChange={setContentsPage} />
                </AccordionContent>
              </AccordionItem>
            )
          })()}

          {/* 순위 트래킹 */}
          {data.tracking.length > 0 && (() => {
            const trTotalPages = Math.ceil(data.tracking.length / PAGE_SIZE)
            const trSlice = data.tracking.slice((trackingPage - 1) * PAGE_SIZE, trackingPage * PAGE_SIZE)
            const trOffset = (trackingPage - 1) * PAGE_SIZE
            return (
              <AccordionItem value="tracking" className="rounded-lg border px-4 print:border print:shadow-none">
                <AccordionTrigger className="text-sm font-medium print:pointer-events-none">
                  순위 트래킹 현황 ({data.tracking.length}건)
                </AccordionTrigger>
                <AccordionContent>
                  {/* 모바일 */}
                  <div className="space-y-3 md:hidden">
                    {trSlice.map((t, i) => (
                      <div key={`${t.keyword}-${t.blog_url}-${trOffset + i}`} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm min-w-0 truncate">
                            <span className="text-muted-foreground mr-1">{trOffset + i + 1}.</span>
                            {t.keyword}
                          </span>
                          {t.rank_position !== null ? (
                            <span className={`text-sm font-bold shrink-0 ${
                              t.rank_position <= 5 ? 'text-green-600' : t.rank_position <= 10 ? 'text-blue-600' : ''
                            }`}>
                              {t.rank_position}위
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground shrink-0">100+</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground min-w-0">
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {t.section === 'blog' ? '블로그탭' : t.section === 'smartblock' ? '스마트블록' : t.section === 'view' ? 'VIEW탭' : t.section || '-'}
                          </Badge>
                          <span className="truncate min-w-0">{t.blog_url}</span>
                          <span className="shrink-0">{new Date(t.checked_at).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 데스크탑 */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">키워드</th>
                          <th className="pb-2 font-medium">블로그</th>
                          <th className="pb-2 font-medium">섹션</th>
                          <th className="pb-2 font-medium">순위</th>
                          <th className="pb-2 font-medium">확인일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trSlice.map((t, i) => (
                          <tr key={`${t.keyword}-${t.blog_url}-${trOffset + i}`} className="border-b last:border-0">
                            <td className="py-2 text-muted-foreground">{trOffset + i + 1}</td>
                            <td className="py-2 font-medium">{t.keyword}</td>
                            <td className="max-w-[200px] truncate py-2 text-muted-foreground">{t.blog_url}</td>
                            <td className="py-2">
                              <Badge variant="outline" className="text-xs">
                                {t.section === 'blog' ? '블로그탭' : t.section === 'smartblock' ? '스마트블록' : t.section === 'view' ? 'VIEW탭' : t.section || '-'}
                              </Badge>
                            </td>
                            <td className="py-2">
                              {t.rank_position !== null ? (
                                <span className={
                                  t.rank_position <= 5
                                    ? 'font-bold text-green-600'
                                    : t.rank_position <= 10
                                      ? 'font-bold text-blue-600'
                                      : 'font-medium'
                                }>
                                  {t.rank_position}위
                                </span>
                              ) : (
                                <span className="text-muted-foreground">100+</span>
                              )}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {new Date(t.checked_at).toLocaleDateString('ko-KR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={trackingPage} totalPages={trTotalPages} onPageChange={setTrackingPage} />
                </AccordionContent>
              </AccordionItem>
            )
          })()}
        </Accordion>

        {/* 프린트 푸터 */}
        <div className="hidden text-center text-xs text-muted-foreground print:block">
          <hr className="mb-2" />
          NaverSEO Pro · {new Date(data.generatedAt).toLocaleDateString('ko-KR')}{' '}
          {new Date(data.generatedAt).toLocaleTimeString('ko-KR')} 생성
        </div>
      </div>
    </div>
  )
}
