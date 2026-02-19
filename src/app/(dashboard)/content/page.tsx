'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Wand2,
  Loader2,
  Copy,
  Check,
  Tag,
  CalendarDays,
  CheckCircle,
  BarChart3,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBgColor(score: number) {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-yellow-500'
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
  const [contentType, setContentType] = useState('')

  // URL param에서 키워드 프리필
  useEffect(() => {
    const kwParam = searchParams.get('keyword')
    if (kwParam) {
      setKeyword(kwParam)
    }
  }, [searchParams])

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
          additionalKeywords: additionalKeywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
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
          <form onSubmit={handleGenerate} className="space-y-4">
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

          {/* SEO 분석 + 가독성 카드 */}
          {result.seoAnalysis && (
            <div className="grid gap-4 sm:grid-cols-2">
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
                    <span className={`text-3xl font-bold ${getScoreColor(result.seoAnalysis.totalScore)}`}>
                      {result.seoAnalysis.totalScore}
                    </span>
                    <span className="mb-1 text-sm text-muted-foreground">/ 100</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${getScoreBgColor(result.seoAnalysis.totalScore)}`}
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
                      <span className={`text-3xl font-bold ${getScoreColor(result.readabilityAnalysis.score)}`}>
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
                              className={`h-full rounded-full ${getScoreBgColor(pct)}`}
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
            <CardContent className="space-y-6">
              {/* 제목 */}
              <div>
                <Label className="text-xs text-muted-foreground">제목</Label>
                <h2 className="mt-1 text-xl font-bold">{result.title}</h2>
              </div>

              {/* 본문 */}
              <div>
                <Label className="text-xs text-muted-foreground">본문</Label>
                <div className="mt-2 rounded-lg border bg-muted/30 p-4">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {result.content}
                  </div>
                </div>
              </div>

              {/* 태그 */}
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
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                마음에 들지 않으면 다른 스타일로 다시 생성해보세요.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* 같은 설정으로 재생성 */}
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 p-3 text-left"
                  disabled={loading}
                  onClick={() => generateContent()}
                >
                  <span className="text-sm font-medium">같은 설정으로</span>
                  <span className="text-xs text-muted-foreground">새로운 버전 생성</span>
                </Button>

                {/* 다른 톤으로 재생성 */}
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

                {/* 더 길게/짧게 */}
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

              {/* 콘텐츠 유형 변경 */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">콘텐츠 유형 변경</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { type: 'informational', label: '정보형' },
                    { type: 'comparison', label: '비교/추천형' },
                    { type: 'review', label: '후기/리뷰형' },
                    { type: 'howto', label: '방법/가이드형' },
                    { type: 'listicle', label: '리스트형' },
                  ].map(({ type, label }) => (
                    <Badge
                      key={type}
                      variant={contentType === type || result.contentType === type ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (!loading) {
                          setContentType(type)
                          generateContent({ contentType: type })
                        }
                      }}
                    >
                      {label}
                      {result.contentType === type && !contentType && ' (현재)'}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
