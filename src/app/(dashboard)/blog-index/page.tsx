'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
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
  User,
  Calendar,
  ExternalLink,
  Image as ImageIcon,
  BarChart3,
  ArrowUpRight,
  Shield,
  Gauge,
  Brain,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Crown,
  ShieldAlert,
  Pencil,
  Type,
  Focus,
  Eye,
  MessageCircle,
  Heart,
  RefreshCw,
  Database,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BLOG_CATEGORY_LABELS } from '@/lib/blog-index/categories'
import { ensureUrl } from '@/lib/utils/text'

const BlogIndexHistoryChart = dynamic(
  () => import('@/components/charts/blog-index-history-chart').then(m => ({ default: m.BlogIndexHistoryChart })),
  { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded bg-muted" /> }
)

// ===== 타입 정의 =====

interface ScoreItem {
  label: string
  points: number
}

interface AnalysisCategory {
  name: string
  score: number
  maxScore: number
  grade: string
  details: string[]
  items?: ScoreItem[]
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
  shortLabel: string
  description: string
  color: string
  badgeColor: string
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
  imageCount?: number
  titleLength: number
  quality?: PostQuality
  isScrapped?: boolean   // true면 실제 본문 스크래핑 데이터
  commentCount?: number | null   // v4: 댓글 수
  sympathyCount?: number | null  // v4: 공감 수
  readCount?: number | null      // v10: 조회수
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
  blogAgeEstimated?: boolean
  postsPerWeek?: number | null
  totalPostCount?: number | null
  blogCreatedDate?: string | null
}

interface BenchmarkData {
  postingFrequency: { mine: number; recommended: number; topBlogger: number }
  avgTitleLength: { mine: number; optimal: number; topBlogger: number }
  avgContentLength: { mine: number; recommended: number; topBlogger: number }
  imageRate: { mine: number; recommended: number; topBlogger: number }
  topicFocus: { mine: number; recommended: number; topBlogger: number }
  keywordDensity?: { mine: number; optimal: [number, number] }
  avgImageCount?: { mine: number; recommended: number; topBlogger: number }
  optimizationPct: number
  categoryPercentile: number
  avgCommentCount?: { mine: number; recommended: number; topBlogger: number }
  avgSympathyCount?: { mine: number; recommended: number; topBlogger: number }
  dailyVisitors?: { mine: number; recommended: number; topBlogger: number }
  blogAge?: { mine: number; recommended: number }
  totalPostCount?: { mine: number; recommended: number }
  buddyCount?: { mine: number; recommended: number }
}

interface AiAnalysis {
  experienceScore: number
  experienceDetails: string
  qualityScore: number
  qualityDetails: string
  abuseRisk: number
  abuseDetails: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  analyzedPosts: number
  scoreAdjustment: number
  adjustmentReason: string
}

interface AbusePenalty {
  score: number
  details: string[]
  flags: string[]
}

interface SearchBonus {
  score: number      // 0~25
  maxScore: number   // 25
  grade: string
  details: string[]
  items?: ScoreItem[]
}

interface BlogIndexResult {
  blogUrl: string
  blogId: string | null
  totalScore: number
  level: BlogLevelInfo
  categories: AnalysisCategory[]
  abusePenalty?: AbusePenalty
  aiAnalysis?: AiAnalysis
  searchBonus?: SearchBonus
  keywordResults: KeywordRankResult[]
  postAnalysis: {
    totalFound: number
    avgTitleLength: number
    avgDescLength: number
    avgImageCount?: number
    topicKeywords: string[]
    postingFrequency: string
    recentPostDays: number | null
    avgCommentCount?: number | null
    avgSympathyCount?: number | null
  }
  recentPosts?: PostDetail[]
  blogProfile?: BlogProfile
  benchmark?: BenchmarkData
  recommendations: string[]
  isDemo: boolean
  checkedAt: string
  // v6 추가: 카테고리별 벤치마크
  blogCategory?: string
  benchmarkSource?: 'accumulated' | 'static'
  benchmarkSampleCount?: number
  // v9.1: 네이버 알고리즘 추정 점수
  diaScore?: {
    score: number; grade: string; label: string; summary: string
    factors: { name: string; weight: number; score: number; contribution: number }[]
  }
  crankScore?: {
    score: number; grade: string; label: string; summary: string
    factors: { name: string; weight: number; score: number; contribution: number }[]
  }
}

interface BlogIndexHistoryEntry {
  id: string
  total_score: number
  search_score: number | null
  popularity_score: number | null
  content_score: number | null
  activity_score: number | null
  abuse_penalty: number | null
  level_tier: number | null
  level_label: string | null
  metrics?: {
    keywords?: string[]
    diaScore?: number | null
    crankScore?: number | null
    [key: string]: unknown
  } | null
  is_demo: boolean
  checked_at: string
}

interface BlogIndexHistoryStats {
  measurements: number
  highestScore: number
  lowestScore: number
  avgScore: number
  latestChange: number
  trend: 'up' | 'down' | 'stable'
}

interface BlogIndexHistoryData {
  history: BlogIndexHistoryEntry[]
  stats: BlogIndexHistoryStats | null
}

// ===== SVG 레이더 차트 =====

// 레이더 차트용 축약 라벨 (5축 정오각형에서 라벨 겹침 방지)
function getRadarLabel(name: string): string {
  switch (name) {
    case '콘텐츠 품질': return '콘텐츠'
    case '방문자 활동': return '방문자'
    case 'SEO 최적화': return 'SEO'
    case '신뢰도': return '신뢰도'
    case '검색 성과': return '검색'
    // 레거시 호환
    case '방문자 & 인기도': return '방문자'
    case '주제 전문성': return '전문성'
    case '활동성': return '활동성'
    case '블로그 신뢰도': return '신뢰도'
    default: return name
  }
}

/** 캐시 날짜를 "오늘 14:30" 또는 "N일 전" 형식으로 표시 */
function formatCacheAge(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) {
    return `오늘 ${new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return `${diffDays}일 전`
}

function RadarChart({ categories, totalScore, maxTotal = 100, size = 220 }: { categories: AnalysisCategory[]; totalScore?: number; maxTotal?: number; size?: number }) {
  const pad = 58 // 라벨용 여백 (4축 대응)
  const totalSize = size + pad * 2
  const center = totalSize / 2
  const radius = size / 2

  // 4축 각도 (12시 방향 시작, 시계 방향)
  const angles = categories.map((_, i) => (Math.PI * 2 * i) / categories.length - Math.PI / 2)

  // 레벨 그리드 그리기
  const levels = 4
  const gridPaths = Array.from({ length: levels }, (_, level) => {
    const r = (radius * (level + 1)) / levels
    const points = angles.map((angle) => `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`)
    return points.join(' ')
  })

  // 데이터 영역
  const dataPoints = categories.map((cat, i) => {
    const ratio = cat.score / cat.maxScore
    const r = radius * ratio
    return { x: center + r * Math.cos(angles[i]), y: center + r * Math.sin(angles[i]) }
  })
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  // 축 끝 라벨 위치
  const labelOffset = radius + 32
  const labels = categories.map((cat, i) => {
    const x = center + labelOffset * Math.cos(angles[i])
    const y = center + labelOffset * Math.sin(angles[i])
    // 텍스트 정렬
    const angleDeg = (angles[i] * 180) / Math.PI
    let anchor: 'start' | 'middle' | 'end' = 'middle'
    if (Math.abs(angleDeg + 90) < 5 || Math.abs(angleDeg - 90) < 5) anchor = 'middle'
    else if (angleDeg > 5 && angleDeg < 175) anchor = 'start'
    else if (angleDeg < -5 && angleDeg > -175) anchor = 'end'
    return { name: getRadarLabel(cat.name), score: cat.score, maxScore: cat.maxScore, x, y, anchor }
  })

  return (
    <svg viewBox={`0 0 ${totalSize} ${totalSize}`} className="mx-auto w-full max-w-[340px]">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
        </radialGradient>
      </defs>
      {/* 배경 그리드 */}
      {gridPaths.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill={i === levels - 1 ? 'hsl(var(--muted))' : 'none'}
          fillOpacity={i === levels - 1 ? 0.3 : 0}
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
          className="text-muted-foreground/15"
        />
      ))}
      {/* 데이터 영역 */}
      <polygon
        points={dataPolygon}
        fill="url(#radarFill)"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
      />
      {/* 데이터 점 */}
      {dataPoints.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill="hsl(var(--primary))" fillOpacity="0.2" />
          <circle cx={p.x} cy={p.y} r="3" fill="hsl(var(--primary))" />
        </g>
      ))}
      {/* 라벨: 카테고리명 + 점수 */}
      {labels.map((lbl, i) => (
        <g key={i}>
          <text
            x={lbl.x}
            y={lbl.y - 6}
            textAnchor={lbl.anchor}
            dominantBaseline="middle"
            className="fill-foreground text-[10px] font-semibold"
          >
            {lbl.name}
          </text>
          <text
            x={lbl.x}
            y={lbl.y + 8}
            textAnchor={lbl.anchor}
            dominantBaseline="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {lbl.score}/{lbl.maxScore}
          </text>
        </g>
      ))}
      {/* 중앙 점수 (totalScore = 카테고리 합산 + 어뷰징 감점 적용) */}
      <text
        x={center}
        y={center - 5}
        textAnchor="middle"
        className="fill-primary text-[20px] font-bold"
      >
        {totalScore ?? categories.reduce((s, c) => s + c.score, 0)}
      </text>
      <text
        x={center}
        y={center + 13}
        textAnchor="middle"
        className="fill-muted-foreground text-[9px]"
      >
        / {maxTotal}
      </text>
    </svg>
  )
}

// ===== 유틸 함수 =====


function getQualityBadgeStyle(category: string) {
  switch (category) {
    case '파워': return 'bg-amber-500 text-white'
    case '최적화+': return 'bg-emerald-500 text-white'
    case '최적화': return 'bg-green-500 text-white'
    case '준최적화': return 'bg-blue-500 text-white'
    case '일반': return 'bg-slate-500 text-white'
    default: return 'bg-gray-500 text-white'
  }
}

function getTierBarColor(tier: number) {
  if (tier >= 16) return 'bg-amber-500'
  if (tier >= 12) return 'bg-emerald-500'
  if (tier >= 9) return 'bg-green-500'
  if (tier >= 2) return 'bg-blue-500'
  return 'bg-slate-500'
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
    case '콘텐츠 품질': return <FileText className="h-4 w-4" />
    case '방문자 활동': return <Eye className="h-4 w-4" />
    case 'SEO 최적화': return <Target className="h-4 w-4" />
    case '신뢰도': return <Shield className="h-4 w-4" />
    case '검색 성과': return <TrendingUp className="h-4 w-4" />
    // 레거시 호환 (캐시된 이전 결과 표시용)
    case '방문자 & 인기도': return <Eye className="h-4 w-4" />
    case '주제 전문성': return <BookOpen className="h-4 w-4" />
    case '활동성': return <Clock className="h-4 w-4" />
    case '블로그 신뢰도': return <Shield className="h-4 w-4" />
    default: return <Activity className="h-4 w-4" />
  }
}


function getDaysAgoBadge(daysAgo: number) {
  if (daysAgo === 0) return <Badge className="bg-green-100 text-green-700 text-[10px] whitespace-nowrap">오늘</Badge>
  if (daysAgo <= 3) return <Badge className="bg-green-100 text-green-700 text-[10px] whitespace-nowrap">{daysAgo}일 전</Badge>
  if (daysAgo <= 7) return <Badge className="bg-blue-100 text-blue-700 text-[10px] whitespace-nowrap">{daysAgo}일 전</Badge>
  if (daysAgo <= 14) return <Badge className="bg-cyan-100 text-cyan-700 text-[10px] whitespace-nowrap">{daysAgo}일 전</Badge>
  if (daysAgo <= 30) return <Badge className="bg-yellow-100 text-yellow-700 text-[10px] whitespace-nowrap">{daysAgo}일 전</Badge>
  return <Badge variant="outline" className="text-[10px] whitespace-nowrap">{daysAgo}일 전</Badge>
}

// ===== 벤치마크 항목 컴포넌트 (통일 디자인: 0 → 평균 → 상위블로거) =====

function BenchmarkItem({ label, mine: rawMine, recommended: rawRec, topBlogger: rawTop, unit, icon, maxOptimal }: {
  label: string; mine: number; recommended: number; topBlogger: number; unit?: string; icon: React.ReactNode
  /** 적정 범위 상한 (제목 길이처럼 너무 길면 안 좋은 항목용) */
  maxOptimal?: number
}) {
  const mine = rawMine ?? 0
  const recommended = rawRec ?? 0
  const topBlogger = rawTop ?? Math.round(recommended * 1.5)
  const u = unit ?? ''
  const upperLimit = maxOptimal ?? topBlogger
  const scaleMax = Math.max(topBlogger * 1.15, mine * 1.1, recommended * 1.3, 1)
  const minePct = Math.min(100, Math.max(0, (mine / scaleMax) * 100))
  const recPct = Math.min(92, Math.max(8, (recommended / scaleMax) * 100))
  const topPct = Math.min(92, Math.max(15, (topBlogger / scaleMax) * 100))

  // maxOptimal 설정 시: 초과하면 경고 (제목 길이 등 적정 범위가 있는 항목)
  let barColor: string
  let statusText: string
  let statusColor: string

  if (maxOptimal && mine > maxOptimal) {
    barColor = mine > maxOptimal * 1.3 ? 'bg-red-400' : 'bg-amber-400'
    statusText = '초과'
    statusColor = mine > maxOptimal * 1.3 ? 'text-red-500' : 'text-amber-600'
  } else {
    const isAboveTop = mine >= upperLimit
    const isAboveRec = mine >= recommended
    barColor = isAboveTop ? 'bg-green-500' : isAboveRec ? 'bg-blue-500' : 'bg-orange-400'
    statusText = isAboveTop ? '최우수' : isAboveRec ? '달성' : mine >= recommended * 0.7 ? '근접' : '부족'
    statusColor = isAboveTop ? 'text-green-600' : isAboveRec ? 'text-blue-600' : mine >= recommended * 0.7 ? 'text-amber-600' : 'text-red-500'
  }
  const formatVal = (v: number) => v == null ? '0' : Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${statusColor}`}>{formatVal(mine)}{u}</span>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusColor} ring-1 ring-current/20`}>
            {statusText}
          </span>
        </div>
      </div>
      {/* 바 + 수직 마커 */}
      <div className="relative h-2.5 rounded-full bg-muted/80">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${barColor}`}
          style={{ width: `${minePct}%` }}
        />
        {/* 평균 수직선 */}
        <div
          className="absolute top-[-3px] w-[2px] h-[calc(100%+6px)] bg-gray-400 dark:bg-gray-500 rounded"
          style={{ left: `${recPct}%` }}
          title={`평균: ${formatVal(recommended)}${u}`}
        />
        {/* 상위블로거 수직선 */}
        <div
          className="absolute top-[-3px] w-[2px] h-[calc(100%+6px)] bg-emerald-500 dark:bg-emerald-400 rounded"
          style={{ left: `${topPct}%` }}
          title={`상위: ${formatVal(topBlogger)}${u}`}
        />
      </div>
      {/* 범례 */}
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
        <span>0</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-sm bg-gray-400" />
            평균 {formatVal(recommended)}{u}
          </span>
          <span className="flex items-center gap-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-sm bg-emerald-500" />
            상위 {formatVal(topBlogger)}{u}
          </span>
        </div>
      </div>
    </div>
  )
}

// ===== 메인 컴포넌트 =====

export default function BlogIndexPage() {
  const [blogUrl, setBlogUrl] = useState('')
  const [testKeywords, setTestKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BlogIndexResult | null>(null)
  const [userPlan, setUserPlan] = useState<string>('free')
  const [historyData, setHistoryData] = useState<BlogIndexHistoryData | null>(null)
  const [chartMode, setChartMode] = useState<'total' | 'category' | 'algorithm'>('total')
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [showCreditConfirm, setShowCreditConfirm] = useState(false)
  const [pendingCache, setPendingCache] = useState<{ data: BlogIndexResult; checkedAt: string } | null>(null)
  const [axisMode, setAxisMode] = useState<'4axis' | '5axis'>('4axis')
  const [aiCardModal, setAiCardModal] = useState<{
    title: string
    icon: ReactNode
    score: number
    isRisk?: boolean
    details: string
  } | null>(null)

  // 히스토리 조회 (추이 차트용)
  const fetchHistory = (url: string) => {
    fetch(`/api/blog-index/history?blogUrl=${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : null)
      .then(h => { if (h && Array.isArray(h.history)) setHistoryData(h) })
      .catch(() => {})
  }

  // 플랜 정보 가져오기
  const fetchPlan = async () => {
    try {
      const profileRes = await fetch('/api/dashboard')
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        const plan = profileData.profile?.plan || profileData.plan || 'free'
        const role = profileData.profile?.role || profileData.role || 'user'
        setUserPlan(role === 'admin' ? 'admin' : plan)
      }
    } catch { /* 무시 */ }
  }

  // 실제 측정 실행 (크레딧 소모)
  const doMeasure = async () => {
    const isRefresh = !!result
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    setShowCreditConfirm(false)
    setPendingCache(null)
    try {
      const keywords = testKeywords.split(',').map((k) => k.trim()).filter(Boolean)
      const res = await fetch('/api/blog-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogUrl: blogUrl.trim(), testKeywords: keywords.length > 0 ? keywords : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '블로그 지수 측정에 실패했습니다.'); return }
      if (data._historySaved === false) {
        console.warn('[BlogIndex] DB 히스토리 저장 실패 - 다음 측정 시 캐시 없이 재측정됩니다')
      }
      setResult(data)
      setCachedAt(new Date().toISOString())
      // 히스토리 조회 (새 측정이 히스토리에 추가됨)
      fetchHistory(blogUrl.trim())
      fetchPlan()
      // 키워드를 비워둔 경우, 자동 추출된 키워드를 입력란에 채워넣기
      if (keywords.length === 0 && data.keywordResults?.length > 0) {
        setTestKeywords(data.keywordResults.map((kr: KeywordRankResult) => kr.keyword).join(', '))
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // "측정하기" 클릭 → DB 캐시 먼저 조회
  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blogUrl.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    setCachedAt(null)
    setHistoryData(null)
    setPendingCache(null)
    try {
      // 1) DB에서 캐시 조회
      const cacheRes = await fetch(`/api/blog-index/history?blogUrl=${encodeURIComponent(blogUrl.trim())}&latest=true`)
      const cacheData = await cacheRes.json()

      if (cacheData.cached) {
        const checkedAt = cacheData.checkedAt as string
        const diffDays = Math.floor((Date.now() - new Date(checkedAt).getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays === 0) {
          // 오늘 측정 → 즉시 표시 (크레딧 0)
          setResult(cacheData.cached)
          setCachedAt(checkedAt)
          fetchHistory(blogUrl.trim())
          fetchPlan()
          if (!testKeywords.trim() && cacheData.cached.keywordResults?.length > 0) {
            setTestKeywords(cacheData.cached.keywordResults.map((kr: KeywordRankResult) => kr.keyword).join(', '))
          }
          setLoading(false)
          return
        }

        // 1일 이상 경과 → 이전 데이터 / 새로 측정 선택
        setPendingCache({ data: cacheData.cached, checkedAt })
        setLoading(false)
        setShowCreditConfirm(true)
        return
      }

      // 2) 캐시 없음 → 크레딧 소모 안내
      setLoading(false)
      setShowCreditConfirm(true)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  // "갱신" 버튼 → 크레딧 소모 확인
  const handleRefreshClick = () => {
    setPendingCache(null)
    setShowCreditConfirm(true)
  }

  // 이전 캐시 데이터 로드 (다이얼로그에서 "이전 데이터 보기" 선택 시)
  const loadPendingCache = () => {
    if (!pendingCache) return
    setResult(pendingCache.data)
    setCachedAt(pendingCache.checkedAt)
    fetchHistory(blogUrl.trim())
    fetchPlan()
    if (!testKeywords.trim() && pendingCache.data.keywordResults?.length > 0) {
      setTestKeywords(pendingCache.data.keywordResults.map((kr: KeywordRankResult) => kr.keyword).join(', '))
    }
    setPendingCache(null)
    setShowCreditConfirm(false)
  }

  const handleAiAnalysis = async () => {
    if (!result || aiLoading) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/blog-index/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogUrl: result.blogUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'AI 심층 분석에 실패했습니다.')
        return
      }
      // 결과에 AI 분석 병합
      const updated = { ...result }
      updated.aiAnalysis = data.aiAnalysis
      // 점수 보정 적용
      if (data.aiAnalysis.scoreAdjustment !== 0) {
        updated.totalScore = Math.max(0, Math.min(100, updated.totalScore + data.aiAnalysis.scoreAdjustment))
      }
      // AI 추천 병합
      if (data.aiAnalysis.recommendations?.length > 0) {
        const existingSet = new Set(updated.recommendations.map((r: string) => r.substring(0, 20)))
        const newRecs = data.aiAnalysis.recommendations.filter(
          (r: string) => !existingSet.has(r.substring(0, 20))
        )
        updated.recommendations = [...updated.recommendations, ...newRecs].slice(0, 8)
      }
      setResult(updated)
    } catch {
      setError('AI 분석 중 네트워크 오류가 발생했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  const canUseAi = userPlan !== 'free'

  return (
    <>
      {/* AI 심층분석 상세 보기 팝업 */}
      <Dialog open={aiCardModal !== null} onOpenChange={(open) => { if (!open) setAiCardModal(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {aiCardModal?.icon}
              {aiCardModal?.title}
              <span className={`ml-auto text-xl font-bold ${aiCardModal?.isRisk
                  ? aiCardModal.score <= 2 ? 'text-green-600' : aiCardModal.score <= 5 ? 'text-yellow-600' : 'text-red-600'
                  : aiCardModal?.score && aiCardModal.score >= 7 ? 'text-green-600' : aiCardModal?.score && aiCardModal.score >= 4 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                {aiCardModal?.score}
                <span className="text-sm text-muted-foreground font-normal">/10</span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {/* 점수 바 */}
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${aiCardModal?.isRisk
                    ? (aiCardModal.score <= 2 ? 'bg-green-500' : aiCardModal.score <= 5 ? 'bg-yellow-500' : 'bg-red-500')
                    : (aiCardModal?.score && aiCardModal.score >= 7 ? 'bg-green-500' : aiCardModal?.score && aiCardModal.score >= 4 ? 'bg-yellow-500' : 'bg-red-500')
                  }`}
                style={{ width: `${(aiCardModal?.score ?? 0) * 10}%` }}
              />
            </div>
            {/* 전체 분석 내용 */}
            <div className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiCardModal?.details ?? ''}</ReactMarkdown>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 크레딧 소모 / 캐시 선택 팝업 */}
      <Dialog open={showCreditConfirm} onOpenChange={(open) => { setShowCreditConfirm(open); if (!open) setPendingCache(null) }}>
        <DialogContent className="max-w-sm">
          {(() => {
            const cacheDaysAgo = pendingCache
              ? Math.floor((Date.now() - new Date(pendingCache.checkedAt).getTime()) / (1000 * 60 * 60 * 24))
              : 0
            const isCacheOld = !!pendingCache && cacheDaysAgo >= 7
            return (
              <>
                <DialogHeader>
                  <DialogTitle>블로그 지수 측정</DialogTitle>
                  <DialogDescription>
                    {pendingCache
                      ? isCacheOld
                        ? `${cacheDaysAgo}일 전 측정 결과가 있습니다. 1주일 이상 경과하여 갱신을 권장합니다.`
                        : `${cacheDaysAgo}일 전 측정 결과가 있습니다.`
                      : result
                        ? '최신 데이터로 지수를 갱신합니다.'
                        : '이 블로그의 측정 기록이 없습니다.'}
                  </DialogDescription>
                </DialogHeader>
                {isCacheOld && (
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0" />
                      <p className="font-medium">오래된 데이터입니다</p>
                    </div>
                    <p className="mt-0.5 text-xs opacity-70">블로그 상태가 변경되었을 수 있으므로 새로 측정하는 것을 권장합니다</p>
                  </div>
                )}
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
                  <p className="font-medium">{pendingCache ? '새로 측정 시 크레딧 3개가 소모됩니다' : '크레딧 3개가 소모됩니다'}</p>
                  <p className="mt-0.5 text-xs opacity-70">네이버 API 호출 + AI 분석이 포함됩니다</p>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  {pendingCache ? (
                    <>
                      <Button variant="outline" onClick={loadPendingCache}>
                        <Database className="mr-2 h-4 w-4" />이전 데이터 보기
                      </Button>
                      <Button onClick={doMeasure} disabled={loading || refreshing}>
                        {(loading || refreshing) ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />측정 중...</>
                        ) : (
                          <><Activity className="mr-2 h-4 w-4" />새로 측정 (3크레딧)</>
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setShowCreditConfirm(false)}>
                        취소
                      </Button>
                      <Button onClick={doMeasure} disabled={loading || refreshing}>
                        {(loading || refreshing) ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />측정 중...</>
                        ) : (
                          <><Activity className="mr-2 h-4 w-4" />{result ? '갱신하기 (3크레딧)' : '측정하기 (3크레딧)'}</>
                        )}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">블로그 지수 측정</h1>
          <p className="mt-1 text-muted-foreground">
            4대 분석 축으로 블로그의 네이버 검색 노출 파워를 정밀 측정합니다
          </p>
        </div>

        {/* 면책 문구 */}
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
          <p>
            <strong>안내:</strong> 본 분석은 자체 알고리즘 기반 추정치이며, 네이버가 공식 제공하는 지표가 아닙니다.
            실제 검색 노출 결과와 차이가 있을 수 있습니다.
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
                  <Label htmlFor="keywords">측정 키워드</Label>
                  <Badge className="bg-primary/10 text-primary text-[10px] font-medium">핵심 기능</Badge>
                </div>
                <Input id="keywords" placeholder="비워두면 포스트에서 자동 추출 (직접 입력 시 쉼표로 구분)" value={testKeywords} onChange={(e) => setTestKeywords(e.target.value)} disabled={loading} />
                <div className="rounded-md bg-blue-50 p-2.5 text-[11px] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                  <p className="font-medium">실제 키워드 순위를 측정합니다</p>
                  <p className="mt-0.5 text-blue-600/70 dark:text-blue-400/70">내 블로그가 해당 키워드 검색에서 몇 위에 노출되는지 확인합니다. 비워두면 블로그 포스트에서 자동 추출한 키워드로 테스트합니다.</p>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}
              <Button type="submit" disabled={loading || refreshing || !blogUrl.trim()} className="w-full">
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />조회 중...</>) : (<><Activity className="mr-2 h-4 w-4" />블로그 지수 조회</>)}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ========== 캐시 상태 + 갱신 버튼 ========== */}
        {result && cachedAt && (() => {
          const cachedDaysAgo = Math.floor((Date.now() - new Date(cachedAt).getTime()) / (1000 * 60 * 60 * 24))
          const isOld = cachedDaysAgo >= 7
          return (
            <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${isOld ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800' : 'bg-muted/30'}`}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isOld ? <Clock className="h-4 w-4 text-orange-500" /> : <Database className="h-4 w-4" />}
                <span>
                  마지막 측정: <strong className={isOld ? 'text-orange-700 dark:text-orange-300' : 'text-foreground'}>
                    {formatCacheAge(cachedAt)}
                  </strong>
                  {isOld && <span className="ml-1.5 text-xs text-orange-600 dark:text-orange-400">갱신 권장</span>}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshClick}
                disabled={refreshing || loading}
                className="gap-1.5"
              >
                {refreshing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />갱신 중...</>
                ) : (
                  <><RefreshCw className="h-3.5 w-3.5" />지수 갱신</>
                )}
              </Button>
            </div>
          )
        })()}

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
                        { icon: <FileText className="h-3 w-3" />, label: '총 포스팅', value: `${result.blogProfile?.totalPostCount ?? result.blogProfile?.totalPosts ?? result.postAnalysis.totalFound}개` },
                        { icon: <Clock className="h-3 w-3" />, label: '최근 포스팅', value: result.postAnalysis.recentPostDays !== null ? `${result.postAnalysis.recentPostDays}일 전` : '-' },
                        { icon: <TrendingUp className="h-3 w-3" />, label: '포스팅 빈도', value: result.postAnalysis.postingFrequency },
                        ...(result.blogProfile?.estimatedStartDate ? [{
                          icon: <Calendar className="h-3 w-3" />,
                          label: result.blogProfile.blogAgeEstimated ? '최초 포스팅 (근사)' : '최초 포스팅',
                          value: (() => {
                            const dateStr = result.blogProfile.estimatedStartDate!
                            const ageDays = result.blogProfile.blogAgeDays
                            const ageText = ageDays != null
                              ? ageDays >= 365
                                ? ` (${Math.floor(ageDays / 365)}년 ${Math.floor((ageDays % 365) / 30)}개월)`
                                : ` (${Math.floor(ageDays / 30)}개월)`
                              : ''
                            return `${dateStr}${ageText}`
                          })(),
                        }] : []),
                        ...(result.benchmark?.buddyCount ? [{ icon: <Users className="h-3 w-3" />, label: '이웃', value: `${result.benchmark.buddyCount.mine.toLocaleString()}명` }] : []),
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
                    <a
                      href={ensureUrl(result.blogUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      블로그 방문 <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>

              {/* 종합 점수 + 레이더 + 등급 (통합) */}
              {(() => {
                // 5대축용 파생 변수 (searchBonus를 AnalysisCategory로 변환)
                const searchBonusCat: AnalysisCategory | null = result.searchBonus && result.searchBonus.score > 0 ? {
                  name: '검색 성과',
                  score: result.searchBonus.score,
                  maxScore: result.searchBonus.maxScore,
                  grade: result.searchBonus.grade,
                  details: result.searchBonus.details,
                  items: result.searchBonus.items,
                } : null
                const displayCategories = axisMode === '5axis' && searchBonusCat
                  ? [...result.categories, searchBonusCat]
                  : result.categories
                const displayTotal = axisMode === '5axis' && searchBonusCat
                  ? result.totalScore + searchBonusCat.score
                  : result.totalScore
                const displayMaxTotal = axisMode === '5axis' && searchBonusCat ? 125 : 100
                const displayScorePct = Math.round((displayTotal / displayMaxTotal) * 100)

                return (
              <Card className="lg:col-span-9">
                <CardContent className="pt-6">
                  {/* 4대축 / 5대축 탭 토글 */}
                  <div className="mb-4 flex items-center gap-1.5 rounded-lg bg-muted p-1">
                    <button
                      onClick={() => setAxisMode('4axis')}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        axisMode === '4axis'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      4대축 <span className="text-[10px] text-muted-foreground">(블로그 체력)</span>
                    </button>
                    <button
                      onClick={() => setAxisMode('5axis')}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        axisMode === '5axis'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      5대축 <span className="text-[10px] text-muted-foreground">(검색 포함)</span>
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* 왼쪽: 레이더 차트 */}
                    <div className="flex items-center justify-center">
                      <RadarChart categories={displayCategories} totalScore={displayTotal} maxTotal={displayMaxTotal} />
                    </div>
                    {/* 오른쪽: 등급 + 최적화 + 프로그레스 */}
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 ${getScoreRingColor(displayScorePct)} bg-background`}>
                          <div className="text-center">
                            <span className="text-2xl font-bold">{displayTotal}</span>
                            <p className="text-[9px] text-muted-foreground">/{displayMaxTotal}</p>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <Badge className={`text-xs font-bold ${result.level.badgeColor}`}>
                            {result.level.label}
                          </Badge>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{result.level.category}</Badge>
                            {result.benchmark && (
                              <Badge variant="outline" className="text-[10px] text-primary">
                                상위 {result.benchmark.categoryPercentile}%
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{result.level.description}</p>
                        </div>
                      </div>

                      {/* v9: 검색 보너스 배너 제거 - SEO 최적화가 본축 */}

                      {/* 최적화 수치 */}
                      {result.benchmark && (
                        <div className="mt-3 rounded-lg bg-muted/50 p-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 font-medium"><Gauge className="h-3 w-3" />최적화 수치</span>
                            <span className="font-bold text-primary">{result.benchmark.optimizationPct}%</span>
                          </div>
                          <div className="mt-1.5 h-2.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${result.benchmark.optimizationPct >= 70 ? 'bg-green-500' : result.benchmark.optimizationPct >= 40 ? 'bg-blue-500' : 'bg-orange-400'}`}
                              style={{ width: `${result.benchmark.optimizationPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* v10: 감점이 각 축에 통합되어 별도 배너 불필요 */}

                      {/* 다음 등급 */}
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

                  {/* 16단계 등급 맵 */}
                  <div className="mt-4 pt-3 border-t">
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">16단계 블로그 지수</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 16 }, (_, i) => {
                        const t = i + 1
                        const active = t === result.level.tier
                        const passed = t < result.level.tier
                        const tierLabels: Record<number, string> = {
                          1: '일반', 2: '준최1', 3: '준최2', 4: '준최3', 5: '준최4',
                          6: '준최5', 7: '준최6', 8: '준최7', 9: '최적1', 10: '최적2',
                          11: '최적3', 12: '최적1+', 13: '최적2+', 14: '최적3+', 15: '최적4+', 16: '파워',
                        }
                        // 색상 그라데이션: slate → violet → indigo → sky → blue → lime → green → teal → emerald → amber
                        function tierBgActive(tier: number) {
                          if (tier >= 16) return 'bg-amber-500'
                          if (tier >= 14) return 'bg-emerald-500'
                          if (tier >= 12) return 'bg-teal-500'
                          if (tier >= 10) return 'bg-green-500'
                          if (tier >= 9) return 'bg-lime-500'
                          if (tier >= 7) return 'bg-blue-500'
                          if (tier >= 5) return 'bg-sky-500'
                          if (tier >= 3) return 'bg-indigo-500'
                          if (tier >= 2) return 'bg-violet-500'
                          return 'bg-slate-500'
                        }
                        function tierBgPassed(tier: number) {
                          if (tier >= 16) return 'bg-amber-200'
                          if (tier >= 14) return 'bg-emerald-200'
                          if (tier >= 12) return 'bg-teal-200'
                          if (tier >= 10) return 'bg-green-200'
                          if (tier >= 9) return 'bg-lime-200'
                          if (tier >= 7) return 'bg-blue-200'
                          if (tier >= 5) return 'bg-sky-200'
                          if (tier >= 3) return 'bg-indigo-200'
                          if (tier >= 2) return 'bg-violet-200'
                          return 'bg-slate-200'
                        }
                        let bg = 'bg-muted'
                        const textCls = 'text-foreground font-bold'
                        if (active) bg = tierBgActive(t)
                        else if (passed) bg = tierBgPassed(t)
                        return (
                          <div key={t} className="flex-1 text-center">
                            <div className={`h-6 rounded flex items-center justify-center ${bg} ${active ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                              <span className={`text-[7px] ${active ? 'text-white font-bold' : passed ? 'text-foreground/60' : 'text-muted-foreground/60'}`}>
                                {t}
                              </span>
                            </div>
                            {active && (
                              <p className={`mt-0.5 text-[7px] ${textCls}`}>{tierLabels[t]}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-0.5 flex justify-between text-[8px] text-muted-foreground">
                      <span className="text-slate-400">일반</span>
                      <span className="text-blue-500">준최적화</span>
                      <span className="text-green-500">최적화</span>
                      <span className="text-emerald-500">최적화+</span>
                      <span className="text-amber-500">파워</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
                )
              })()}
            </div>

            {/* ===== 지수 변동 추이 ===== */}
            {historyData && historyData.history?.length > 0 && historyData.stats && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      지수 변동 추이
                    </CardTitle>
                    <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                      <button
                        onClick={() => setChartMode('total')}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${chartMode === 'total' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        총점 추이
                      </button>
                      <button
                        onClick={() => setChartMode('category')}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${chartMode === 'category' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        카테고리별
                      </button>
                      <button
                        onClick={() => setChartMode('algorithm')}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${chartMode === 'algorithm' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        D.I.A./C-Rank
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <BlogIndexHistoryChart
                    history={historyData.history}
                    stats={historyData.stats}
                    mode={chartMode}
                  />
                </CardContent>
              </Card>
            )}

            {/* ===== 1.5행: D.I.A. + C-Rank 네이버 알고리즘 추정 ===== */}
            {(result.diaScore || result.crankScore) && (
              <div className="grid gap-3 grid-cols-2">
                {[result.diaScore, result.crankScore].filter(Boolean).map((algo) => {
                  if (!algo) return null
                  const scoreColor = algo.score >= 70 ? 'text-green-600' : algo.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                  const barColor = algo.score >= 70 ? 'bg-green-500' : algo.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  return (
                    <Card key={algo.label} className="overflow-hidden">
                      <div className={`h-1 ${barColor}`} />
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {algo.label === 'D.I.A.' ? (
                              <Sparkles className="h-4 w-4 text-purple-500" />
                            ) : (
                              <Crown className="h-4 w-4 text-amber-500" />
                            )}
                            <p className="text-xs font-semibold">{algo.label}</p>
                            <span className="text-[9px] text-muted-foreground">추정</span>
                          </div>
                          <Badge className={`text-[10px] ${getGradeColor(algo.grade)}`}>{algo.grade}</Badge>
                        </div>
                        <div className="mt-2 flex items-end gap-1">
                          <span className={`text-2xl font-bold ${scoreColor}`}>{(algo.score ?? 0).toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground mb-0.5">/100</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${algo.score}%` }} />
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground">{algo.summary}</p>
                        <div className="mt-2 space-y-0.5">
                          {algo.factors.map((f) => (
                            <div key={f.name} className="flex items-center justify-between text-[9px]">
                              <span className="text-muted-foreground">{f.name} ({Math.round(f.weight * 100)}%)</span>
                              <span className="font-medium">{f.score ?? 0}/{25} → {(f.contribution ?? 0).toFixed(1)}점</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* ===== 2행: 축 상세 카드 (4대축 또는 5대축) ===== */}
            {(() => {
              const searchBonusCat5: AnalysisCategory | null = result.searchBonus && result.searchBonus.score > 0 ? {
                name: '검색 성과', score: result.searchBonus.score, maxScore: result.searchBonus.maxScore,
                grade: result.searchBonus.grade, details: result.searchBonus.details, items: result.searchBonus.items,
              } : null
              const displayCats = axisMode === '5axis' && searchBonusCat5
                ? [...result.categories, searchBonusCat5]
                : result.categories
              return (
            <div className={`grid gap-3 grid-cols-2 ${axisMode === '5axis' && displayCats.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
              {displayCats.map((cat) => {
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
                      {/* v10: items 기반 항목별 ±점수 표시 */}
                      {cat.items && cat.items.length > 0 ? (
                        <ul className="mt-1.5 space-y-0.5">
                          {cat.items.map((item, ii) => (
                            <li key={ii} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                              <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${item.points < 0 ? 'bg-red-400' : 'bg-muted-foreground/40'}`} />
                              <span className="line-clamp-2 flex-1">{item.label}</span>
                              <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
                                item.points < 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                item.points >= 5 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                item.points >= 3 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                item.points >= 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {item.points > 0 ? `+${item.points}` : item.points === 0 ? '0' : `${item.points}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : cat.details.length > 0 ? (
                        <ul className="mt-1.5 space-y-0.5">
                          {cat.details.map((detail, di) => (
                            <li key={di} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                              <span className="line-clamp-2 flex-1">{detail}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
              )
            })()}

            {/* ===== 3행: 벤치마크 비교 ===== */}
            {result.benchmark && (() => {
              const bm = result.benchmark!
              // 전체 달성률 계산 (캐시된 이전 데이터에 값이 없을 수 있으므로 ?? 0 방어)
              // 제목 길이는 범위 기반 (15~36자), 나머지는 높을수록 좋음
              const titleMine = bm.avgTitleLength?.mine ?? 0
              const titleOk = titleMine >= 15 && titleMine <= 36
              const items: { mine: number; target: number }[] = [
                { mine: bm.postingFrequency?.mine ?? 0, target: bm.postingFrequency?.recommended ?? 3 },
                { mine: titleOk ? 1 : 0, target: 1 }, // 범위 내면 달성
                { mine: bm.avgContentLength?.mine ?? 0, target: bm.avgContentLength?.recommended ?? 150 },
                { mine: bm.avgImageCount?.mine ?? 0, target: bm.avgImageCount?.recommended ?? 3 },
                { mine: bm.topicFocus?.mine ?? 0, target: bm.topicFocus?.recommended ?? 60 },
              ]
              if (bm.dailyVisitors) items.push({ mine: bm.dailyVisitors.mine, target: bm.dailyVisitors.recommended })
              if (bm.avgCommentCount) items.push({ mine: bm.avgCommentCount.mine, target: bm.avgCommentCount.recommended })
              if (bm.avgSympathyCount) items.push({ mine: bm.avgSympathyCount.mine, target: bm.avgSympathyCount.recommended })

              const achievedCount = items.filter(i => i.mine >= i.target).length
              const overallPct = Math.round((achievedCount / items.length) * 100)
              const overallColor = overallPct >= 70 ? 'text-green-600' : overallPct >= 40 ? 'text-amber-600' : 'text-red-500'

              return (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                        벤치마크 비교
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        {result.blogCategory && result.blogCategory !== 'general' && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {BLOG_CATEGORY_LABELS[result.blogCategory as keyof typeof BLOG_CATEGORY_LABELS] || result.blogCategory}
                            {result.benchmarkSource === 'accumulated' && result.benchmarkSampleCount
                              ? ` (${result.benchmarkSampleCount}개 샘플)`
                              : ''}
                          </span>
                        )}
                        <div className="text-right">
                          <p className={`text-lg font-bold ${overallColor}`}>{achievedCount}/{items.length}</p>
                          <p className="text-[10px] text-muted-foreground">항목 달성</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      <BenchmarkItem label="주간 포스팅" mine={bm.postingFrequency.mine} recommended={bm.postingFrequency.recommended} topBlogger={bm.postingFrequency.topBlogger} unit="회" icon={<Pencil className="h-3.5 w-3.5" />} />
                      <BenchmarkItem label="제목 길이" mine={bm.avgTitleLength.mine} recommended={bm.avgTitleLength.optimal} topBlogger={bm.avgTitleLength.topBlogger} unit="자" icon={<Type className="h-3.5 w-3.5" />} maxOptimal={36} />
                      <BenchmarkItem label="콘텐츠 깊이" mine={bm.avgContentLength.mine} recommended={bm.avgContentLength.recommended} topBlogger={bm.avgContentLength.topBlogger} unit="자" icon={<FileText className="h-3.5 w-3.5" />} />
                      {bm.avgImageCount && (
                        <BenchmarkItem label="평균 이미지 수" mine={bm.avgImageCount.mine} recommended={bm.avgImageCount.recommended} topBlogger={bm.avgImageCount.topBlogger} unit="장" icon={<ImageIcon className="h-3.5 w-3.5" />} />
                      )}
                      <BenchmarkItem label="주제 집중도" mine={bm.topicFocus.mine} recommended={bm.topicFocus.recommended} topBlogger={bm.topicFocus.topBlogger} unit="%" icon={<Focus className="h-3.5 w-3.5" />} />
                      {bm.dailyVisitors && (
                        <BenchmarkItem label="일평균 방문자" mine={bm.dailyVisitors.mine} recommended={bm.dailyVisitors.recommended} topBlogger={bm.dailyVisitors.topBlogger} unit="명" icon={<Eye className="h-3.5 w-3.5" />} />
                      )}
                      {bm.avgCommentCount && (
                        <BenchmarkItem label="평균 댓글 수" mine={bm.avgCommentCount.mine} recommended={bm.avgCommentCount.recommended} topBlogger={bm.avgCommentCount.topBlogger} unit="개" icon={<MessageCircle className="h-3.5 w-3.5" />} />
                      )}
                      {bm.avgSympathyCount && (
                        <BenchmarkItem label="평균 공감 수" mine={bm.avgSympathyCount.mine} recommended={bm.avgSympathyCount.recommended} topBlogger={bm.avgSympathyCount.topBlogger} unit="개" icon={<Heart className="h-3.5 w-3.5" />} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })()}

            {/* ===== AI 심층 분석 (온디맨드) ===== */}
            {!result.aiAnalysis && (
              <Card className="border-purple-200 dark:border-purple-800">
                <CardContent className="py-6">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Brain className="h-8 w-8 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-semibold">AI 심층 분석</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {canUseAi
                          ? 'AI가 포스트 본문을 분석하여 경험 정보, 콘텐츠 품질, 어뷰징 위험도를 평가합니다.'
                          : 'AI 심층 분석은 Starter 플랜 이상에서 사용할 수 있습니다.'}
                      </p>
                    </div>
                    <Button
                      onClick={handleAiAnalysis}
                      disabled={!canUseAi || aiLoading}
                      variant={canUseAi ? 'default' : 'outline'}
                      className="gap-2"
                    >
                      {aiLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />분석 중... (10~20초 소요)</>
                      ) : canUseAi ? (
                        <><Brain className="h-4 w-4" />AI 심층 분석 실행</>
                      ) : (
                        <><Brain className="h-4 w-4" />Starter 플랜 이상 전용</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {result.aiAnalysis && (
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4 text-purple-600" />
                    AI 심층 분석
                    <span className="ml-auto text-[10px] text-muted-foreground font-normal">
                      {result.aiAnalysis.analyzedPosts}개 포스트 분석
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* AI 점수 3대 지표 */}
                  <div className="grid gap-3 sm:grid-cols-3 mb-4">
                    {/* 경험 정보 */}
                    <div
                      className="rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => setAiCardModal({
                        title: '경험 정보',
                        icon: <Eye className="h-5 w-5 text-blue-500" />,
                        score: result.aiAnalysis!.experienceScore,
                        details: result.aiAnalysis!.experienceDetails,
                      })}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-medium">경험 정보</span>
                        <span className={`ml-auto text-lg font-bold ${result.aiAnalysis.experienceScore >= 7 ? 'text-green-600' :
                            result.aiAnalysis.experienceScore >= 4 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                          {result.aiAnalysis.experienceScore}
                          <span className="text-[10px] text-muted-foreground font-normal">/10</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${result.aiAnalysis.experienceScore >= 7 ? 'bg-green-500' :
                              result.aiAnalysis.experienceScore >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          style={{ width: `${result.aiAnalysis.experienceScore * 10}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">
                        {result.aiAnalysis.experienceDetails}
                      </p>
                      <p className="mt-1 text-[9px] text-primary/50 group-hover:text-primary/70 text-right">전체 보기 →</p>
                    </div>

                    {/* 콘텐츠 품질 */}
                    <div
                      className="rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => setAiCardModal({
                        title: '콘텐츠 품질',
                        icon: <FileText className="h-5 w-5 text-purple-500" />,
                        score: result.aiAnalysis!.qualityScore,
                        details: result.aiAnalysis!.qualityDetails,
                      })}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-purple-500" />
                        <span className="text-xs font-medium">콘텐츠 품질</span>
                        <span className={`ml-auto text-lg font-bold ${result.aiAnalysis.qualityScore >= 7 ? 'text-green-600' :
                            result.aiAnalysis.qualityScore >= 4 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                          {result.aiAnalysis.qualityScore}
                          <span className="text-[10px] text-muted-foreground font-normal">/10</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${result.aiAnalysis.qualityScore >= 7 ? 'bg-green-500' :
                              result.aiAnalysis.qualityScore >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          style={{ width: `${result.aiAnalysis.qualityScore * 10}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">
                        {result.aiAnalysis.qualityDetails}
                      </p>
                      <p className="mt-1 text-[9px] text-primary/50 group-hover:text-primary/70 text-right">전체 보기 →</p>
                    </div>

                    {/* 어뷰징 위험도 */}
                    <div
                      className="rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => setAiCardModal({
                        title: '어뷰징 위험도',
                        icon: <ShieldAlert className="h-5 w-5 text-orange-500" />,
                        score: result.aiAnalysis!.abuseRisk,
                        isRisk: true,
                        details: result.aiAnalysis!.abuseDetails,
                      })}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-medium">어뷰징 위험도</span>
                        <span className={`ml-auto text-lg font-bold ${result.aiAnalysis.abuseRisk <= 2 ? 'text-green-600' :
                            result.aiAnalysis.abuseRisk <= 5 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                          {result.aiAnalysis.abuseRisk}
                          <span className="text-[10px] text-muted-foreground font-normal">/10</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${result.aiAnalysis.abuseRisk <= 2 ? 'bg-green-500' :
                              result.aiAnalysis.abuseRisk <= 5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          style={{ width: `${result.aiAnalysis.abuseRisk * 10}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">
                        {result.aiAnalysis.abuseDetails}
                      </p>
                      <p className="mt-1 text-[9px] text-primary/50 group-hover:text-primary/70 text-right">전체 보기 →</p>
                    </div>
                  </div>

                  {/* AI 점수 보정 알림 */}
                  {result.aiAnalysis.scoreAdjustment !== 0 && (
                    <div className={`mb-4 flex items-center gap-2 rounded-lg p-2.5 text-xs ${result.aiAnalysis.scoreAdjustment > 0
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                        : 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300'
                      }`}>
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {result.aiAnalysis.adjustmentReason}
                        <span className="font-bold ml-1">
                          ({result.aiAnalysis.scoreAdjustment > 0 ? '+' : ''}{result.aiAnalysis.scoreAdjustment}점)
                        </span>
                      </span>
                    </div>
                  )}

                  {/* 강점 & 약점 */}
                  <div className="grid gap-3 sm:grid-cols-2 mb-4">
                    {/* 강점 */}
                    <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                        <ThumbsUp className="h-3.5 w-3.5" />강점
                      </p>
                      <ul className="space-y-1">
                        {result.aiAnalysis.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-green-600 dark:text-green-400">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-green-500" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* 약점 */}
                    <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-950/20">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-300 mb-2">
                        <ThumbsDown className="h-3.5 w-3.5" />개선 필요
                      </p>
                      <ul className="space-y-1">
                        {result.aiAnalysis.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-orange-600 dark:text-orange-400">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange-500" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* AI 맞춤 추천 */}
                  {result.aiAnalysis.recommendations.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />AI 맞춤 추천
                      </p>
                      <div className="space-y-1.5">
                        {result.aiAnalysis.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-lg bg-purple-50 p-2 dark:bg-purple-950/20">
                            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-purple-200 text-[9px] font-bold text-purple-700 dark:bg-purple-800 dark:text-purple-200">
                              {i + 1}
                            </div>
                            <p className="text-[11px] text-purple-700 dark:text-purple-300">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                  <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-2 font-medium text-muted-foreground min-w-[120px]">제목</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-20">지수</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground w-24 whitespace-nowrap">작성일</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-16 whitespace-nowrap">경과</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-16">글자수</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-14">이미지</th>
                          {/* 조회수는 네이버에서 비공개이므로 표시하지 않음 */}
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-14">댓글</th>
                          <th className="pb-2 font-medium text-muted-foreground text-center w-14">공감</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.recentPosts.map((post, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 pr-2">
                              <a
                                href={ensureUrl(post.link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-1 hover:text-primary"
                              >
                                <span className="line-clamp-1 text-xs font-medium">{post.title}</span>
                                <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                              </a>
                            </td>
                            <td className="py-2 pr-2 text-center">
                              {post.quality ? (
                                <Badge className={`text-[10px] whitespace-nowrap ${getQualityBadgeStyle(post.quality.category)}`}>
                                  {post.quality.label}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-2 pr-2 text-[11px] text-muted-foreground whitespace-nowrap">{post.date}</td>
                            <td className="py-2 pr-2 text-center">{getDaysAgoBadge(post.daysAgo)}</td>
                            <td className="py-2 pr-2 text-center">
                              <span
                                className={`text-[11px] ${post.isScrapped
                                  ? (post.charCount >= 1500 ? 'text-green-600 font-medium' : post.charCount >= 800 ? 'text-yellow-600' : 'text-muted-foreground')
                                  : (post.charCount >= 300 ? 'text-green-600 font-medium' : post.charCount >= 150 ? 'text-yellow-600' : 'text-muted-foreground')}`}
                                title={post.isScrapped ? '실제 본문 스크래핑 기준' : 'RSS 미리보기 텍스트 기준 (추정치)'}
                              >
                                {post.isScrapped ? '' : '~'}{post.charCount.toLocaleString()}자
                                {post.isScrapped && <span className="ml-0.5 text-[8px] text-blue-500" title="실제 본문 데이터">✓</span>}
                              </span>
                            </td>
                            <td className="py-2 pr-2 text-center">
                              {post.hasImage ? (
                                <span className="flex items-center justify-center gap-0.5">
                                  <ImageIcon className="h-3.5 w-3.5 text-green-600" />
                                  {(post.imageCount ?? 0) > 1 && (
                                    <span className="text-[9px] font-bold text-green-600">{post.imageCount}</span>
                                  )}
                                </span>
                              ) : (
                                <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                              )}
                            </td>
                            {/* 조회수는 네이버에서 비공개이므로 표시하지 않음 */}
                            <td className="py-2 pr-2 text-center">
                              {post.commentCount != null ? (
                                <span className="flex items-center justify-center gap-0.5">
                                  <MessageCircle className="h-3 w-3 text-blue-500" />
                                  <span className="text-[10px]">{post.commentCount}</span>
                                </span>
                              ) : (
                                <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                              )}
                            </td>
                            <td className="py-2 text-center">
                              {post.sympathyCount != null ? (
                                <span className="flex items-center justify-center gap-0.5">
                                  <Heart className="h-3 w-3 text-red-400" />
                                  <span className="text-[10px]">{post.sympathyCount}</span>
                                </span>
                              ) : (
                                <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 포스트 분석 서머리 */}
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-2.5 sm:grid-cols-5">
                    {(() => {
                      // 실제 본문 데이터가 있는지 확인
                      const hasActualContent = result.recentPosts.some(p => p.isScrapped)
                      const scrappedPosts = result.recentPosts.filter(p => p.isScrapped)
                      const avgContentLength = scrappedPosts.length > 0
                        ? Math.round(scrappedPosts.reduce((s, p) => s + p.charCount, 0) / scrappedPosts.length)
                        : result.postAnalysis.avgDescLength

                      return [
                        { label: '평균 제목', value: `${result.postAnalysis.avgTitleLength}자` },
                        {
                          label: hasActualContent ? '본문 깊이' : '미리보기',
                          value: hasActualContent
                            ? `${avgContentLength.toLocaleString()}자`
                            : `~${avgContentLength}자`
                        },
                        { label: '이미지 포함률', value: `${result.recentPosts.length > 0 ? Math.round((result.recentPosts.filter(p => p.hasImage).length / result.recentPosts.length) * 100) : 0}%` },
                        { label: '최적 제목 비율', value: `${result.recentPosts.length > 0 ? Math.round((result.recentPosts.filter(p => p.titleLength >= 15 && p.titleLength <= 40).length / result.recentPosts.length) * 100) : 0}%` },
                        { label: '평균 품질', value: result.recentPosts.filter(p => p.quality).length > 0 ? `${(result.recentPosts.filter(p => p.quality).reduce((s, p) => s + (p.quality?.score || 0), 0) / result.recentPosts.filter(p => p.quality).length).toFixed(1)}/15` : '-' },
                      ].map((stat, i) => (
                        <div key={i} className="text-center">
                          <p className="text-[9px] text-muted-foreground">{stat.label}</p>
                          <p className="text-xs font-bold">{stat.value}</p>
                        </div>
                      ))
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== 축별 분석 상세 ===== */}
            {(() => {
              const searchBonusCatDetail: AnalysisCategory | null = result.searchBonus && result.searchBonus.score > 0 ? {
                name: '검색 성과', score: result.searchBonus.score, maxScore: result.searchBonus.maxScore,
                grade: result.searchBonus.grade, details: result.searchBonus.details, items: result.searchBonus.items,
              } : null
              const detailCats = axisMode === '5axis' && searchBonusCatDetail
                ? [...result.categories, searchBonusCatDetail]
                : result.categories
              return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  축별 분석 상세 <span className="text-xs font-normal text-muted-foreground">({axisMode === '5axis' ? '5대축' : '4대축'})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {detailCats.map((cat) => (
                    <div key={cat.name} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {getCategoryIcon(cat.name)}
                        <h3 className="text-sm font-medium">{cat.name}</h3>
                        <Badge className={`ml-auto text-[10px] ${getGradeColor(cat.grade)}`}>{cat.score}/{cat.maxScore}</Badge>
                      </div>
                      <ul className="space-y-0.5">
                        {cat.details.map((detail, i) => {
                          const scoreMatch = detail.match(/\(\+(\d+)\)\s*$/)
                          const pointText = scoreMatch ? `+${scoreMatch[1]}` : null
                          const detailText = scoreMatch ? detail.replace(/\s*\(\+\d+\)\s*$/, '') : detail
                          const pointNum = scoreMatch ? parseInt(scoreMatch[1]) : 0
                          return (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                              <span className="flex-1">{detailText}</span>
                              {pointText && (
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${pointNum >= 5 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : pointNum >= 3 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : pointNum >= 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                                  {pointText}
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
              )
            })()}

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

            {/* ===== 맞춤형 개선 가이드 ===== */}
            <Card>
              <CardHeader><CardTitle className="text-base">맞춤형 개선 가이드</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  // 가장 약한 카테고리 2개 찾기
                  const weakCategories = [...result.categories]
                    .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))
                    .slice(0, 2)

                  // 카테고리별 맞춤 가이드 매핑
                  const guideMap: Record<string, { title: string; tips: string[] }> = {
                    '콘텐츠 품질': {
                      title: 'D.I.A. 콘텐츠 품질 향상',
                      tips: [
                        '1,500~2,000자 이상의 깊이 있는 글 작성',
                        '소제목(H2, H3)으로 구조화하여 가독성 향상',
                        '포스트당 이미지 3~5장 삽입으로 시각적 풍성함 확보',
                        '한 가지 주제에 집중하여 C-Rank 전문성 확보',
                      ]
                    },
                    '방문자 활동': {
                      title: '방문자 활동 향상',
                      tips: [
                        '댓글을 유도하는 질문형 마무리 활용',
                        '공감 버튼 클릭 유도 문구 삽입',
                        '이웃 블로그 소통으로 방문자 유입 확대',
                        '검색 유입을 늘리는 키워드 최적화',
                      ]
                    },
                    'SEO 최적화': {
                      title: 'SEO 최적화 강화',
                      tips: [
                        '제목 앞부분에 핵심 키워드를 배치',
                        '본문에 키워드를 자연스럽게 3~5회 배치',
                        '관련 키워드(롱테일)를 함께 사용',
                        '태그에 키워드 변형을 포함하여 노출 확대',
                      ]
                    },
                    '신뢰도': {
                      title: '블로그 신뢰도 강화',
                      tips: [
                        '꾸준한 발행 주기 유지 (주 3~5회 권장)',
                        '정해진 요일/시간에 포스팅하여 규칙성 확보',
                        '다양한 주제의 양질 글을 축적하여 누적 포스트 수 늘리기',
                        '기존 인기 글을 주기적으로 업데이트',
                      ]
                    }
                  }

                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {weakCategories.map((cat) => {
                        const guide = guideMap[cat.name]
                        if (!guide) return null

                        return (
                          <div key={cat.name} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-medium text-muted-foreground">{guide.title}</p>
                              <Badge variant="outline" className="text-[9px]">
                                현재 {cat.score}/{cat.maxScore}
                              </Badge>
                            </div>
                            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                              {guide.tips.map((tip, i) => (
                                <li key={i}>- {tip}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
