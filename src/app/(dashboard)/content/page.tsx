'use client'

import { useState } from 'react'
import { Wand2, Loader2, Copy, Check, Tag, CalendarDays, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default function ContentPage() {
  const [keyword, setKeyword] = useState('')
  const [tone, setTone] = useState('친근하고 정보적인')
  const [additionalKeywords, setAdditionalKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    title: string
    content: string
    tags: string[]
    isDemo: boolean
    contentId?: string
    seoScore?: number
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim() || loading) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          tone,
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

  const handleCopy = async () => {
    if (!result) return
    const text = `${result.title}\n\n${result.content}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toneOptions = [
    '친근하고 정보적인',
    '전문적이고 신뢰감 있는',
    '캐주얼하고 유머러스한',
    '간결하고 실용적인',
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
              {result.seoScore !== undefined && (
                <Badge variant="outline" className="border-green-300 text-green-700">
                  SEO 점수: {result.seoScore}점
                </Badge>
              )}
            </div>
            <Link href="/content/calendar">
              <Button variant="outline" size="sm" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100">
                <CalendarDays className="h-4 w-4" />
                콘텐츠 캘린더에서 보기
              </Button>
            </Link>
          </div>

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
        </>
      )}
    </div>
  )
}
