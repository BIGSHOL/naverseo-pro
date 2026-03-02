'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3, Loader2, CheckCircle, AlertTriangle, XCircle, ArrowUp, ArrowDown, Link2, ExternalLink, Wand2, Sparkles, Brain, Star, Target, MessageSquare, Lightbulb, Image, Type, Bold, Heading, Palette, Highlighter, Underline, AlertCircle, Check } from 'lucide-react'
import { CreditTooltip } from '@/components/credit-tooltip'
import { PlanGateAlert } from '@/components/plan-gate-alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { LiveSeoPanel } from '@/components/seo/LiveSeoPanel'
import { SeoScanPreview } from '@/components/seo/SeoScanPreview'
import { cn } from '@/lib/utils'
import { analyzeSeo, analyzeReadability, getGradeByScore, type SeoGradeInfo } from '@/lib/seo/engine'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { InlineMarkdown } from '@/components/ui/inline-markdown'
import { ensureUrl } from '@/lib/utils/text'
import dynamic from 'next/dynamic'
/** NDJSON 스트림 진행 이벤트 (seo-check 전용) */
interface ScanProgress {
  step: number
  total: number
  label: string
  percent: number
}

// TipTap 에디터는 클라이언트 전용 (SSR 방지)
const TiptapEditor = dynamic(
  () => import('@/components/content/TiptapEditor').then(mod => ({ default: mod.TiptapEditor })),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg border bg-muted" /> }
)

interface SeoCategory {
  id: string
  name: string
  score: number
  maxScore: number
  feedback: string
}

interface AiAnalysis {
  experienceScore: number
  experienceDetails: string
  contentQualityScore: number
  contentQualityDetails: string
  keywordStrategyScore: number
  keywordStrategyDetails: string
  engagementScore: number
  engagementDetails: string
  overallFeedback: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  scoreAdjustment: number
  adjustmentReason: string
}

interface SeoResult {
  totalScore: number
  grade?: string
  categories: SeoCategory[]
  improvements: string[]
  strengths: string[]
  isDemo: boolean
  demoReason?: string
  aiAnalysis?: AiAnalysis | null
}

function getCategoryScoreColor(score: number, max: number) {
  const pct = (score / max) * 100
  if (pct >= 60) return 'text-green-600'
  if (pct >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

/** 점수 기반 프로그레스 바 색상 (카테고리 항목용) */
function getScoreBarBg(score: number) {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

/** 16단계 등급 색상 → 원형 스코어 배경 */
function getScoreCircleBg(color: string) {
  const map: Record<string, string> = {
    amber: 'bg-amber-500', emerald: 'bg-emerald-500', teal: 'bg-teal-500',
    green: 'bg-green-500', lime: 'bg-lime-600', blue: 'bg-blue-500',
    sky: 'bg-sky-500', indigo: 'bg-indigo-500', violet: 'bg-violet-500', slate: 'bg-slate-500',
  }
  return map[color] || 'bg-slate-500'
}

/** 16단계 등급 색상 → 텍스트 색상 */
function getGradeTextColor(color: string) {
  const map: Record<string, string> = {
    amber: 'text-amber-700', emerald: 'text-emerald-700', teal: 'text-teal-700',
    green: 'text-green-700', lime: 'text-lime-700', blue: 'text-blue-700',
    sky: 'text-sky-700', indigo: 'text-indigo-700', violet: 'text-violet-700', slate: 'text-slate-700',
  }
  return map[color] || 'text-slate-700'
}

/** 카테고리별 아이콘 */
function getGradeCategoryIcon(category: string) {
  switch (category) {
    case '파워': return Star
    case '최적화+': return CheckCircle
    case '최적화': return CheckCircle
    case '준최적화': return AlertTriangle
    default: return XCircle
  }
}

function getCharCountClass(len: number) {
  if (len < 800) return 'text-red-500'
  if (len < 1500) return 'text-yellow-500'
  if (len <= 3000) return 'text-green-500'
  return 'text-yellow-500'
}

/** AI 분석 축 점수 색상 (10점 만점) */
function getAxisColor(score: number) {
  if (score >= 8) return 'text-green-600'
  if (score >= 6) return 'text-blue-600'
  if (score >= 4) return 'text-yellow-600'
  return 'text-red-600'
}

function getAxisBg(score: number) {
  if (score >= 8) return 'bg-green-500'
  if (score >= 6) return 'bg-blue-500'
  if (score >= 4) return 'bg-yellow-500'
  return 'bg-red-500'
}

/** 스캔 애니메이션 설정 */
const SCAN_MIN_MS = 8000       // 최소 8초 스캔 애니메이션 (사용자가 볼 수 있도록 느리게)
const SCAN_INTERVAL_MS = 150   // 150ms 간격 업데이트
const SCAN_TOTAL_STEPS = Math.ceil(SCAN_MIN_MS / SCAN_INTERVAL_MS)
const SCAN_LABELS = [
  'SEO 엔진 분석 중...',
  '키워드·구조 분석 중...',
  '가독성 분석 중...',
  '결과 정리 중...',
]

export default function SeoCheckPage() {
  const searchParams = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planGate, setPlanGate] = useState<string | null>(null)
  const [result, setResult] = useState<SeoResult | null>(null)
  // 입력 모드: 'url' (기본) vs 'manual' (직접 입력)
  const [inputMode, setInputMode] = useState<'url' | 'manual'>('url')
  const [blogUrl, setBlogUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [fetchSource, setFetchSource] = useState('')
  const [scrapedStats, setScrapedStats] = useState<{
    charCount: number; imageCount: number; videoCount: number
    commentCount: number | null; sympathyCount: number | null
    imageUrls: string[]
    tags: string[]
    formatting?: { hasBold: boolean; hasHeading: boolean; hasFontSize: boolean; hasColor: boolean; hasHighlight: boolean; hasUnderline: boolean; count: number }
  } | null>(null)
  const [showImageGallery, setShowImageGallery] = useState(false)
  // URL fetch 후 콘텐츠 미리보기 접기/펼치기
  const [showContentPreview, setShowContentPreview] = useState(false)

  // 프로그레스 UI
  const [progressStep, setProgressStep] = useState<ScanProgress | null>(null)

  // AI 심층 분석 후속 로딩 상태
  const [aiLoading, setAiLoading] = useState(false)
  const [aiProgressLabel, setAiProgressLabel] = useState('')

  // AI 약점 개선
  const [improving, setImproving] = useState(false)
  const [improveMessage, setImproveMessage] = useState('')
  const [guidanceItems, setGuidanceItems] = useState<Array<{ id: string; name: string; score: number; maxScore: number; guidance: string }>>([])

  // 실시간 분석 패널 표시 여부
  const showLivePanel = content.trim().length >= 50 && keyword.trim().length > 0

  // URL param + sessionStorage에서 프리필
  useEffect(() => {
    const kwParam = searchParams.get('keyword')
    if (kwParam) {
      setKeyword(kwParam)
    }

    const storedContent = sessionStorage.getItem('naverseo-workflow:content-body')
    const storedTitle = sessionStorage.getItem('naverseo-workflow:content-title')
    const storedKeyword = sessionStorage.getItem('naverseo-workflow:content-keyword')

    // sessionStorage에서 콘텐츠가 있으면 직접 입력 모드로 전환
    if (storedContent) {
      setContent(storedContent)
      setInputMode('manual')
      sessionStorage.removeItem('naverseo-workflow:content-body')
    }
    if (storedTitle) {
      setTitle(storedTitle)
      sessionStorage.removeItem('naverseo-workflow:content-title')
    }
    if (storedKeyword) {
      if (!kwParam) setKeyword(storedKeyword)
      sessionStorage.removeItem('naverseo-workflow:content-keyword')
    }
  }, [searchParams])

  const handleFetchBlog = async () => {
    if (!blogUrl.trim() || fetchingUrl) return

    setFetchingUrl(true)
    setError('')

    try {
      const res = await fetch('/api/naver/blog-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: blogUrl.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '블로그 글을 가져오는데 실패했습니다.')
        return
      }

      if (data.title) setTitle(data.title)
      if (data.content) setContent(data.content)
      if (data.source) setFetchSource(data.source)
      // 스크래핑 상세 데이터 저장
      if (data.detailedAnalysis?.scrapedData) {
        const sd = data.detailedAnalysis.scrapedData
        setScrapedStats({
          charCount: sd.charCount,
          imageCount: sd.imageCount,
          videoCount: sd.videoCount,
          commentCount: sd.commentCount ?? null,
          sympathyCount: sd.sympathyCount ?? null,
          imageUrls: sd.imageUrls ?? [],
          tags: data.detailedAnalysis?.tags ?? [],
          formatting: sd.formatting,
        })
        // 이미지가 있으면 갤러리 자동 표시
        if (sd.imageUrls?.length > 0) setShowImageGallery(true)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setFetchingUrl(false)
    }
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || loading) return

    setLoading(true)
    setError('')
    setPlanGate(null)
    setProgressStep(null)
    setAiLoading(false)
    setAiProgressLabel('')
    setGuidanceItems([])
    setImproveMessage('')

    const requestBody = {
      keyword: keyword.trim(),
      title: title.trim(),
      content: content.trim(),
      ...(scrapedStats && {
        scrapedMeta: {
          charCount: scrapedStats.charCount,
          imageCount: scrapedStats.imageCount,
          videoCount: scrapedStats.videoCount,
          commentCount: scrapedStats.commentCount,
          sympathyCount: scrapedStats.sympathyCount,
          tags: scrapedStats.tags,
          formatting: scrapedStats.formatting,
        },
      }),
    }

    // === 클라이언트 직접 분석 + 스캔 애니메이션 ===
    // API 의존성 제거: analyzeSeo는 순수 함수이므로 클라이언트에서 즉시 실행
    // 크레딧 차감과 AI 심층 분석만 API 호출 (백그라운드)
    setProgressStep({ step: 1, total: 3, label: SCAN_LABELS[0], percent: 5 })

    // 1단계: 클라이언트 로컬 SEO 분석 (즉시, API 호출 없음)
    const seoScrapedMeta = scrapedStats ? {
      tags: scrapedStats.tags,
      formatting: scrapedStats.formatting,
    } : undefined
    const engineResult = analyzeSeo(
      keyword.trim(),
      title.trim(),
      content.trim(),
      undefined,
      seoScrapedMeta
    )
    const readability = analyzeReadability(content.trim())

    const localResult: SeoResult = {
      totalScore: engineResult.totalScore,
      grade: engineResult.grade,
      categories: engineResult.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        score: cat.score,
        maxScore: cat.maxScore,
        feedback: cat.details,
      })),
      improvements: engineResult.improvements,
      strengths: engineResult.strengths,
      isDemo: false,
      aiAnalysis: null,
    }

    // 스캔 애니메이션 (8초 시각 이펙트 — 분석은 이미 완료됨)
    let scanTimerRef: ReturnType<typeof setInterval> | null = null
    try {
      await new Promise<void>(resolve => {
        let s = 0
        scanTimerRef = setInterval(() => {
          s++
          const pct = Math.min(95, 5 + (s / SCAN_TOTAL_STEPS) * 90)
          const li = Math.min(Math.floor(pct / 25), SCAN_LABELS.length - 1)
          setProgressStep({ step: li + 1, total: 3, label: SCAN_LABELS[li], percent: Math.round(pct) })
          if (s >= SCAN_TOTAL_STEPS) {
            clearInterval(scanTimerRef!)
            scanTimerRef = null
            resolve()
          }
        }, SCAN_INTERVAL_MS)
      })

      // 스캔 완료 → 100% 잠시 표시 후 결과 전환
      setProgressStep({ step: 3, total: 3, label: '분석 완료!', percent: 100 })
      await new Promise(r => setTimeout(r, 600))

      // 로컬 분석 결과 즉시 표시
      setResult(localResult)
      setLoading(false)
      setProgressStep(null)

      // 2단계: 크레딧 차감 (백그라운드, 실패해도 결과는 유지)
      fetch('/api/ai/seo-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }).catch(() => { /* 크레딧 차감 실패 무시 — 결과는 이미 표시됨 */ })

      // 3단계: AI 심층 분석 (별도 요청)
      setAiLoading(true)
      setAiProgressLabel('AI 심층 분석 시작...')

      try {
        const aiRes = await fetch('/api/ai/seo-check/deep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...requestBody,
            baseScore: localResult.totalScore,
          }),
        })

        let aiData
        try {
          aiData = await aiRes.json()
        } catch {
          setAiLoading(false)
          setAiProgressLabel('')
          return
        }

        if (aiRes.ok && aiData.aiAnalysis) {
          setResult(prev => prev ? {
            ...prev,
            aiAnalysis: aiData.aiAnalysis,
            isDemo: aiData.isDemo ?? prev.isDemo,
            demoReason: aiData.demoReason ?? prev.demoReason,
            ...(aiData.totalScore != null ? { totalScore: aiData.totalScore } : {}),
            ...(aiData.grade != null ? { grade: aiData.grade } : {}),
          } : prev)
        }
      } catch {
        // AI 분석 실패해도 기본 결과 유지
      } finally {
        setAiLoading(false)
        setAiProgressLabel('')
      }
    } catch {
      setError('분석 중 오류가 발생했습니다.')
    } finally {
      if (scanTimerRef) clearInterval(scanTimerRef)
      setLoading(false)
      setProgressStep(null)
    }
  }

  const handleImprove = async () => {
    if (improving || !content.trim() || !keyword.trim()) return
    setImproving(true)
    setImproveMessage('')
    setGuidanceItems([])

    try {
      // 클라이언트에서 SEO 분석 실행 → 약한 항목 추출
      const seoResult = analyzeSeo(keyword.trim(), title, content)
      const weakCategories = [...seoResult.categories]
        .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))
        .filter(cat => (cat.score / cat.maxScore) < 0.8)
        .slice(0, 5)
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          score: cat.score,
          maxScore: cat.maxScore,
          details: cat.details,
        }))

      if (weakCategories.length === 0) {
        setImproveMessage('모든 항목이 양호합니다! 개선할 약점이 없습니다.')
        setTimeout(() => setImproveMessage(''), 3000)
        return
      }

      setImproveMessage(`${weakCategories.length}개 약점 분석 중...`)

      const res = await fetch('/api/ai/content/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          title: title.trim(),
          content: content.trim(),
          weakCategories,
        }),
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any

      const ct = res.headers.get('Content-Type') || ''
      if (ct.includes('application/x-ndjson') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buf += decoder.decode()
          } else {
            buf += decoder.decode(value, { stream: true })
          }

          const lines = buf.split('\n')
          buf = done ? '' : (lines.pop() || '')

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)
              if (event.type === 'stream') {
                setImproveMessage('AI가 개선안을 작성 중...')
              } else if (event.type === 'result') {
                data = event
              } else if (event.type === 'error') {
                if (event.planGate) {
                  setPlanGate(event.error)
                } else {
                  setImproveMessage(event.error || 'AI 개선에 실패했습니다.')
                }
                return
              }
            } catch {
              // 파싱 실패 무시
            }
          }

          if (done) break
        }
      } else {
        data = await res.json()
        if (!res.ok) {
          if (data.planGate) {
            setPlanGate(data.error)
          } else {
            setImproveMessage(data.error || 'AI 개선에 실패했습니다.')
          }
          return
        }
      }

      if (!data) {
        setImproveMessage('AI 응답을 받지 못했습니다.')
        return
      }

      // 가이드 항목 저장
      if (data.guidance && Array.isArray(data.guidance) && data.guidance.length > 0) {
        setGuidanceItems(data.guidance)
      }

      // 패치 일괄 적용
      const validPatches = (data.patches && Array.isArray(data.patches))
        ? data.patches.filter((p: { find: string; replace: string }) =>
            typeof p.find === 'string' && typeof p.replace === 'string' && p.find.length > 0 && content.includes(p.find)
          )
        : []

      let updatedContent = content
      let appliedCount = 0
      let skippedCount = 0

      for (const patch of validPatches) {
        if (updatedContent.includes(patch.find)) {
          updatedContent = updatedContent.replace(patch.find, patch.replace)
          appliedCount++
        } else {
          skippedCount++
        }
      }

      if (data.append) {
        updatedContent = updatedContent.trimEnd() + '\n\n' + data.append
        appliedCount++
      }
      if (data.title) setTitle(data.title)
      if (appliedCount > 0) setContent(updatedContent)

      const messages: string[] = []
      if (appliedCount > 0) messages.push(`${appliedCount}개 수정 적용!`)
      if (skippedCount > 0) messages.push(`${skippedCount}개 건너뜀`)
      if (data.guidance?.length > 0) messages.push(`${data.guidance.length}개 항목은 아래 가이드 확인`)
      if (appliedCount === 0 && skippedCount > 0 && !data.guidance?.length) {
        setImproveMessage('패치 적용에 실패했습니다. 다시 시도해주세요.')
      } else {
        setImproveMessage(messages.join(', ') + (appliedCount > 0 ? ' 다시 분석하여 점수를 확인하세요.' : ''))
      }
      setTimeout(() => setImproveMessage(''), 6000)
    } catch {
      setImproveMessage('네트워크 오류가 발생했습니다.')
    } finally {
      setImproving(false)
    }
  }

  const gradeInfo: SeoGradeInfo | null = result ? getGradeByScore(result.totalScore) : null
  const GradeIcon = gradeInfo ? getGradeCategoryIcon(gradeInfo.category) : null
  const ai = result?.aiAnalysis

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SEO 점수 체크</h1>
        <p className="mt-1 text-muted-foreground">
          작성한 콘텐츠의 네이버 SEO 점수를 실시간으로 분석합니다
        </p>
      </div>

      {/* 입력 폼 + 실시간 분석 2컬럼 */}
      <div className={cn('grid gap-6', showLivePanel && 'lg:grid-cols-[1fr,380px]')}>
        {/* 좌측: 입력 폼 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
              <span>{inputMode === 'url' ? '블로그 URL 분석' : '직접 입력 분석'}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => {
                  setInputMode(inputMode === 'url' ? 'manual' : 'url')
                  setError('')
                }}
              >
                {inputMode === 'url' ? '직접 입력으로 전환' : 'URL 분석으로 전환'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAnalyze} className="space-y-4">
              {/* === URL 모드 === */}
              {inputMode === 'url' && (
                <>
                  {/* URL 입력 */}
                  <div className="space-y-2">
                    <Label>네이버 블로그 URL</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://blog.naver.com/blogid/123456789"
                        value={blogUrl}
                        onChange={(e) => setBlogUrl(e.target.value)}
                        disabled={fetchingUrl || loading}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleFetchBlog()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleFetchBlog}
                        disabled={fetchingUrl || !blogUrl.trim() || loading}
                      >
                        {fetchingUrl ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          '가져오기'
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* 키워드 입력 */}
                  <div className="space-y-2">
                    <Label htmlFor="keyword">타겟 키워드 (선택)</Label>
                    <Input
                      id="keyword"
                      placeholder="예: 다이어트 식단"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">키워드를 입력하면 키워드 밀도, 배치 등 더 정밀한 분석이 가능합니다</p>
                  </div>

                  {/* URL fetch 완료 후 결과 요약 */}
                  {fetchSource && content && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      {/* 출처 + 기본 정보 */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                            <ExternalLink className="h-3 w-3" />
                            분석 대상
                          </Badge>
                          <a
                            href={ensureUrl(fetchSource)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 truncate text-xs text-muted-foreground hover:underline"
                          >
                            {fetchSource}
                          </a>
                        </div>
                        {title && (
                          <p className="text-sm font-medium">{title}</p>
                        )}
                        {scrapedStats && (
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="rounded bg-muted px-2 py-0.5">{scrapedStats.charCount.toLocaleString()}자</span>
                            <span className="rounded bg-muted px-2 py-0.5">이미지 {scrapedStats.imageCount}개</span>
                            {scrapedStats.videoCount > 0 && <span className="rounded bg-muted px-2 py-0.5">동영상 {scrapedStats.videoCount}개</span>}
                            <span className="rounded bg-muted px-2 py-0.5">댓글 {scrapedStats.commentCount ?? '?'}개</span>
                            {scrapedStats.sympathyCount != null && <span className="rounded bg-muted px-2 py-0.5">공감 {scrapedStats.sympathyCount}개</span>}
                          </div>
                        )}
                      </div>

                      {/* 태그 */}
                      {scrapedStats?.tags && scrapedStats.tags.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">태그 ({scrapedStats.tags.length}개)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {scrapedStats.tags.map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-normal">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 서식 사용 현황 */}
                      {scrapedStats?.formatting && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            서식 사용 ({scrapedStats.formatting.count}/6종)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { key: 'hasBold', label: '볼드', icon: Bold },
                              { key: 'hasHeading', label: '소제목', icon: Heading },
                              { key: 'hasFontSize', label: '글자크기', icon: Type },
                              { key: 'hasColor', label: '글자색', icon: Palette },
                              { key: 'hasHighlight', label: '형광펜', icon: Highlighter },
                              { key: 'hasUnderline', label: '밑줄', icon: Underline },
                            ].map(({ key, label, icon: Icon }) => {
                              const used = scrapedStats.formatting?.[key as keyof typeof scrapedStats.formatting] as boolean
                              return (
                                <span
                                  key={key}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs',
                                    used
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                      : 'bg-muted text-muted-foreground line-through'
                                  )}
                                >
                                  <Icon className="h-3 w-3" />
                                  {label}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* 이미지 갤러리 토글 */}
                      {scrapedStats?.imageUrls && scrapedStats.imageUrls.length > 0 && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowImageGallery(!showImageGallery)}
                          >
                            <Image className="h-3.5 w-3.5" />
                            이미지 {scrapedStats.imageUrls.length}개
                            <span className="text-primary">{showImageGallery ? '접기' : '펼치기'}</span>
                          </button>
                          {showImageGallery && (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                              {scrapedStats.imageUrls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`이미지 ${i + 1}`}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="absolute bottom-0 right-0 bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                                    {i + 1}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 본문 미리보기 토글 */}
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowContentPreview(!showContentPreview)}
                      >
                        <Type className="h-3.5 w-3.5" />
                        본문 미리보기
                        <span className="text-primary">{showContentPreview ? '접기' : '펼치기'}</span>
                      </button>
                      {showContentPreview && (
                        <div className="max-h-[200px] overflow-y-auto rounded border bg-background p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                          {content.slice(0, 2000)}{content.length > 2000 && '...'}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* === 직접 입력 모드 === */}
              {inputMode === 'manual' && (
                <>
                  <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>서식 에디터로 볼드, 소제목, 색상 등을 적용하면 SEO 분석에 반영됩니다. 단, 태그/댓글/공감 등 블로그 메타 정보는 URL 분석에서만 확인 가능합니다.</span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="keyword">타겟 키워드</Label>
                      <Input
                        id="keyword"
                        placeholder="예: 다이어트 식단"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">글 제목</Label>
                      <Input
                        id="title"
                        placeholder="블로그 글 제목을 입력하세요"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>본문 *</Label>
                      <span className={cn('text-xs font-medium', getCharCountClass(content.length))}>
                        {content.length.toLocaleString()}자
                        {content.length > 0 && content.length < 1500 && ' (최소 1,500자 권장)'}
                        {content.length >= 1500 && content.length <= 3000 && ' (적정)'}
                        {content.length > 3000 && ' (길 수 있음)'}
                      </span>
                    </div>
                    <TiptapEditor
                      markdown={content}
                      onMarkdownChange={setContent}
                      placeholder="서식을 적용하며 블로그 글을 작성하거나 붙여넣기 하세요..."
                      className="min-h-[300px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      서식(볼드, 소제목, 색상 등)을 적용하면 SEO 분석에 반영됩니다. 작성 후 네이버 블로그에 서식 유지 복사 가능합니다.
                    </p>
                  </div>
                </>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {planGate && <PlanGateAlert message={planGate} />}

              <CreditTooltip feature="seo_check">
                <Button type="submit" disabled={loading || !content.trim()} className="w-full gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {progressStep ? progressStep.label : 'AI 심층 분석 중...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      AI 심층 분석
                    </>
                  )}
                </Button>
              </CreditTooltip>

              {showLivePanel && (
                <p className="text-center text-xs text-muted-foreground">
                  실시간 기본 분석은 우측에서 확인하세요. AI 심층 분석은 더 정밀한 결과를 제공합니다.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* 우측: 실시간 SEO 분석 패널 */}
        {showLivePanel && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">실시간 분석</span>
              <Badge variant="secondary" className="text-xs">LIVE</Badge>
            </div>
            <LiveSeoPanel
              keyword={keyword}
              title={title}
              content={content}
            />
          </div>
        )}
      </div>

      {/* SEO 스캐닝 이펙트 — 분석 중 본문 스캔 + 콘텐츠 하이라이팅 */}
      {loading && content.trim() && (
        <SeoScanPreview
          content={content}
          title={title}
          keyword={keyword}
          scanPercent={progressStep?.percent ?? 5}
          progressLabel={progressStep?.label}
        />
      )}

      {/* AI 심층 분석 결과 */}
      {result && gradeInfo && GradeIcon && (
        <>
          {/* 총점 카드 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn('flex h-20 w-20 items-center justify-center rounded-full cursor-help', getScoreCircleBg(gradeInfo.color))}>
                        <span className="text-2xl font-bold text-white">{result.totalScore}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent><p>100점 만점 기준 네이버 SEO 최적화 점수입니다</p></TooltipContent>
                  </Tooltip>
                  <div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-help">
                          <Badge className={cn('gap-1 text-sm font-bold border', gradeInfo.badgeColor)}>
                            <GradeIcon className="h-4 w-4" />
                            {gradeInfo.label}
                          </Badge>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent><p>{gradeInfo.description}</p></TooltipContent>
                    </Tooltip>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">AI 심층 분석 결과</p>
                      {result.isDemo && (
                        <Badge variant="outline" className="text-xs">데모</Badge>
                      )}
                    </div>
                    {gradeInfo.nextTierScore && (
                      <p className={cn('mt-0.5 text-xs', getGradeTextColor(gradeInfo.color))}>
                        다음 등급까지 {gradeInfo.nextTierScore - result.totalScore}점
                      </p>
                    )}
                    {result.isDemo && result.demoReason && (
                      <p className="text-xs text-amber-600">{result.demoReason}</p>
                    )}
                    {ai && ai.scoreAdjustment !== 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ai.scoreAdjustment > 0 ? '+' : ''}{ai.scoreAdjustment}점 보정 ({ai.adjustmentReason})
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI 약점 개선 버튼 */}
          {content.trim() && keyword.trim() && (
            <Card className="border-purple-200 bg-purple-50/30 dark:border-purple-800 dark:bg-purple-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">AI 약점 자동 개선</p>
                    <p className="text-xs text-muted-foreground">
                      SEO 점수가 낮은 항목을 AI가 자동으로 수정합니다
                    </p>
                  </div>
                  <CreditTooltip feature="content_improve">
                    <Button
                      variant="outline"
                      onClick={handleImprove}
                      disabled={improving || loading}
                      className="gap-1.5"
                    >
                      {improving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />개선 중...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" />AI 약점 개선</>
                      )}
                    </Button>
                  </CreditTooltip>
                </div>
                {improveMessage && (
                  <p className="mt-2 text-sm text-primary">{improveMessage}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 수동 개선 가이드 카드 */}
          {guidanceItems.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                수동 개선이 필요한 항목
              </h4>
              <div className="space-y-3">
                {guidanceItems.map(item => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{item.name}</Badge>
                      <span className="text-xs text-muted-foreground">{item.score}/{item.maxScore}점</span>
                    </div>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{item.guidance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 4축 심층 분석 */}
          {aiLoading && !ai && (
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  <p className="text-sm font-medium text-muted-foreground">{aiProgressLabel || 'AI 심층 분석 중...'}</p>
                  <p className="text-xs text-muted-foreground">기본 SEO 분석은 이미 완료되었습니다. AI 심층 분석이 추가로 진행 중입니다.</p>
                </div>
              </CardContent>
            </Card>
          )}
          {ai && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-purple-500" />
                  AI 심층 분석
                  {result.isDemo && <Badge variant="outline" className="text-xs">데모</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 4축 점수 카드 */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* 경험 정보 */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">경험 정보</span>
                      </div>
                      <span className={cn('text-lg font-bold', getAxisColor(ai.experienceScore))}>
                        {ai.experienceScore}/10
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={cn('h-2 rounded-full transition-all', getAxisBg(ai.experienceScore))}
                        style={{ width: `${ai.experienceScore * 10}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground"><InlineMarkdown>{ai.experienceDetails}</InlineMarkdown></div>
                  </div>

                  {/* 콘텐츠 품질 */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">콘텐츠 품질</span>
                      </div>
                      <span className={cn('text-lg font-bold', getAxisColor(ai.contentQualityScore))}>
                        {ai.contentQualityScore}/10
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={cn('h-2 rounded-full transition-all', getAxisBg(ai.contentQualityScore))}
                        style={{ width: `${ai.contentQualityScore * 10}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground"><InlineMarkdown>{ai.contentQualityDetails}</InlineMarkdown></div>
                  </div>

                  {/* 키워드 전략 */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">키워드 전략</span>
                      </div>
                      <span className={cn('text-lg font-bold', getAxisColor(ai.keywordStrategyScore))}>
                        {ai.keywordStrategyScore}/10
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={cn('h-2 rounded-full transition-all', getAxisBg(ai.keywordStrategyScore))}
                        style={{ width: `${ai.keywordStrategyScore * 10}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground"><InlineMarkdown>{ai.keywordStrategyDetails}</InlineMarkdown></div>
                  </div>

                  {/* 독자 참여 */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium">독자 참여</span>
                      </div>
                      <span className={cn('text-lg font-bold', getAxisColor(ai.engagementScore))}>
                        {ai.engagementScore}/10
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={cn('h-2 rounded-full transition-all', getAxisBg(ai.engagementScore))}
                        style={{ width: `${ai.engagementScore * 10}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground"><InlineMarkdown>{ai.engagementDetails}</InlineMarkdown></div>
                  </div>
                </div>

                {/* 종합 피드백 */}
                {ai.overallFeedback && (
                  <div className="rounded-lg border bg-muted/30 p-4 prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{ai.overallFeedback}</ReactMarkdown>
                  </div>
                )}

                {/* AI 강점/약점 */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {ai.strengths.length > 0 && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <p className="mb-2 text-sm font-medium text-green-700 flex items-center gap-1.5">
                        <ArrowUp className="h-4 w-4" />
                        AI 분석 강점
                      </p>
                      <ul className="space-y-1.5">
                        {ai.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <InlineMarkdown>{s}</InlineMarkdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ai.weaknesses.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="mb-2 text-sm font-medium text-red-700 flex items-center gap-1.5">
                        <ArrowDown className="h-4 w-4" />
                        AI 분석 약점
                      </p>
                      <ul className="space-y-1.5">
                        {ai.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <InlineMarkdown>{w}</InlineMarkdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* AI 맞춤 추천 */}
                {ai.recommendations.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="mb-3 text-sm font-medium text-blue-700 flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4" />
                      AI 맞춤 추천
                    </p>
                    <ul className="space-y-2">
                      {ai.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold">
                            {i + 1}
                          </span>
                          <InlineMarkdown>{rec}</InlineMarkdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 카테고리별 점수 (13개 항목) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">항목별 분석 ({result.categories.length}개 항목)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.categories.map((cat) => (
                <div key={cat.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className={`text-sm font-bold ${getCategoryScoreColor(cat.score, cat.maxScore)}`}>
                      {cat.score}/{cat.maxScore}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full transition-all ${getScoreBarBg(cat.score * (100 / cat.maxScore))}`}
                      style={{ width: `${(cat.score / cat.maxScore) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground"><InlineMarkdown>{cat.feedback}</InlineMarkdown></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 강점 & 개선사항 (엔진 기반) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-green-600">
                  <ArrowUp className="h-4 w-4" />
                  강점
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <InlineMarkdown>{s}</InlineMarkdown>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-yellow-600">
                  <ArrowDown className="h-4 w-4" />
                  개선 사항
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.improvements.map((imp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                      <InlineMarkdown>{imp}</InlineMarkdown>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* 워크플로우 액션 */}
          {keyword && (
            <div className="flex flex-wrap gap-3">
              <Link href={`/content?keyword=${encodeURIComponent(keyword)}`}>
                <Button variant="outline" className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  이 키워드로 콘텐츠 다시 생성
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
