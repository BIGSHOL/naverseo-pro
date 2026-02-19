'use client'

import { useState } from 'react'
import {
  Activity,
  Loader2,
  TrendingUp,
  Target,
  Award,
  AlertCircle,
  Minus,
  FileText,
  Clock,
  Zap,
  BookOpen,
  Star,
  User,
  Calendar,
  ExternalLink,
  Image as ImageIcon,
  BarChart3,
  ArrowUpRight,
  Shield,
  Gauge,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// ===== 타입 정의 =====

interface AnalysisCategory {
  name: string
  score: number
  maxScore: number
  grade: string
  details: string[]
}

interface KeywordRankResult {
  keyword: string
  rank: number | null
  totalResults: number
}

interface BlogLevelInfo {
  tier: number
  category: string
  label: string
  description: string
  color: string
  nextTierScore: number | null
}

interface PostQuality {
  score: number
  tier: number
  label: string
  category: string
}

interface PostDetail {
  title: string
  link: string
  daysAgo: number
  date: string
  charCount: number
  hasImage: boolean
  titleLength: number
  quality?: PostQuality
}

interface BlogProfile {
  blogId: string | null
  blogName: string | null
  blogUrl: string
  totalPosts: number
  categoryKeywords: string[]
  estimatedStartDate: string | null
  isActive: boolean
  blogAgeDays?: number | null
  postsPerWeek?: number | null
}

interface BenchmarkData {
  postingFrequency: { mine: number; recommended: number; topBlogger: number }
  avgTitleLength: { mine: number; optimal: number }
  avgContentLength: { mine: number; recommended: number }
  imageRate: { mine: number; recommended: number }
  topicFocus: { mine: number; recommended: number }
  optimizationPct: number
  categoryPercentile: number
}

interface BlogIndexResult {
  blogUrl: string
  blogId: string | null
  totalScore: number
  level: BlogLevelInfo
  categories: AnalysisCategory[]
  keywordResults: KeywordRankResult[]
  postAnalysis: {
    totalFound: number
    avgTitleLength: number
    avgDescLength: number
    topicKeywords: string[]
    postingFrequency: string
    recentPostDays: number | null
  }
  recentPosts?: PostDetail[]
  blogProfile?: BlogProfile
  benchmark?: BenchmarkData
  recommendations: string[]
  isDemo: boolean
  checkedAt: string
}

// ===== SVG 레이더 차트 =====

function RadarChart({ categories }: { categories: AnalysisCategory[] }) {
  const size = 200
  const center = size / 2
  const radius = 70
  const levels = 4

  // 5축 각도 (12시 방향 시작, 시계 방향)
  const angles = categories.map((_, i) => (Math.PI * 2 * i) / categories.length - Math.PI / 2)

  // 레벨 그리드 그리기
  const gridPaths = Array.from({ length: levels }, (_, level) => {
    const r = (radius * (level + 1)) / levels
    const points = angles.map((angle) => `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`)
    return points.join(' ')
  })

  // 데이터 영역
  const dataPoints = categories.map((cat, i) => {
    const ratio = cat.score / cat.maxScore
    const r = radius * ratio
    return `${center + r * Math.cos(angles[i])},${center + r * Math.sin(angles[i])}`
  })

  // 축 라벨 위치
  const labelPositions = categories.map((cat, i) => {
    const labelRadius = radius + 24
    const x = center + labelRadius * Math.cos(angles[i])
    const y = center + labelRadius * Math.sin(angles[i])
    return { name: cat.name, x, y, score: cat.score, maxScore: cat.maxScore }
  })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[220px]">
      {/* 배경 그리드 */}
      {gridPaths.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-muted-foreground/20"
        />
      ))}
      {/* 축선 */}
      {angles.map((angle, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={center + radius * Math.cos(angle)}
          y2={center + radius * Math.sin(angle)}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-muted-foreground/20"
        />
      ))}
      {/* 데이터 영역 */}
      <polygon
        points={dataPoints.join(' ')}
        fill="hsl(var(--primary))"
        fillOpacity="0.15"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
      />
      {/* 데이터 점 */}
      {dataPoints.map((point, i) => {
        const [x, y] = point.split(',').map(Number)
        return <circle key={i} cx={x} cy={y} r="3" fill="hsl(var(--primary))" />
      })}
      {/* 라벨 */}
      {labelPositions.map((lbl, i) => (
        <text
          key={i}
          x={lbl.x}
          y={lbl.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-[8px] font-medium"
        >
          {lbl.name}
        </text>
      ))}
      {/* 중앙 등급 */}
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        className="fill-primary text-[14px] font-bold"
      >
        {categories.reduce((s, c) => s + c.score, 0)}
      </text>
      <text
        x={center}
        y={center + 10}
        textAnchor="middle"
        className="fill-muted-foreground text-[7px]"
      >
        / 100
      </text>
    </svg>
  )
}

// ===== 유틸 함수 =====

function getCategoryColor(category: string) {
  switch (category) {
    case '최적화': return 'text-green-600 bg-green-100 border-green-200'
    case '준최적화': return 'text-blue-600 bg-blue-100 border-blue-200'
    case '일반': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
    case '저품질': return 'text-red-600 bg-red-100 border-red-200'
    default: return 'text-gray-600 bg-gray-100 border-gray-200'
  }
}

function getQualityBadgeStyle(category: string) {
  switch (category) {
    case '최적화': return 'bg-green-500 text-white'
    case '준최적화': return 'bg-blue-500 text-white'
    case '일반': return 'bg-yellow-500 text-white'
    case '저품질': return 'bg-red-500 text-white'
    default: return 'bg-gray-500 text-white'
  }
}

function getTierBarColor(tier: number) {
  if (tier >= 9) return 'bg-green-500'
  if (tier >= 6) return 'bg-blue-500'
  if (tier >= 3) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScoreRingColor(score: number) {
  if (score >= 70) return 'border-green-500 text-green-600'
  if (score >= 50) return 'border-blue-500 text-blue-600'
  if (score >= 30) return 'border-yellow-500 text-yellow-600'
  return 'border-red-500 text-red-600'
}

function getGradeColor(grade: string) {
  switch (grade) {
    case 'S': return 'text-green-600 bg-green-100'
    case 'A': return 'text-blue-600 bg-blue-100'
    case 'B': return 'text-cyan-600 bg-cyan-100'
    case 'C': return 'text-yellow-600 bg-yellow-100'
    case 'D': return 'text-orange-600 bg-orange-100'
    default: return 'text-red-600 bg-red-100'
  }
}

function getCategoryIcon(name: string) {
  switch (name) {
    case '검색 파워': return <Zap className="h-4 w-4" />
    case '콘텐츠 품질': return <FileText className="h-4 w-4" />
    case '주제 전문성': return <BookOpen className="h-4 w-4" />
    case '활동성': return <Clock className="h-4 w-4" />
    case '영향력': return <Star className="h-4 w-4" />
    default: return <Activity className="h-4 w-4" />
  }
}


function getDaysAgoBadge(daysAgo: number) {
  if (daysAgo === 0) return <Badge className="bg-green-100 text-green-700 text-[10px]">오늘</Badge>
  if (daysAgo <= 3) return <Badge className="bg-green-100 text-green-700 text-[10px]">{daysAgo}일 전</Badge>
  if (daysAgo <= 7) return <Badge className="bg-blue-100 text-blue-700 text-[10px]">{daysAgo}일 전</Badge>
  if (daysAgo <= 14) return <Badge className="bg-cyan-100 text-cyan-700 text-[10px]">{daysAgo}일 전</Badge>
  if (daysAgo <= 30) return <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">{daysAgo}일 전</Badge>
  return <Badge variant="outline" className="text-[10px]">{daysAgo}일 전</Badge>
}

// ===== 벤치마크 바 컴포넌트 =====

function BenchmarkBar({ label, mine, target, targetLabel, max }: {
  label: string; mine: number; target: number; targetLabel: string; max: number
}) {
  const minePct = Math.min(100, (mine / max) * 100)
  const targetPct = Math.min(100, (target / max) * 100)
  const isGood = mine >= target

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${isGood ? 'text-green-600' : 'text-orange-600'}`}>
          {mine}{typeof mine === 'number' && mine % 1 !== 0 ? '' : ''}
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${isGood ? 'bg-green-500' : 'bg-orange-400'}`}
          style={{ width: `${minePct}%` }}
        />
        {/* 기준점 마커 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/40"
          style={{ left: `${targetPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span>{targetLabel}: {target}</span>
      </div>
    </div>
  )
}

// ===== 메인 컴포넌트 =====

export default function BlogIndexPage() {
  const [blogUrl, setBlogUrl] = useState('')
  const [testKeywords, setTestKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BlogIndexResult | null>(null)

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blogUrl.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const keywords = testKeywords.split(',').map((k) => k.trim()).filter(Boolean)
      const res = await fetch('/api/blog-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogUrl: blogUrl.trim(), testKeywords: keywords.length > 0 ? keywords : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '블로그 지수 측정에 실패했습니다.'); return }
      setResult(data)
    } catch { setError('네트워크 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">블로그 지수 측정</h1>
        <p className="mt-1 text-muted-foreground">
          5대 분석 축으로 블로그의 네이버 검색 노출 파워를 정밀 측정합니다
        </p>
      </div>

      {/* 입력 폼 */}
      <Card>
        <CardHeader><CardTitle className="text-lg">블로그 정보 입력</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCheck} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="blogUrl">블로그 URL *</Label>
              <Input id="blogUrl" placeholder="https://blog.naver.com/myblog" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} disabled={loading} />
              <p className="text-xs text-muted-foreground">네이버 블로그 주소를 입력하세요</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="keywords">테스트 키워드</Label>
                <Badge className="bg-primary/10 text-primary text-[10px] font-medium">핵심 기능</Badge>
              </div>
              <Input id="keywords" placeholder="쉼표로 구분 (예: 침산동 수학, 강남 맛집, 다이어트 후기)" value={testKeywords} onChange={(e) => setTestKeywords(e.target.value)} disabled={loading} />
              <div className="rounded-md bg-blue-50 p-2.5 text-[11px] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                <p className="font-medium">실제 키워드 순위를 측정합니다</p>
                <p className="mt-0.5 text-blue-600/70 dark:text-blue-400/70">내 블로그가 해당 키워드 검색에서 몇 위에 노출되는지 확인합니다. 비워두면 기본 키워드 5개로 테스트합니다.</p>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </div>
            )}
            <Button type="submit" disabled={loading || !blogUrl.trim()} className="w-full">
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />블로그 지수 측정 중...</>) : (<><Activity className="mr-2 h-4 w-4" />블로그 지수 측정하기</>)}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ========== 측정 결과 ========== */}
      {result && (
        <>
          {/* ===== 1행: 블로그 프로필 + 종합 점수 + 레이더 차트 ===== */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* 블로그 프로필 */}
            <Card className="lg:col-span-3">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mt-2 text-base font-bold">
                    {result.blogProfile?.blogName || result.blogId || '블로그'}
                  </h3>
                  {result.blogId && <p className="text-[11px] text-muted-foreground">@{result.blogId}</p>}
                  <div className="mt-1.5 flex items-center gap-1">
                    {result.blogProfile?.isActive
                      ? <Badge className="bg-green-100 text-green-700 text-[10px]">활동 중</Badge>
                      : <Badge variant="outline" className="text-[10px]">비활동</Badge>}
                    {result.isDemo && <Badge variant="outline" className="text-[10px]">데모</Badge>}
                  </div>

                  <div className="mt-3 w-full space-y-1.5 text-left">
                    {[
                      { icon: <FileText className="h-3 w-3" />, label: '분석 포스트', value: `${result.blogProfile?.totalPosts || result.postAnalysis.totalFound}개` },
                      { icon: <Clock className="h-3 w-3" />, label: '최근 포스팅', value: result.postAnalysis.recentPostDays !== null ? `${result.postAnalysis.recentPostDays}일 전` : '-' },
                      { icon: <TrendingUp className="h-3 w-3" />, label: '포스팅 빈도', value: result.postAnalysis.postingFrequency },
                      ...(result.blogProfile?.blogAgeDays ? [{ icon: <Calendar className="h-3 w-3" />, label: '분석 기간', value: `${result.blogProfile.blogAgeDays}일` }] : []),
                      { icon: <Target className="h-3 w-3" />, label: '평균 제목', value: `${result.postAnalysis.avgTitleLength}자` },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between rounded bg-muted/50 px-2.5 py-1.5">
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{item.icon}{item.label}</span>
                        <span className="text-[11px] font-bold">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {result.blogProfile?.categoryKeywords && result.blogProfile.categoryKeywords.length > 0 && (
                    <div className="mt-2.5 w-full">
                      <p className="mb-1 text-left text-[10px] font-medium text-muted-foreground">주요 주제</p>
                      <div className="flex flex-wrap gap-1">
                        {result.blogProfile.categoryKeywords.map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <a href={result.blogUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:underline">
                    블로그 방문 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* 종합 점수 + 등급 */}
            <Card className="lg:col-span-5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* 도넛 스코어 */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`flex h-24 w-24 items-center justify-center rounded-full border-[5px] ${getScoreRingColor(result.totalScore)} bg-background`}>
                      <div className="text-center">
                        <span className="text-3xl font-bold">{result.totalScore}</span>
                        <p className="text-[10px] text-muted-foreground">/100</p>
                      </div>
                    </div>
                    <Badge className={`text-xs font-bold ${getCategoryColor(result.level.category)}`}>
                      {result.level.label}
                    </Badge>
                  </div>
                  {/* 등급 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{result.level.category}</Badge>
                      {result.benchmark && (
                        <Badge variant="outline" className="text-[10px] text-primary">
                          전체 상위 {result.benchmark.categoryPercentile}%
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{result.level.description}</p>

                    {/* 최적화 수치 바 */}
                    {result.benchmark && (
                      <div className="mt-2.5 rounded-lg bg-muted/50 p-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 font-medium"><Gauge className="h-3 w-3" />최적화 수치</span>
                          <span className="font-bold text-primary">{result.benchmark.optimizationPct}%</span>
                        </div>
                        <div className="mt-1.5 h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              result.benchmark.optimizationPct >= 70 ? 'bg-green-500' : result.benchmark.optimizationPct >= 40 ? 'bg-blue-500' : 'bg-orange-400'
                            }`}
                            style={{ width: `${result.benchmark.optimizationPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 다음 등급 프로그레스 */}
                    {result.level.nextTierScore !== null && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>다음 등급까지</span>
                          <span className="font-bold text-primary">+{result.level.nextTierScore - result.totalScore}점</span>
                        </div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-muted">
                          <div className={`h-full rounded-full ${getTierBarColor(result.level.tier)}`} style={{ width: `${Math.min(100, (result.totalScore / result.level.nextTierScore) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 10단계 등급 맵 */}
                <div className="mt-4 pt-3 border-t">
                  <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">10단계 블로그 지수</p>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }, (_, i) => {
                      const t = i + 1
                      const active = t === result.level.tier
                      const passed = t < result.level.tier
                      const tierLabels: Record<number, string> = { 1: '저품질1', 2: '저품질2', 3: '입문', 4: '일반', 5: '성장', 6: '준최적', 7: '양호', 8: '우수', 9: '최적화', 10: '파워' }
                      let bg = 'bg-muted'
                      let textCls = 'text-muted-foreground'
                      if (active) {
                        bg = t >= 9 ? 'bg-green-500' : t >= 6 ? 'bg-blue-500' : t >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                        textCls = 'text-foreground font-bold'
                      } else if (passed) {
                        bg = t >= 9 ? 'bg-green-200' : t >= 6 ? 'bg-blue-200' : t >= 3 ? 'bg-yellow-200' : 'bg-red-200'
                      }
                      return (
                        <div key={t} className="flex-1 text-center">
                          <div className={`h-6 rounded flex items-center justify-center ${bg} ${active ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                            <span className={`text-[8px] ${active ? 'text-white font-bold' : passed ? 'text-foreground/60' : 'text-muted-foreground/60'}`}>
                              {t}
                            </span>
                          </div>
                          {active && (
                            <p className={`mt-0.5 text-[8px] ${textCls}`}>{tierLabels[t]}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-0.5 flex justify-between text-[8px] text-muted-foreground">
                    <span className="text-red-400">저품질</span>
                    <span className="text-yellow-500">일반</span>
                    <span className="text-blue-500">준최적화</span>
                    <span className="text-green-500">최적화</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 레이더 차트 */}
            <Card className="lg:col-span-4">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">5축 분석 레이더</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <RadarChart categories={result.categories} />
                {/* 축 점수 요약 */}
                <div className="mt-1 grid grid-cols-5 gap-1 text-center">
                  {result.categories.map((cat) => (
                    <div key={cat.name}>
                      <p className="text-[9px] text-muted-foreground">{cat.name.replace(' ', '\n')}</p>
                      <p className="text-xs font-bold">{cat.score}<span className="text-[9px] text-muted-foreground">/{cat.maxScore}</span></p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ===== 2행: 5축 상세 카드 (전체 너비) ===== */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {result.categories.map((cat) => {
              const pct = Math.round((cat.score / cat.maxScore) * 100)
              return (
                <Card key={cat.name} className="overflow-hidden">
                  <div className={`h-1 ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {getCategoryIcon(cat.name)}
                        <p className="text-xs font-medium">{cat.name}</p>
                      </div>
                      <Badge className={`text-[10px] ${getGradeColor(cat.grade)}`}>{cat.grade}</Badge>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-end justify-between">
                        <span className="text-xl font-bold">{cat.score}</span>
                        <span className="text-[10px] text-muted-foreground">/{cat.maxScore}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                        <div className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-0.5 text-right text-[9px] text-muted-foreground">{pct}%</p>
                    </div>
                    {cat.details[0] && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">{cat.details[0]}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* ===== 3행: 벤치마크 비교 (컴팩트 가로 레이아웃) ===== */}
          {result.benchmark && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4" />
                  <p className="text-sm font-semibold">벤치마크 비교</p>
                </div>
                <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  <BenchmarkBar label="주간 포스팅" mine={result.benchmark.postingFrequency.mine} target={result.benchmark.postingFrequency.recommended} targetLabel="권장" max={Math.max(result.benchmark.postingFrequency.topBlogger, result.benchmark.postingFrequency.mine, 7)} />
                  <BenchmarkBar label="제목 길이" mine={result.benchmark.avgTitleLength.mine} target={result.benchmark.avgTitleLength.optimal} targetLabel="최적" max={50} />
                  <BenchmarkBar label="콘텐츠 깊이" mine={result.benchmark.avgContentLength.mine} target={result.benchmark.avgContentLength.recommended} targetLabel="권장" max={Math.max(200, result.benchmark.avgContentLength.mine)} />
                  <BenchmarkBar label="이미지 포함률 (%)" mine={result.benchmark.imageRate.mine} target={result.benchmark.imageRate.recommended} targetLabel="권장" max={100} />
                  <BenchmarkBar label="주제 집중도 (%)" mine={result.benchmark.topicFocus.mine} target={result.benchmark.topicFocus.recommended} targetLabel="권장" max={100} />
                  {/* 포스팅 빈도 비교 미니 차트 */}
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground">주간 포스팅 비교</p>
                    <div className="flex items-end gap-2 h-10">
                      {[
                        { label: '나', value: result.benchmark.postingFrequency.mine, color: 'bg-primary' },
                        { label: '권장', value: result.benchmark.postingFrequency.recommended, color: 'bg-muted-foreground/30' },
                        { label: '상위', value: result.benchmark.postingFrequency.topBlogger, color: 'bg-green-400' },
                      ].map((bar) => {
                        const maxVal = Math.max(result.benchmark!.postingFrequency.topBlogger, result.benchmark!.postingFrequency.mine, 7)
                        const h = Math.max(6, (bar.value / maxVal) * 40)
                        return (
                          <div key={bar.label} className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="text-[8px] font-bold">{bar.value}회</span>
                            <div className={`w-full rounded-t ${bar.color}`} style={{ height: `${h}px` }} />
                            <span className="text-[7px] text-muted-foreground">{bar.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== 3행: 포스팅 지수 (개별 포스트 품질 테이블) ===== */}
          {result.recentPosts && result.recentPosts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  포스팅 지수 (최근 {result.recentPosts.length}개)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-2 font-medium text-muted-foreground w-24">제목</th>
                        <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-16">지수</th>
                        <th className="pb-2 pr-2 font-medium text-muted-foreground w-24">작성일</th>
                        <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-12">경과</th>
                        <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-16">글자수</th>
                        <th className="pb-2 font-medium text-muted-foreground text-center w-12">이미지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.recentPosts.map((post, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 pr-2">
                            <a href={post.link} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-1 hover:text-primary">
                              <span className="line-clamp-1 text-xs font-medium">{post.title}</span>
                              <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                            </a>
                          </td>
                          <td className="py-2 pr-2 text-center">
                            {post.quality ? (
                              <Badge className={`text-[10px] ${getQualityBadgeStyle(post.quality.category)}`}>
                                {post.quality.label}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2 pr-2 text-[11px] text-muted-foreground whitespace-nowrap">{post.date}</td>
                          <td className="py-2 pr-2 text-center">{getDaysAgoBadge(post.daysAgo)}</td>
                          <td className="py-2 pr-2 text-center">
                            <span className={`text-[11px] ${post.charCount >= 100 ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                              {post.charCount}자
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            {post.hasImage
                              ? <ImageIcon className="mx-auto h-3.5 w-3.5 text-green-600" />
                              : <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 포스트 분석 서머리 */}
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-2.5 sm:grid-cols-5">
                  {[
                    { label: '평균 제목', value: `${result.postAnalysis.avgTitleLength}자` },
                    { label: '평균 본문', value: `${result.postAnalysis.avgDescLength}자` },
                    { label: '이미지 포함률', value: `${result.recentPosts.length > 0 ? Math.round((result.recentPosts.filter(p => p.hasImage).length / result.recentPosts.length) * 100) : 0}%` },
                    { label: '최적 제목 비율', value: `${result.recentPosts.length > 0 ? Math.round((result.recentPosts.filter(p => p.titleLength >= 15 && p.titleLength <= 40).length / result.recentPosts.length) * 100) : 0}%` },
                    { label: '평균 품질', value: result.recentPosts.filter(p => p.quality).length > 0 ? `${(result.recentPosts.filter(p => p.quality).reduce((s, p) => s + (p.quality?.score || 0), 0) / result.recentPosts.filter(p => p.quality).length).toFixed(1)}/10` : '-' },
                  ].map((stat, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[9px] text-muted-foreground">{stat.label}</p>
                      <p className="text-xs font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== 축별 분석 상세 ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                축별 분석 상세
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.categories.map((cat) => (
                  <div key={cat.name} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      {getCategoryIcon(cat.name)}
                      <h3 className="text-sm font-medium">{cat.name}</h3>
                      <Badge className={`ml-auto text-[10px] ${getGradeColor(cat.grade)}`}>{cat.score}/{cat.maxScore}</Badge>
                    </div>
                    <ul className="space-y-0.5">
                      {cat.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ===== 키워드별 실전 순위 ===== */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-4 w-4 text-primary" />
                  키워드 실전 순위
                  <Badge className="bg-primary/10 text-primary text-[10px]">핵심 분석</Badge>
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">네이버 블로그 검색 기준 100위 내 순위</p>
              </div>
            </CardHeader>
            <CardContent>
              {/* 요약 카드 */}
              <div className="mb-4 grid grid-cols-4 gap-2">
                {(() => {
                  const top = result.keywordResults.filter(kr => kr.rank !== null && kr.rank <= 10).length
                  const mid = result.keywordResults.filter(kr => kr.rank !== null && kr.rank > 10 && kr.rank <= 30).length
                  const low = result.keywordResults.filter(kr => kr.rank !== null && kr.rank > 30).length
                  const none = result.keywordResults.filter(kr => kr.rank === null).length
                  const total = result.keywordResults.length
                  const exposureRate = total > 0 ? Math.round(((top + mid + low) / total) * 100) : 0
                  return (
                    <>
                      <div className="rounded-lg bg-green-50 p-2.5 text-center dark:bg-green-950/30">
                        <p className="text-lg font-bold text-green-600">{top}</p>
                        <p className="text-[10px] text-green-600/70">상위 노출 (1~10위)</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-2.5 text-center dark:bg-blue-950/30">
                        <p className="text-lg font-bold text-blue-600">{mid}</p>
                        <p className="text-[10px] text-blue-600/70">중위 노출 (11~30위)</p>
                      </div>
                      <div className="rounded-lg bg-orange-50 p-2.5 text-center dark:bg-orange-950/30">
                        <p className="text-lg font-bold text-orange-600">{none + low}</p>
                        <p className="text-[10px] text-orange-600/70">하위/미노출</p>
                      </div>
                      <div className="rounded-lg bg-primary/5 p-2.5 text-center">
                        <p className="text-lg font-bold text-primary">{exposureRate}%</p>
                        <p className="text-[10px] text-muted-foreground">키워드 노출률</p>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* 키워드별 시각적 순위 */}
              <div className="space-y-2">
                {result.keywordResults.map((kr) => {
                  const rankPct = kr.rank !== null ? Math.max(2, 100 - kr.rank) : 0
                  const barColor = kr.rank === null ? 'bg-red-200' : kr.rank <= 10 ? 'bg-green-500' : kr.rank <= 30 ? 'bg-blue-500' : kr.rank <= 50 ? 'bg-yellow-500' : 'bg-orange-400'
                  return (
                    <div key={kr.keyword} className="flex items-center gap-3 rounded-lg border p-2.5">
                      {/* 키워드명 */}
                      <div className="w-28 shrink-0">
                        <p className="text-xs font-medium truncate">{kr.keyword}</p>
                        <p className="text-[9px] text-muted-foreground">{kr.totalResults.toLocaleString()}건</p>
                      </div>
                      {/* 순위 바 */}
                      <div className="flex-1">
                        <div className="h-5 rounded-full bg-muted overflow-hidden">
                          {kr.rank !== null ? (
                            <div className={`h-full rounded-full ${barColor} flex items-center justify-end pr-2 transition-all`} style={{ width: `${rankPct}%` }}>
                              <span className="text-[9px] font-bold text-white">{kr.rank}위</span>
                            </div>
                          ) : (
                            <div className="h-full flex items-center pl-2">
                              <span className="text-[9px] text-muted-foreground">100위 밖 (미노출)</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* 상태 뱃지 */}
                      <div className="w-16 shrink-0 text-right">
                        {kr.rank === null
                          ? <Badge variant="outline" className="text-[9px] text-red-500 border-red-200">미노출</Badge>
                          : kr.rank <= 10
                          ? <Badge className="text-[9px] bg-green-500">상위</Badge>
                          : kr.rank <= 30
                          ? <Badge className="text-[9px] bg-blue-500">중위</Badge>
                          : <Badge variant="outline" className="text-[9px]">하위</Badge>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* ===== 개선 추천 ===== */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ArrowUpRight className="h-4 w-4" />맞춤 개선 추천</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border p-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</div>
                      <p className="text-xs">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== 알고리즘 가이드 ===== */}
          <Card>
            <CardHeader><CardTitle className="text-base">네이버 알고리즘 가이드</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">C-Rank 높이기</p>
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                    <li>- 한 가지 주제에 집중하여 전문성 확보</li>
                    <li>- 1,500~2,000자 이상의 깊이 있는 글 작성</li>
                    <li>- 꾸준한 발행 주기 유지 (주 3회 이상)</li>
                    <li>- 이웃과의 적극적 소통</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">D.I.A 높이기</p>
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                    <li>- 체류 시간을 늘리는 양질의 콘텐츠</li>
                    <li>- 공유를 유도하는 실용적 정보 제공</li>
                    <li>- 원본 이미지와 멀티미디어 활용</li>
                    <li>- 검색 의도에 맞는 정확한 정보 전달</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
