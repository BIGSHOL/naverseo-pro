'use client'

import { useState } from 'react'
import { BarChart3, Loader2, CheckCircle, AlertTriangle, XCircle, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface SeoCategory {
  name: string
  score: number
  maxScore: number
  feedback: string
}

interface SeoResult {
  totalScore: number
  categories: SeoCategory[]
  improvements: string[]
  strengths: string[]
  isDemo: boolean
}

// 통일된 점수 기준: 80+ 우수(녹색), 60+ 양호(녹색), 40+ 보통(노란색), 40 미만 개선 필요(빨간색)
function getScoreColor(score: number, max: number) {
  const pct = (score / max) * 100
  if (pct >= 60) return 'text-green-600'
  if (pct >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBg(score: number) {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function getGradeLabel(score: number) {
  if (score >= 80) return { label: '우수', icon: CheckCircle, color: 'text-green-600' }
  if (score >= 60) return { label: '양호', icon: CheckCircle, color: 'text-green-600' }
  if (score >= 40) return { label: '보통', icon: AlertTriangle, color: 'text-yellow-600' }
  return { label: '개선 필요', icon: XCircle, color: 'text-red-600' }
}

export default function SeoCheckPage() {
  const [keyword, setKeyword] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SeoResult | null>(null)

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
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'SEO 분석에 실패했습니다.')
        return
      }

      setResult(data)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const grade = result ? getGradeLabel(result.totalScore) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SEO 점수 체크</h1>
        <p className="mt-1 text-muted-foreground">
          작성한 콘텐츠의 네이버 SEO 점수를 실시간으로 분석합니다
        </p>
      </div>

      {/* 입력 폼 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">콘텐츠 입력</CardTitle>
        </CardHeader>
        <CardContent>
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
                <span className="text-xs text-muted-foreground">
                  {content.length}자
                </span>
              </div>
              <textarea
                id="content"
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

            <Button type="submit" disabled={loading || !content.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  SEO 분석 중...
                </>
              ) : (
                <>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  SEO 점수 분석하기
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 분석 결과 */}
      {result && grade && (
        <>
          {/* 총점 카드 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-full ${getScoreBg(result.totalScore)}`}>
                    <span className="text-2xl font-bold text-white">{result.totalScore}</span>
                  </div>
                  <div>
                    <div className={`flex items-center gap-1 text-lg font-bold ${grade.color}`}>
                      <grade.icon className="h-5 w-5" />
                      {grade.label}
                    </div>
                    <p className="text-sm text-muted-foreground">100점 만점</p>
                  </div>
                </div>
                {result.isDemo && <Badge variant="outline">데모 분석</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* 카테고리별 점수 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">항목별 분석</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.categories.map((cat) => (
                <div key={cat.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className={`text-sm font-bold ${getScoreColor(cat.score, cat.maxScore)}`}>
                      {cat.score}/{cat.maxScore}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full transition-all ${getScoreBg(cat.score * (100 / cat.maxScore))}`}
                      style={{ width: `${(cat.score / cat.maxScore) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{cat.feedback}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 강점 & 개선사항 */}
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
        </>
      )}
    </div>
  )
}
