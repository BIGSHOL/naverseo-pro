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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface KeywordRankResult {
  keyword: string
  rank: number | null
  totalResults: number
}

interface BlogIndexResult {
  blogUrl: string
  score: number
  level: string
  details: {
    rankedCount: number
    totalTested: number
    avgRank: number | null
    top10Count: number
    top30Count: number
    top50Count: number
  }
  keywordResults: KeywordRankResult[]
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
          블로그 URL을 입력하면 네이버 검색 노출 파워를 분석합니다
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
                  블로그 지수 측정 중... (키워드별 순위를 확인하고 있습니다)
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
                    className={`flex h-20 w-20 items-center justify-center rounded-full ${getScoreColor(result.score)}`}
                  >
                    <span className="text-2xl font-bold text-white">
                      {result.score}
                    </span>
                  </div>
                  <div>
                    <Badge className={`text-sm ${getLevelColor(result.level)}`}>
                      {result.level}
                    </Badge>
                    <p className="mt-1 text-sm text-muted-foreground">
                      100점 만점
                    </p>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-sm font-medium">{result.blogUrl}</p>
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

          {/* 상세 통계 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-muted-foreground">검색 노출률</p>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {result.details.rankedCount}/{result.details.totalTested}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(
                    (result.details.rankedCount / result.details.totalTested) *
                      100
                  )}
                  % 키워드에서 100위 내 노출
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-muted-foreground">평균 순위</p>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {result.details.avgRank !== null
                    ? `${result.details.avgRank}위`
                    : '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  노출된 키워드 기준
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-muted-foreground">TOP 10</p>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {result.details.top10Count}개
                </p>
                <p className="text-xs text-muted-foreground">
                  상위 10위 내 노출 키워드
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <p className="text-sm text-muted-foreground">TOP 30</p>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {result.details.top30Count}개
                </p>
                <p className="text-xs text-muted-foreground">
                  상위 30위 내 노출 키워드
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 키워드별 순위 결과 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">키워드별 순위 결과</CardTitle>
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

          {/* 개선 가이드 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">블로그 지수 개선 가이드</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {result.score < 30 && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">
                        블로그 기본기를 다져야 합니다
                      </p>
                      <p className="mt-1 text-red-700">
                        하나의 주제에 집중해서 꾸준히 2,000자 이상의 양질의
                        글을 작성하세요. 주 3~4회 포스팅을 권장합니다.
                      </p>
                    </div>
                  </div>
                )}
                {result.score >= 30 && result.score < 55 && (
                  <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-800">
                        꾸준한 콘텐츠 생산이 핵심입니다
                      </p>
                      <p className="mt-1 text-yellow-700">
                        주제 전문성(C-Rank)을 높이기 위해 특정 카테고리에
                        집중하고, 이웃과의 소통을 늘려보세요.
                      </p>
                    </div>
                  </div>
                )}
                {result.score >= 55 && result.score < 70 && (
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-800">
                        좋은 상태입니다! 경쟁 키워드를 공략해보세요
                      </p>
                      <p className="mt-1 text-blue-700">
                        체류 시간을 늘리기 위해 멀티미디어(이미지, 동영상)를
                        활용하고, 독자의 공유를 유도하는 콘텐츠를 작성하세요.
                      </p>
                    </div>
                  </div>
                )}
                {result.score >= 70 && (
                  <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">
                        우수한 블로그입니다!
                      </p>
                      <p className="mt-1 text-green-700">
                        현재 전략을 유지하면서, 경쟁이 높은 키워드도 공략하고
                        콘텐츠의 최신성을 유지하세요.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
