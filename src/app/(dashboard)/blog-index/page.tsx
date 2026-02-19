'use client'

import { useState } from 'react'
import {
  Activity,
  Loader2,
  TrendingUp,
  Target,
  Award,
  AlertCircle,
  CheckCircle,
  Minus,
  FileText,
  Clock,
  Zap,
  BookOpen,
  Star,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

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

interface BlogIndexResult {
  blogUrl: string
  blogId: string | null
  totalScore: number
  level: string
  levelDescription: string
  categories: AnalysisCategory[]
  keywordResults: KeywordRankResult[]
  postAnalysis: {
    totalFound: number
    avgTitleLength: number
    avgDescLength: number
    topicKeywords: string[]
    postingFrequency: string
    recentPostDays: number | null
  }
  recommendations: string[]
  isDemo: boolean
  checkedAt: string
}

function getLevelColor(level: string) {
  switch (level) {
    case '최적화':
      return 'text-green-600 bg-green-100'
    case '우수':
      return 'text-blue-600 bg-blue-100'
    case '양호':
      return 'text-cyan-600 bg-cyan-100'
    case '보통':
      return 'text-yellow-600 bg-yellow-100'
    case '성장 중':
      return 'text-orange-600 bg-orange-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

function getScoreColor(score: number) {
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-blue-500'
  if (score >= 30) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getGradeColor(grade: string) {
  switch (grade) {
    case 'S':
      return 'text-green-600 bg-green-100'
    case 'A':
      return 'text-blue-600 bg-blue-100'
    case 'B':
      return 'text-cyan-600 bg-cyan-100'
    case 'C':
      return 'text-yellow-600 bg-yellow-100'
    case 'D':
      return 'text-orange-600 bg-orange-100'
    default:
      return 'text-red-600 bg-red-100'
  }
}

function getCategoryIcon(name: string) {
  switch (name) {
    case '검색 파워':
      return <Zap className="h-4 w-4" />
    case '콘텐츠 품질':
      return <FileText className="h-4 w-4" />
    case '주제 전문성':
      return <BookOpen className="h-4 w-4" />
    case '활동성':
      return <Clock className="h-4 w-4" />
    case '영향력':
      return <Star className="h-4 w-4" />
    default:
      return <Activity className="h-4 w-4" />
  }
}

function getRankBadge(rank: number | null) {
  if (rank === null) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        100+
      </span>
    )
  }
  if (rank <= 10) {
    return (
      <span className="flex items-center gap-1 font-bold text-green-600">
        <CheckCircle className="h-3 w-3" />
        {rank}위
      </span>
    )
  }
  if (rank <= 30) {
    return <span className="font-medium text-blue-600">{rank}위</span>
  }
  if (rank <= 50) {
    return <span className="font-medium text-yellow-600">{rank}위</span>
  }
  return <span className="text-muted-foreground">{rank}위</span>
}

export default function BlogIndexPage() {
  const [blogUrl, setBlogUrl] = useState('')
  const [testKeywords, setTestKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BlogIndexResult | null>(null)

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blogUrl.trim() || loading) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const keywords = testKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)

      const res = await fetch('/api/blog-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogUrl: blogUrl.trim(),
          testKeywords: keywords.length > 0 ? keywords : undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '블로그 지수 측정에 실패했습니다.')
        return
      }

      setResult(data)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">블로그 지수 측정</h1>
        <p className="mt-1 text-muted-foreground">
          5대 분석 축으로 블로그의 네이버 검색 노출 파워를 정밀 측정합니다
        </p>
      </div>

      {/* 입력 폼 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">블로그 정보 입력</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheck} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="blogUrl">블로그 URL *</Label>
              <Input
                id="blogUrl"
                placeholder="https://blog.naver.com/myblog"
                value={blogUrl}
                onChange={(e) => setBlogUrl(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                네이버 블로그 주소를 입력하세요
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">테스트 키워드 (선택)</Label>
              <Input
                id="keywords"
                placeholder="쉼표로 구분 (예: 맛집 추천, 여행 후기, 다이어트)"
                value={testKeywords}
                onChange={(e) => setTestKeywords(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                비워두면 기본 키워드 5개로 테스트합니다. 블로그 주제와 관련된
                키워드를 입력하면 더 정확한 결과를 얻을 수 있습니다.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !blogUrl.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  블로그 지수 측정 중... (5대 분석 축을 확인하고 있습니다)
                </>
              ) : (
                <>
                  <Activity className="mr-2 h-4 w-4" />
                  블로그 지수 측정하기
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 측정 결과 */}
      {result && (
        <>
          {/* 종합 점수 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-24 w-24 items-center justify-center rounded-full ${getScoreColor(result.totalScore)}`}
                  >
                    <div className="text-center">
                      <span className="text-3xl font-bold text-white">
                        {result.totalScore}
                      </span>
                      <p className="text-xs text-white/80">/ 100</p>
                    </div>
                  </div>
                  <div>
                    <Badge className={`text-sm ${getLevelColor(result.level)}`}>
                      {result.level}
                    </Badge>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {result.levelDescription}
                    </p>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-sm font-medium">{result.blogUrl}</p>
                  {result.blogId && (
                    <p className="text-xs text-muted-foreground">
                      블로그 ID: {result.blogId}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(result.checkedAt).toLocaleString('ko-KR')} 측정
                  </p>
                  {result.isDemo && (
                    <Badge variant="outline" className="mt-1">
                      데모 결과
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5대 분석 축 */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">5대 분석 축</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {result.categories.map((cat) => {
                const pct = Math.round((cat.score / cat.maxScore) * 100)
                return (
                  <Card key={cat.name}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(cat.name)}
                          <p className="text-sm font-medium">{cat.name}</p>
                        </div>
                        <Badge className={`text-xs ${getGradeColor(cat.grade)}`}>
                          {cat.grade}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-end justify-between">
                          <span className="text-2xl font-bold">{cat.score}</span>
                          <span className="text-xs text-muted-foreground">
                            / {cat.maxScore}점
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct >= 70
                                ? 'bg-green-500'
                                : pct >= 40
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* 분석 상세 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">분석 상세</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.categories.map((cat) => (
                  <div key={cat.name} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {getCategoryIcon(cat.name)}
                      <h3 className="font-medium">{cat.name}</h3>
                      <Badge className={`ml-auto text-xs ${getGradeColor(cat.grade)}`}>
                        {cat.score}/{cat.maxScore}
                      </Badge>
                    </div>
                    <ul className="space-y-1">
                      {cat.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 포스트 분석 요약 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-muted-foreground">분석 포스트</p>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {result.postAnalysis.totalFound}개
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-muted-foreground">평균 제목 길이</p>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {result.postAnalysis.avgTitleLength}자
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <p className="text-sm text-muted-foreground">포스팅 빈도</p>
                </div>
                <p className="mt-1 text-lg font-bold">
                  {result.postAnalysis.postingFrequency}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <p className="text-sm text-muted-foreground">최근 포스팅</p>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {result.postAnalysis.recentPostDays !== null
                    ? `${result.postAnalysis.recentPostDays}일 전`
                    : '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 주제 키워드 */}
          {result.postAnalysis.topicKeywords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">블로그 주제 키워드</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.postAnalysis.topicKeywords.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="text-sm">
                      {kw}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  블로그 포스트에서 자주 등장하는 키워드입니다. 하나의 주제에 집중하면 C-Rank가 향상됩니다.
                </p>
              </CardContent>
            </Card>
          )}

          {/* 키워드별 순위 결과 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4" />
                키워드별 순위 결과
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">키워드</th>
                      <th className="pb-2 font-medium">순위</th>
                      <th className="pb-2 font-medium">총 검색결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.keywordResults.map((kr, i) => (
                      <tr
                        key={kr.keyword}
                        className="border-b last:border-0"
                      >
                        <td className="py-2.5 text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="py-2.5 font-medium">{kr.keyword}</td>
                        <td className="py-2.5">{getRankBadge(kr.rank)}</td>
                        <td className="py-2.5 text-muted-foreground">
                          {kr.totalResults.toLocaleString()}건
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 개선 추천 */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">맞춤 개선 추천</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </div>
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* C-Rank / D.I.A 가이드 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">네이버 알고리즘 가이드</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    C-Rank 높이기
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>- 한 가지 주제에 집중하여 전문성 확보</li>
                    <li>- 1,500~2,000자 이상의 깊이 있는 글 작성</li>
                    <li>- 꾸준한 발행 주기 유지 (주 3회 이상)</li>
                    <li>- 이웃과의 적극적 소통</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    D.I.A 높이기
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>- 체류 시간을 늘리는 양질의 콘텐츠</li>
                    <li>- 공유를 유도하는 실용적 정보 제공</li>
                    <li>- 원본 이미지와 멀티미디어 활용</li>
                    <li>- 검색 의도에 맞는 정확한 정보 전달</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
