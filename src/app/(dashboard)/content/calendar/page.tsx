'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Copy,
  Check,
  Eye,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface ContentItem {
  id: string
  target_keyword: string
  title: string
  content: string
  status: 'draft' | 'published' | 'archived'
  seo_score: number | null
  created_at: string
  updated_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '초안', color: 'bg-yellow-100 text-yellow-800' },
  published: { label: '발행', color: 'bg-green-100 text-green-800' },
  archived: { label: '보관', color: 'bg-gray-100 text-gray-800' },
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export default function ContentCalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [contents, setContents] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [viewingContent, setViewingContent] = useState<ContentItem | null>(null)
  const [copied, setCopied] = useState(false)

  const loadContents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/content/list?year=${year}&month=${month + 1}`
      )
      if (!res.ok) return
      const data = await res.json()
      setContents(data.contents || [])
    } catch {
      // 로드 실패
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    loadContents()
  }, [loadContents])

  const handlePrevMonth = () => {
    if (month === 0) {
      setYear(year - 1)
      setMonth(11)
    } else {
      setMonth(month - 1)
    }
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    if (month === 11) {
      setYear(year + 1)
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
    setSelectedDate(null)
  }

  const handleStatusChange = async (contentId: string, newStatus: string) => {
    setUpdating(contentId)
    try {
      const res = await fetch('/api/content/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, status: newStatus }),
      })
      if (res.ok) {
        await loadContents()
      }
    } catch {
      // 업데이트 실패
    } finally {
      setUpdating(null)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 실패 시 무시
    }
  }

  // 날짜별 콘텐츠 그룹핑
  const contentsByDate: Record<string, ContentItem[]> = {}
  for (const c of contents) {
    const d = new Date(c.created_at)
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!contentsByDate[dateKey]) contentsByDate[dateKey] = []
    contentsByDate[dateKey].push(c)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // 선택된 날짜의 콘텐츠
  const selectedContents = selectedDate ? contentsByDate[selectedDate] || [] : []

  // 통계
  const totalContents = contents.length
  const draftCount = contents.filter((c) => c.status === 'draft').length
  const publishedCount = contents.filter((c) => c.status === 'published').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">콘텐츠 캘린더</h1>
          <p className="mt-1 text-muted-foreground">
            생성된 콘텐츠를 날짜별로 확인하고 관리하세요
          </p>
        </div>
        <Link href="/content">
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            새 콘텐츠 생성
          </Button>
        </Link>
      </div>

      {/* 월별 통계 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">이번 달 총 콘텐츠</p>
            <p className="mt-1 text-2xl font-bold">{totalContents}편</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">초안</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{draftCount}편</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">발행됨</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{publishedCount}편</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 캘린더 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-base">
                {year}년 {month + 1}월
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {/* 요일 헤더 */}
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="border-b py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}

                {/* 빈 칸 (이전 달) */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="border-b p-1" />
                ))}

                {/* 날짜 셀 */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayContents = contentsByDate[dateKey] || []
                  const isToday =
                    year === now.getFullYear() &&
                    month === now.getMonth() &&
                    day === now.getDate()
                  const isSelected = selectedDate === dateKey

                  return (
                    <div
                      key={day}
                      className={`min-h-[72px] cursor-pointer border-b p-1 transition-colors hover:bg-muted/50 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedDate(dateKey)}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          isToday
                            ? 'bg-primary font-bold text-primary-foreground'
                            : 'font-medium'
                        }`}
                      >
                        {day}
                      </span>
                      {dayContents.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {dayContents.slice(0, 2).map((c) => (
                            <div
                              key={c.id}
                              className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                                STATUS_LABELS[c.status]?.color || 'bg-gray-100'
                              }`}
                            >
                              {c.target_keyword}
                            </div>
                          ))}
                          {dayContents.length > 2 && (
                            <div className="px-1 text-[10px] text-muted-foreground">
                              +{dayContents.length - 2}개 더
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 선택된 날짜의 콘텐츠 상세 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDate
                ? `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  })} 콘텐츠`
                : '날짜를 선택하세요'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                캘린더에서 날짜를 클릭하면
                <br />
                해당 날짜의 콘텐츠를 볼 수 있어요
              </p>
            ) : selectedContents.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  이 날짜에 생성된 콘텐츠가 없습니다
                </p>
                <Link href="/content">
                  <Button variant="outline" size="sm" className="mt-3">
                    콘텐츠 생성하기
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedContents.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          키워드: {c.target_keyword}
                        </p>
                      </div>
                      {c.seo_score !== null && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          SEO {c.seo_score}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${STATUS_LABELS[c.status]?.color || ''}`}
                      >
                        {STATUS_LABELS[c.status]?.label || c.status}
                      </Badge>

                      {c.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleStatusChange(c.id, 'published')}
                          disabled={updating === c.id}
                        >
                          {updating === c.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            '발행'
                          )}
                        </Button>
                      )}
                      {c.status === 'published' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleStatusChange(c.id, 'archived')}
                          disabled={updating === c.id}
                        >
                          {updating === c.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            '보관'
                          )}
                        </Button>
                      )}
                      {c.status === 'archived' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleStatusChange(c.id, 'draft')}
                          disabled={updating === c.id}
                        >
                          {updating === c.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            '초안으로'
                          )}
                        </Button>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => setViewingContent(c)}
                      >
                        <Eye className="h-3 w-3" />
                        보기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => handleCopy(`${c.title}\n\n${c.content}`)}
                      >
                        <Copy className="h-3 w-3" />
                        복사
                      </Button>
                    </div>

                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      생성
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 콘텐츠 본문 보기 모달 */}
      {viewingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold">{viewingContent.title}</h3>
                <p className="text-xs text-muted-foreground">
                  키워드: {viewingContent.target_keyword}
                  {viewingContent.seo_score !== null && ` · SEO ${viewingContent.seo_score}점`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => handleCopy(`${viewingContent.title}\n\n${viewingContent.content}`)}
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? '복사됨' : '전체 복사'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewingContent(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(80vh - 80px)' }}>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {viewingContent.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
