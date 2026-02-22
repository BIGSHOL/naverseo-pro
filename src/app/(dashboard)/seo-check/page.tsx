'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3, Loader2, CheckCircle, AlertTriangle, XCircle, ArrowUp, ArrowDown, Link2, ExternalLink, Wand2, Sparkles, Brain, Star, Target, MessageSquare, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { LiveSeoPanel } from '@/components/seo/LiveSeoPanel'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface SeoCategory {
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
  aiAnalysis?: AiAnalysis | null
}

function getCategoryScoreColor(score: number, max: number) {
  const pct = (score / max) * 100
  if (pct >= 60) return 'text-green-600'
  if (pct >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function getOverallScoreBg(score: number) {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function getGradeLabel(score: number) {
  if (score >= 80) return { label: '우수', icon: CheckCircle, color: 'text-green-600', tooltip: 'SEO 최적화가 매우 잘 되어 있습니다' }
  if (score >= 60) return { label: '양호', icon: CheckCircle, color: 'text-green-600', tooltip: 'SEO 기본 요소가 잘 갖춰져 있습니다' }
  if (score >= 40) return { label: '보통', icon: AlertTriangle, color: 'text-yellow-600', tooltip: '일부 SEO 요소의 개선이 필요합니다' }
  return { label: '개선 필요', icon: XCircle, color: 'text-red-600', tooltip: 'SEO 핵심 요소의 보완이 필요합니다' }
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

export default function SeoCheckPage() {
  const searchParams = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SeoResult | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [blogUrl, setBlogUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [fetchSource, setFetchSource] = useState('')

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

    if (storedContent) {
      setContent(storedContent)
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
      setShowUrlInput(false)
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

    try {
      const res = await fetch('/api/ai/seo-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim(), title: title.trim(), content: content.trim() }),
      })

      // 응답이 JSON이 아닐 수 있음 (서버 에러, 타임아웃 등)
      let data
      try {
        data = await res.json()
      } catch {
        setError(`서버 응답 오류 (${res.status}). 잠시 후 다시 시도해주세요.`)
        return
      }

      if (!res.ok) {
        setError(data.error || 'SEO 분석에 실패했습니다.')
        return
      }

      setResult(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('abort') || msg.includes('timeout')) {
        setError('요청 시간이 초과되었습니다. 본문을 줄이거나 다시 시도해주세요.')
      } else {
        setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  const grade = result ? getGradeLabel(result.totalScore) : null
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
              <span>콘텐츠 입력</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs sm:h-8 sm:text-sm"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                  >
                    <Link2 className="mr-1 h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
                    URL로 가져오기
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>네이버 블로그 URL에서 제목과 본문을 자동으로 가져옵니다</p></TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showUrlInput && (
              <div className="mb-4 rounded-md border border-dashed p-4 space-y-3">
                <Label>네이버 블로그 URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://blog.naver.com/blogid/123456789"
                    value={blogUrl}
                    onChange={(e) => setBlogUrl(e.target.value)}
                    disabled={fetchingUrl}
                  />
                  <Button
                    type="button"
                    onClick={handleFetchBlog}
                    disabled={fetchingUrl || !blogUrl.trim()}
                  >
                    {fetchingUrl ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '가져오기'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  네이버 블로그 글 URL을 입력하면 제목과 본문을 자동으로 가져옵니다
                </p>
              </div>
            )}

            {fetchSource && (
              <div className="mb-4 flex items-center gap-2 overflow-hidden">
                <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                  <ExternalLink className="h-3 w-3" />
                  URL에서 가져옴
                </Badge>
                <a
                  href={fetchSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate text-xs text-muted-foreground hover:underline"
                >
                  {fetchSource}
                </a>
              </div>
            )}

            <form onSubmit={handleAnalyze} className="space-y-4">
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
                  <Label htmlFor="content">본문 *</Label>
                  <span className={cn('text-xs font-medium', getCharCountClass(content.length))}>
                    {content.length.toLocaleString()}자
                    {content.length > 0 && content.length < 1500 && ' (최소 1,500자 권장)'}
                    {content.length >= 1500 && content.length <= 3000 && ' (적정)'}
                    {content.length > 3000 && ' (길 수 있음)'}
                  </span>
                </div>
                <textarea
                  id="content"
                  className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="분석할 블로그 글 내용을 붙여넣기 하세요..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading || !content.trim()} className="w-full gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 심층 분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    AI 심층 분석
                  </>
                )}
              </Button>
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

      {/* AI 심층 분석 결과 */}
      {result && grade && (
        <>
          {/* 총점 카드 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`flex h-20 w-20 items-center justify-center rounded-full cursor-help ${getOverallScoreBg(result.totalScore)}`}>
                        <span className="text-2xl font-bold text-white">{result.totalScore}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent><p>100점 만점 기준 네이버 SEO 최적화 점수입니다</p></TooltipContent>
                  </Tooltip>
                  <div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center gap-1 text-lg font-bold cursor-help ${grade.color}`}>
                          <grade.icon className="h-5 w-5" />
                          {grade.label}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent><p>{grade.tooltip}</p></TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">AI 심층 분석 결과</p>
                      {result.isDemo && (
                        <Badge variant="outline" className="text-xs">데모</Badge>
                      )}
                    </div>
                    {/* AI 점수 보정 표시 */}
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

          {/* AI 4축 심층 분석 */}
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
                    <p className="text-xs text-muted-foreground">{ai.experienceDetails}</p>
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
                    <p className="text-xs text-muted-foreground">{ai.contentQualityDetails}</p>
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
                    <p className="text-xs text-muted-foreground">{ai.keywordStrategyDetails}</p>
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
                    <p className="text-xs text-muted-foreground">{ai.engagementDetails}</p>
                  </div>
                </div>

                {/* 종합 피드백 */}
                {ai.overallFeedback && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm">{ai.overallFeedback}</p>
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
                            {s}
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
                            {w}
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
                          {rec}
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
                      className={`h-2 rounded-full transition-all ${getOverallScoreBg(cat.score * (100 / cat.maxScore))}`}
                      style={{ width: `${(cat.score / cat.maxScore) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{cat.feedback}</p>
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
                      {s}
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
                      {imp}
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
