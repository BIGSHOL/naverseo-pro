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
  Search,
  Compass,
  BarChart3,
  PenTool,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// 콘텐츠 아이템 (본문 보기용)
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

// 통합 활동 아이템
interface Activity {
  id: string
  type: 'content' | 'keyword' | 'discovery' | 'tracking'
  label: string
  detail: string | null
  status: string | null
  score: number | null
  created_at: string
}

const ACTIVITY_CONFIG: Record<string, { name: string; icon: typeof FileText; color: string; bgColor: string }> = {
  content: { name: '콘텐츠', icon: PenTool, color: 'text-blue-700', bgColor: 'bg-blue-100' },
  keyword: { name: '키워드 리서치', icon: Search, color: 'text-purple-700', bgColor: 'bg-purple-100' },
  discovery: { name: '키워드 발굴', icon: Compass, color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  tracking: { name: '순위 트래킹', icon: BarChart3, color: 'text-orange-700', bgColor: 'bg-orange-100' },
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
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [viewingContent, setViewingContent] = useState<ContentItem | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/content/list?year=${year}&month=${month + 1}&activities=true`
      )
      if (!res.ok) {
        setError('캘린더 데이터를 불러오지 못했습니다.')
        return
      }
      const data = await res.json()
      setContents(data.contents || [])
      setActivities(data.activities || [])
    } catch {
      setError('캘린더 데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    loadData()
  }, [loadData])

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
        await loadData()
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

  // 날짜별 활동 그룹핑
  const activitiesByDate: Record<string, Activity[]> = {}
  for (const a of activities) {
    const d = new Date(a.created_at)
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!activitiesByDate[dateKey]) activitiesByDate[dateKey] = []
    activitiesByDate[dateKey].push(a)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // 선택된 날짜의 활동
  const selectedActivities = selectedDate ? activitiesByDate[selectedDate] || [] : []

  // 통계
  const contentCount = activities.filter((a) => a.type === 'content').length
  const keywordCount = activities.filter((a) => a.type === 'keyword').length
  const discoveryCount = activities.filter((a) => a.type === 'discovery').length
  const trackingCount = activities.filter((a) => a.type === 'tracking').length
  const activeDays = Object.keys(activitiesByDate).length
  const totalActivities = activities.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">활동 캘린더</h1>
          <p className="mt-1 text-muted-foreground">
            모든 SEO 활동을 날짜별로 확인하세요
          </p>
        </div>
        <Link href="/content">
          <Button variant="outline" size="sm" className="gap-2">
            <PenTool className="h-4 w-4" />
            새 콘텐츠 생성
          </Button>
        </Link>
      </div>

      {/* 월별 통계 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">총 활동</p>
            <p className="mt-1 text-2xl font-bold">{totalActivities}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <PenTool className="h-3.5 w-3.5 text-blue-600" />
              <p className="text-sm text-muted-foreground">콘텐츠</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-blue-600">{contentCount}편</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-purple-600" />
              <p className="text-sm text-muted-foreground">키워드 리서치</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-purple-600">{keywordCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-emerald-600" />
              <p className="text-sm text-muted-foreground">키워드 발굴</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{discoveryCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-orange-600" />
              <p className="text-sm text-muted-foreground">순위 트래킹</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-orange-600">{trackingCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">활동일수</p>
            <p className="mt-1 text-2xl font-bold">
              {activeDays}일
              <span className="ml-1 text-xs font-normal text-muted-foreground">/ {daysInMonth}일</span>
            </p>
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
            {error ? (
              <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
                {error}
              </div>
            ) : loading ? (
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
                  const dayActivities = activitiesByDate[dateKey] || []
                  const isToday =
                    year === now.getFullYear() &&
                    month === now.getMonth() &&
                    day === now.getDate()
                  const isSelected = selectedDate === dateKey

                  // 날짜 셀에 표시할 활동 타입별 도트
                  const typesInDay = Array.from(new Set(dayActivities.map((a) => a.type)))

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
                      {dayActivities.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {/* 활동 타입별 요약 표시 */}
                          {dayActivities.slice(0, 2).map((a) => {
                            const config = ACTIVITY_CONFIG[a.type]
                            return (
                              <div
                                key={a.id}
                                className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${config.bgColor} ${config.color}`}
                              >
                                {a.label}
                              </div>
                            )
                          })}
                          {dayActivities.length > 2 && (
                            <div className="px-1 text-[10px] text-muted-foreground">
                              +{dayActivities.length - 2}개 더
                            </div>
                          )}
                          {/* 활동 타입 도트 */}
                          <div className="flex gap-0.5 px-1">
                            {typesInDay.map((type) => (
                              <div
                                key={type}
                                className={`h-1.5 w-1.5 rounded-full ${ACTIVITY_CONFIG[type]?.bgColor || 'bg-gray-300'}`}
                                style={{ opacity: 0.8 }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 선택된 날짜의 활동 상세 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDate
                ? `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  })} 활동`
                : '날짜를 선택하세요'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                캘린더에서 날짜를 클릭하면
                <br />
                해당 날짜의 활동을 볼 수 있어요
              </p>
            ) : selectedActivities.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  이 날짜에 기록된 활동이 없습니다
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedActivities.map((a) => {
                  const config = ACTIVITY_CONFIG[a.type]
                  const Icon = config.icon

                  return (
                    <div key={`${a.type}-${a.id}`} className="rounded-lg border p-3">
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 rounded p-1 ${config.bgColor}`}>
                          <Icon className={`h-3 w-3 ${config.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-medium ${config.color}`}>
                              {config.name}
                            </span>
                            {a.type === 'content' && a.status && STATUS_LABELS[a.status] && (
                              <Badge
                                variant="secondary"
                                className={`h-4 px-1 text-[10px] ${STATUS_LABELS[a.status].color}`}
                              >
                                {STATUS_LABELS[a.status].label}
                              </Badge>
                            )}
                            {a.type === 'content' && a.score !== null && (
                              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                SEO {a.score}
                              </Badge>
                            )}
                            {a.type === 'tracking' && a.status && (
                              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                {a.status}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-sm font-semibold">{a.label}</p>
                          {a.detail && a.type === 'content' && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {a.detail}
                            </p>
                          )}
                          {a.detail && a.type === 'tracking' && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {a.detail}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 콘텐츠 전용 액션 버튼 */}
                      {a.type === 'content' && (
                        <div className="mt-2 flex items-center gap-1 pl-7">
                          {a.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleStatusChange(a.id, 'published')}
                              disabled={updating === a.id}
                            >
                              {updating === a.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                '발행'
                              )}
                            </Button>
                          )}
                          {a.status === 'published' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleStatusChange(a.id, 'archived')}
                              disabled={updating === a.id}
                            >
                              {updating === a.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                '보관'
                              )}
                            </Button>
                          )}
                          {a.status === 'archived' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleStatusChange(a.id, 'draft')}
                              disabled={updating === a.id}
                            >
                              {updating === a.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                '초안으로'
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 px-2 text-xs"
                            onClick={() => {
                              const item = contents.find((c) => c.id === a.id)
                              if (item) setViewingContent(item)
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            보기
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 px-2 text-xs"
                            onClick={() => {
                              const item = contents.find((c) => c.id === a.id)
                              if (item) handleCopy(`${item.title}\n\n${item.content}`)
                            }}
                          >
                            <Copy className="h-3 w-3" />
                            복사
                          </Button>
                        </div>
                      )}

                      <p className="mt-1.5 pl-7 text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(ACTIVITY_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${config.bgColor}`} />
            <span>{config.name}</span>
          </div>
        ))}
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
