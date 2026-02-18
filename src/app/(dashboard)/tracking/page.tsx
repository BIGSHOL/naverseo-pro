'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
  Search,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface TrackingHistory {
  id: string
  rank_position: number | null
  section: string | null
  checked_at: string
}

interface TrackedKeyword {
  keyword: string
  blog_url: string
  latest: {
    rank_position: number | null
    section: string | null
    checked_at: string
  }
  history: TrackingHistory[]
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

function getRankChange(history: TrackingHistory[]): {
  change: number | null
  direction: 'up' | 'down' | 'same' | 'new'
} {
  if (history.length < 2) return { change: null, direction: 'new' }

  const current = history[0].rank_position
  const previous = history[1].rank_position

  if (current === null && previous === null) return { change: null, direction: 'same' }
  if (current === null) return { change: null, direction: 'down' } // 순위권 밖으로
  if (previous === null) return { change: null, direction: 'up' } // 순위권 진입

  const diff = previous - current // 양수면 순위 상승 (숫자가 작을수록 좋음)
  if (diff > 0) return { change: diff, direction: 'up' }
  if (diff < 0) return { change: Math.abs(diff), direction: 'down' }
  return { change: 0, direction: 'same' }
}

export default function TrackingPage() {
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newBlogUrl, setNewBlogUrl] = useState('')
  const [error, setError] = useState('')
  const [isDemo, setIsDemo] = useState(false)

  async function loadTracking() {
    try {
      const res = await fetch('/api/tracking')
      if (!res.ok) return
      const data = await res.json()
      setKeywords(data.keywords || [])
    } catch {
      // 로드 실패 시 무시
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTracking()
  }, [])

  async function handleAdd() {
    if (!newKeyword.trim() || !newBlogUrl.trim()) {
      setError('키워드와 블로그 URL을 모두 입력해주세요.')
      return
    }

    setAdding(true)
    setError('')

    try {
      const res = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          blogUrl: newBlogUrl.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '등록에 실패했습니다.')
        return
      }

      if (data.isDemo) setIsDemo(true)

      setNewKeyword('')
      setNewBlogUrl('')
      setShowAddForm(false)
      await loadTracking()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setAdding(false)
    }
  }

  async function handleCheck(keyword: string, blogUrl: string) {
    const key = `${keyword}||${blogUrl}`
    setChecking(key)

    try {
      const res = await fetch('/api/tracking/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, blogUrl }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.isDemo) setIsDemo(true)
        await loadTracking()
      }
    } catch {
      // 체크 실패 시 무시
    } finally {
      setChecking(null)
    }
  }

  async function handleDelete(keyword: string, blogUrl: string) {
    const key = `${keyword}||${blogUrl}`
    setDeleting(key)

    try {
      const res = await fetch('/api/tracking/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, blogUrl }),
      })

      if (res.ok) {
        await loadTracking()
      }
    } catch {
      // 삭제 실패 시 무시
    } finally {
      setDeleting(null)
    }
  }

  // 통계 계산
  const totalKeywords = keywords.length
  const inRankCount = keywords.filter((k) => k.latest.rank_position !== null).length
  const top10Count = keywords.filter(
    (k) => k.latest.rank_position !== null && k.latest.rank_position <= 10
  ).length
  const avgRank =
    inRankCount > 0
      ? Math.round(
          keywords
            .filter((k) => k.latest.rank_position !== null)
            .reduce((sum, k) => sum + (k.latest.rank_position || 0), 0) / inRankCount
        )
      : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">순위 트래킹</h1>
          <p className="mt-1 text-muted-foreground">
            타겟 키워드의 네이버 블로그 검색 순위를 추적합니다
            <span className="ml-1 text-xs text-muted-foreground/70">
              (광고 제외 기준, 실제 검색 결과와 1~2위 차이가 있을 수 있습니다)
            </span>
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          키워드 추가
        </Button>
      </div>

      {isDemo && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          데모 데이터입니다. 실제 순위는 네이버 검색 API 키 설정 후 확인 가능합니다.
        </div>
      )}

      {/* 키워드 추가 폼 */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">새 키워드 트래킹 등록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">타겟 키워드</label>
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="예: 네이버 블로그 SEO"
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">블로그 URL</label>
              <input
                type="text"
                value={newBlogUrl}
                onChange={(e) => setNewBlogUrl(e.target.value)}
                placeholder="예: https://blog.naver.com/myblog"
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                네이버 블로그 주소를 입력해주세요 (blog.naver.com/아이디)
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={adding}>
                {adding ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    확인 중...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    등록 및 순위 확인
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  setError('')
                }}
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">트래킹 키워드</p>
            <p className="mt-1 text-2xl font-bold">{totalKeywords}개</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">순위권 진입</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {inRankCount}개
              {totalKeywords > 0 && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {totalKeywords}
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">TOP 10</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{top10Count}개</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">평균 순위</p>
            <p className="mt-1 text-2xl font-bold">
              {avgRank !== null ? `${avgRank}위` : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 키워드 목록 */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">로딩 중...</span>
          </CardContent>
        </Card>
      ) : keywords.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-orange-100 p-4">
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">아직 트래킹 중인 키워드가 없어요</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              &ldquo;키워드 추가&rdquo; 버튼을 눌러 순위 추적을 시작하세요
            </p>
            <Button
              className="mt-4"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              첫 키워드 등록하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keywords.map((kw) => {
            const key = `${kw.keyword}||${kw.blog_url}`
            const rankChange = getRankChange(kw.history)
            const isChecking = checking === key
            const isDeleting = deleting === key

            return (
              <Card key={key}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* 순위 표시 */}
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="flex h-14 min-w-14 items-center justify-center rounded-lg bg-muted px-3">
                        {kw.latest.rank_position !== null ? (
                          <span className="text-xl font-bold">
                            {kw.latest.rank_position}
                            <span className="text-sm font-normal text-muted-foreground">위</span>
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground">
                            100+위
                          </span>
                        )}
                      </div>

                      {/* 변동 */}
                      <div className="flex items-center gap-1">
                        {rankChange.direction === 'up' && (
                          <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-700">
                            <TrendingUp className="h-3 w-3" />
                            {rankChange.change !== null ? `${rankChange.change}↑` : '진입'}
                          </Badge>
                        )}
                        {rankChange.direction === 'down' && (
                          <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
                            <TrendingDown className="h-3 w-3" />
                            {rankChange.change !== null ? `${rankChange.change}↓` : '이탈'}
                          </Badge>
                        )}
                        {rankChange.direction === 'same' && (
                          <Badge variant="outline" className="gap-1">
                            <Minus className="h-3 w-3" />
                            유지
                          </Badge>
                        )}
                        {rankChange.direction === 'new' && (
                          <Badge variant="secondary" className="text-xs">
                            NEW
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 키워드 정보 */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{kw.keyword}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <a
                          href={kw.blog_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
                        >
                          {kw.blog_url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        마지막 확인: {timeAgo(kw.latest.checked_at)}
                        {kw.history.length > 1 && ` · ${kw.history.length}회 기록`}
                      </p>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCheck(kw.keyword, kw.blog_url)}
                        disabled={isChecking}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`}
                        />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(kw.keyword, kw.blog_url)}
                        disabled={isDeleting}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 순위 히스토리 (최근 7개) */}
                  {kw.history.length > 1 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        최근 순위 변동
                      </p>
                      <div className="flex gap-2 overflow-x-auto">
                        {kw.history.slice(0, 7).map((h) => (
                          <div
                            key={h.id}
                            className="flex shrink-0 flex-col items-center rounded-md border px-3 py-1.5"
                          >
                            <span className="text-sm font-semibold">
                              {h.rank_position !== null ? `${h.rank_position}위` : '100+'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(h.checked_at).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
