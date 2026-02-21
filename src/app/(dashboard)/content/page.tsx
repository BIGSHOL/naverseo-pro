'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback } from 'react'
import {
  Wand2, Loader2, Copy, Check, Tag, CalendarDays, CheckCircle, BarChart3,
  FileText, Eye, ChevronDown, ChevronUp, TrendingUp, AlertCircle, RefreshCw,
  Pencil, Save, Link2, ListOrdered, MessageSquareQuote, Sparkles,
  Search, Filter, Clock, Trash2, ExternalLink,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { LiveSeoPanel } from '@/components/seo/LiveSeoPanel'
import { TagEditor } from '@/components/content/TagEditor'
import { detectContentType, generateOutline, analyzeSeo, type ContentType } from '@/lib/content/engine'
import { analyzeDia } from '@/lib/dia/engine'
import { Shield, Store } from 'lucide-react'
import Link from 'next/link'

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

export default function ContentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [tone, setTone] = useState('친근하고 정보적인')
  const [additionalKeywords, setAdditionalKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0) // 0: 네이버 데이터, 1: AI 생성, 2: SEO 분석
  const [error, setError] = useState('')
  const [result, setResult] = useState<ContentResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [showSeoDetail, setShowSeoDetail] = useState(false)
  const [targetLength, setTargetLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [contentType, setContentType] = useState<ContentType | ''>('')
  const [includeFaq, setIncludeFaq] = useState(true)
  const [showOutline, setShowOutline] = useState(false)

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
  const [activeTab, setActiveTab] = useState('preview')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [improving, setImproving] = useState(false)
  const [improveMessage, setImproveMessage] = useState('')

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
  const [historyEditMode, setHistoryEditMode] = useState(false)
  const [historyEditTitle, setHistoryEditTitle] = useState('')
  const [historyEditContent, setHistoryEditContent] = useState('')
  const [historySaving, setHistorySaving] = useState(false)
  const [historyCopied, setHistoryCopied] = useState(false)

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
    setLoadingStep(0)
    setError('')
    setShowSeoDetail(false)

    // 로딩 단계 타이머 (UX용)
    const stepTimer1 = setTimeout(() => setLoadingStep(1), 3000)  // 3초 후: AI 생성 중
    const stepTimer2 = setTimeout(() => setLoadingStep(2), 12000) // 12초 후: SEO 분석 중

    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          tone: overrides?.tone || tone,
          targetLength: overrides?.targetLength || targetLength,
          contentType: overrides?.contentType || contentType || undefined,
          includeFaq,
          additionalKeywords: additionalKeywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          // 참고 URL 분석 결과가 있으면 전달
          referenceAnalysis: referenceAnalysis ? {
            title: referenceAnalysis.title,
            headings: referenceAnalysis.headings,
            charCount: referenceAnalysis.charCount,
          } : undefined,
          // 홍보글 모드일 때 업체 정보 전달
          businessInfo: isPromoMode && businessName.trim() ? {
            name: businessName.trim(),
            address: businessAddress.trim() || undefined,
            pricing: businessPricing.trim() || undefined,
            strengths: businessStrengths.trim() || undefined,
            operatingHours: businessHours.trim() || undefined,
            contact: businessContact.trim() || undefined,
            topic: businessTopic.trim() || undefined,
          } : undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '콘텐츠 생성에 실패했습니다.')
        return
      }

      setResult(data)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
      setLoading(false)
      setLoadingStep(0)
    }
  }

  // 아웃라인 미리보기 계산
  const effectiveContentType = (contentType as ContentType) || detectContentType(keyword.trim())
  const currentOutline = keyword.trim()
    ? generateOutline({
        keyword: keyword.trim(),
        contentType: effectiveContentType,
        targetLength,
        businessInfo: isPromoMode ? { name: businessName.trim() || '내 업체', topic: businessTopic.trim() || undefined } : undefined,
      })
    : null

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    await generateContent()
  }

  const handleCopy = async () => {
    if (!result) return
    const text = `${result.title}\n\n${result.content}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const enterEditMode = () => {
    if (!result) return
    setEditTitle(result.title)
    setEditContent(result.content)
    setEditTags(result.tags || [])
    setActiveTab('edit')
  }

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

  // AI 약점 개선
  const handleImprove = async () => {
    if (improving || !editContent.trim() || !keyword.trim()) return
    setImproving(true)
    setImproveMessage('')

    try {
      // 현재 콘텐츠의 SEO 분석 실행
      const seoResult = analyzeSeo(keyword.trim(), editTitle, editContent)

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
        setTimeout(() => setImproveMessage(''), 3000)
        return
      }

      const res = await fetch('/api/ai/content/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          title: editTitle,
          content: editContent,
          weakCategories,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setImproveMessage(data.error || 'AI 개선에 실패했습니다.')
        return
      }

      // 개선된 콘텐츠 반영
      if (data.title) setEditTitle(data.title)
      if (data.content) setEditContent(data.content)
      setImproveMessage(`${weakCategories.length}개 항목 개선 완료! LIVE SEO에서 점수 변화를 확인하세요.`)
      setTimeout(() => setImproveMessage(''), 5000)
    } catch {
      setImproveMessage('네트워크 오류가 발생했습니다.')
    } finally {
      setImproving(false)
    }
  }

  const toneOptions = [
    '친근하고 정보적인',
    '전문적인',
    '재미있는',
    '솔직한',
  ]

  // 내역 관련 함수
  const selectedContent = historyContents.find(c => c.id === selectedContentId)
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
            <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
              {/* 좌측: 목록 */}
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

              {/* 우측: 상세 보기 */}
              <div>
                {selectedContent ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
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
                      <div className="flex flex-wrap gap-2 mt-2">
                        {historyEditMode ? (
                          <>
                            <Button size="sm" onClick={saveHistoryEdit} disabled={historySaving}>
                              {historySaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                              저장
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setHistoryEditMode(false)}>
                              취소
                            </Button>
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
                              setHistoryEditMode(true)
                            }}>
                              <Pencil className="mr-1 h-3 w-3" />
                              편집
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                sessionStorage.setItem('naverseo-workflow:content-body', selectedContent.content)
                                sessionStorage.setItem('naverseo-workflow:content-title', selectedContent.title)
                                sessionStorage.setItem('naverseo-workflow:content-keyword', selectedContent.target_keyword)
                                router.push('/seo-check?keyword=' + encodeURIComponent(selectedContent.target_keyword))
                              }}
                            >
                              <BarChart3 className="mr-1 h-3 w-3" />
                              SEO 체크
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
                        <Textarea
                          value={historyEditContent}
                          onChange={(e) => setHistoryEditContent(e.target.value)}
                          rows={20}
                          className="font-mono text-sm"
                        />
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

            {/* 아웃라인 미리보기 */}
            {keyword.trim() && currentOutline && (
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowOutline(!showOutline)}
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                  아웃라인 미리보기
                  {showOutline ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showOutline && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        예상 {currentOutline.estimatedLength.toLocaleString()}자 · {
                          isPromoMode
                            ? '내 업체 홍보글'
                            : contentType
                              ? { informational: '정보형', comparison: '비교/추천형', review: '후기/리뷰형', howto: '방법/가이드형', listicle: '리스트형', local: '지역업종형' }[contentType]
                              : '자동 감지: ' + { informational: '정보형', comparison: '비교/추천형', review: '후기/리뷰형', howto: '방법/가이드형', listicle: '리스트형', local: '지역업종형' }[detectContentType(keyword.trim())]
                        }
                      </span>
                    </div>
                    {currentOutline.sections.map((sec, i) => (
                      <div key={i} className={sec.level === 3 ? 'ml-4' : ''}>
                        <span className="text-muted-foreground">{sec.level === 2 ? '##' : '###'}</span>{' '}
                        <span className="font-medium">{sec.heading}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({sec.keyPoints.join(', ')})
                        </span>
                      </div>
                    ))}
                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                      키워드 배치: {currentOutline.keywordPlacements.join(' → ')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading || !keyword.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loadingStep === 0 && '네이버 데이터 수집 중... (연관 키워드 · 트렌드 · 상위 글)'}
                  {loadingStep === 1 && 'AI가 콘텐츠를 작성하고 있습니다...'}
                  {loadingStep === 2 && 'SEO 분석 및 최적화 중...'}
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  블로그 글 생성하기
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 생성 결과 */}
      {result && (
        <>
          {/* 저장 확인 + SEO 점수 배너 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">콘텐츠가 자동 저장되었습니다</span>
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
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100"
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
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 mb-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                AI에 제공된 네이버 데이터 인사이트
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-600">
                {result.enrichment.relatedKeywordsCount && (
                  <span>연관 키워드 {result.enrichment.relatedKeywordsCount}개 반영</span>
                )}
                {result.enrichment.trendDirection && (
                  <span>트렌드: {result.enrichment.trendDirection} {result.enrichment.trendDirection === '상승 중' ? '↑' : result.enrichment.trendDirection === '하락 중' ? '↓' : '→'}{result.enrichment.trendRatio ? ` (${result.enrichment.trendRatio}/100)` : ''}</span>
                )}
                {result.enrichment.serpRefCount && (
                  <span>상위노출 {result.enrichment.serpRefCount}개 글 분석</span>
                )}
                {result.enrichment.autoKeywords && result.enrichment.autoKeywords.length > 0 && (
                  <span>자동 추가 키워드: {result.enrichment.autoKeywords.join(', ')}</span>
                )}
              </div>
            </div>
          )}

          {/* SEO 분석 + 가독성 + DIA 카드 */}
          {result.seoAnalysis && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* SEO 분석 요약 */}
              <Card>
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

              {/* 가독성 분석 */}
              {result.readabilityAnalysis && (
                <Card>
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
              <DiaScoreCard keyword={keyword} title={result.title} content={result.content} />
            </div>
          )}

          {/* SEO 상세 분석 (토글) */}
          {showSeoDetail && result.seoAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SEO 분석 상세 (10개 항목)</CardTitle>
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
                              className={`h-full rounded-full ${getContentScoreBgColor(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                          {cat.score}/{cat.maxScore}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* 강점 / 개선점 */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.seoAnalysis.strengths.length > 0 && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="mb-2 text-xs font-medium text-green-700">강점</p>
                      <ul className="space-y-1">
                        {result.seoAnalysis.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-green-700">
                            <CheckCircle className="mt-0.5 h-3 w-3 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.seoAnalysis.improvements.length > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <p className="mb-2 text-xs font-medium text-yellow-700">개선점</p>
                      <ul className="space-y-1">
                        {result.seoAnalysis.improvements.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-yellow-700">
                            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
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

          {/* 생성된 콘텐츠 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">생성된 콘텐츠</CardTitle>
                <div className="flex items-center gap-2">
                  {result.isDemo && (
                    <Badge variant="outline">데모</Badge>
                  )}
                  <Button variant="outline" size="sm" onClick={enterEditMode}>
                    <Pencil className="mr-1 h-3 w-3" />
                    편집
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3 w-3" />
                        복사
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="preview">
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    미리보기
                  </TabsTrigger>
                  <TabsTrigger value="edit">
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    편집
                  </TabsTrigger>
                </TabsList>

                {/* 미리보기 탭 - 마크다운 렌더링 */}
                <TabsContent value="preview" className="space-y-6">
                  <div>
                    <Label className="text-xs text-muted-foreground">제목</Label>
                    <h2 className="mt-1 text-xl font-bold">{result.title}</h2>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">본문</Label>
                    <div className="mt-2 rounded-lg border bg-muted/30 p-4">
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/90">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {result.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                  {result.tags && result.tags.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        <Tag className="mr-1 inline h-3 w-3" />
                        추천 태그
                      </Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {result.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* 편집 탭 */}
                <TabsContent value="edit">
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
                        <Label htmlFor="edit-content">본문</Label>
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
                        <Button
                          variant="outline"
                          onClick={handleImprove}
                          disabled={improving || !editContent.trim() || !keyword.trim()}
                          className="gap-1.5"
                        >
                          {improving ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />개선 중...</>
                          ) : (
                            <><Sparkles className="h-4 w-4" />AI 약점 개선</>
                          )}
                        </Button>
                        {!result.contentId && (
                          <span className="text-xs text-muted-foreground">데모 콘텐츠는 저장할 수 없습니다</span>
                        )}
                        {saveMessage && (
                          <span className={`text-sm font-medium ${saveMessage.includes('완료') ? 'text-green-600' : 'text-red-600'}`}>
                            {saveMessage}
                          </span>
                        )}
                        {improveMessage && (
                          <span className={`text-sm font-medium ${improveMessage.includes('완료') || improveMessage.includes('양호') ? 'text-green-600' : 'text-red-600'}`}>
                            {improveMessage}
                          </span>
                        )}
                      </div>
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
                </TabsContent>
              </Tabs>
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
              <p className="text-sm text-muted-foreground mb-3">
                마음에 들지 않으면 위 설정을 변경하거나 빠르게 재생성해보세요.
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
    </div>
  )
}

// DIA 점수 카드 (콘텐츠 생성 결과에 표시)
function DiaScoreCard({ keyword, title, content }: { keyword: string; title: string; content: string }) {
  const dia = analyzeDia(keyword.trim(), title, content)

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
