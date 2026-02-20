'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Wand2, Loader2, Copy, Check, Tag, CalendarDays, CheckCircle, BarChart3,
  FileText, Eye, ChevronDown, ChevronUp, TrendingUp, AlertCircle, RefreshCw,
  Pencil, Save, Link2, ListOrdered, MessageSquareQuote,
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
import { detectContentType, generateOutline, type ContentType } from '@/lib/content/engine'
import { analyzeDia } from '@/lib/dia/engine'
import { Shield } from 'lucide-react'
import Link from 'next/link'

interface SeoCategory {
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

  // URL param에서 키워드 프리필
  useEffect(() => {
    const kwParam = searchParams.get('keyword')
    if (kwParam) {
      setKeyword(kwParam)
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
    setError('')
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
      setLoading(false)
    }
  }

  // 아웃라인 미리보기 계산
  const currentOutline = keyword.trim()
    ? generateOutline({
        keyword: keyword.trim(),
        contentType: (contentType as ContentType) || detectContentType(keyword.trim()),
        targetLength,
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

  const toneOptions = [
    '친근하고 정보적인',
    '전문적인',
    '재미있는',
    '솔직한',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 콘텐츠 생성</h1>
        <p className="mt-1 text-muted-foreground">
          AI가 네이버 SEO에 최적화된 블로그 글을 자동으로 생성합니다
        </p>
      </div>

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
                ].map(({ type, label, desc }) => (
                  <Badge
                    key={type || 'auto'}
                    variant={contentType === type ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setContentType(type as ContentType | '')}
                  >
                    {label}
                    {desc && contentType === type && (
                      <span className="ml-1 opacity-60 text-[10px]">({desc})</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

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
                          contentType
                            ? { informational: '정보형', comparison: '비교/추천형', review: '후기/리뷰형', howto: '방법/가이드형', listicle: '리스트형' }[contentType]
                            : '자동 감지: ' + { informational: '정보형', comparison: '비교/추천형', review: '후기/리뷰형', howto: '방법/가이드형', listicle: '리스트형' }[detectContentType(keyword.trim())]
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
                  AI가 글을 작성하고 있습니다...
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
                      <div className="flex items-center gap-3">
                        <Button onClick={handleSave} disabled={saving || !result.contentId}>
                          {saving ? (
                            <><Loader2 className="mr-1 h-4 w-4 animate-spin" />저장 중...</>
                          ) : (
                            <><Save className="mr-1 h-4 w-4" />저장</>
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
