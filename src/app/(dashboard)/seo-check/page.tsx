'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3, Loader2, CheckCircle, AlertTriangle, XCircle, ArrowUp, ArrowDown, ExternalLink, Wand2, Sparkles, Brain, Star, Target, MessageSquare, Lightbulb, Image, Type, Bold, Heading, Palette, Highlighter, Underline, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { CreditTooltip } from '@/components/credit-tooltip'
import { creditToast } from '@/lib/credit-toast'
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
import { analyzeSeo, getGradeByScore, type SeoGradeInfo } from '@/lib/seo/engine'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { InlineMarkdown } from '@/components/ui/inline-markdown'
import { ensureUrl, extractKoreanKeywords, STOPWORDS } from '@/lib/utils/text'
import dynamic from 'next/dynamic'

// TipTap 에디터는 클라이언트 전용 (SSR 방지)
const TiptapEditor = dynamic(
  () => import('@/components/content/TiptapEditor').then(mod => ({ default: mod.TiptapEditor })),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg border bg-muted" /> }
)

/**
 * 제목+본문에서 핵심 타겟 키워드 자동 추출
 * 1. 제목에서 연속 2~3단어 복합 키워드가 본문에 등장하는지 탐색
 * 2. 없으면 제목 단어 중 본문 빈도가 가장 높은 단어 선택
 */
function extractBestKeyword(title: string, content: string): string {
  const contentSlice = content.slice(0, 3000)

  // 제목 토큰화 (한국어 2글자+, 영문 3글자+, 불용어 제외)
  const titleClean = title.replace(/[^\s가-힣a-zA-Z0-9]/g, ' ').trim()
  const titleTokens = titleClean.split(/\s+/).filter(t =>
    ((/[가-힣]/.test(t) && t.length >= 2) || (/[a-zA-Z]/.test(t) && t.length >= 3)) && !STOPWORDS.has(t)
  )

  if (titleTokens.length === 0) {
    // 제목에서 추출 실패 → 본문 빈도 1위
    const bodyWords = extractKoreanKeywords(contentSlice)
    const freq: Record<string, number> = {}
    for (const w of bodyWords) freq[w] = (freq[w] || 0) + 1
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] || ''
  }

  // 1) 제목에서 연속 2~3단어 복합 키워드 (본문에 존재하는 것만)
  for (let len = Math.min(3, titleTokens.length); len >= 2; len--) {
    for (let i = 0; i <= titleTokens.length - len; i++) {
      const phrase = titleTokens.slice(i, i + len).join(' ')
      if (phrase.length >= 3 && contentSlice.includes(phrase)) {
        return phrase
      }
    }
  }

  // 2) 제목 단어 중 본문 빈도가 가장 높은 것
  const bodyWords = extractKoreanKeywords(contentSlice)
  const freq: Record<string, number> = {}
  for (const w of bodyWords) freq[w] = (freq[w] || 0) + 1

  let bestWord = titleTokens[0]
  let bestScore = 0
  for (const tw of titleTokens) {
    const score = freq[tw.toLowerCase()] || 0
    if (score > bestScore) {
      bestScore = score
      bestWord = tw
    }
  }

  return bestWord
}

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

/** 본문에서 불용어를 하이라이트 마크업으로 변환 */
function highlightStopwords(text: string): React.ReactNode[] {
  // 한글 단어(2글자+)를 기준으로 분리 → 불용어만 하이라이트
  const parts: React.ReactNode[] = []
  const regex = /[가-힣]{2,}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // 매치 이전 텍스트
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const word = match[0]
    if (STOPWORDS.has(word)) {
      parts.push(
        <mark key={match.index} className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded px-0.5" title="불용어">
          {word}
        </mark>
      )
    } else {
      parts.push(word)
    }
    lastIndex = match.index + word.length
  }
  // 나머지 텍스트
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

function getAxisBg(score: number) {
  if (score >= 8) return 'bg-green-500'
  if (score >= 6) return 'bg-blue-500'
  if (score >= 4) return 'bg-yellow-500'
  return 'bg-red-500'
}


export default function SeoCheckPage() {
  const searchParams = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [autoExtracted, setAutoExtracted] = useState(false) // 키워드 자동 추출 여부
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
  const [manualTags, setManualTags] = useState('') // 직접 입력 모드 태그 (쉼표/공백 구분)
  // URL fetch 후 콘텐츠 미리보기 접기/펼치기
  const [showContentPreview, setShowContentPreview] = useState(false)
  // 불용어 하이라이트 표시 토글
  const [highlightStops, setHighlightStops] = useState(true)
  // 결과 나온 후 입력 폼 접기/펼치기
  const [formCollapsed, setFormCollapsed] = useState(false)
  // 결과 영역 내 본문 미리보기 (분석 후 원문 확인용)
  const [showResultPreview, setShowResultPreview] = useState(false)

  // AI 심층 분석 로딩 상태
  const [aiLoading, setAiLoading] = useState(false)
  const [aiProgressLabel, setAiProgressLabel] = useState('')
  const [aiScanPercent, setAiScanPercent] = useState(0)

  // AI 약점 개선
  const [improving, setImproving] = useState(false)
  const [improveMessage, setImproveMessage] = useState('')
  const [guidanceItems, setGuidanceItems] = useState<Array<{ id: string; name: string; score: number; maxScore: number; guidance: string }>>([])

  // 실시간 분석 패널 표시 여부 (결과 나오면 숨김 — 빈공간 방지)
  const showLivePanel = content.trim().length >= 50 && keyword.trim().length > 0 && !result

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

  // 콘텐츠/제목 변경 시 키워드 자동 추출 (사용자가 수기 입력한 경우 제외)
  useEffect(() => {
    // 이미 수동 입력된 키워드가 있으면 건드리지 않음
    if (keyword.trim() && !autoExtracted) return
    // 콘텐츠가 충분히 있을 때만 추출
    if (content.trim().length < 50) return

    const extracted = extractBestKeyword(title, content)
    if (extracted && extracted !== keyword) {
      setKeyword(extracted)
      setAutoExtracted(true)
    }
  }, [content, title]) // keyword, autoExtracted 의존성 제외 (무한루프 방지)

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
        // 이미지·본문 미리보기는 기본 접힘 유지
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

    // 키워드 미입력 시 자동 추출
    let effectiveKeyword = keyword.trim()
    if (!effectiveKeyword) {
      const extracted = extractBestKeyword(title, content)
      if (extracted) {
        effectiveKeyword = extracted
        setKeyword(extracted)
        setAutoExtracted(true)
      }
    }

    setLoading(true)
    setError('')
    setPlanGate(null)
    setGuidanceItems([])
    setImproveMessage('')

    try {
      // 로컬 SEO 엔진으로 즉시 분석 (API 호출 없음, 크레딧 소모 없음)
      const seoScrapedMeta = scrapedStats ? {
        tags: scrapedStats.tags,
        formatting: scrapedStats.formatting,
      } : inputMode === 'manual' && manualTags.trim() ? {
        tags: manualTags.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean),
      } : undefined

      // 태그는 태그&CTA 항목에서 평가 → 관련 키워드에는 전달하지 않음
      // 관련 키워드는 사용자가 직접 입력한 경우에만 사용
      const engineResult = analyzeSeo(
        effectiveKeyword,
        title.trim(),
        content.trim(),
        undefined,
        seoScrapedMeta,
      )

      setResult({
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
      })
      setFormCollapsed(true)
    } catch {
      setError('분석 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /** AI 심층 분석 — 사용자가 명시적으로 활성화 */
  const handleDeepAnalysis = async () => {
    if (aiLoading || !result || !content.trim()) return

    setAiLoading(true)
    setAiScanPercent(0)
    setAiProgressLabel('콘텐츠 구조 분석 중...')
    setError('')
    setPlanGate(null)

    // 프로그레스 애니메이션: 0→85까지 점진적 증가
    const progressSteps = [
      { percent: 15, label: '키워드 배치 분석 중...', delay: 2000 },
      { percent: 30, label: '경험 정보 탐색 중...', delay: 4000 },
      { percent: 45, label: '콘텐츠 품질 평가 중...', delay: 8000 },
      { percent: 60, label: '키워드 전략 분석 중...', delay: 15000 },
      { percent: 75, label: '독자 참여 요소 분석 중...', delay: 25000 },
      { percent: 85, label: 'AI 종합 평가 생성 중...', delay: 35000 },
    ]
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const step of progressSteps) {
      timers.push(setTimeout(() => {
        setAiScanPercent(step.percent)
        setAiProgressLabel(step.label)
      }, step.delay))
    }

    // 직접 입력 모드: manualTags 파싱
    const parsedManualTags = inputMode === 'manual' && manualTags.trim()
      ? manualTags.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
      : []

    const requestBody = {
      keyword: keyword.trim(),
      title: title.trim(),
      content: content.trim(),
      baseScore: result.totalScore,
      ...(scrapedStats ? {
        scrapedMeta: {
          charCount: scrapedStats.charCount,
          imageCount: scrapedStats.imageCount,
          videoCount: scrapedStats.videoCount,
          commentCount: scrapedStats.commentCount,
          sympathyCount: scrapedStats.sympathyCount,
          tags: scrapedStats.tags,
          formatting: scrapedStats.formatting,
        },
      } : parsedManualTags.length > 0 ? {
        scrapedMeta: {
          charCount: content.trim().length,
          imageCount: (content.match(/\[이미지[\]:\s]/g) || []).length,
          videoCount: 0,
          commentCount: 3,
          sympathyCount: 5,
          tags: parsedManualTags,
        },
      } : {}),
    }

    try {
      const aiRes = await fetch('/api/ai/seo-check/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      // 응답 받으면 95%로
      timers.forEach(t => clearTimeout(t))
      setAiScanPercent(95)
      setAiProgressLabel('결과 처리 중...')

      let aiData
      try {
        aiData = await aiRes.json()
      } catch {
        setError('AI 응답을 처리할 수 없습니다.')
        return
      }

      if (!aiRes.ok) {
        if (aiData.planGate) {
          setPlanGate(aiData.error)
        } else if (aiData.creditLimit) {
          setError(`크레딧이 부족합니다. (잔액: ${aiData.balance}, 필요: ${aiData.cost})`)
        } else {
          setError(aiData.error || 'AI 심층 분석에 실패했습니다.')
        }
        return
      }

      setAiScanPercent(100)
      setAiProgressLabel('분석 완료!')

      if (aiData.aiAnalysis) {
        setResult(prev => prev ? {
          ...prev,
          aiAnalysis: aiData.aiAnalysis,
          isDemo: aiData.isDemo ?? prev.isDemo,
          demoReason: aiData.demoReason ?? prev.demoReason,
          ...(aiData.totalScore != null ? { totalScore: aiData.totalScore } : {}),
          ...(aiData.grade != null ? { grade: aiData.grade } : {}),
        } : prev)
        creditToast('seo_check')
      }
    } catch {
      setError('AI 심층 분석 중 오류가 발생했습니다.')
    } finally {
      timers.forEach(t => clearTimeout(t))
      setAiLoading(false)
      setAiProgressLabel('')
      setAiScanPercent(0)
    }
  }

  const handleImprove = async () => {
    if (improving || !content.trim() || !keyword.trim()) return
    setImproving(true)
    setImproveMessage('')
    setGuidanceItems([])

    try {
      // 클라이언트에서 SEO 분석 실행 → 약한 항목 추출
      const availableTags = scrapedStats?.tags ?? (
        inputMode === 'manual' && manualTags.trim()
          ? manualTags.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
          : undefined
      )
      const seoResult = analyzeSeo(keyword.trim(), title, content, availableTags && availableTags.length > 0 ? availableTags : undefined)
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
      creditToast('content_improve')
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

      {/* 입력 폼 */}
      <div className="space-y-6">
        <Card>
          <CardHeader
            className={cn(result ? 'cursor-pointer select-none hover:bg-muted/30 transition-colors' : '')}
            onClick={() => result && setFormCollapsed(!formCollapsed)}
          >
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
              <span className="flex items-center gap-2">
                {inputMode === 'url' ? '블로그 URL 분석' : '직접 입력 분석'}
                {result && formCollapsed && title && (
                  <span className="text-sm font-normal text-muted-foreground truncate max-w-[200px]">— {title}</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {!formCollapsed && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      setInputMode(inputMode === 'url' ? 'manual' : 'url')
                      setError('')
                    }}
                  >
                    {inputMode === 'url' ? '직접 입력으로 전환' : 'URL 분석으로 전환'}
                  </Button>
                )}
                {result && (
                  formCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
          {!formCollapsed && <CardContent>
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

                  {/* 키워드 (URL 모드: 자동 추출 전용, 수기 입력 불가) */}
                  <div className="space-y-2">
                    <Label htmlFor="keyword">
                      타겟 키워드
                      {autoExtracted && keyword.trim() && <span className="text-cyan-600 font-normal ml-1">(자동 추출)</span>}
                    </Label>
                    <Input
                      id="keyword"
                      placeholder="블로그 가져오기 후 자동 추출됩니다"
                      value={keyword}
                      readOnly
                      disabled={loading}
                      className="bg-muted/50"
                    />
                    {keyword.trim() ? (
                      <p className="text-xs text-muted-foreground">제목과 본문에서 자동 추출된 키워드입니다</p>
                    ) : content.trim() ? (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        키워드 자동 추출에 실패했습니다. 직접 입력 모드에서 수기 입력하세요
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">이 글이 상위노출을 노리는 키워드를 입력하세요</p>
                    )}
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
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowContentPreview(!showContentPreview)}
                        >
                          <Type className="h-3.5 w-3.5" />
                          본문 미리보기
                          <span className="text-primary">{showContentPreview ? '접기' : '펼치기'}</span>
                        </button>
                        {showContentPreview && result && (
                          <button
                            type="button"
                            className={cn(
                              'flex items-center gap-1 text-xs font-medium transition-colors rounded px-1.5 py-0.5',
                              highlightStops
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            onClick={() => setHighlightStops(!highlightStops)}
                          >
                            <Highlighter className="h-3 w-3" />
                            불용어 표시
                          </button>
                        )}
                      </div>
                      {showContentPreview && (
                        <div className="max-h-[200px] overflow-y-auto rounded border bg-background p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                          {highlightStops && result
                            ? highlightStopwords(content.slice(0, 2000))
                            : content.slice(0, 2000)
                          }
                          {content.length > 2000 && '...'}
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
                      <div>
                        <p>서식 에디터로 볼드, 소제목, 색상 등을 적용하면 SEO 분석에 반영됩니다. 태그도 아래에 직접 입력할 수 있습니다.</p>
                        <p className="mt-0.5 text-blue-600/80 dark:text-blue-500/80">댓글·공감·조회수는 직접 입력 시 측정할 수 없어 기본 점수가 부여됩니다.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="keyword">
                        타겟 키워드
                        {autoExtracted && keyword.trim() && <span className="text-cyan-600 font-normal ml-1">(자동 추출)</span>}
                      </Label>
                      <Input
                        id="keyword"
                        placeholder="예: 다이어트 식단 (미입력 시 자동 추출)"
                        value={keyword}
                        onChange={(e) => { setKeyword(e.target.value); setAutoExtracted(false) }}
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

                  {/* 태그 입력 */}
                  <div className="space-y-2">
                    <Label htmlFor="manualTags">태그</Label>
                    <Input
                      id="manualTags"
                      placeholder="예: #다이어트 #식단 #건강 (쉼표 또는 공백으로 구분)"
                      value={manualTags}
                      onChange={(e) => setManualTags(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      실제 블로그에 달 태그를 입력하면 태그 & CTA 항목에 반영됩니다
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

              <Button type="submit" disabled={loading || !content.trim()} className="w-full gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    분석 중...
                  </>
                ) : result ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    다시 분석하기
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    SEO 분석
                  </>
                )}
              </Button>

              {showLivePanel && !result && (
                <p className="text-center text-xs text-muted-foreground">
                  아래에서 실시간 점수를 확인하세요. 분석을 실행하면 상세 결과를 볼 수 있습니다.
                </p>
              )}
            </form>
          </CardContent>}
          {/* 접힌 상태에서 다시 분석 버튼 */}
          {formCollapsed && (
            <CardContent className="pt-0 pb-4">
              <Button
                type="button"
                disabled={loading || !content.trim()}
                className="w-full gap-2"
                onClick={(e) => {
                  setFormCollapsed(false)
                  handleAnalyze(e as unknown as React.FormEvent)
                }}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />분석 중...</>
                ) : (
                  <><RotateCcw className="h-4 w-4" />다시 분석하기</>
                )}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* 실시간 SEO 분석 패널 (폼 아래에 표시) */}
        {showLivePanel && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-4 w-4 text-primary" />
                실시간 분석
                <Badge variant="secondary" className="text-xs">LIVE</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LiveSeoPanel
                keyword={keyword}
                title={title}
                content={content}
                scrapedMeta={scrapedStats ? {
                  tags: scrapedStats.tags,
                  formatting: scrapedStats.formatting,
                } : undefined}
                hideStrengths={!!result}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* SEO 스캐닝 이펙트 — AI 심층 분석 진행 중 */}
      {aiLoading && content.trim() && (
        <SeoScanPreview
          content={content}
          title={title}
          keyword={keyword}
          scanPercent={aiScanPercent}
          progressLabel={aiProgressLabel || 'AI 심층 분석 중...'}
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
                      <p className="text-sm text-muted-foreground">
                        {ai ? 'AI 심층 분석 반영' : 'SEO 분석 결과'}
                      </p>
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

          {/* 결과 영역 본문 미리보기 — 분석 후 원문 확인용 */}
          {formCollapsed && content.trim() && (
            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowResultPreview(!showResultPreview)}
              >
                <Type className="h-3.5 w-3.5" />
                본문 원문 보기
                <span className="text-primary">{showResultPreview ? '접기' : '펼치기'}</span>
                {showResultPreview && (
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium transition-colors rounded px-1.5 py-0.5 ml-2',
                      highlightStops
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={(e) => { e.stopPropagation(); setHighlightStops(!highlightStops) }}
                  >
                    <Highlighter className="h-3 w-3" />
                    불용어
                  </button>
                )}
              </button>
              {showResultPreview && (
                <div className="max-h-[300px] overflow-y-auto rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground whitespace-pre-wrap">
                  {title && <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>}
                  {highlightStops
                    ? highlightStopwords(content.slice(0, 3000))
                    : content.slice(0, 3000)
                  }
                  {content.length > 3000 && '...'}
                </div>
              )}
            </div>
          )}

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
                      disabled={improving || loading || aiLoading}
                      className="gap-1.5"
                    >
                      {improving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />개선 중...</>
                      ) : aiLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />심층 분석 중...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" />AI 약점 개선 (3크레딧)</>
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

          {/* AI 심층 분석 — 사용자 활성화 카드 */}
          {!ai && !aiLoading && (
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50/60 to-indigo-50/60 dark:from-purple-950/20 dark:to-indigo-950/20">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <Brain className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-base font-semibold">AI 심층 분석으로 더 정밀하게</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      AI가 경험 정보, 콘텐츠 품질, 키워드 전략, 독자 참여를
                      심층 분석하여 맞춤 개선안을 제공합니다.
                    </p>
                  </div>
                  <CreditTooltip feature="seo_check">
                    <Button onClick={handleDeepAnalysis} className="gap-2 shrink-0">
                      <Sparkles className="h-4 w-4" />
                      AI 심층 분석 시작 (2크레딧)
                    </Button>
                  </CreditTooltip>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI 심층 분석 진행 중 */}
          {aiLoading && !ai && (
            <Card className="border-purple-200">
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  <p className="text-sm font-medium">{aiProgressLabel || 'AI 심층 분석 중...'}</p>
                  <p className="text-xs text-muted-foreground">경험 정보, 콘텐츠 품질, 키워드 전략, 독자 참여를 분석하고 있습니다</p>
                </div>
              </CardContent>
            </Card>
          )}
          {ai && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-purple-500" />
                  AI 심층 분석 결과
                  {result.isDemo && <Badge variant="outline" className="text-xs">데모</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* 4축 점수 — 콤팩트 인라인 */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: Star, color: 'text-amber-500', label: '경험 정보', score: ai.experienceScore, detail: ai.experienceDetails },
                    { icon: CheckCircle, color: 'text-green-500', label: '콘텐츠 품질', score: ai.contentQualityScore, detail: ai.contentQualityDetails },
                    { icon: Target, color: 'text-blue-500', label: '키워드 전략', score: ai.keywordStrategyScore, detail: ai.keywordStrategyDetails },
                    { icon: MessageSquare, color: 'text-pink-500', label: '독자 참여', score: ai.engagementScore, detail: ai.engagementDetails },
                  ].map(({ icon: Icon, color, label, score, detail }) => (
                    <div key={label} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-3.5 w-3.5', color)} />
                        <span className="text-xs font-medium flex-1">{label}</span>
                        <span className={cn('text-sm font-bold tabular-nums', getAxisColor(score))}>{score}/10</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className={cn('h-1.5 rounded-full transition-all', getAxisBg(score))} style={{ width: `${score * 10}%` }} />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight"><InlineMarkdown>{detail}</InlineMarkdown></p>
                    </div>
                  ))}
                </div>

                {/* 종합 피드백 */}
                {ai.overallFeedback && (
                  <div className="rounded-lg bg-muted/30 p-3 prose prose-sm max-w-none dark:prose-invert text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{ai.overallFeedback}</ReactMarkdown>
                  </div>
                )}

                {/* 강점/약점 — 나란히 콤팩트 */}
                {(ai.strengths.length > 0 || ai.weaknesses.length > 0) && (
                  <>
                    <div className="border-t" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      {ai.strengths.length > 0 && (
                        <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 p-3">
                          <p className="mb-1.5 text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
                            <ArrowUp className="h-3.5 w-3.5" />
                            강점
                          </p>
                          <ul className="space-y-1">
                            {ai.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
                                <CheckCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                <InlineMarkdown>{s}</InlineMarkdown>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ai.weaknesses.length > 0 && (
                        <div className="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800 p-3">
                          <p className="mb-1.5 text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                            <ArrowDown className="h-3.5 w-3.5" />
                            약점
                          </p>
                          <ul className="space-y-1">
                            {ai.weaknesses.map((w, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                                <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                <InlineMarkdown>{w}</InlineMarkdown>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* AI 맞춤 추천 */}
                {ai.recommendations.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 p-3">
                    <p className="mb-2 text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                      <Lightbulb className="h-3.5 w-3.5" />
                      맞춤 추천
                    </p>
                    <ul className="space-y-1.5">
                      {ai.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-400">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <InlineMarkdown>{rec}</InlineMarkdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 항목별 점수 — 구분선 후 통합 */}
                <div className="border-t" />
                <div>
                  <p className="mb-2 text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5" />
                    항목별 점수 ({result.categories.length}개)
                  </p>
                  <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    {result.categories.map((cat) => {
                      const pct = (cat.score / cat.maxScore) * 100
                      return (
                        <div key={cat.name} className="py-1 border-b border-muted/40 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium flex-1 truncate">{cat.name}</span>
                            <div className="h-1 w-16 shrink-0 rounded-full bg-muted">
                              <div
                                className={cn('h-1 rounded-full transition-all', getScoreBarBg(pct))}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={cn('text-[11px] font-bold w-9 text-right tabular-nums', getCategoryScoreColor(cat.score, cat.maxScore))}>
                              {cat.score}/{cat.maxScore}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight"><InlineMarkdown>{cat.feedback}</InlineMarkdown></p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 카테고리별 점수 (13개 항목) — AI 분석 없을 때만 별도 카드 */}
          {!ai && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">항목별 분석 ({result.categories.length}개 항목)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {result.categories.map((cat) => {
                    const pct = (cat.score / cat.maxScore) * 100
                    return (
                      <div key={cat.name} className="group py-1.5 border-b border-muted/50 last:border-b-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium flex-1 truncate">{cat.name}</span>
                          <div className="h-1.5 w-20 shrink-0 rounded-full bg-muted">
                            <div
                              className={cn('h-1.5 rounded-full transition-all', getScoreBarBg(pct))}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={cn('text-xs font-bold w-10 text-right tabular-nums', getCategoryScoreColor(cat.score, cat.maxScore))}>
                            {cat.score}/{cat.maxScore}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight"><InlineMarkdown>{cat.feedback}</InlineMarkdown></p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 강점 & 개선사항 — AI 분석이 있으면 숨김 (AI 강점/약점/추천으로 대체) */}
          {!ai && (
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
          )}

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
