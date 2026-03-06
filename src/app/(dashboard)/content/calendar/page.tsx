'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ChevronDown,
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
  Coins,
  Pencil,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { markdownToHtml, htmlForNaverClipboard } from '@/lib/utils/markdown-convert'

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
  keyword: { name: '키워드 검색', icon: Search, color: 'text-purple-700', bgColor: 'bg-purple-100' },
  discovery: { name: '키워드 발굴', icon: Compass, color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  tracking: { name: '순위 트래킹', icon: BarChart3, color: 'text-orange-700', bgColor: 'bg-orange-100' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '작성완료', color: 'bg-blue-100 text-blue-800' },
  published: { label: '복사완료', color: 'bg-green-100 text-green-800' },
  archived: { label: '보관', color: 'bg-gray-100 text-gray-800' },
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

/** 마크다운 → 플레인텍스트 (클립보드 text/plain 용) */
function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')           // 제목 마커 제거
    .replace(/\*\*(.+?)\*\*/g, '$1')       // 볼드 제거
    .replace(/\*(.+?)\*/g, '$1')           // 이탤릭 제거
    .replace(/~~(.+?)~~/g, '$1')           // 취소선 제거
    .replace(/`(.+?)`/g, '$1')             // 인라인 코드 제거
    .replace(/\[이미지[:\s][^\]]*\]/g, '')  // 이미지 마커 제거
    .replace(/\[(.+?)\]\([^)]*\)/g, '$1')  // 링크 → 텍스트만
    .replace(/^[-*]\s+/gm, '• ')           // 리스트 마커 통일
    .replace(/^>\s+/gm, '')                // 인용 제거
    .replace(/---+/g, '')                  // 수평선 제거
    .replace(/\n{3,}/g, '\n\n')            // 과도한 빈줄 정리
    .trim()
}

export default function ContentCalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [contents, setContents] = useState<ContentItem[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [dailyCredits, setDailyCredits] = useState<Record<string, number>>({})
  const [monthlyCreditsSpent, setMonthlyCreditsSpent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewingContent, setViewingContent] = useState<ContentItem | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

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
      setDailyCredits(data.dailyCredits || {})
      setMonthlyCreditsSpent(data.monthlyCreditsSpent || 0)
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

  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey)
    setExpandedGroups(new Set())
    setDialogOpen(true)
  }

  const handleCopy = async (title: string, markdown: string) => {
    try {
      const rawHtml = `<h1>${title}</h1>${markdownToHtml(markdown)}`
      const html = htmlForNaverClipboard(rawHtml)
      const text = `${title}\n\n${markdownToPlainText(markdown)}`

      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ])
      } catch {
        await navigator.clipboard.writeText(text)
      }
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

  // 타입별 아코디언 그룹
  const typeGroups = useMemo(() => {
    const map = new Map<string, Activity[]>()
    const typeOrder = ['content', 'keyword', 'discovery', 'tracking']
    for (const type of typeOrder) map.set(type, [])

    for (const a of selectedActivities) {
      const list = map.get(a.type)
      if (list) list.push(a)
    }

    return typeOrder
      .filter(type => (map.get(type)?.length || 0) > 0)
      .map(type => ({ type, items: map.get(type)! }))
  }, [selectedActivities])

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
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
              <p className="text-sm text-muted-foreground">키워드 검색</p>
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-600" />
              <p className="text-sm text-muted-foreground">크레딧 소모</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-amber-600">{monthlyCreditsSpent.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 캘린더 (전체 너비) */}
      <Card>
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
                const dayCreditsSpent = dailyCredits[dateKey] || 0
                const isToday =
                  year === now.getFullYear() &&
                  month === now.getMonth() &&
                  day === now.getDate()
                const isSelected = selectedDate === dateKey && dialogOpen

                // 날짜 셀에 표시할 활동 타입별 도트
                const typesInDay = Array.from(new Set(dayActivities.map((a) => a.type)))

                return (
                  <div
                    key={day}
                    className={`min-h-[80px] cursor-pointer border-b p-1.5 transition-colors hover:bg-muted/50 ${
                      isSelected ? 'bg-primary/5 ring-1 ring-primary/30' : ''
                    } ${dayActivities.length > 0 ? 'hover:bg-primary/5' : ''}`}
                    onClick={() => handleDateClick(dateKey)}
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
                    {dayCreditsSpent > 0 && (
                      <div className="mt-0.5 flex items-center gap-0.5 px-1">
                        <Coins className="h-2.5 w-2.5 text-amber-500" />
                        <span className="text-[10px] text-amber-600 font-medium">-{dayCreditsSpent}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(ACTIVITY_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${config.bgColor}`} />
            <span>{config.name}</span>
          </div>
        ))}
      </div>

      {/* 날짜 활동 상세 팝업 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDate
                ? `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })} 활동${selectedActivities.length > 0 ? ` (${selectedActivities.length}건)` : ''}`
                : '활동 상세'}
            </DialogTitle>
            <DialogDescription className="sr-only">선택한 날짜의 활동 상세 정보</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
            {selectedActivities.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  이 날짜에 기록된 활동이 없습니다
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {typeGroups.map((group) => {
                  const config = ACTIVITY_CONFIG[group.type]
                  const Icon = config.icon
                  const isExpanded = expandedGroups.has(group.type)

                  return (
                    <div key={group.type} className="rounded-lg border">
                      {/* 그룹 헤더 */}
                      <button
                        className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => toggleGroup(group.type)}
                      >
                        <div className={`rounded p-1 ${config.bgColor}`}>
                          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                        </div>
                        <span className="flex-1 text-sm font-medium">{config.name}</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                          {group.items.length}
                        </Badge>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* 펼쳐진 아이템 목록 */}
                      {isExpanded && (
                        <div className="border-t px-3 pb-2">
                          {group.items.map((a) => (
                            <div key={a.id} className="border-b last:border-b-0 py-2">
                              <div className="flex items-center gap-1.5">
                                <p className="flex-1 truncate text-sm">{a.label}</p>
                                {a.type === 'content' && a.status && STATUS_LABELS[a.status] && (
                                  <Badge
                                    variant="secondary"
                                    className={`h-4 shrink-0 px-1 text-[10px] ${STATUS_LABELS[a.status].color}`}
                                  >
                                    {STATUS_LABELS[a.status].label}
                                  </Badge>
                                )}
                                {a.type === 'content' && a.score !== null && (
                                  <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
                                    SEO {a.score}
                                  </Badge>
                                )}
                                {a.type === 'tracking' && a.status && (
                                  <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
                                    {a.status}
                                  </Badge>
                                )}
                              </div>
                              {a.detail && (a.type === 'content' || a.type === 'tracking') && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {a.detail}
                                </p>
                              )}

                              {/* 콘텐츠 전용 액션 버튼 */}
                              {a.type === 'content' && (
                                <div className="mt-1.5 flex items-center gap-1">
                                  <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs"
                                    onClick={() => { const item = contents.find((c) => c.id === a.id); if (item) { setDialogOpen(false); setViewingContent(item) } }}
                                  >
                                    <Eye className="h-3 w-3" /> 보기
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs"
                                    onClick={() => { const item = contents.find((c) => c.id === a.id); if (item) handleCopy(item.title, item.content) }}
                                  >
                                    <Copy className="h-3 w-3" /> 복사
                                  </Button>
                                  <Link href={`/content?keyword=${encodeURIComponent(a.label)}`}>
                                    <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs">
                                      <Pencil className="h-3 w-3" /> 편집
                                    </Button>
                                  </Link>
                                </div>
                              )}

                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {new Date(a.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                  onClick={() => handleCopy(viewingContent.title, viewingContent.content)}
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
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(viewingContent.content) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
