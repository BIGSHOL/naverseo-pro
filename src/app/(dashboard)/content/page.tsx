'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CREDIT_COSTS } from '@/types/database'
import { useCallback } from 'react'
import {
  Wand2, Loader2, Copy, Check, Tag, CalendarDays, CheckCircle, BarChart3,
  FileText, Eye, ChevronDown, ChevronUp, TrendingUp, AlertCircle, RefreshCw,
  Pencil, Save, Link2, MessageSquareQuote, Sparkles, ImagePlus,
  Search, Trash2, ChevronsDown, Pause, PanelLeftClose, PanelLeftOpen, AlertTriangle,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { InlineMarkdown } from '@/components/ui/inline-markdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { TiptapEditor, getEditorHtml } from '@/components/content/TiptapEditor'
import { htmlForNaverClipboard } from '@/lib/utils/markdown-convert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { LiveSeoPanel } from '@/components/seo/LiveSeoPanel'
import { TagEditor } from '@/components/content/TagEditor'
import type { Editor } from '@tiptap/core'
import { animatePatchesSequential } from '@/lib/editor/patch-animator'
import { analyzeSeo, type ContentType, type DomainCategory, DOMAIN_CATEGORY_NAMES } from '@/lib/content/engine'
import { analyzeDia } from '@/lib/dia/engine'
import { Shield, Store } from 'lucide-react'
import { CreditTooltip } from '@/components/credit-tooltip'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { PlanGateAlert } from '@/components/plan-gate-alert'

interface SeoCategory {
  id: string
  name: string
  score: number
  maxScore: number
  details: string
}

interface SeoAnalysisResult {
  totalScore: number
  grade: string
  categories: SeoCategory[]
  strengths: string[]
  improvements: string[]
}

interface ReadabilityResult {
  score: number
  grade: string
  avgSentenceLength: number
  totalCharacters: number
  totalParagraphs: number
  boldCount: number
  listCount: number
  headingCount: number
  imageCount: number
  details: string[]
}

interface EnrichmentData {
  relatedKeywordsCount?: number
  autoKeywords?: string[]
  trendDirection?: string
  trendRatio?: number
  serpRefCount?: number
  learningPatternCount?: number
  learningMatchType?: string
}

interface ContentProgress {
  step: number
  totalSteps: number
  message: string
  current?: number
  total?: number
}

interface ContentResult {
  title: string
  content: string
  tags: string[]
  metaDescription?: string
  contentType?: string
  contentTypeName?: string
  seoAnalysis?: SeoAnalysisResult
  readabilityAnalysis?: ReadabilityResult
  isDemo: boolean
  contentId?: string
  seoScore?: number
  enrichment?: EnrichmentData
  autoOptimized?: boolean
  optimizations?: string[]
  scoreBefore?: number
  scoreAfter?: number
  notice?: string
  unknownKeyword?: boolean
  validation?: { score: number; warnings: string[]; errors: string[]; isValid: boolean }
}

/** 스트리밍 중 부분 JSON에서 title/content 필드를 추출 */
function extractFromStreamJson(json: string): { title?: string; content?: string } {
  const result: { title?: string; content?: string } = {}

  // title 추출: "title" : "값"
  const titleMatch = json.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (titleMatch) {
    result.title = unescapeJsonString(titleMatch[1])
  }

  // content 추출: "content" : "값..." (아직 닫히지 않았을 수 있음)
  const contentIdx = json.search(/"content"\s*:\s*"/)
  if (contentIdx !== -1) {
    const afterKey = json.substring(contentIdx).replace(/^"content"\s*:\s*"/, '')
    // 완성된 content 값인지 확인 (닫는 따옴표 + , 또는 })
    const closingMatch = afterKey.match(/^([\s\S]*?)(?<!\\)"\s*[,}]/)
    if (closingMatch) {
      result.content = unescapeJsonString(closingMatch[1])
    } else {
      // 아직 스트리밍 중 — 현재까지의 텍스트
      result.content = unescapeJsonString(afterKey)
    }
  }

  return result
}

function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function getContentScoreColor(score: number) {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

function getContentScoreBgColor(score: number) {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function getGradeBadgeColor(grade: string) {
  if (grade.startsWith('S') || grade.startsWith('A')) return 'bg-green-100 text-green-700'
  if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700'
  if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

/** 실제 사진이 필요한 이미지인지 판별 (AI 생성 불가) */
const REAL_PHOTO_PATTERNS = [
  /외관/, /내부\s*(사진|모습|전경)/, /전경/, /전면\s*(사진|모습)/,
  /건물\s*(사진|모습)/, /매장\s*(사진|모습|전경|내부|외부)/,
  /가게\s*(사진|모습|전경|내부|외부)/, /입구\s*(사진|모습)/, /간판/,
  /스크린샷/, /캡[처쳐]/, /화면\s*(캡|사진|촬영)/,
  /지도/, /약도/, /네이버\s*지도/, /구글\s*맵/, /위치\s*(안내|사진)/, /찾아오시는\s*길/,
  /인물\s*사진/, /얼굴/, /셀[카피]/, /프로필\s*사진/, /증명\s*사진/, /단체\s*사진/,
  /영수증/, /메뉴판/, /명함/, /자격증/, /수료증/, /성적표/,
  /실제\s*(사진|촬영|모습)/, /현장\s*(사진|촬영|모습)/,
  /시공\s*(사진|전후|과정)/, /비포\s*(앤|&)\s*애프터/, /before\s*(and|&)\s*after/i,
]

function isRealPhotoRequired(description: string): boolean {
  return REAL_PHOTO_PATTERNS.some(p => p.test(description))
}

interface ParsedImageMarker {
  index: number
  description: string
  isReal: boolean
}

/** 마크다운에서 [이미지: ...] 마커 추출 + 실사 판별 */
function extractImageMarkers(content: string): ParsedImageMarker[] {
  const regex = /\[이미지[:\s]+([^\]]+)\]/g
  const markers: ParsedImageMarker[] = []
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = regex.exec(content)) !== null) {
    const desc = match[1].trim()
    markers.push({ index: idx++, description: desc, isReal: isRealPhotoRequired(desc) })
  }
  return markers
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function ContentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [keyword, setKeyword] = useState('')
  const [tone, setTone] = useState('친근하고 정보적인')
  const [additionalKeywords, setAdditionalKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<ContentProgress | null>(null)
  const [error, setError] = useState('')
  const [planGateMessage, setPlanGateMessage] = useState('')
  const [result, setResult] = useState<ContentResult | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const streamingTextRef = useRef('')
  const streamingContentRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const autoScrollRef = useRef(true)
  const resultRef = useRef<HTMLDivElement>(null)
  const contentCardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [showSeoDetail, setShowSeoDetail] = useState(false)
  const [targetLength, setTargetLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [contentType, setContentType] = useState<ContentType | ''>('')
  const [contentDirection, setContentDirection] = useState('')
  const [domainCategory, setDomainCategory] = useState<DomainCategory | ''>('')
  const [customDomain, setCustomDomain] = useState('')
  const [includeFaq, setIncludeFaq] = useState(false)

  // 고급 옵션
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  // 구조/레이아웃
  const [imageCount, setImageCount] = useState<number | 'auto'>('auto')
  const [headingCount, setHeadingCount] = useState<number | 'auto'>('auto')
  const [structureRatio, setStructureRatio] = useState<'balanced' | 'intro-heavy' | 'content-heavy'>('balanced')
  const [forcedSections, setForcedSections] = useState<string[]>([])
  // SEO/키워드
  const [keywordDensity, setKeywordDensity] = useState<'natural' | 'moderate' | 'aggressive'>('moderate')
  const [internalLinkCount, setInternalLinkCount] = useState<number | 'auto'>('auto')
  // 스타일/형식
  const [forceListFormat, setForceListFormat] = useState(false)
  const [includeTable, setIncludeTable] = useState(false)
  const [useEmoji, setUseEmoji] = useState(false)
  const [includeQuotes, setIncludeQuotes] = useState(false)
  // 타겟 독자
  const [targetAudience, setTargetAudience] = useState<'beginner' | 'general' | 'expert'>('general')
  const [ageGroup, setAgeGroup] = useState<'10s' | '20-30s' | '40-50s' | '60+' | 'all'>('all')

  // 템플릿 프리셋 적용 함수
  const applyInfoPreset = () => {
    setShowAdvancedOptions(true)
    // 구조/레이아웃
    setImageCount(4)
    setHeadingCount(4)
    setStructureRatio('balanced')
    setForcedSections(['핵심 요약', '단계별 가이드'])
    // SEO/키워드
    setKeywordDensity('moderate')
    setInternalLinkCount(3)
    // 스타일/형식
    setForceListFormat(true)
    setIncludeTable(true)
    setUseEmoji(false)
    setIncludeQuotes(true)
    // 타겟 독자
    setTargetAudience('general')
    setAgeGroup('all')
    // 피드백
    toast({
      title: '📚 정보성 프리셋 적용됨',
      description: '목록·인용구 중심 구조로 설정되었습니다.',
    })
  }

  const applyReviewPreset = () => {
    setShowAdvancedOptions(true)
    // 구조/레이아웃
    setImageCount(8)
    setHeadingCount(5)
    setStructureRatio('content-heavy')
    setForcedSections(['첫인상', '장점', '단점', '총평'])
    // SEO/키워드
    setKeywordDensity('natural')
    setInternalLinkCount(2)
    // 스타일/형식
    setForceListFormat(false)
    setIncludeTable(true)
    setUseEmoji(true)
    setIncludeQuotes(true)
    // 타겟 독자
    setTargetAudience('general')
    setAgeGroup('all')
    // 피드백
    toast({
      title: '⭐ 리뷰성 프리셋 적용됨',
      description: '사진 다량·경험 중심 구조로 설정되었습니다.',
    })
  }

  const applyListiclePreset = () => {
    setShowAdvancedOptions(true)
    // 구조/레이아웃
    setImageCount(6)
    setHeadingCount(5)
    setStructureRatio('balanced')
    setForcedSections(['선정 기준', '비교 요약'])
    // SEO/키워드
    setKeywordDensity('moderate')
    setInternalLinkCount(3)
    // 스타일/형식
    setForceListFormat(true)
    setIncludeTable(true)
    setUseEmoji(false)
    setIncludeQuotes(false)
    // 타겟 독자
    setTargetAudience('general')
    setAgeGroup('all')
    // 피드백
    toast({
      title: '🏆 추천형 프리셋 적용됨',
      description: '순위·비교표 중심 구조로 설정되었습니다.',
    })
  }

  // 사용자 정의 템플릿
  const [templates, setTemplates] = useState<any[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [maxTemplates, setMaxTemplates] = useState<number | null>(null) // null = 무제한

  // 템플릿 목록 로드
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('템플릿 로드 실패')
      const data = await res.json()
      setTemplates(data.templates || [])
      setMaxTemplates(data.maxTemplates ?? null)
    } catch (err) {
      console.error('[Templates] 로드 오류:', err)
    }
  }

  const saveCurrentAsTemplate = async () => {
    const name = window.prompt('템플릿 이름을 입력하세요 (예: 내 리뷰 템플릿)')
    if (!name || name.trim().length === 0) return

    const description = window.prompt('템플릿 설명을 입력하세요 (선택사항)')

    setSavingTemplate(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description?.trim() || null,
          advancedOptions: {
            imageCount,
            headingCount,
            structureRatio,
            forcedSections,
            keywordDensity,
            internalLinkCount,
            forceListFormat,
            includeTable,
            useEmoji,
            includeQuotes,
            targetAudience,
            ageGroup,
            domainCategory: domainCategory || undefined,
            customDomain: domainCategory === 'other' ? customDomain.trim() || undefined : undefined,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '템플릿 저장 실패')
      }

      toast({
        title: '✅ 템플릿 저장 완료',
        description: `"${name}" 템플릿이 저장되었습니다.`,
      })

      await loadTemplates()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      toast({
        title: '❌ 저장 실패',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  const loadTemplate = (template: any) => {
    const opts = template.advanced_options
    setShowAdvancedOptions(true)
    // 옵션 적용
    setImageCount(opts.imageCount ?? 'auto')
    setHeadingCount(opts.headingCount ?? 'auto')
    setStructureRatio(opts.structureRatio ?? 'balanced')
    setForcedSections(opts.forcedSections ?? [])
    setKeywordDensity(opts.keywordDensity ?? 'moderate')
    setInternalLinkCount(opts.internalLinkCount ?? 'auto')
    setForceListFormat(opts.forceListFormat ?? false)
    setIncludeTable(opts.includeTable ?? false)
    setUseEmoji(opts.useEmoji ?? false)
    setIncludeQuotes(opts.includeQuotes ?? false)
    setTargetAudience(opts.targetAudience ?? 'general')
    setAgeGroup(opts.ageGroup ?? 'all')
    setDomainCategory(opts.domainCategory ?? '')
    setCustomDomain(opts.customDomain ?? '')

    toast({
      title: '📥 템플릿 불러옴',
      description: `"${template.name}" 템플릿이 적용되었습니다.`,
    })
  }

  const deleteTemplate = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" 템플릿을 삭제하시겠습니까?`)) return

    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('템플릿 삭제 실패')

      toast({
        title: '🗑️ 템플릿 삭제됨',
        description: `"${name}" 템플릿이 삭제되었습니다.`,
      })

      await loadTemplates()
    } catch (err) {
      toast({
        title: '❌ 삭제 실패',
        description: err instanceof Error ? err.message : '템플릿 삭제에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 참고 URL 분석
  const [referenceUrl, setReferenceUrl] = useState('')
  const [referenceAnalysis, setReferenceAnalysis] = useState<{
    title: string
    headings: string[]
    charCount: number
    structure: string
  } | null>(null)
  const [analyzingRef, setAnalyzingRef] = useState(false)

  // 편집 모드 상태
  const [showRawMarkdown, setShowRawMarkdown] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [improving, setImproving] = useState(false)
  const [improveMessage, setImproveMessage] = useState('')
  const [animatingPatch, setAnimatingPatch] = useState('')
  const [guidanceItems, setGuidanceItems] = useState<Array<{ id: string; name: string; score: number; maxScore: number; guidance: string }>>([])
  const [improveDetails, setImproveDetails] = useState<string[]>([])
  const [improveDisabledReason, setImproveDisabledReason] = useState('')
  const [improveUsed, setImproveUsed] = useState(false)
  const editorRef = useRef<Editor | null>(null)
  const historyEditorRef = useRef<Editor | null>(null)
  const cancelAnimationRef = useRef<(() => void) | null>(null)

  // Self-Healing 패치 애니메이션용
  const selfHealPatchesRef = useRef<{ rawTitle: string; rawContent: string; patches: Array<{ find: string; replace: string; label: string }> } | null>(null)

  // AI 검토/수정 시각화 상태
  const [healAnimState, setHealAnimState] = useState<{
    phase: 'reviewing' | 'fixing' | 'done'
    current: number
    total: number
    label: string
    fixPhase: 'find' | 'replace'
    scoreBefore: number
    scoreAfter: number
  } | null>(null)

  // AI 이미지 생성
  const [generatingImages, setGeneratingImages] = useState(false)
  const [imageGenMessage, setImageGenMessage] = useState('')
  const [showImageConfirm, setShowImageConfirm] = useState(false)
  const [imageMarkers, setImageMarkers] = useState<ParsedImageMarker[]>([])

  // 내 업체 홍보글 모드
  const [isPromoMode, setIsPromoMode] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPricing, setBusinessPricing] = useState('')
  const [businessStrengths, setBusinessStrengths] = useState('')
  const [businessHours, setBusinessHours] = useState('')
  const [businessContact, setBusinessContact] = useState('')
  const [businessTopic, setBusinessTopic] = useState('')

  // 내 콘텐츠 내역 탭
  const [pageTab, setPageTab] = useState<'generate' | 'history'>('generate')
  const [historyContents, setHistoryContents] = useState<Array<{
    id: string
    target_keyword: string
    title: string
    content: string
    status: string
    seo_score: number | null
    created_at: string
    updated_at: string
  }>>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null)
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all')
  const [historyListCollapsed, setHistoryListCollapsed] = useState(false)
  const [historyEditMode, setHistoryEditMode] = useState(false)
  const [historyEditTitle, setHistoryEditTitle] = useState('')
  const [historyEditContent, setHistoryEditContent] = useState('')
  const [historySaving, setHistorySaving] = useState(false)
  const [historyCopied, setHistoryCopied] = useState(false)
  const [showHistoryRawMarkdown, setShowHistoryRawMarkdown] = useState(false)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/content/list')
      const data = await res.json()
      if (res.ok) {
        setHistoryContents(data.contents || [])
      }
    } catch {
      // 조용히 실패
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // 내 콘텐츠 탭 진입 시 로드
  useEffect(() => {
    if (pageTab === 'history') {
      loadHistory()
    }
  }, [pageTab, loadHistory])

  // URL param에서 키워드 프리필 + 경쟁자 분석 데이터 자동 입력
  useEffect(() => {
    const kwParam = searchParams.get('keyword')
    if (kwParam) {
      setKeyword(kwParam)
    }

    // 경쟁자 분석에서 넘어온 경우 분석 데이터 자동 적용
    const fromCompetitors = searchParams.get('from') === 'competitors'
    if (fromCompetitors) {
      try {
        const raw = sessionStorage.getItem('naverseo-competitor-preset')
        if (raw) {
          const preset = JSON.parse(raw)
          sessionStorage.removeItem('naverseo-competitor-preset')

          // 관련 키워드 자동 입력
          if (preset.relatedKeywords && preset.relatedKeywords.length > 0) {
            setAdditionalKeywords(preset.relatedKeywords.join(', '))
          }

          // 참고 블로그 URL 자동 입력 (1위 블로그)
          if (preset.referenceUrl) {
            setReferenceUrl(preset.referenceUrl)
          }

          // 콘텐츠 유형 자동 선택
          if (preset.contentType) {
            const typeMap: Record<string, ContentType> = {
              '비교/추천형': 'comparison',
              '후기/리뷰형': 'review',
              '방법/가이드형': 'howto',
              '리스트형': 'listicle',
              '정보형': 'informational',
              '지역업종형': 'local',
            }
            const mapped = typeMap[preset.contentType]
            if (mapped) setContentType(mapped)
          }

          // 톤앤매너 자동 선택
          if (preset.tone) {
            setTone(preset.tone)
          }
        }
      } catch {
        // sessionStorage 파싱 실패 시 무시
      }
    }
  }, [searchParams])

  // 참고 URL 분석
  const analyzeReferenceUrl = async () => {
    if (!referenceUrl.trim() || analyzingRef) return
    setAnalyzingRef(true)
    setReferenceAnalysis(null)

    try {
      const res = await fetch('/api/naver/blog-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: referenceUrl.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '블로그 분석에 실패했습니다.')
        return
      }

      // 구조 분석
      const text = data.content || ''
      const headingMatches = text.match(/^#{1,3}\s.+$/gm) || []
      const headings = headingMatches.map((h: string) => h.replace(/^#+\s/, ''))
      const h2Count = (text.match(/^## /gm) || []).length
      const h3Count = (text.match(/^### /gm) || []).length
      const imageCount = (text.match(/\[이미지/g) || []).length
      const boldCount = (text.match(/\*\*[^*]+\*\*/g) || []).length
      const listCount = (text.match(/^[-•]\s|^\d+\.\s/gm) || []).length

      const structure = `${text.length.toLocaleString()}자 / H2 ${h2Count}개 / H3 ${h3Count}개 / 볼드 ${boldCount}개 / 리스트 ${listCount}개 / 이미지 ${imageCount}개`

      setReferenceAnalysis({
        title: data.title || '(제목 없음)',
        headings,
        charCount: text.length,
        structure,
      })
    } catch {
      setError('참고 URL 분석 중 오류가 발생했습니다.')
    } finally {
      setAnalyzingRef(false)
    }
  }

  const generateContent = async (overrides?: { tone?: string; targetLength?: string; contentType?: string }) => {
    if (!keyword.trim() || loading) return

    setLoading(true)
    setProgress(null)
    setError('')
    setPlanGateMessage('')
    setShowSeoDetail(false)

    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          tone: overrides?.tone || tone,
          targetLength: overrides?.targetLength || targetLength,
          contentType: overrides?.contentType || contentType || undefined,
          contentDirection: contentDirection.trim() || undefined,
          domainCategory: domainCategory || undefined,
          customDomain: domainCategory === 'other' ? customDomain.trim() || undefined : undefined,
          includeFaq,
          additionalKeywords: additionalKeywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          referenceAnalysis: referenceAnalysis ? {
            title: referenceAnalysis.title,
            headings: referenceAnalysis.headings,
            charCount: referenceAnalysis.charCount,
          } : undefined,
          businessInfo: isPromoMode && businessName.trim() ? {
            name: businessName.trim(),
            address: businessAddress.trim() || undefined,
            pricing: businessPricing.trim() || undefined,
            strengths: businessStrengths.trim() || undefined,
            operatingHours: businessHours.trim() || undefined,
            contact: businessContact.trim() || undefined,
            topic: businessTopic.trim() || undefined,
          } : undefined,
          advancedOptions: showAdvancedOptions ? {
            imageCount,
            headingCount,
            structureRatio,
            forcedSections,
            keywordDensity,
            internalLinkCount,
            forceListFormat,
            includeTable,
            useEmoji,
            includeQuotes,
            targetAudience,
            ageGroup,
          } : undefined,
        }),
      })

      const contentType_ = res.headers.get('Content-Type') || ''

      // NDJSON 스트리밍 응답 처리
      if (contentType_.includes('application/x-ndjson') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let resultReceived = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            // 스트림 종료 시 TextDecoder 잔여 바이트 플러시
            buffer += decoder.decode()
          } else {
            buffer += decoder.decode(value, { stream: true })
          }

          const lines = buffer.split('\n')
          // 스트림 진행 중: 마지막 줄은 불완전할 수 있으므로 버퍼에 유지
          // 스트림 종료: 모든 줄을 처리 (잔여 버퍼 포함)
          buffer = done ? '' : (lines.pop() || '')

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)
              if (event.type !== 'stream') {
                console.log('[Content NDJSON]', event.type, event.type === 'result' ? '✓ result received' : '')
              }

              if (event.type === 'progress') {
                setProgress({
                  step: event.step,
                  totalSteps: event.totalSteps,
                  message: event.message,
                  current: event.current,
                  total: event.total,
                })
              } else if (event.type === 'stream') {
                const isFirst = !streamingTextRef.current
                streamingTextRef.current += event.delta
                const accumulated = streamingTextRef.current
                setStreamingText(accumulated)

                // 첫 스트림 청크: 외부 스크롤을 스트리밍 영역으로 1회만 이동
                if (isFirst) {
                  setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                }

                // 스트리밍 콘텐츠 auto-scroll (내부 컨테이너만 — 외부 스크롤은 건드리지 않음)
                if (autoScrollRef.current) {
                  setTimeout(() => {
                    const el = streamingContentRef.current
                    if (el) {
                      el.scrollTop = el.scrollHeight
                    }
                  }, 0)
                }

                // 스트리밍 중에는 SEO 분석 안 함 (렉 방지)
                // editTitle/editContent는 result 이벤트 후 설정됨
              } else if (event.type === 'selfHealPatches') {
                // Self-Healing 패치 저장 (result 수신 시 애니메이션 실행)
                selfHealPatchesRef.current = {
                  rawTitle: event.rawTitle,
                  rawContent: event.rawContent,
                  patches: event.patches || [],
                }
              } else if (event.type === 'result') {
                resultReceived = true
                setStreamingText('')
                streamingTextRef.current = ''

                const healData = selfHealPatchesRef.current
                selfHealPatchesRef.current = null

                if (healData && healData.patches.length > 0 && !showRawMarkdown) {
                  // Self-Healing 3단계 애니메이션: 검토 → 수정 → 완료
                  const scoreBefore = event.scoreBefore ?? 0
                  const scoreAfter = event.scoreAfter ?? event.seoScore ?? 0

                  // 원본(최적화 전) 콘텐츠/제목을 에디터에 로드
                  setEditTitle(healData.rawTitle)
                  setEditContent(healData.rawContent)
                  setResult(event)

                  // 패치 분류
                  const contentPatches = healData.patches.filter(p => p.label !== '제목 키워드 최적화' && p.label !== '제목 길이 조정')
                  const titlePatch = healData.patches.find(p => p.label === '제목 키워드 최적화' || p.label === '제목 길이 조정')
                  const totalPatches = contentPatches.length + (titlePatch ? 1 : 0)

                  // Phase 1: "검토 중"
                  setHealAnimState({ phase: 'reviewing', current: 0, total: totalPatches, label: '', fixPhase: 'find', scoreBefore, scoreAfter })
                  setAnimatingPatch('AI 검토 중...')

                  // 에디터 렌더링 대기 후 애니메이션 시작
                  setTimeout(() => {
                    contentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

                    if (contentPatches.length > 0 && editorRef.current) {
                      let currentContent = healData.rawContent

                      cancelAnimationRef.current = animatePatchesSequential(
                        editorRef.current,
                        contentPatches,
                        {
                          initialDelay: 1500,
                          findDuration: 900,
                          replaceDuration: 1400,
                          interPatchDelay: 600,
                          onApplyPatch: (patch) => {
                            return new Promise((resolve) => {
                              if (!currentContent.includes(patch.find)) {
                                resolve(false)
                                return
                              }
                              currentContent = currentContent.replace(patch.find, patch.replace)
                              setEditContent(currentContent)
                              requestAnimationFrame(() => {
                                setTimeout(() => resolve(true), 150)
                              })
                            })
                          },
                          onProgress: (current, total, phase) => {
                            const patchLabel = contentPatches[current - 1]?.label || ''
                            // Phase 2: 각 패치의 find/replace 단계
                            setHealAnimState(prev => prev ? {
                              ...prev,
                              phase: 'fixing',
                              current,
                              total: totalPatches,
                              label: patchLabel,
                              fixPhase: phase as 'find' | 'replace',
                            } : null)
                            if (phase === 'find') {
                              setAnimatingPatch(`${patchLabel} 수정 중... (${current}/${total})`)
                            } else {
                              setAnimatingPatch(`${patchLabel} 적용 완료 (${current}/${total})`)
                            }
                          },
                          onComplete: () => {
                            if (titlePatch) setEditTitle(event.title)
                            setEditContent(event.content)
                            setAnimatingPatch('')
                            cancelAnimationRef.current = null

                            // Phase 3: "완료"
                            setHealAnimState(prev => prev ? { ...prev, phase: 'done', current: totalPatches, label: '' } : null)
                            setTimeout(() => setHealAnimState(null), 4000)
                          },
                        }
                      )
                    } else {
                      // 콘텐츠 패치 없음 (제목만 변경)
                      if (titlePatch) setEditTitle(event.title)
                      setEditContent(event.content)
                      setHealAnimState(prev => prev ? { ...prev, phase: 'done', current: totalPatches, label: '' } : null)
                      setTimeout(() => setHealAnimState(null), 4000)
                    }
                  }, 600)
                } else {
                  // Self-Healing 패치 없음 → 기존 방식
                  setResult(event)
                  setTimeout(() => contentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                }
              } else if (event.type === 'error') {
                setStreamingText('')
                streamingTextRef.current = ''
                setError(event.error || '콘텐츠 생성에 실패했습니다.')
              }
            } catch {
              // JSON 파싱 실패 시 무시
            }
          }

          if (done) break
        }

        // 폴백: 스트리밍은 됐는데 result 이벤트를 못 받은 경우 (타임아웃/네트워크 중단 등)
        if (!resultReceived && streamingTextRef.current) {
          console.warn('[Content] result 이벤트 미수신 — 스트리밍 텍스트로 폴백 복구')
          const parsed = extractFromStreamJson(streamingTextRef.current)
          if (parsed.title && parsed.content) {
            const fallbackResult: ContentResult = {
              title: parsed.title,
              content: parsed.content,
              tags: [],
              isDemo: false,
              notice: '서버 응답이 불완전하여 스트리밍 데이터로 복구되었습니다. 내용을 확인해주세요.',
            }
            setStreamingText('')
            streamingTextRef.current = ''
            setResult(fallbackResult)
            setTimeout(() => contentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
          }
        }
      } else {
        // 일반 JSON 응답 (데모/에러)
        const data = await res.json()
        if (!res.ok) {
          if (data.planGate) {
            setPlanGateMessage(data.error)
            setError('')
          } else {
            setError(data.error || '콘텐츠 생성에 실패했습니다.')
          }
          return
        }
        setResult(data)
        setTimeout(() => contentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }


  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    setStreamingText('')
    streamingTextRef.current = ''
    selfHealPatchesRef.current = null
    cancelAnimationRef.current?.()
    setAnimatingPatch('')
    setHealAnimState(null)
    setAutoScroll(true)
    setImproveUsed(false)
    setImproveDisabledReason('')
    autoScrollRef.current = true
    await generateContent()
  }

  const handleCopy = async () => {
    if (!result) return
    const contentSource = editContent || result.content
    const titleSource = editTitle || result.title
    const rawHtml = `<h1>${titleSource}</h1>${getEditorHtml(contentSource)}`
    const html = htmlForNaverClipboard(rawHtml)
    const text = `${titleSource}\n\n${contentSource}`

    try {
      // HTML + 텍스트 동시 클립보드 저장 (네이버 블로그 서식 유지)
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ])
    } catch {
      // ClipboardItem 미지원 브라우저 폴백
      await navigator.clipboard.writeText(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // result 도착 시 편집 상태 초기화 (Self-Healing 애니메이션 중에는 건너뜀)
  useEffect(() => {
    if (result) {
      // 애니메이션 진행 중이면 title/content 덮어쓰기 방지 (애니메이션 완료 시 직접 설정)
      if (!animatingPatch) {
        setEditTitle(result.title)
        setEditContent(result.content)
      }
      setEditTags(result.tags || [])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const handleSave = async () => {
    if (!result?.contentId || saving) return
    setSaving(true)
    setSaveMessage('')

    try {
      const res = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: result.contentId,
          title: editTitle,
          content: editContent,
          tags: editTags,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setSaveMessage(data.error || '저장에 실패했습니다.')
        return
      }

      // 결과 반영
      setResult({
        ...result,
        title: editTitle,
        content: editContent,
        tags: editTags,
        seoScore: data.seoScore ?? result.seoScore,
      })
      setSaveMessage('저장 완료!')
      setTimeout(() => setSaveMessage(''), 2000)
    } catch {
      setSaveMessage('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // AI 약점 개선 (Patch 방식) — active context 사용 (생성 탭 + 내 콘텐츠 편집 모두 지원)
  const handleImprove = async () => {
    if (improving || !activeContent.trim() || !activeKeyword.trim()) return
    setImproving(true)
    setImproveMessage('')
    setImproveDetails([])

    try {
      // 현재 콘텐츠의 SEO 분석 실행
      const seoResult = analyzeSeo(activeKeyword.trim(), activeTitle, activeContent)

      // 약한 항목 추출 (점수 비율 기준 상위 5개)
      const weakCategories = [...seoResult.categories]
        .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))
        .filter(cat => (cat.score / cat.maxScore) < 0.8) // 80% 미만만
        .slice(0, 5)
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          score: cat.score,
          maxScore: cat.maxScore,
          details: cat.details,
        }))

      if (weakCategories.length === 0) {
        setImproveMessage('모든 항목이 양호합니다!')
        setImproveDisabledReason('모든 SEO 항목이 양호합니다 (80% 이상)')
        setTimeout(() => setImproveMessage(''), 3000)
        setImproving(false)
        return
      }

      const res = await fetch('/api/ai/content/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: activeKeyword.trim(),
          title: activeTitle,
          content: activeContent,
          weakCategories,
        }),
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any

      const contentType = res.headers.get('Content-Type') || ''
      if (contentType.includes('application/x-ndjson') && res.body) {
        // NDJSON 스트리밍 수신
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += decoder.decode()
          } else {
            buffer += decoder.decode(value, { stream: true })
          }

          const lines = buffer.split('\n')
          buffer = done ? '' : (lines.pop() || '')

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)
              if (event.type === 'stream') {
                setImproveMessage('AI가 개선안을 작성 중...')
              } else if (event.type === 'result') {
                data = event
              } else if (event.type === 'error') {
                setImproveMessage(event.error || 'AI 개선에 실패했습니다.')
                return
              }
            } catch {
              // 파싱 실패 무시
            }
          }

          if (done) break
        }
      } else {
        // 일반 JSON 응답
        data = await res.json()
        if (!res.ok) {
          setImproveMessage(data.error || 'AI 개선에 실패했습니다.')
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
      } else {
        setGuidanceItems([])
      }

      // 적용 가능한 패치 필터링
      const validPatches = (data.patches && Array.isArray(data.patches))
        ? data.patches.filter((p: { find: string; replace: string }) =>
            typeof p.find === 'string' && typeof p.replace === 'string' && p.find.length > 0 && activeContent.includes(p.find)
          )
        : []

      // 편집기 탭 + 에디터 있으면 → 순차 애니메이션 (패치 하나씩 적용)
      if (validPatches.length > 0 && activeEditorRef.current && !activeShowRawMarkdown) {
        cancelAnimationRef.current?.()
        let currentContent = activeContent

        cancelAnimationRef.current = animatePatchesSequential(
          activeEditorRef.current,
          validPatches,
          {
            initialDelay: 300,
            findDuration: 900,
            replaceDuration: 1400,
            interPatchDelay: 400,
            onApplyPatch: (patch) => {
              return new Promise((resolve) => {
                if (!currentContent.includes(patch.find)) {
                  resolve(false)
                  return
                }
                currentContent = currentContent.replace(patch.find, patch.replace)
                setActiveContent(currentContent)
                // React 리렌더 + TipTap 동기화 대기
                requestAnimationFrame(() => {
                  setTimeout(() => resolve(true), 150)
                })
              })
            },
            onProgress: (current, total, phase) => {
              if (phase === 'find') {
                setAnimatingPatch(`${current}/${total} 수정 중...`)
              } else {
                setAnimatingPatch(`${current}/${total} 적용 완료`)
              }
            },
            onComplete: (applied, skipped) => {
              // append (태그/CTA 등 끝에 추가)
              if (data.append) {
                currentContent = currentContent.trimEnd() + '\n\n' + data.append
                setActiveContent(currentContent)
              }
              if (data.title) setActiveTitle(data.title)

              setAnimatingPatch('')
              cancelAnimationRef.current = null

              // 개선 내역 저장 (어떤 항목이 개선되었는지)
              if (applied > 0) {
                setImproveDetails(weakCategories.map(c => c.name))
              }

              const messages: string[] = []
              if (applied > 0) messages.push(`${applied}개 수정 적용 완료!`)
              if (skipped > 0) messages.push(`${skipped}개 건너뜀`)
              if (data.guidance?.length > 0) messages.push(`${data.guidance.length}개 항목은 아래 가이드 확인`)
              setImproveMessage(messages.join(', ') + (applied > 0 ? ' LIVE SEO에서 점수를 확인하세요.' : ''))
              setTimeout(() => setImproveMessage(''), 5000)
            },
          }
        )
      } else {
        // 폴백: 마크다운 탭이거나 에디터 없으면 일괄 적용 (기존 방식)
        let updatedContent = activeContent
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
        if (data.title) setActiveTitle(data.title)
        if (appliedCount > 0) {
          setActiveContent(updatedContent)
          setImproveUsed(true)
          setImproveDisabledReason('이미 AI 약점 개선이 적용되었습니다')
        }

        // 개선 내역 저장
        if (appliedCount > 0) {
          setImproveDetails(weakCategories.map(c => c.name))
        }

        const messages: string[] = []
        if (appliedCount > 0) messages.push(`${appliedCount}개 수정 적용 완료!`)
        if (skippedCount > 0) messages.push(`${skippedCount}개 건너뜀`)
        if (data.guidance?.length > 0) messages.push(`${data.guidance.length}개 항목은 아래 가이드 확인`)
        if (appliedCount === 0 && skippedCount > 0 && !data.guidance?.length) {
          setImproveMessage('패치 적용에 실패했습니다. 다시 시도해주세요.')
        } else {
          setImproveMessage(messages.join(', ') + (appliedCount > 0 ? ' LIVE SEO에서 점수를 확인하세요.' : ''))
        }
        setTimeout(() => setImproveMessage(''), 5000)
      }
    } catch {
      setImproveMessage('네트워크 오류가 발생했습니다.')
    } finally {
      setImproving(false)
    }
  }

  // ── AI 이미지 생성 ──

  /** AI 이미지 생성 버튼 클릭 → 마커 추출 → 확인 다이얼로그 (active context 사용) */
  const handleImageGenClick = () => {
    const markers = extractImageMarkers(activeContent)
    if (markers.length === 0) {
      toast({ title: '이미지 마커 없음', description: '본문에 [이미지: 설명] 마커가 없습니다.', variant: 'destructive' })
      return
    }
    setImageMarkers(markers)
    setShowImageConfirm(true)
  }

  /** 확인 후 이미지 생성 실행 */
  const handleConfirmImageGeneration = async () => {
    setShowImageConfirm(false)
    const generatableMarkers = imageMarkers.filter(m => !m.isReal)
    if (generatableMarkers.length === 0) {
      toast({ title: '생성 가능한 이미지 없음', description: '모든 마커가 실제 사진이 필요한 유형입니다.', variant: 'destructive' })
      return
    }

    setGeneratingImages(true)
    setImageGenMessage(`이미지 생성 준비 중...`)

    try {
      const res = await fetch('/api/ai/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: activeContentId,
          keyword: activeKeyword.trim(),
          markers: generatableMarkers.map(m => ({ index: m.index, description: m.description })),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '알 수 없는 오류' }))
        if (errData.planGate) setPlanGateMessage(errData.error)
        else setImageGenMessage(errData.error || '이미지 생성 실패')
        setTimeout(() => setImageGenMessage(''), 5000)
        return
      }

      // NDJSON 스트리밍 파싱
      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''
      let updatedContent = activeContent
      let replacedCount = 0

      console.log('[ImageGen] 시작 — activeContent 마커 수:', (activeContent.match(/\[이미지[:\s]+[^\]]+\]/g) || []).length)

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          buffer += decoder.decode()
        } else {
          buffer += decoder.decode(value, { stream: true })
        }

        const lines = buffer.split('\n')
        buffer = done ? '' : (lines.pop() || '')

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'progress') {
              setImageGenMessage(event.message)
            } else if (event.type === 'skipped') {
              console.log('[ImageGen] 스킵:', event.description, event.reason)
            } else if (event.type === 'image') {
              // 마크다운에서 해당 마커를 이미지로 교체
              const markerInfo = imageMarkers.find(m => m.index === event.index)
              if (markerInfo) {
                const markerRegex = new RegExp(
                  `\\[이미지[:\\s]+${escapeRegex(markerInfo.description)}\\]`,
                  ''
                )
                const before = updatedContent
                updatedContent = updatedContent.replace(markerRegex, `<img src="${event.url}" alt="${event.description}" style="max-width:680px;width:100%;height:auto;border-radius:8px;margin:12px auto;display:block;" />`)
                if (before !== updatedContent) {
                  replacedCount++
                  console.log(`[ImageGen] 마커 교체 성공 #${event.index}: "${markerInfo.description}" → 이미지 URL`)
                } else {
                  console.warn(`[ImageGen] 마커 교체 실패 #${event.index}: "${markerInfo.description}" 정규식이 본문에서 일치하지 않음`)
                }
              } else {
                console.warn(`[ImageGen] 마커 정보 미발견 — index=${event.index}`)
              }
            } else if (event.type === 'error_partial') {
              console.warn(`[ImageGen] 부분 실패 #${event.index}:`, event.reason)
            } else if (event.type === 'result') {
              console.log(`[ImageGen] 완료 — 생성: ${event.generated}, 실패: ${event.failed}, 교체: ${replacedCount}`)
              let finalContent = ''
              if (replacedCount > 0) {
                finalContent = updatedContent
                setActiveContent(updatedContent)
                toast({ title: '이미지 배치 완료', description: `${replacedCount}장의 이미지가 본문에 삽입되었습니다.` })
              } else if (event.generated > 0) {
                // 이미지는 생성되었지만 마커 교체 실패 — 강제 배치 시도
                console.warn('[ImageGen] 마커 교체 0건 — 이미지 URL을 본문 하단에 추가합니다')
                let appendMarkdown = '\n\n---\n\n### AI 생성 이미지\n\n'
                for (const img of (event.images || [])) {
                  appendMarkdown += `<img src="${img.url}" alt="${img.description}" style="max-width:680px;width:100%;height:auto;border-radius:8px;margin:12px auto;display:block;" />\n\n`
                }
                finalContent = activeContent + appendMarkdown
                setActiveContent(finalContent)
                toast({ title: '이미지 생성 완료', description: `마커 교체 실패로 본문 하단에 이미지를 추가했습니다.` })
              }

              // 이미지 삽입 후 자동저장
              if (finalContent && activeContentId) {
                try {
                  const saveRes = await fetch('/api/content/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contentId: activeContentId,
                      title: activeTitle,
                      content: finalContent,
                    }),
                  })
                  if (saveRes.ok) {
                    console.log('[ImageGen] 자동저장 완료')
                    toast({ title: '자동 저장 완료', description: '이미지가 포함된 콘텐츠가 저장되었습니다.' })
                  } else {
                    console.warn('[ImageGen] 자동저장 실패:', await saveRes.text())
                  }
                } catch (saveErr) {
                  console.warn('[ImageGen] 자동저장 오류:', saveErr)
                }
              }

              const msgs: string[] = []
              if (event.generated > 0) msgs.push(`${event.generated}장 생성 완료`)
              if (event.failed > 0) msgs.push(`${event.failed}장 실패`)
              if (event.skippedCount > 0) msgs.push(`${event.skippedCount}장 스킵 (실사)`)
              msgs.push(`${event.totalCredits} 크레딧 사용`)
              setImageGenMessage(msgs.join(', '))
              setTimeout(() => setImageGenMessage(''), 8000)
            }
          } catch (e) {
            console.warn('[ImageGen] NDJSON 파싱 오류:', e)
          }
        }

        if (done) break
      }
    } catch {
      setImageGenMessage('네트워크 오류가 발생했습니다.')
      setTimeout(() => setImageGenMessage(''), 5000)
    } finally {
      setGeneratingImages(false)
    }
  }

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => { cancelAnimationRef.current?.() }
  }, [])

  const toneOptions = [
    '친근하고 정보적인',
    '전문적인',
    '재미있는',
    '솔직한',
  ]

  // 내역 관련 함수
  const selectedContent = historyContents.find(c => c.id === selectedContentId)

  // Active editing context — 생성 탭 vs 내 콘텐츠 편집 모드 자동 감지
  const isHistoryEditing = pageTab === 'history' && historyEditMode && !!selectedContent
  const activeKeyword = isHistoryEditing ? selectedContent!.target_keyword : keyword
  const activeTitle = isHistoryEditing ? historyEditTitle : editTitle
  const activeContent = isHistoryEditing ? historyEditContent : editContent
  const setActiveContent = isHistoryEditing ? setHistoryEditContent : setEditContent
  const setActiveTitle = isHistoryEditing ? setHistoryEditTitle : setEditTitle
  const activeContentId = isHistoryEditing ? selectedContentId : (result?.contentId || null)
  const activeEditorRef = isHistoryEditing ? historyEditorRef : editorRef
  const activeShowRawMarkdown = isHistoryEditing ? showHistoryRawMarkdown : showRawMarkdown

  // 약점 개선 가능 여부 체크 (디바운스 1초) — active context 사용
  useEffect(() => {
    // 이미 사용한 경우 비활성화 유지
    if (improveUsed) return
    if (!activeContent.trim() || !activeKeyword.trim()) {
      setImproveDisabledReason('')
      return
    }
    const timer = setTimeout(() => {
      try {
        const seoResult = analyzeSeo(activeKeyword.trim(), activeTitle, activeContent)
        const weakCount = seoResult.categories.filter(cat => (cat.score / cat.maxScore) < 0.8).length
        setImproveDisabledReason(weakCount === 0 ? '모든 SEO 항목이 양호합니다 (80% 이상)' : '')
      } catch { /* ignore */ }
    }, 1000)
    return () => clearTimeout(timer)
  }, [activeContent, activeTitle, activeKeyword])

  const filteredHistory = historyContents.filter(c => {
    if (historyFilter !== 'all' && c.status !== historyFilter) return false
    if (historySearch.trim()) {
      const q = historySearch.trim().toLowerCase()
      return c.title.toLowerCase().includes(q) || c.target_keyword.toLowerCase().includes(q)
    }
    return true
  })

  const updateContentStatus = async (contentId: string, status: string) => {
    try {
      const res = await fetch('/api/content/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, status }),
      })
      if (res.ok) {
        setHistoryContents(prev => prev.map(c => c.id === contentId ? { ...c, status } : c))
      }
    } catch {
      // 조용히 실패
    }
  }

  const saveHistoryEdit = async () => {
    if (!selectedContentId || historySaving) return
    setHistorySaving(true)
    try {
      const res = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: selectedContentId,
          title: historyEditTitle,
          content: historyEditContent,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setHistoryContents(prev => prev.map(c => c.id === selectedContentId
          ? { ...c, title: historyEditTitle, content: historyEditContent, seo_score: data.seoScore ?? c.seo_score }
          : c
        ))
        setHistoryEditMode(false)
      }
    } catch {
      // 조용히 실패
    } finally {
      setHistorySaving(false)
    }
  }

  const copyHistoryContent = (c: { title: string; content: string }) => {
    navigator.clipboard.writeText(c.title + '\n\n' + c.content)
    setHistoryCopied(true)
    setTimeout(() => setHistoryCopied(false), 2000)
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: '초안', color: 'bg-gray-100 text-gray-700' },
    published: { label: '발행됨', color: 'bg-green-100 text-green-700' },
    archived: { label: '보관됨', color: 'bg-yellow-100 text-yellow-700' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 콘텐츠</h1>
        <p className="mt-1 text-muted-foreground">
          AI가 네이버 SEO에 최적화된 블로그 글을 자동으로 생성합니다
        </p>
      </div>

      {/* 최상단 탭: AI 콘텐츠 생성 | 내 콘텐츠 */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            pageTab === 'generate'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setPageTab('generate')}
        >
          <Wand2 className="mr-1.5 inline h-4 w-4" />
          AI 콘텐츠 생성
        </button>
        <button
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            pageTab === 'history'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setPageTab('history')}
        >
          <FileText className="mr-1.5 inline h-4 w-4" />
          내 콘텐츠
          {historyContents.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
              {historyContents.length}
            </Badge>
          )}
        </button>
      </div>

      {/* 내 콘텐츠 탭 */}
      {pageTab === 'history' && (
        <div className="space-y-4">
          {/* 검색 + 필터 */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="키워드 또는 제목으로 검색..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'draft', 'published', 'archived'] as const).map(f => (
                <Badge
                  key={f}
                  variant={historyFilter === f ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setHistoryFilter(f)}
                >
                  {f === 'all' ? '전체' : statusLabel[f].label}
                </Badge>
              ))}
            </div>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">불러오는 중...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40" />
                <p className="mt-4 text-lg font-medium">
                  {historyContents.length === 0 ? '아직 생성한 콘텐츠가 없습니다' : '검색 결과가 없습니다'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {historyContents.length === 0
                    ? 'AI 콘텐츠 생성 탭에서 첫 번째 글을 만들어보세요!'
                    : '다른 키워드로 검색하거나 필터를 변경해보세요'}
                </p>
                {historyContents.length === 0 && (
                  <Button className="mt-4" onClick={() => setPageTab('generate')}>
                    <Wand2 className="mr-1.5 h-4 w-4" />
                    콘텐츠 생성하기
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className={`grid gap-4 ${historyListCollapsed ? '' : 'lg:grid-cols-[380px_1fr]'}`}>
              {/* 좌측: 목록 */}
              {!historyListCollapsed && (
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                  {filteredHistory.map(c => (
                    <div
                      key={c.id}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
                        selectedContentId === c.id ? 'border-primary bg-accent/30' : ''
                      }`}
                      onClick={() => {
                        setSelectedContentId(c.id)
                        setHistoryEditMode(false)
                        setImproveUsed(false)
                        setImproveDisabledReason('')
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium line-clamp-1 flex-1">{c.title}</h3>
                        {c.seo_score !== null && (
                          <span className={`text-xs font-bold shrink-0 ${getContentScoreColor(c.seo_score)}`}>
                            {c.seo_score}점
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.target_keyword}</Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 ${statusLabel[c.status]?.color || ''}`}>
                          {statusLabel[c.status]?.label || c.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(c.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 우측: 상세 보기 */}
              <div>
                {selectedContent ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          className="mt-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors hidden lg:block"
                          onClick={() => setHistoryListCollapsed(!historyListCollapsed)}
                          title={historyListCollapsed ? '목록 펼치기' : '목록 접기'}
                        >
                          {historyListCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline">{selectedContent.target_keyword}</Badge>
                            <Badge className={statusLabel[selectedContent.status]?.color || ''}>
                              {statusLabel[selectedContent.status]?.label || selectedContent.status}
                            </Badge>
                            {selectedContent.seo_score !== null && (
                              <Badge variant="outline" className="border-blue-300 text-blue-700">
                                SEO {selectedContent.seo_score}점
                              </Badge>
                            )}
                          </div>
                          {historyEditMode ? (
                            <Input
                              value={historyEditTitle}
                              onChange={(e) => setHistoryEditTitle(e.target.value)}
                              className="text-lg font-bold"
                            />
                          ) : (
                            <h2 className="text-lg font-bold">{selectedContent.title}</h2>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(selectedContent.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      {/* 액션 버튼 */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {historyEditMode ? (
                          <>
                            <Button size="sm" onClick={saveHistoryEdit} disabled={historySaving}>
                              {historySaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                              저장
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setHistoryEditMode(false)}>
                              취소
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleImprove}
                              disabled={improving || generatingImages || !!animatingPatch || !historyEditContent.trim() || !!improveDisabledReason}
                              className="gap-1"
                              title={improveDisabledReason || undefined}
                            >
                              {improving ? (
                                <><Loader2 className="h-3 w-3 animate-spin" />개선 중</>
                              ) : (
                                <><Sparkles className="h-3 w-3" />AI 약점 개선</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleImageGenClick}
                              disabled={generatingImages || improving || !!animatingPatch || !historyEditContent.trim()}
                              className="gap-1"
                            >
                              {generatingImages ? (
                                <><Loader2 className="h-3 w-3 animate-spin" />생성 중</>
                              ) : (
                                <><ImagePlus className="h-3 w-3" />AI 이미지</>
                              )}
                            </Button>
                            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5 ml-auto">
                              <button
                                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                  !showHistoryRawMarkdown
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setShowHistoryRawMarkdown(false)}
                              >
                                <Pencil className="mr-1 inline h-3 w-3" />
                                편집기
                              </button>
                              <button
                                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                  showHistoryRawMarkdown
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setShowHistoryRawMarkdown(true)}
                              >
                                <FileText className="mr-1 inline h-3 w-3" />
                                마크다운
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => copyHistoryContent(selectedContent)}>
                              {historyCopied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                              {historyCopied ? '복사됨' : '복사'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setHistoryEditTitle(selectedContent.title)
                              setHistoryEditContent(selectedContent.content)
                              setShowHistoryRawMarkdown(false)
                              setHistoryEditMode(true)
                            }}>
                              <Pencil className="mr-1 h-3 w-3" />
                              편집
                            </Button>
                            {selectedContent.status !== 'published' && (
                              <Button size="sm" variant="outline" className="text-green-700" onClick={() => updateContentStatus(selectedContent.id, 'published')}>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                발행
                              </Button>
                            )}
                            {selectedContent.status !== 'archived' && (
                              <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => updateContentStatus(selectedContent.id, 'archived')}>
                                <Trash2 className="mr-1 h-3 w-3" />
                                보관
                              </Button>
                            )}
                            {selectedContent.status === 'archived' && (
                              <Button size="sm" variant="outline" onClick={() => updateContentStatus(selectedContent.id, 'draft')}>
                                <RefreshCw className="mr-1 h-3 w-3" />
                                초안으로
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {historyEditMode ? (
                        <>
                          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                            {/* 좌측: 편집 영역 */}
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>본문</Label>
                                {showHistoryRawMarkdown ? (
                                  <>
                                    <Textarea
                                      value={historyEditContent}
                                      onChange={(e) => setHistoryEditContent(e.target.value)}
                                      rows={20}
                                      className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      {historyEditContent.length.toLocaleString()}자
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <TiptapEditor
                                      markdown={historyEditContent}
                                      onMarkdownChange={setHistoryEditContent}
                                      onEditorReady={(editor) => { historyEditorRef.current = editor }}
                                      placeholder="글을 작성하세요..."
                                      maxHeight={500}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      {historyEditContent.length.toLocaleString()}자
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                            {/* 우측: 실시간 SEO 패널 (데스크톱) */}
                            <div className="hidden lg:block">
                              <div className="sticky top-4">
                                <div className="mb-2 flex items-center gap-1.5">
                                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                                  <span className="text-xs font-medium text-muted-foreground">LIVE SEO</span>
                                </div>
                                <LiveSeoPanel
                                  keyword={selectedContent.target_keyword}
                                  title={historyEditTitle}
                                  content={historyEditContent}
                                  compact
                                />
                              </div>
                            </div>
                          </div>
                          {/* 모바일: 편집 시 SEO 패널 아래에 표시 */}
                          <div className="mt-4 lg:hidden">
                            <div className="mb-2 flex items-center gap-1.5">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                              <span className="text-xs font-medium text-muted-foreground">LIVE SEO</span>
                            </div>
                            <LiveSeoPanel
                              keyword={selectedContent.target_keyword}
                              title={historyEditTitle}
                              content={historyEditContent}
                              compact
                            />
                          </div>
                        </>
                      ) : (
                        <div className="rounded-lg border bg-muted/30 p-4 max-h-[60vh] overflow-y-auto">
                          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/90">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {selectedContent.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                      <Eye className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">왼쪽 목록에서 콘텐츠를 선택하세요</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI 콘텐츠 생성 탭 */}
      {pageTab === 'generate' && (<>


      {/* 입력 폼 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">콘텐츠 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="keyword">타겟 키워드 *</Label>
              <Input
                id="keyword"
                placeholder="예: 다이어트 식단 추천"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional">관련 키워드 (선택)</Label>
              <Input
                id="additional"
                placeholder="쉼표로 구분 (예: 저칼로리, 건강식, 다이어트 레시피)"
                value={additionalKeywords}
                onChange={(e) => setAdditionalKeywords(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 참고 블로그 URL */}
            <div className="space-y-2">
              <Label htmlFor="refUrl" className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                참고 블로그 URL (선택)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="refUrl"
                  placeholder="상위노출 블로그 URL을 입력하면 구조를 분석합니다"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  disabled={loading || analyzingRef}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={analyzeReferenceUrl}
                  disabled={!referenceUrl.trim() || analyzingRef || loading}
                  className="shrink-0"
                >
                  {analyzingRef ? <Loader2 className="h-4 w-4 animate-spin" /> : '분석'}
                </Button>
              </div>
              {referenceAnalysis && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
                  <p className="font-medium text-blue-800 mb-1">{referenceAnalysis.title}</p>
                  <p className="text-blue-600 mb-1.5">{referenceAnalysis.structure}</p>
                  {referenceAnalysis.headings.length > 0 && (
                    <div className="text-blue-700">
                      <span className="font-medium">목차:</span>{' '}
                      {referenceAnalysis.headings.slice(0, 6).join(' → ')}
                      {referenceAnalysis.headings.length > 6 && ` 외 ${referenceAnalysis.headings.length - 6}개`}
                    </div>
                  )}
                  <button
                    type="button"
                    className="mt-1.5 text-blue-500 hover:text-blue-700 underline"
                    onClick={() => { setReferenceAnalysis(null); setReferenceUrl('') }}
                  >
                    분석 초기화
                  </button>
                </div>
              )}
            </div>

            {/* 콘텐츠 유형 */}
            <div className="space-y-2">
              <Label>콘텐츠 유형</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { type: '' as const, label: '자동 감지', desc: '키워드 기반' },
                  { type: 'informational' as ContentType, label: '정보형' },
                  { type: 'comparison' as ContentType, label: '비교/추천형' },
                  { type: 'review' as ContentType, label: '후기/리뷰형' },
                  { type: 'howto' as ContentType, label: '방법/가이드형' },
                  { type: 'listicle' as ContentType, label: '리스트형' },
                  { type: 'local' as ContentType, label: '지역업종형', desc: '동/역+업종' },
                ].map(({ type, label, desc }) => (
                  <Badge
                    key={type || 'auto'}
                    variant={contentType === type && !isPromoMode ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => { setContentType(type as ContentType | ''); setIsPromoMode(false) }}
                  >
                    {label}
                    {desc && contentType === type && !isPromoMode && (
                      <span className="ml-1 opacity-60 text-[10px]">({desc})</span>
                    )}
                  </Badge>
                ))}
                <Badge
                  variant={isPromoMode ? 'default' : 'outline'}
                  className={`cursor-pointer ${isPromoMode ? 'bg-orange-500 hover:bg-orange-600 border-orange-500' : 'border-orange-300 text-orange-600 hover:bg-orange-50'}`}
                  onClick={() => {
                    if (!isPromoMode) {
                      setContentType('local')
                      setIsPromoMode(true)
                    } else {
                      setIsPromoMode(false)
                    }
                  }}
                >
                  <Store className="mr-1 h-3 w-3" />
                  내 업체 홍보글
                </Badge>
              </div>
            </div>

            {/* 산업/분야 도메인 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-teal-500" />
                산업/분야
                <span className="text-xs font-normal text-muted-foreground">(선택)</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={domainCategory === '' ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => { setDomainCategory(''); setCustomDomain('') }}
                >
                  자동 감지
                </Badge>
                {(Object.entries(DOMAIN_CATEGORY_NAMES) as [DomainCategory, string][])
                  .filter(([key]) => key !== 'other')
                  .map(([key, name]) => (
                    <Badge
                      key={key}
                      variant={domainCategory === key ? 'default' : 'outline'}
                      className={`cursor-pointer text-xs ${domainCategory === key ? 'bg-teal-600 hover:bg-teal-700 border-teal-600' : ''}`}
                      onClick={() => { setDomainCategory(key); setCustomDomain('') }}
                    >
                      {name}
                    </Badge>
                  ))}
                <Badge
                  variant={domainCategory === 'other' ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs ${domainCategory === 'other' ? 'bg-teal-600 hover:bg-teal-700 border-teal-600' : ''}`}
                  onClick={() => setDomainCategory('other')}
                >
                  기타
                </Badge>
              </div>
              {domainCategory === 'other' && (
                <Input
                  placeholder="분야를 직접 입력하세요 (예: 웹툰, 반도체, 캠핑용품)"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  disabled={loading}
                  className="mt-1.5 border-teal-200 focus:border-teal-400 focus:ring-teal-400"
                />
              )}
              <p className="text-xs text-teal-600/80">
                분야를 지정하면 해당 산업에 특화된 AI 가이드라인이 적용됩니다
              </p>
            </div>

            {/* 콘텐츠 방향 (선택) */}
            {!isPromoMode && (
              <div className="space-y-2">
                <Label htmlFor="content-direction" className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  콘텐츠 방향
                  <span className="text-xs font-normal text-muted-foreground">(선택)</span>
                </Label>
                <Input
                  id="content-direction"
                  placeholder="예: 실제 사용 후기 느낌으로, 장단점 비교 중심으로, 초보자 눈높이에 맞춰서"
                  value={contentDirection}
                  onChange={(e) => setContentDirection(e.target.value)}
                  disabled={loading}
                  className="border-violet-200 focus:border-violet-400 focus:ring-violet-400"
                />
                <p className="text-xs text-violet-600/80">
                  입력하면 AI가 더 정확하게 원하는 방향의 글을 생성합니다
                </p>
              </div>
            )}

            {/* 내 업체 홍보글 입력 폼 */}
            {isPromoMode && (
              <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
                  <Store className="h-4 w-4" />
                  내 업체 정보 입력
                </div>
                <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="biz-name" className="text-sm">업체명 *</Label>
                      <Input
                        id="biz-name"
                        placeholder="내 업체/매장 이름을 입력하세요"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="biz-address" className="text-sm">위치/주소</Label>
                        <Input
                          id="biz-address"
                          placeholder="시/구/동 또는 상세 주소"
                          value={businessAddress}
                          onChange={(e) => setBusinessAddress(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-hours" className="text-sm">운영 시간</Label>
                        <Input
                          id="biz-hours"
                          placeholder="평일/주말 운영 시간"
                          value={businessHours}
                          onChange={(e) => setBusinessHours(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-pricing" className="text-sm">가격 정보</Label>
                        <Input
                          id="biz-pricing"
                          placeholder="대표 상품/서비스 가격대"
                          value={businessPricing}
                          onChange={(e) => setBusinessPricing(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="biz-contact" className="text-sm">연락처/예약</Label>
                        <Input
                          id="biz-contact"
                          placeholder="전화번호 또는 예약 링크"
                          value={businessContact}
                          onChange={(e) => setBusinessContact(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="biz-strengths" className="text-sm">강점/특징</Label>
                      <Textarea
                        id="biz-strengths"
                        placeholder="우리 업체만의 차별점, 핵심 강점을 적어주세요"
                        value={businessStrengths}
                        onChange={(e) => setBusinessStrengths(e.target.value)}
                        disabled={loading}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="biz-topic" className="text-sm font-medium text-orange-700">
                        글 주제/소재 (핵심!)
                      </Label>
                      <Textarea
                        id="biz-topic"
                        placeholder="어떤 주제의 글을 쓸지 자유롭게 입력하세요"
                        value={businessTopic}
                        onChange={(e) => setBusinessTopic(e.target.value)}
                        disabled={loading}
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '서비스 탐방', text: '대표 서비스 체험기 - 직접 방문해서 경험한 솔직한 후기' },
                          { label: '시설 소개', text: '새로 리뉴얼한 매장 소개 - 깔끔한 인테리어와 편의시설' },
                          { label: '이벤트 안내', text: '이번 달 특별 이벤트 안내 - 할인 및 무료 체험 정보' },
                          { label: '고객 후기', text: '단골 고객의 솔직 후기 - 실제 이용자의 생생한 경험담' },
                          { label: '전문가 칼럼', text: '업계 전문가가 알려주는 꿀팁 - 현장 노하우 공유' },
                          { label: '일상/비하인드', text: '매장 운영 비하인드 - 사장님과 직원들의 소소한 일상' },
                        ].map(({ label, text }) => (
                          <button
                            key={label}
                            type="button"
                            className="rounded-full border border-orange-200 bg-white px-2.5 py-0.5 text-xs text-orange-600 hover:bg-orange-100 transition-colors"
                            onClick={() => setBusinessTopic(text)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        칩을 클릭하면 예시가 자동 입력됩니다. 자유롭게 수정하세요!
                      </p>
                    </div>
                  </div>
              </div>
            )}

            {/* 글 길이 */}
            <div className="space-y-2">
              <Label>글 길이</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'short' as const, label: '짧은 글', desc: '~1,500자' },
                  { value: 'medium' as const, label: '보통', desc: '~2,500자' },
                  { value: 'long' as const, label: '긴 글', desc: '~4,000자' },
                ].map(({ value, label, desc }) => (
                  <Badge
                    key={value}
                    variant={targetLength === value ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setTargetLength(value)}
                  >
                    {label}
                    <span className="ml-1 opacity-60 text-[10px]">({desc})</span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* 톤앤매너 */}
            <div className="space-y-2">
              <Label>톤앤매너</Label>
              <div className="flex flex-wrap gap-2">
                {toneOptions.map((t) => (
                  <Badge
                    key={t}
                    variant={tone === t ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setTone(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            {/* FAQ 포함 토글 */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={includeFaq}
                onClick={() => setIncludeFaq(!includeFaq)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  includeFaq ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    includeFaq ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
              <Label className="flex items-center gap-1.5 cursor-pointer" onClick={() => setIncludeFaq(!includeFaq)}>
                <MessageSquareQuote className="h-3.5 w-3.5" />
                FAQ 섹션 포함
              </Label>
            </div>

            {/* 고급 옵션 */}
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-medium text-blue-800 hover:text-blue-900 transition-colors"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  고급 옵션 ({showAdvancedOptions ? '접기' : '펼치기'})
                </span>
                {showAdvancedOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showAdvancedOptions && (
                <div className="space-y-4 pt-3">
                  {/* 템플릿 프리셋 */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-blue-800">⚡ 빠른 설정</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={applyInfoPreset}
                        className="flex flex-col items-start gap-1 rounded-md border border-blue-200 bg-white p-3 text-left hover:bg-blue-50 hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-center gap-1.5 text-sm font-medium text-blue-900">
                          📚 정보성
                        </div>
                        <p className="text-xs text-gray-600">목록·인용구 중심</p>
                      </button>
                      <button
                        type="button"
                        onClick={applyReviewPreset}
                        className="flex flex-col items-start gap-1 rounded-md border border-blue-200 bg-white p-3 text-left hover:bg-blue-50 hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-center gap-1.5 text-sm font-medium text-blue-900">
                          ⭐ 리뷰성
                        </div>
                        <p className="text-xs text-gray-600">사진 다량·경험 중심</p>
                      </button>
                      <button
                        type="button"
                        onClick={applyListiclePreset}
                        className="flex flex-col items-start gap-1 rounded-md border border-blue-200 bg-white p-3 text-left hover:bg-blue-50 hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-center gap-1.5 text-sm font-medium text-blue-900">
                          🏆 추천형
                        </div>
                        <p className="text-xs text-gray-600">순위·비교표 중심</p>
                      </button>
                    </div>
                  </div>

                  {/* 내 템플릿 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-blue-800">
                        💾 내 템플릿
                        {maxTemplates !== null && (
                          <span className="ml-1.5 font-normal text-gray-500">
                            ({templates.length}/{maxTemplates})
                          </span>
                        )}
                        {maxTemplates === null && templates.length > 0 && (
                          <span className="ml-1.5 font-normal text-gray-500">
                            ({templates.length}개)
                          </span>
                        )}
                      </Label>
                      {maxTemplates !== null && templates.length >= maxTemplates ? (
                        <span className="text-xs text-orange-600">
                          플랜 업그레이드 시 더 저장 가능
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={saveCurrentAsTemplate}
                          disabled={savingTemplate}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                        >
                          {savingTemplate ? '저장 중...' : '현재 설정 저장'}
                        </button>
                      )}
                    </div>
                    {templates.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white p-2"
                          >
                            <button
                              type="button"
                              onClick={() => loadTemplate(template)}
                              className="flex-1 text-left"
                            >
                              <div className="text-xs font-medium text-gray-900">{template.name}</div>
                              {template.description && (
                                <p className="text-[10px] text-gray-500 truncate">{template.description}</p>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTemplate(template.id, template.name)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">저장된 템플릿이 없습니다. "현재 설정 저장"을 클릭하여 템플릿을 만드세요.</p>
                    )}
                  </div>

                  {/* 구조/레이아웃 */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-blue-800">🏗️ 구조/레이아웃</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="imageCount" className="text-xs">이미지 개수</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[{ value: 'auto' as const, label: '자동' }, { value: 2, label: '2개' }, { value: 3, label: '3개' }, { value: 4, label: '4개' }, { value: 5, label: '5개' }].map(({ value, label }) => (
                            <Badge
                              key={value}
                              variant={imageCount === value ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => setImageCount(value)}
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="headingCount" className="text-xs">소제목 개수</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[{ value: 'auto' as const, label: '자동' }, { value: 3, label: '3개' }, { value: 4, label: '4개' }, { value: 5, label: '5개' }, { value: 7, label: '7개' }].map(({ value, label }) => (
                            <Badge
                              key={value}
                              variant={headingCount === value ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => setHeadingCount(value)}
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">글 구성 비율</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { value: 'balanced' as const, label: '균형잡힌', desc: '도입 20% · 본문 60% · 결론 20%' },
                          { value: 'intro-heavy' as const, label: '도입 강조', desc: '도입 30% · 본문 50% · 결론 20%' },
                          { value: 'content-heavy' as const, label: '본문 강조', desc: '도입 15% · 본문 70% · 결론 15%' },
                        ].map(({ value, label, desc }) => (
                          <Badge
                            key={value}
                            variant={structureRatio === value ? 'default' : 'outline'}
                            className="cursor-pointer text-xs"
                            onClick={() => setStructureRatio(value)}
                            title={desc}
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">특정 섹션 강제 포함</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {['장단점 비교', '가격표', '주의사항', '사용 팁', '자주묻는질문'].map((section) => (
                          <Badge
                            key={section}
                            variant={forcedSections.includes(section) ? 'default' : 'outline'}
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              setForcedSections(prev =>
                                prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
                              )
                            }}
                          >
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SEO/키워드 */}
                  <div className="space-y-2 border-t border-blue-200 pt-3">
                    <Label className="text-sm font-semibold text-blue-800">🔍 SEO/키워드</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">키워드 밀도</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { value: 'natural' as const, label: '자연스럽게', desc: '3~5회' },
                            { value: 'moderate' as const, label: '보통', desc: '5~8회 (권장)' },
                            { value: 'aggressive' as const, label: '적극적', desc: '8~12회' },
                          ].map(({ value, label, desc }) => (
                            <Badge
                              key={value}
                              variant={keywordDensity === value ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => setKeywordDensity(value)}
                              title={desc}
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">내부 링크 개수</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[{ value: 'auto' as const, label: '자동' }, { value: 1, label: '1개' }, { value: 2, label: '2개' }, { value: 3, label: '3개' }, { value: 5, label: '5개' }].map(({ value, label }) => (
                            <Badge
                              key={value}
                              variant={internalLinkCount === value ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => setInternalLinkCount(value)}
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 스타일/형식 */}
                  <div className="space-y-2 border-t border-blue-200 pt-3">
                    <Label className="text-sm font-semibold text-blue-800">🎨 스타일/형식</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { state: forceListFormat, setter: setForceListFormat, label: '리스트 형식 강제' },
                        { state: includeTable, setter: setIncludeTable, label: '표 포함' },
                        { state: useEmoji, setter: setUseEmoji, label: '이모지 사용' },
                        { state: includeQuotes, setter: setIncludeQuotes, label: '인용구/팁박스' },
                      ].map(({ state, setter, label }) => (
                        <Badge
                          key={label}
                          variant={state ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => setter(!state)}
                        >
                          {state ? '✓ ' : ''}{label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 타겟 독자 */}
                  <div className="space-y-2 border-t border-blue-200 pt-3">
                    <Label className="text-sm font-semibold text-blue-800">👥 타겟 독자</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">독자 수준</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { value: 'beginner' as const, label: '초보자', desc: '쉬운 용어, 단계별 설명' },
                            { value: 'general' as const, label: '일반인', desc: '보통 수준의 설명' },
                            { value: 'expert' as const, label: '전문가', desc: '전문 용어, 심화 내용' },
                          ].map(({ value, label, desc }) => (
                            <Badge
                              key={value}
                              variant={targetAudience === value ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => setTargetAudience(value)}
                              title={desc}
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">연령대</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { value: 'all' as const, label: '전연령' },
                            { value: '10s' as const, label: '10대' },
                            { value: '20-30s' as const, label: '20-30대' },
                            { value: '40-50s' as const, label: '40-50대' },
                            { value: '60+' as const, label: '60대+' },
                          ].map(({ value, label }) => (
                            <Badge
                              key={value}
                              variant={ageGroup === value ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => setAgeGroup(value)}
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SERP 기반 자동 최적화 안내 */}
            {keyword.trim() && (
              <div className="flex items-center gap-2 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  검색 데이터(SERP) 기반으로 콘텐츠 유형과 구조가 자동 최적화됩니다.
                </span>
              </div>
            )}

            {planGateMessage && (
              <PlanGateAlert message={planGateMessage} />
            )}

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <CreditTooltip feature="content_generation">
              <Button type="submit" disabled={loading || !keyword.trim()} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {progress?.message || '준비 중...'}
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    블로그 글 생성하기
                  </>
                )}
              </Button>
            </CreditTooltip>

            {/* 프로그레스 카드 */}
            {loading && progress && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-foreground">{progress.message}</span>
                  <span className="text-muted-foreground">
                    {progress.step}/{progress.totalSteps}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{
                      width: progress.current && progress.total
                        ? `${(((progress.step - 1) + progress.current / progress.total) / progress.totalSteps) * 100}%`
                        : `${(progress.step / progress.totalSteps) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                  <span>
                    {progress.step === 1 && '네이버 데이터 수집'}
                    {progress.step === 2 && '검색 데이터 분석'}
                    {progress.step === 3 && 'AI 콘텐츠 생성'}
                    {progress.step === 4 && 'SEO 자동 최적화'}
                    {progress.step === 5 && '품질 검증'}
                    {progress.step === 6 && '저장'}
                  </span>
                  {progress.current !== undefined && progress.total !== undefined && (
                    <span>{progress.current}/{progress.total}</span>
                  )}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* AI 스트리밍 타이핑 프리뷰 */}
      <div ref={resultRef} />
      {loading && streamingText && (() => {
        const parsed = extractFromStreamJson(streamingText)
        const isOptimizing = (progress?.step ?? 0) >= 4
        const healPatches = selfHealPatchesRef.current?.patches || []
        return (
          <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
            <Card className={`overflow-hidden ${isOptimizing ? 'border-amber-200 bg-gradient-to-br from-amber-50/50 to-white' : 'border-blue-200 bg-gradient-to-br from-blue-50/50 to-white'}`}>
              <CardHeader className="pb-2">
                <div className={`flex items-center gap-2 ${isOptimizing ? 'text-amber-700' : 'text-blue-700'}`}>
                  {isOptimizing ? (
                    <Shield className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Sparkles className="h-4 w-4 animate-pulse" />
                  )}
                  <span className="text-sm font-medium">
                    {isOptimizing ? (
                      healPatches.length > 0
                        ? `SEO 약점 ${healPatches.length}건 발견 → 자동 수정 중...`
                        : (progress?.message || 'SEO 약점 체크 중...')
                    ) : (
                      <>
                        AI가 글을 작성하고 있습니다...
                        {parsed.content && (
                          <span className="ml-2 text-blue-500/70">({parsed.content.length.toLocaleString()}자)</span>
                        )}
                      </>
                    )}
                  </span>
                </div>
                {parsed.title && (
                  <h3 className="text-lg font-bold mt-2">{parsed.title}</h3>
                )}
                {/* 최적화 단계 상세 */}
                {isOptimizing && healPatches.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {healPatches.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-600">
                        <Check className="h-3 w-3" />
                        <span>{p.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardHeader>
              {parsed.content && (
                <CardContent className="pt-0">
                  <div ref={streamingContentRef} className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/80 max-h-[400px] overflow-y-auto">
                    {parsed.content}
                    {!isOptimizing && (
                      <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                  {/* 자동 스크롤 안내 + 토글 */}
                  <div className="mt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !autoScroll
                        setAutoScroll(next)
                        autoScrollRef.current = next
                        // 다시 켜면 즉시 하단으로 이동 (내부 컨테이너만)
                        if (next) {
                          const el = streamingContentRef.current
                          if (el) {
                            el.scrollTop = el.scrollHeight
                          }
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        autoScroll
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {autoScroll ? (
                        <>
                          <ChevronsDown className="h-3 w-3" />
                          자동 스크롤 중
                        </>
                      ) : (
                        <>
                          <Pause className="h-3 w-3" />
                          자동 스크롤 중지됨
                        </>
                      )}
                    </button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 스트리밍 중 SEO 안내 */}
            <div className="hidden lg:block">
              <div className="sticky top-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  <span className="text-xs font-medium text-muted-foreground">LIVE SEO</span>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    작성 완료 후 분석
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    AI 콘텐츠 생성이 끝나면<br />실시간 SEO 분석이 시작됩니다
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 생성 결과 */}
      {result && (
        <>
          {/* 폴백 복구 알림 */}
          {result.notice && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {result.notice}
            </div>
          )}

          {/* 저장 확인 + SEO 점수 배너 */}
          <div className="flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{result.contentId ? '콘텐츠가 자동 저장되었습니다' : '콘텐츠가 생성되었습니다'}</span>
              {result.contentTypeName && (
                <Badge variant="secondary" className="text-xs">
                  {result.contentTypeName}
                </Badge>
              )}
              {result.seoScore !== undefined && (
                <Badge variant="outline" className="border-green-300 text-green-700">
                  SEO {result.seoScore}점
                </Badge>
              )}
              {result.autoOptimized && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                  <Sparkles className="h-3 w-3 mr-1" />
                  자동 최적화됨
                  {result.scoreBefore !== undefined && result.scoreAfter !== undefined && result.scoreAfter > result.scoreBefore && (
                    <span className="ml-1">({result.scoreBefore} → {result.scoreAfter}점)</span>
                  )}
                </Badge>
              )}
            </div>
            {result.optimizations && result.optimizations.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-green-700 hover:text-green-900 font-medium">
                  자동 최적화 내역 ({result.optimizations.length}건)
                </summary>
                <ul className="mt-1.5 space-y-0.5 text-green-700/80">
                  {result.optimizations.map((opt, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 shrink-0" />
                      {opt}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100 text-xs sm:text-sm"
                onClick={() => { setPageTab('history'); loadHistory() }}
              >
                <FileText className="h-4 w-4" />
                내 콘텐츠
              </Button>
              <Link href="/content/calendar">
                <Button variant="outline" size="sm" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100">
                  <CalendarDays className="h-4 w-4" />
                  캘린더
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100"
                onClick={() => {
                  if (result) {
                    sessionStorage.setItem('naverseo-workflow:content-body', result.content)
                    sessionStorage.setItem('naverseo-workflow:content-title', result.title)
                    sessionStorage.setItem('naverseo-workflow:content-keyword', keyword)
                    router.push('/seo-check?keyword=' + encodeURIComponent(keyword))
                  }
                }}
              >
                <BarChart3 className="h-4 w-4" />
                SEO 상세 체크
              </Button>
            </div>
          </div>

          {/* 데이터 강화 요약 */}
          {result.enrichment && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                AI에 제공된 네이버 데이터 인사이트
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {result.enrichment.relatedKeywordsCount !== undefined && result.enrichment.relatedKeywordsCount > 0 && (
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 gap-1">
                    <Search className="h-3 w-3" />
                    연관 키워드 {result.enrichment.relatedKeywordsCount}개
                  </Badge>
                )}
                {result.enrichment.trendDirection && (
                  <Badge variant="outline" className={`gap-1 ${
                    result.enrichment.trendDirection === '상승 중' ? 'border-green-200 bg-green-50 text-green-700' :
                    result.enrichment.trendDirection === '하락 중' ? 'border-red-200 bg-red-50 text-red-700' :
                    'border-gray-200 bg-gray-50 text-gray-700'
                  }`}>
                    <TrendingUp className="h-3 w-3" />
                    {result.enrichment.trendDirection}
                    {result.enrichment.trendRatio ? ` (${result.enrichment.trendRatio}/100)` : ''}
                  </Badge>
                )}
                {result.enrichment.serpRefCount !== undefined && result.enrichment.serpRefCount > 0 && (
                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 gap-1">
                    <Eye className="h-3 w-3" />
                    상위 {result.enrichment.serpRefCount}개 글 분석
                  </Badge>
                )}
                {result.enrichment.learningPatternCount !== undefined && result.enrichment.learningPatternCount > 0 && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 gap-1">
                    <FileText className="h-3 w-3" />
                    학습 패턴 {result.enrichment.learningPatternCount}개
                    {result.enrichment.learningMatchType ? ` · ${result.enrichment.learningMatchType}` : ''}
                  </Badge>
                )}
              </div>
              {result.enrichment.autoKeywords && result.enrichment.autoKeywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-xs text-blue-500 mr-1">자동 키워드:</span>
                  {result.enrichment.autoKeywords.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SEO 분석 + 가독성 + DIA 카드 */}
          {result.seoAnalysis && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* SEO 분석 요약 */}
              <Card className="order-1">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">SEO 점수</span>
                    </div>
                    <Badge className={getGradeBadgeColor(result.seoAnalysis.grade)}>
                      {result.seoAnalysis.grade}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-end gap-1">
                    <span className={`text-3xl font-bold ${getContentScoreColor(result.seoAnalysis.totalScore)}`}>
                      {result.seoAnalysis.totalScore}
                    </span>
                    <span className="mb-1 text-sm text-muted-foreground">/ 100</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${getContentScoreBgColor(result.seoAnalysis.totalScore)}`}
                      style={{ width: `${result.seoAnalysis.totalScore}%` }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-xs"
                    onClick={() => setShowSeoDetail(!showSeoDetail)}
                  >
                    {showSeoDetail ? (
                      <><ChevronUp className="mr-1 h-3 w-3" /> 접기</>
                    ) : (
                      <><ChevronDown className="mr-1 h-3 w-3" /> 상세 보기 (10개 항목)</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* SEO 상세 분석 (토글) - 모바일: SEO 바로 아래, 데스크탑: 전체 카드 아래 */}
              {showSeoDetail && result.seoAnalysis && (
                <Card className="order-2 sm:order-last col-span-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">SEO 분석 상세 ({result.seoAnalysis.categories.length}개 항목)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 세부 항목 */}
                    <div className="space-y-2">
                      {result.seoAnalysis.categories.map((cat) => {
                        const pct = Math.round((cat.score / cat.maxScore) * 100)
                        return (
                          <div key={cat.name} className="flex items-center gap-3">
                            <span className="w-24 shrink-0 text-sm">{cat.name}</span>
                            <div className="flex-1">
                              <div className="h-2 rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="w-12 text-right text-sm text-muted-foreground">
                              {cat.score}/{cat.maxScore}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* 강점/개선점 */}
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      {result.seoAnalysis.strengths.length > 0 && (
                        <div>
                          <p className="font-medium text-green-700 mb-1">강점</p>
                          <ul className="space-y-0.5 text-muted-foreground">
                            {result.seoAnalysis.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.seoAnalysis.improvements.length > 0 && (
                        <div>
                          <p className="font-medium text-amber-700 mb-1">개선 필요</p>
                          <ul className="space-y-0.5 text-muted-foreground">
                            {result.seoAnalysis.improvements.map((s, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 가독성 분석 */}
              {result.readabilityAnalysis && (
                <Card className="order-3 sm:order-2">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">가독성</span>
                      </div>
                      <Badge className={getGradeBadgeColor(result.readabilityAnalysis.grade)}>
                        {result.readabilityAnalysis.grade}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-end gap-1">
                      <span className={`text-3xl font-bold ${getContentScoreColor(result.readabilityAnalysis.score)}`}>
                        {result.readabilityAnalysis.score}
                      </span>
                      <span className="mb-1 text-sm text-muted-foreground">/ 100</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">{result.readabilityAnalysis.totalCharacters.toLocaleString()}</span>자
                      </div>
                      <div>
                        소제목 <span className="font-medium">{result.readabilityAnalysis.headingCount}</span>개
                      </div>
                      <div>
                        볼드 <span className="font-medium">{result.readabilityAnalysis.boldCount}</span>개
                      </div>
                      <div>
                        이미지 <span className="font-medium">{result.readabilityAnalysis.imageCount}</span>개
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* DIA 품질 분석 */}
              <div className="order-4 sm:order-3">
                <DiaScoreCard keyword={keyword} title={result.title} content={result.content} />
              </div>
            </div>
          )}

          {/* 메타 설명 */}
          {result.metaDescription && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">검색 결과 미리보기</span>
                </div>
                <div className="rounded border bg-white p-3">
                  <p className="text-sm font-medium text-blue-700">{result.title}</p>
                  <p className="mt-1 text-xs text-green-700">blog.naver.com</p>
                  <p className="mt-0.5 text-xs text-gray-600">{result.metaDescription}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI 검토/수정 시각화 카드 */}
          {healAnimState && (
            <div className={`rounded-lg border p-4 transition-all duration-500 ${
              healAnimState.phase === 'reviewing'
                ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-700'
                : healAnimState.phase === 'fixing'
                  ? healAnimState.fixPhase === 'find'
                    ? 'border-red-300 bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/30 dark:to-amber-950/30 dark:border-red-700'
                    : 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-700'
                  : 'border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-600'
            }`}>
              {/* 진행 바 */}
              <div className="mb-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    healAnimState.phase === 'done' ? 'bg-green-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${healAnimState.total > 0 ? (healAnimState.current / healAnimState.total) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <div className={`mt-0.5 flex-shrink-0 rounded-full p-2 ${
                  healAnimState.phase === 'reviewing'
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                    : healAnimState.phase === 'fixing' && healAnimState.fixPhase === 'find'
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'
                      : 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                }`}>
                  {healAnimState.phase === 'reviewing' ? (
                    <Search className="h-4 w-4 animate-pulse" />
                  ) : healAnimState.phase === 'fixing' && healAnimState.fixPhase === 'find' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </div>

                {/* 메시지 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    healAnimState.phase === 'reviewing'
                      ? 'text-amber-800 dark:text-amber-300'
                      : healAnimState.phase === 'fixing' && healAnimState.fixPhase === 'find'
                        ? 'text-red-800 dark:text-red-300'
                        : 'text-green-800 dark:text-green-300'
                  }`}>
                    {healAnimState.phase === 'reviewing' && 'AI가 생성된 글을 검토하고 있습니다...'}
                    {healAnimState.phase === 'fixing' && healAnimState.fixPhase === 'find' && (
                      <>약점 발견: {healAnimState.label}</>
                    )}
                    {healAnimState.phase === 'fixing' && healAnimState.fixPhase === 'replace' && (
                      <>수정 완료: {healAnimState.label}</>
                    )}
                    {healAnimState.phase === 'done' && (
                      <>모든 약점 수정 완료!{healAnimState.scoreBefore > 0 && ` SEO ${healAnimState.scoreBefore} → ${healAnimState.scoreAfter}점`}</>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {healAnimState.phase === 'reviewing' && `${healAnimState.total}건의 SEO 약점을 분석하고 있습니다`}
                    {healAnimState.phase === 'fixing' && `${healAnimState.current}/${healAnimState.total} 수정 중`}
                    {healAnimState.phase === 'done' && '추가 개선이 필요하면 AI 약점 개선 버튼을 이용하세요'}
                  </p>
                </div>

                {/* 카운터 */}
                {healAnimState.phase !== 'done' && (
                  <span className="flex-shrink-0 text-xs font-mono text-muted-foreground">
                    {healAnimState.current}/{healAnimState.total}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 생성된 콘텐츠 */}
          <Card ref={contentCardRef}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">생성된 콘텐츠</CardTitle>
                <div className="flex items-center gap-2">
                  {result.isDemo && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="cursor-help">데모</Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>API 연동 전 샘플 콘텐츠입니다</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {/* 편집기/마크다운 토글 */}
                  <div className="flex gap-0.5 rounded-lg bg-muted p-0.5 sm:gap-1 sm:p-1">
                    <button
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${
                        !showRawMarkdown
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setShowRawMarkdown(false)}
                    >
                      <Pencil className="mr-1 inline h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                      편집기
                    </button>
                    <button
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${
                        showRawMarkdown
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => { cancelAnimationRef.current?.(); setAnimatingPatch(''); setShowRawMarkdown(true) }}
                    >
                      <FileText className="mr-1 inline h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                      마크다운
                    </button>
                  </div>
                  {/* HTML 복사 버튼 (네이버 블로그 서식 유지) */}
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm" onClick={handleCopy}>
                          {copied ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              복사됨
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              HTML 복사
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>복사 후 네이버 블로그에 붙여넣으면 서식이 유지됩니다</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 편집기 영역 */}
              <div>
                  <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    {/* 좌측: 편집 영역 */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-title">제목</Label>
                        <Input
                          id="edit-title"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>본문</Label>
                        {showRawMarkdown ? (
                          <>
                            <Textarea
                              id="edit-content"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={20}
                              className="font-mono text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              {editContent.length.toLocaleString()}자
                            </p>
                          </>
                        ) : (
                          <>
                            <TiptapEditor
                              markdown={editContent}
                              onMarkdownChange={setEditContent}
                              onEditorReady={(editor) => { editorRef.current = editor }}
                              placeholder="글을 작성하세요..."
                              maxHeight={500}
                            />
                            <p className="text-xs text-muted-foreground">
                              {editContent.length.toLocaleString()}자
                            </p>
                          </>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>
                          <Tag className="mr-1 inline h-3 w-3" />
                          태그
                        </Label>
                        <TagEditor tags={editTags} onTagsChange={setEditTags} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={handleSave} disabled={saving || !result.contentId}>
                          {saving ? (
                            <><Loader2 className="mr-1 h-4 w-4 animate-spin" />저장 중...</>
                          ) : (
                            <><Save className="mr-1 h-4 w-4" />저장</>
                          )}
                        </Button>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="outline"
                                  onClick={handleImprove}
                                  disabled={improving || generatingImages || !!animatingPatch || !editContent.trim() || !keyword.trim() || !!improveDisabledReason}
                                  className="gap-1.5"
                                >
                                  {improving ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" />개선 중...</>
                                  ) : (
                                    <><Sparkles className="h-4 w-4" />AI 약점 개선</>
                                  )}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {(generatingImages || !!improveDisabledReason) && (
                              <TooltipContent>
                                {generatingImages ? '다른 AI 작업이 진행 중입니다' : improveDisabledReason}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="outline"
                                  onClick={handleImageGenClick}
                                  disabled={generatingImages || improving || !!animatingPatch || !editContent.trim()}
                                  className="gap-1.5"
                                >
                                  {generatingImages ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" />이미지 생성 중...</>
                                  ) : (
                                    <><ImagePlus className="h-4 w-4" />AI 이미지 생성</>
                                  )}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {improving && (
                              <TooltipContent>다른 AI 작업이 진행 중입니다</TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        {!result.contentId && (
                          <span className="text-xs text-muted-foreground">데모 콘텐츠는 저장할 수 없습니다</span>
                        )}
                        {saveMessage && (
                          <span className={`text-sm font-medium ${saveMessage.includes('완료') ? 'text-green-600' : 'text-red-600'}`}>
                            {saveMessage}
                          </span>
                        )}
                        {animatingPatch && (
                          <span className="text-sm font-medium text-blue-600 animate-pulse">
                            {animatingPatch}
                          </span>
                        )}
                        {improveMessage && !animatingPatch && (
                          <span className={`text-sm font-medium ${improveMessage.includes('완료') || improveMessage.includes('양호') || improveMessage.includes('가이드') ? 'text-green-600' : 'text-red-600'}`}>
                            {improveMessage}
                          </span>
                        )}
                        {imageGenMessage && (
                          <span className={`text-sm font-medium ${imageGenMessage.includes('완료') ? 'text-green-600' : imageGenMessage.includes('실패') || imageGenMessage.includes('오류') ? 'text-red-600' : 'text-blue-600'}`}>
                            {imageGenMessage}
                          </span>
                        )}
                      </div>

                      {/* AI 약점 개선 완료 내역 */}
                      {improveDetails.length > 0 && !improving && !animatingPatch && (
                        <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-800 dark:bg-green-950/20">
                          <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            AI 약점 개선 완료 ({improveDetails.length}개 항목)
                          </div>
                          <ul className="mt-2 space-y-1 text-xs text-green-600 dark:text-green-500">
                            {improveDetails.map((detail, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <Check className="h-3 w-3 flex-shrink-0" />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 수동 개선 가이드 (약점 개선 후 표시) */}
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
                    </div>

                    {/* 우측: 실시간 SEO 패널 */}
                    <div className="hidden lg:block">
                      <div className="sticky top-4">
                        <div className="mb-2 flex items-center gap-1.5">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                          <span className="text-xs font-medium text-muted-foreground">LIVE SEO</span>
                        </div>
                        <LiveSeoPanel
                          keyword={keyword}
                          title={editTitle}
                          content={editContent}
                          compact
                        />
                      </div>
                    </div>
                  </div>

                  {/* 모바일: SEO 패널 아래에 표시 */}
                  <div className="mt-6 lg:hidden">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                      <span className="text-xs font-medium text-muted-foreground">LIVE SEO</span>
                    </div>
                    <LiveSeoPanel
                      keyword={keyword}
                      title={editTitle}
                      content={editContent}
                      compact
                    />
                  </div>
                </div>
            </CardContent>
          </Card>

          {/* 재생성 옵션 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4" />
                다시 생성하기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-1">
                마음에 들지 않으면 위 설정을 변경하거나 빠르게 재생성해보세요.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                <AlertCircle className="mr-1 inline h-3 w-3" />
                다시 생성 시 {CREDIT_COSTS.content_generation} 크레딧이 소모됩니다
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 p-3 text-left"
                  disabled={loading}
                  onClick={() => generateContent()}
                >
                  <span className="text-sm font-medium">같은 설정으로</span>
                  <span className="text-xs text-muted-foreground">새로운 버전 생성</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 p-3 text-left"
                  disabled={loading}
                  onClick={() => {
                    const otherTones = toneOptions.filter(t => t !== tone)
                    const nextTone = otherTones[Math.floor(Math.random() * otherTones.length)]
                    setTone(nextTone)
                    generateContent({ tone: nextTone })
                  }}
                >
                  <span className="text-sm font-medium">다른 톤으로</span>
                  <span className="text-xs text-muted-foreground">현재: {tone}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 p-3 text-left"
                  disabled={loading}
                  onClick={() => {
                    const next = targetLength === 'medium' ? 'long' : targetLength === 'long' ? 'short' : 'medium'
                    setTargetLength(next)
                    generateContent({ targetLength: next })
                  }}
                >
                  <span className="text-sm font-medium">
                    {targetLength === 'short' ? '더 길게' : targetLength === 'long' ? '간결하게' : '더 길게'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    현재: {targetLength === 'short' ? '짧은 글' : targetLength === 'long' ? '긴 글' : '보통'}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </>)}

      {/* AI 이미지 생성 확인 다이얼로그 */}
      <Dialog open={showImageConfirm} onOpenChange={setShowImageConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5" />
              AI 이미지 생성
            </DialogTitle>
            <DialogDescription>
              본문의 이미지 마커를 AI가 생성한 이미지로 교체합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {imageMarkers.map((m) => (
                <div key={m.index} className="flex items-start gap-2 rounded border p-2 text-sm">
                  <span className="mt-0.5 min-w-[20px] font-mono text-xs text-muted-foreground">{m.index + 1}</span>
                  <span className="flex-1">{m.description}</span>
                  {m.isReal ? (
                    <Badge variant="outline" className="shrink-0 border-red-200 bg-red-50 text-red-600 text-xs">
                      실사 (스킵)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 border-green-200 bg-green-50 text-green-600 text-xs">
                      생성 가능
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span>생성 가능</span>
                <span className="font-medium text-green-600">{imageMarkers.filter(m => !m.isReal).length}장</span>
              </div>
              {imageMarkers.some(m => m.isReal) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>실사 이미지 (스킵)</span>
                  <span>{imageMarkers.filter(m => m.isReal).length}장</span>
                </div>
              )}
              <div className="mt-1 border-t pt-1 flex justify-between font-medium">
                <span>크레딧 소모</span>
                <span>{imageMarkers.filter(m => !m.isReal).length} 크레딧</span>
              </div>
            </div>
            {imageMarkers.some(m => m.isReal) && (
              <p className="text-xs text-amber-600">
                <AlertCircle className="mr-1 inline h-3 w-3" />
                실사 이미지(건물 외관, 스크린샷, 지도 등)는 AI가 생성할 수 없어 건너뜁니다. 직접 촬영한 사진을 사용해주세요.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowImageConfirm(false)}>
              취소
            </Button>
            <Button
              onClick={handleConfirmImageGeneration}
              disabled={imageMarkers.filter(m => !m.isReal).length === 0}
            >
              <ImagePlus className="mr-1 h-4 w-4" />
              {imageMarkers.filter(m => !m.isReal).length}장 생성하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// DIA 점수 카드 (콘텐츠 생성 결과에 표시)
function DiaScoreCard({ keyword, title, content }: { keyword: string; title: string; content: string }) {
  const dia = useMemo(() => {
    if (!keyword.trim() || !content || content.length < 50) return null
    try {
      return analyzeDia(keyword.trim(), title, content)
    } catch {
      return null
    }
  }, [keyword, title, content])

  if (!dia) return null

  const gradeColor = (() => {
    switch (dia.grade) {
      case 'S': return { bg: 'bg-emerald-100 text-emerald-700', score: 'text-emerald-600', bar: 'bg-emerald-500' }
      case 'A+': return { bg: 'bg-green-100 text-green-700', score: 'text-green-600', bar: 'bg-green-500' }
      case 'A': return { bg: 'bg-teal-100 text-teal-700', score: 'text-teal-600', bar: 'bg-teal-500' }
      case 'B+': return { bg: 'bg-blue-100 text-blue-700', score: 'text-blue-600', bar: 'bg-blue-500' }
      case 'B': return { bg: 'bg-yellow-100 text-yellow-700', score: 'text-yellow-600', bar: 'bg-yellow-500' }
      case 'C': return { bg: 'bg-orange-100 text-orange-700', score: 'text-orange-600', bar: 'bg-orange-500' }
      default: return { bg: 'bg-red-100 text-red-700', score: 'text-red-600', bar: 'bg-red-500' }
    }
  })()

  // 가장 약한 카테고리 2개
  const weakest = [...dia.categories]
    .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))
    .slice(0, 2)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium">D.I.A. 품질</span>
          </div>
          <Badge className={gradeColor.bg}>
            {dia.grade} {dia.gradeInfo.label}
          </Badge>
        </div>
        <div className="mt-2 flex items-end gap-1">
          <span className={`text-3xl font-bold ${gradeColor.score}`}>
            {dia.totalScore}
          </span>
          <span className="mb-1 text-sm text-muted-foreground">/ 100</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${gradeColor.bar}`}
            style={{ width: `${dia.totalScore}%` }}
          />
        </div>
        {weakest.length > 0 && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {weakest.map(cat => (
              <div key={cat.id} className="flex items-center justify-between">
                <span>{cat.name}</span>
                <span className="font-medium">{cat.score}/{cat.maxScore}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
