'use client'

import { useState } from 'react'
import {
  FileSearch,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  AlertCircle,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreditTooltip } from '@/components/credit-tooltip'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ensureUrl } from '@/lib/utils/text'

interface PostCheckResult {
  title: string
  link: string
  indexed: boolean
  totalResults?: number
  error?: string
  checkedAt: string
}

interface PostCheckResponse {
  blogUrl: string
  blogId: string
  blogName: string
  totalPosts: number
  indexedCount: number
  missingCount: number
  results: PostCheckResult[]
  isDemo: boolean
}

export default function PostCheckPage() {
  const [blogUrl, setBlogUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PostCheckResponse | null>(null)
  const [error, setError] = useState('')

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blogUrl.trim()) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/post-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogUrl: blogUrl.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '조회 중 오류가 발생했습니다.')
        return
      }

      setResult(data)
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const missingPosts = result?.results.filter(r => !r.indexed) || []
  const indexedPosts = result?.results.filter(r => r.indexed) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">검색 누락 조회</h1>
        <p className="mt-1 text-muted-foreground">
          내 블로그 포스트가 네이버 검색에 정상적으로 색인되어 있는지 확인합니다
        </p>
      </div>

      {/* 입력 폼 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">블로그 URL 입력</CardTitle>
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
                네이버 블로그 주소를 입력하면 최근 포스트 최대 30개의 검색 색인 상태를 확인합니다
              </p>
            </div>
            <CreditTooltip feature="post_check">
              <Button type="submit" disabled={loading || !blogUrl.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    조회 중... (포스트당 약 0.2초)
                  </>
                ) : (
                  <>
                    <FileSearch className="mr-2 h-4 w-4" />
                    누락 조회 시작
                  </>
                )}
              </Button>
            </CreditTooltip>
          </form>
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          {/* 요약 통계 */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <FileSearch className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold">{result.totalPosts}</p>
                  <p className="text-sm text-muted-foreground">총 포스트</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="text-2xl font-bold text-green-600">{result.indexedCount}</p>
                  <p className="text-sm text-muted-foreground">정상 색인</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                  <p className="text-2xl font-bold text-red-600">{result.missingCount}</p>
                  <p className="text-sm text-muted-foreground">누락 포스트</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 데모 배지 */}
          {result.isDemo && (
            <div className="flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1 cursor-help">
                    <Info className="h-3 w-3" />
                    데모 데이터
                  </Badge>
                </TooltipTrigger>
                <TooltipContent><p>API 키 미설정 시 표시되는 예시 데이터입니다</p></TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* 블로그 정보 */}
          <div className="text-sm text-muted-foreground">
            블로그: <strong>{result.blogName}</strong> ({result.blogId})
          </div>

          {/* 누락 포스트 (우선 표시) */}
          {missingPosts.length > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                  누락된 포스트 ({missingPosts.length}개)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  네이버 검색에서 찾을 수 없는 포스트입니다. 제목을 수정하거나 재발행을 고려해보세요.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {missingPosts.map((post, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-red-100 dark:border-red-900 p-3 bg-red-50/50 dark:bg-red-950/20"
                    >
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{post.title}</p>
                        {post.error && (
                          <p className="text-xs text-muted-foreground">{post.error}</p>
                        )}
                      </div>
                      <a
                        href={ensureUrl(post.link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" />
                          원문
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 누락 없을 때 */}
          {missingPosts.length === 0 && (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="text-center py-4">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-lg font-semibold text-green-600">모든 포스트가 정상 색인되어 있습니다!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    검색 누락 없이 잘 관리되고 있는 블로그입니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 정상 색인 포스트 */}
          {indexedPosts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  정상 색인 ({indexedPosts.length}개)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {indexedPosts.map((post, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      <p className="text-sm flex-1 min-w-0 truncate">{post.title}</p>
                      <Badge variant="outline" className="text-xs shrink-0">색인됨</Badge>
                      <a
                        href={ensureUrl(post.link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
