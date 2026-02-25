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
  ShieldAlert,
  Eye,
  MessageCircle,
  Heart,
  RefreshCw,
  Database,
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

const BlogIndexHistoryChart = dynamic(
  () => import('@/components/charts/blog-index-history-chart').then(m => ({ default: m.BlogIndexHistoryChart })),
  { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded bg-muted" /> }
)

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
  totalPostCount?: number | null
  blogCreatedDate?: string | null
}

interface BenchmarkData {
  postingFrequency: { mine: number; recommended: number; topBlogger: number }
  avgTitleLength: { mine: number; optimal: number }
  avgContentLength: { mine: number; recommended: number }
  imageRate: { mine: number; recommended: number }
  topicFocus: { mine: number; recommended: number }
  keywordDensity?: { mine: number; optimal: [number, number] }
  avgImageCount?: { mine: number; recommended: number }
  optimizationPct: number
  categoryPercentile: number
  avgCommentCount?: { mine: number; recommended: number }
  avgSympathyCount?: { mine: number; recommended: number }
  dailyVisitors?: { mine: number; recommended: number; topBlogger: number }
  blogAge?: { mine: number; recommended: number }
  totalPostCount?: { mine: number; recommended: number }
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
    case '방문자 & 인기도': return '방문자'
    case '콘텐츠 품질': return '콘텐츠'
    case '주제 전문성': return '전문성'
    case '활동성': return '활동성'
    case '블로그 신뢰도': return '신뢰도'
    default: return name
  }
}

function RadarChart({ categories, totalScore, size = 220 }: { categories: AnalysisCategory[]; totalScore?: number; size?: number }) {
  const pad = 58 // 라벨용 여백 (5축 대응)
  const totalSize = size + pad * 2
  const center = totalSize / 2
  const radius = size / 2

  // 5축 각도 (12시 방향 시작, 시계 방향)
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
        / 100
      </text>
    </svg>
  )
}

// ===== 유틸 함수 =====


function getQualityBadgeStyle(category: string) {
  switch (category) {
    case '파워': return 'bg-emerald-500 text-white'
    case '최적화': return 'bg-green-500 text-white'
    case '준최적화': return 'bg-blue-500 text-white'
    case '일반': return 'bg-yellow-500 text-white'
    case '저품질': return 'bg-red-500 text-white'
    default: return 'bg-gray-500 text-white'
  }
}

function getTierBarColor(tier: number) {
  if (tier >= 11) return 'bg-emerald-500'
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
    case '방문자 & 인기도': return <Eye className="h-4 w-4" />
    case '콘텐츠 품질': return <FileText className="h-4 w-4" />
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
  const [refreshing, setRefreshing] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BlogIndexResult | null>(null)
  const [userPlan, setUserPlan] = useState<string>('free')
  const [historyData, setHistoryData] = useState<BlogIndexHistoryData | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [showCreditConfirm, setShowCreditConfirm] = useState(false)
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
      .then(r => r.json())
      .then(h => setHistoryData(h))
      .catch(() => {})
  }

  // 플랜 정보 가져오기
  const fetchPlan = async () => {
    try {
      const profileRes = await fetch('/api/dashboard')
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setUserPlan(profileData.plan || 'free')
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
    try {
      // 1) DB에서 캐시 조회
      const cacheRes = await fetch(`/api/blog-index/history?blogUrl=${encodeURIComponent(blogUrl.trim())}&latest=true`)
      const cacheData = await cacheRes.json()

      if (cacheData.cached) {
        // 캐시 있음 → 즉시 표시 (크레딧 0)
        setResult(cacheData.cached)
        setCachedAt(cacheData.checkedAt)
        // 히스토리도 조회
        fetchHistory(blogUrl.trim())
        fetchPlan()
        // 자동 추출 키워드 채우기
        if (!testKeywords.trim() && cacheData.cached.keywordResults?.length > 0) {
          setTestKeywords(cacheData.cached.keywordResults.map((kr: KeywordRankResult) => kr.keyword).join(', '))
        }
        setLoading(false)
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
    setShowCreditConfirm(true)
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

      {/* 크레딧 소모 확인 팝업 */}
      <Dialog open={showCreditConfirm} onOpenChange={setShowCreditConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>블로그 지수 측정</DialogTitle>
            <DialogDescription>
              {result
                ? '최신 데이터로 지수를 갱신합니다.'
                : '이 블로그의 측정 기록이 없습니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
            <p className="font-medium">크레딧 3개가 소모됩니다</p>
            <p className="mt-0.5 text-xs opacity-70">네이버 API 호출 + AI 분석이 포함됩니다</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">블로그 지수 측정</h1>
          <p className="mt-1 text-muted-foreground">
            5대 분석 축으로 블로그의 네이버 검색 노출 파워를 정밀 측정합니다
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
        {result && cachedAt && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>
                마지막 측정: <strong className="text-foreground">
                  {new Date(cachedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </strong>
                <span className="ml-1 text-xs">
                  ({new Date(cachedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})
                </span>
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
        )}

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
                        ...(result.blogProfile?.blogAgeDays ? [{ icon: <Calendar className="h-3 w-3" />, label: '블로그 연차', value: result.blogProfile.blogAgeDays >= 365 ? `${Math.floor(result.blogProfile.blogAgeDays / 365)}년 ${Math.floor((result.blogProfile.blogAgeDays % 365) / 30)}개월` : `${Math.floor(result.blogProfile.blogAgeDays / 30)}개월` }] : []),
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

              {/* 종합 점수 + 레이더 + 등급 (통합) */}
              <Card className="lg:col-span-9">
                <CardContent className="pt-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* 왼쪽: 레이더 차트 */}
                    <div className="flex items-center justify-center">
                      <RadarChart categories={result.categories} totalScore={result.totalScore} />
                    </div>
                    {/* 오른쪽: 등급 + 최적화 + 프로그레스 */}
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 ${getScoreRingColor(result.totalScore)} bg-background`}>
                          <div className="text-center">
                            <span className="text-2xl font-bold">{result.totalScore}</span>
                            <p className="text-[9px] text-muted-foreground">/100</p>
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

                      {/* 검색 보너스 */}
                      {result.searchBonus && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-purple-50 p-2 dark:bg-purple-950/30">
                          <Zap className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-purple-600 dark:text-purple-300 font-medium">검색 보너스</span>
                            <span className="font-bold text-purple-700 dark:text-purple-200">+α {result.searchBonus.score}/{result.searchBonus.maxScore}</span>
                          </div>
                          <span className="ml-auto text-[9px] text-purple-500/70 dark:text-purple-400/70">기본 지수에 반영되지 않습니다</span>
                        </div>
                      )}

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

                  {/* 11단계 등급 맵 */}
                  <div className="mt-4 pt-3 border-t">
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">11단계 블로그 지수</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 11 }, (_, i) => {
                        const t = i + 1
                        const active = t === result.level.tier
                        const passed = t < result.level.tier
                        const tierLabels: Record<number, string> = { 1: '저품질1', 2: '저품질2', 3: '일반1', 4: '일반2', 5: '일반3', 6: '준최적화1', 7: '준최적화2', 8: '준최적화3', 9: '최적화1', 10: '최적화2', 11: '파워' }
                        let bg = 'bg-muted'
                        const textCls = 'text-foreground font-bold'
                        if (active) {
                          bg = t >= 11 ? 'bg-emerald-500' : t >= 9 ? 'bg-green-500' : t >= 6 ? 'bg-blue-500' : t >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                        } else if (passed) {
                          bg = t >= 11 ? 'bg-emerald-200' : t >= 9 ? 'bg-green-200' : t >= 6 ? 'bg-blue-200' : t >= 3 ? 'bg-yellow-200' : 'bg-red-200'
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
                      <span className="text-emerald-500">파워</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ===== 지수 변동 추이 ===== */}
            {historyData && historyData.history.length > 0 && historyData.stats && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    지수 변동 추이
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BlogIndexHistoryChart
                    history={historyData.history}
                    stats={historyData.stats}
                  />
                </CardContent>
              </Card>
            )}

            {/* ===== 2행: 5축 + 검색 보너스 상세 카드 (전체 너비) ===== */}
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
            {/* 검색 보너스 별도 카드 */}
            {result.searchBonus && (
              <Card className="overflow-hidden border-purple-200 dark:border-purple-800">
                <div className="h-1 bg-purple-500" />
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-purple-500" />
                      <p className="text-xs font-medium">검색 보너스</p>
                      <Badge className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">+α</Badge>
                    </div>
                    <Badge className={`text-[10px] ${getGradeColor(result.searchBonus.grade)}`}>{result.searchBonus.grade}</Badge>
                  </div>
                  <div className="mt-2 flex items-end gap-4">
                    <div>
                      <div className="flex items-end gap-1">
                        <span className="text-xl font-bold text-purple-600">{result.searchBonus.score}</span>
                        <span className="text-[10px] text-muted-foreground">/{result.searchBonus.maxScore}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-24 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-purple-500" style={{ width: `${Math.round((result.searchBonus.score / result.searchBonus.maxScore) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-purple-500/80 dark:text-purple-400/80">
                        이 점수는 키워드별로 달라지며, 기본 지수에 반영되지 않습니다
                      </p>
                      {result.searchBonus.details[0] && (
                        <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1">{result.searchBonus.details[0]}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                    {result.benchmark.dailyVisitors && (
                      <BenchmarkBar label="일평균 방문자" mine={result.benchmark.dailyVisitors.mine} target={result.benchmark.dailyVisitors.recommended} targetLabel="권장" max={Math.max(result.benchmark.dailyVisitors.topBlogger, result.benchmark.dailyVisitors.mine, 1000)} />
                    )}
                    {result.benchmark.avgCommentCount && (
                      <BenchmarkBar label="평균 댓글 수" mine={result.benchmark.avgCommentCount.mine} target={result.benchmark.avgCommentCount.recommended} targetLabel="권장" max={Math.max(30, result.benchmark.avgCommentCount.mine)} />
                    )}
                    {result.benchmark.avgSympathyCount && (
                      <BenchmarkBar label="평균 공감 수" mine={result.benchmark.avgSympathyCount.mine} target={result.benchmark.avgSympathyCount.recommended} targetLabel="권장" max={Math.max(50, result.benchmark.avgSympathyCount.mine)} />
                    )}
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
                    <table className="w-full min-w-[700px] text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-2 font-medium text-muted-foreground min-w-[120px]">제목</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-20">지수</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground w-24 whitespace-nowrap">작성일</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-16 whitespace-nowrap">경과</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-16">글자수</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-14">이미지</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground text-center w-14">댓글</th>
                          <th className="pb-2 font-medium text-muted-foreground text-center w-14">공감</th>
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
                    '방문자 & 인기도': {
                      title: '방문자 & 인기도 향상',
                      tips: [
                        '댓글을 유도하는 질문형 마무리 활용',
                        '공감 버튼 클릭 유도 문구 삽입',
                        '검색 유입을 늘리는 키워드 최적화',
                        '이웃 블로그 소통으로 방문자 유입 확대',
                      ]
                    },
                    '콘텐츠 품질': {
                      title: 'D.I.A. 콘텐츠 품질 향상',
                      tips: [
                        '1,500~2,000자 이상의 깊이 있는 글 작성',
                        '소제목(H2, H3)으로 구조화하여 가독성 향상',
                        '포스트당 이미지 3~5장 삽입으로 시각적 풍성함 확보',
                        '리스트, 구체적 수치 등 구조화 서식 활용',
                      ]
                    },
                    '주제 전문성': {
                      title: 'C-Rank 주제 전문성 강화',
                      tips: [
                        '한 가지 주제에 집중하여 블로그 정체성 확립',
                        '관련 키워드를 자연스럽게 본문에 배치',
                        '같은 주제로 시리즈 포스팅 작성',
                        '해당 분야 전문 용어와 인사이트 포함',
                      ]
                    },
                    '활동성': {
                      title: '활동성 강화',
                      tips: [
                        '꾸준한 발행 주기 유지 (주 3~5회 권장)',
                        '정해진 요일/시간에 포스팅하여 규칙성 확보',
                        '최소 주 1회 이상 포스팅하여 활성 상태 유지',
                        '검색 트렌드에 맞는 시의성 있는 콘텐츠 발행',
                      ]
                    },
                    '블로그 신뢰도': {
                      title: '블로그 신뢰도 강화',
                      tips: [
                        '장기간 꾸준히 운영하여 블로그 연차 확보',
                        '다양한 주제의 양질 글을 축적하여 누적 포스트 수 늘리기',
                        '기존 인기 글을 주기적으로 업데이트',
                        '독자와의 소통으로 블로그 커뮤니티 구축',
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
