'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
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
  Sparkles,
} from 'lucide-react'
import { PlanGateAlert } from '@/components/plan-gate-alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ensureUrl } from '@/lib/utils/text'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { timeAgo } from '@/lib/utils/date'
import { CreditTooltip } from '@/components/credit-tooltip'
import { useToast } from '@/hooks/use-toast'
import { creditToast } from '@/lib/credit-toast'

const RankHistoryChart = dynamic(
  () => import('@/components/charts/rank-history-chart').then(mod => ({ default: mod.RankHistoryChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] flex items-center justify-center bg-muted/30 rounded-lg">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
)

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
  const { toast } = useToast()
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newBlogId, setNewBlogId] = useState('')
  const newBlogUrl = newBlogId.trim() ? `https://blog.naver.com/${newBlogId.trim()}` : ''
  const [error, setError] = useState('')
  const [planGateMessage, setPlanGateMessage] = useState('')
  const [isDemo, setIsDemo] = useState(false)
  const [bulkChecking, setBulkChecking] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState('')

  async function loadTracking() {
    try {
      const res = await fetch('/api/tracking')
      if (!res.ok) return
      const data = await res.json()
      setKeywords(data.keywords || [])
      setAiAnalysis(data.aiAnalysis || '')
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
    if (!newKeyword.trim() || !newBlogId.trim()) {
      setError('키워드와 블로그 URL을 모두 입력해주세요.')
      return
    }

    setAdding(true)
    setError('')
    setPlanGateMessage('')

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
        if (data.planGate) {
          setPlanGateMessage(data.error)
        } else {
          setError(data.error || '등록에 실패했습니다.')
        }
        return
      }

      if (data.isDemo) setIsDemo(true)

      setNewKeyword('')
      setNewBlogId('')
      setShowAddForm(false)
      await loadTracking()
      creditToast('tracking_per_keyword')
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
      } else {
        const data = await res.json()
        if (data.cooldown) {
          toast({ title: '쿨다운 중', description: data.error })
        }
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

  // 전체 새로고침
  async function handleBulkCheck() {
    if (keywords.length === 0 || bulkChecking) return
    setBulkChecking(true)

    let skippedCount = 0
    for (const kw of keywords) {
      try {
        const res = await fetch('/api/tracking/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw.keyword, blogUrl: kw.blog_url }),
        })
        if (res.status === 429) skippedCount++
      } catch {
        // 개별 실패 무시
      }
    }

    await loadTracking()
    setBulkChecking(false)

    const checkedCount = keywords.length - skippedCount
    if (checkedCount > 0) {
      creditToast('tracking_per_keyword', checkedCount)
    }

    if (skippedCount > 0) {
      toast({
        title: '일부 키워드 건너뜀',
        description: `${skippedCount}개 키워드가 쿨다운 중이어서 건너뛰었습니다. (1시간 간격)`,
      })
    }
  }

  // 최고 순위 계산
  function getBestRank(history: TrackingHistory[]): number | null {
    const ranks = history
      .map(h => h.rank_position)
      .filter((r): r is number => r !== null)
    return ranks.length > 0 ? Math.min(...ranks) : null
  }

  // 섹션 라벨
  function getSectionLabel(section: string | null): string {
    if (!section) return ''
    const labels: Record<string, string> = {
      blog: '블로그탭',
      smartblock: '스마트블록',
      view: 'VIEW탭',
    }
    return labels[section] || section
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">순위 트래킹</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            타겟 키워드의 네이버 블로그 검색 순위를 추적합니다
            <span className="ml-1 text-xs text-muted-foreground/70">
              (광고 제외 기준, 실제 검색 결과와 1~2위 차이가 있을 수 있습니다)
            </span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {keywords.length > 0 && (
            <CreditTooltip feature="tracking_per_keyword">
              <Button
                variant="outline"
                onClick={handleBulkCheck}
                disabled={bulkChecking}
                className="gap-2"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${bulkChecking ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{bulkChecking ? '확인 중...' : '전체 새로고침 (1크레딧/키워드)'}</span>
                <span className="sm:hidden">{bulkChecking ? '확인 중' : '새로고침'}</span>
              </Button>
            </CreditTooltip>
          )}
          <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            키워드 추가
          </Button>
        </div>
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
              <Input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="예: 네이버 블로그 SEO"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">블로그 아이디</label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground whitespace-nowrap">
                  https://blog.naver.com/
                </span>
                <Input
                  type="text"
                  className="rounded-l-none"
                  value={newBlogId}
                  onChange={(e) => {
                    let val = e.target.value
                    if (val.includes('blog.naver.com/')) {
                      val = val.replace(/^https?:\/\/blog\.naver\.com\//, '').split(/[?/#]/)[0]
                    }
                    setNewBlogId(val)
                  }}
                  placeholder="myblog"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                네이버 블로그 아이디를 입력해주세요
              </p>
            </div>
            {planGateMessage && (
              <PlanGateAlert message={planGateMessage} />
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
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
                    등록 및 순위 확인 (1크레딧)
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">트래킹 키워드</p>
                <p className="mt-1 text-2xl font-bold">{totalKeywords}개</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent><p>현재 순위를 추적 중인 키워드 수입니다</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
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
          </TooltipTrigger>
          <TooltipContent><p>네이버 검색 100위 이내에 노출되는 키워드 수입니다</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">TOP 10</p>
                <p className="mt-1 text-2xl font-bold text-blue-600">{top10Count}개</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent><p>네이버 검색 1페이지(10위 이내)에 노출되는 키워드 수입니다</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">평균 순위</p>
                <p className="mt-1 text-2xl font-bold">
                  {avgRank !== null ? `${avgRank}위` : '-'}
                </p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent><p>순위권에 있는 키워드들의 평균 검색 순위입니다</p></TooltipContent>
        </Tooltip>
      </div>

      {/* AI 트래킹 분석 카드 (Starter+) */}
      {aiAnalysis && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="flex items-start gap-3 py-3 px-4">
            <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
            <p className="text-sm text-purple-900">{aiAnalysis}</p>
          </CardContent>
        </Card>
      )}

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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-medium text-muted-foreground cursor-help">
                                100+위
                              </span>
                            </TooltipTrigger>
                            <TooltipContent><p>검색 결과 100위 이내에 노출되지 않습니다</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {/* 변동 */}
                      <div className="flex items-center gap-1">
                        {rankChange.direction === 'up' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-700">
                                <TrendingUp className="h-3 w-3" />
                                {rankChange.change !== null ? `${rankChange.change}↑` : '진입'}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>이전 확인 대비 순위가 올라갔습니다</p></TooltipContent>
                          </Tooltip>
                        )}
                        {rankChange.direction === 'down' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
                                <TrendingDown className="h-3 w-3" />
                                {rankChange.change !== null ? `${rankChange.change}↓` : '이탈'}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>이전 확인 대비 순위가 내려갔습니다</p></TooltipContent>
                          </Tooltip>
                        )}
                        {rankChange.direction === 'same' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1">
                                <Minus className="h-3 w-3" />
                                유지
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>이전 확인과 동일한 순위입니다</p></TooltipContent>
                          </Tooltip>
                        )}
                        {rankChange.direction === 'new' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-xs">
                                NEW
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>첫 번째 순위 확인 결과입니다</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* 키워드 정보 */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{kw.keyword}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <a
                          href={ensureUrl(kw.blog_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
                        >
                          {kw.blog_url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>마지막 확인: {timeAgo(kw.latest.checked_at)}</span>
                        {kw.history.length > 1 && <span>· {kw.history.length}회 기록</span>}
                        {kw.latest.section && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {getSectionLabel(kw.latest.section)}
                          </Badge>
                        )}
                        {(() => {
                          const best = getBestRank(kw.history)
                          return best !== null && kw.history.length > 1 ? (
                            <span className="text-green-600">최고 {best}위</span>
                          ) : null
                        })()}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex shrink-0 gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent><p>이 키워드의 최신 순위를 다시 확인합니다</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(kw.keyword, kw.blog_url)}
                            disabled={isDeleting}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>이 키워드의 순위 추적을 중단합니다</p></TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* 순위 히스토리 차트 */}
                  {kw.history.length > 1 && (
                    <div className="mt-3 border-t pt-3">
                      <RankHistoryChart history={kw.history} keyword={kw.keyword} />
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
