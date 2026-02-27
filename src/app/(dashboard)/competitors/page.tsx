'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Loader2, BarChart3, Clock, Type, Sparkles, ExternalLink, Lightbulb, Target, BookOpen, Wand2, Shield, Hash, CalendarDays, ImageIcon, FileText, MessageCircle, Heart, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KeywordSearch } from '@/components/keywords/keyword-search'
import { PlanGateAlert } from '@/components/plan-gate-alert'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { InlineMarkdown } from '@/components/ui/inline-markdown'
import { ensureUrl } from '@/lib/utils/text'

// === 타입 ===

interface CompetitorItem {
  rank: number
  title: string
  link: string
  description: string
  bloggerName: string
  bloggerLink: string
  postDateFormatted: string
  daysSincePosted: number
  titleLength: number
  hasKeywordInTitle: boolean
  charCount?: number | null
  imageCount?: number | null
  videoCount?: number | null
  commentCount?: number | null
  sympathyCount?: number | null
  readCount?: number | null
}

interface ContentQualityStats {
  avgCharCount: number
  medianCharCount: number
  charCountRange: [number, number]
  avgImageCount: number
  avgVideoCount: number
  avgCommentCount: number | null
  avgSympathyCount: number | null
  avgReadCount: number | null
  scrapedCount: number
}

interface PatternAnalysis {
  titleStats: {
    avgLength: number
    minLength: number
    maxLength: number
    keywordInTitleRate: number
    keywordInTitleCount: number
  }
  dateStats: {
    avgDaysAgo: number
    newestDaysAgo: number
    oldestDaysAgo: number
    within30Days: number
    within90Days: number
    within365Days: number
    older: number
  }
  blogDiversity: {
    uniqueBlogCount: number
    totalResults: number
    diversityRate: number
    repeatedBlogs: { name: string; count: number }[]
  }
  contentQuality?: ContentQualityStats | null
}

interface DifficultyAssessment {
  level: 'easy' | 'medium' | 'hard' | 'very_hard'
  score: number
  reasons: string[]
  breakdown?: {
    competition: number
    quality: number
    engagement: number
    freshness: number
  }
}

interface TitlePatternWord {
  word: string
  count: number
}

interface ImageAnalysis {
  totalImages: number
  imageTypes: string[]
  recommendation: string
}

interface AiInsights {
  summary: string
  topPatterns: string[]
  contentGaps: string[]
  recommendedStrategy: string
  recommendedContentType?: string
  recommendedTone?: string
  relatedKeywords?: string[]
  titleSuggestions: string[]
  imageAnalysis?: ImageAnalysis
}

// === 날짜 표시 헬퍼 ===

function formatDaysAgo(days: number): string {
  if (days === 0) return '오늘'
  if (days <= 7) return `${days}일 전`
  if (days <= 30) return `${Math.floor(days / 7)}주 전`
  if (days <= 365) return `${Math.floor(days / 30)}개월 전`
  return `${Math.floor(days / 365)}년 전`
}

function getDifficultyInfo(level: string) {
  switch (level) {
    case 'easy': return { label: '쉬움', color: 'text-green-600', bg: 'bg-green-100', barColor: 'bg-green-500' }
    case 'medium': return { label: '보통', color: 'text-yellow-600', bg: 'bg-yellow-100', barColor: 'bg-yellow-500' }
    case 'hard': return { label: '어려움', color: 'text-orange-600', bg: 'bg-orange-100', barColor: 'bg-orange-500' }
    case 'very_hard': return { label: '매우 어려움', color: 'text-red-600', bg: 'bg-red-100', barColor: 'bg-red-500' }
    default: return { label: '알 수 없음', color: 'text-gray-600', bg: 'bg-gray-100', barColor: 'bg-gray-500' }
  }
}

function getBarColor(value: number, max: number): string {
  const ratio = value / max
  if (ratio >= 0.7) return 'bg-red-500'
  if (ratio >= 0.4) return 'bg-yellow-500'
  return 'bg-green-500'
}

// === 메인 페이지 ===

export default function CompetitorsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planGateMessage, setPlanGateMessage] = useState('')
  const [searched, setSearched] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [searchedKeyword, setSearchedKeyword] = useState('')

  const [competitors, setCompetitors] = useState<CompetitorItem[]>([])
  const [patterns, setPatterns] = useState<PatternAnalysis | null>(null)
  const [difficulty, setDifficulty] = useState<DifficultyAssessment | null>(null)
  const [titlePatterns, setTitlePatterns] = useState<TitlePatternWord[]>([])

  const [dateFilter, setDateFilter] = useState<'all' | '1m' | '3m' | '6m'>('all')

  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiStreamingText, setAiStreamingText] = useState('')

  // 날짜 필터 적용
  const filteredCompetitors = competitors.filter(comp => {
    if (dateFilter === 'all') return true
    if (dateFilter === '1m') return comp.daysSincePosted <= 30
    if (dateFilter === '3m') return comp.daysSincePosted <= 90
    if (dateFilter === '6m') return comp.daysSincePosted <= 180
    return true
  })

  const handleSearch = async (keyword: string) => {
    setLoading(true)
    setError('')
    setPlanGateMessage('')
    setSearched(true)
    setSearchedKeyword(keyword)
    setDateFilter('all')
    setAiInsights(null)
    setAiError('')

    try {
      const res = await fetch('/api/ai/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, includeAi: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.planGate) {
          setPlanGateMessage(data.error)
        } else {
          setError(data.error || '상위노출 분석에 실패했습니다.')
        }
        return
      }

      setCompetitors(data.competitors)
      setPatterns(data.patterns)
      setDifficulty(data.difficulty || null)
      setTitlePatterns(data.titlePatterns || [])
      setIsDemo(data.isDemo || false)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAiAnalysis = async () => {
    setAiLoading(true)
    setAiError('')
    setAiStreamingText('')
    try {
      const res = await fetch('/api/ai/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchedKeyword, includeAi: true }),
      })

      const contentType = res.headers.get('Content-Type') || ''

      if (contentType.includes('application/x-ndjson') && res.body) {
        // NDJSON 스트리밍 수신
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)
              if (event.type === 'stream') {
                setAiStreamingText(prev => prev + event.delta)
              } else if (event.type === 'ai_result') {
                setAiStreamingText('')
                setAiInsights(event.aiInsights || null)
              } else if (event.type === 'ai_error') {
                setAiStreamingText('')
                setAiError(event.error || 'AI 분석에 실패했습니다.')
              }
            } catch {
              // 파싱 실패 무시
            }
          }
        }
      } else {
        // 일반 JSON 응답 (폴백)
        const data = await res.json()
        if (!res.ok) {
          setAiError(data.error || 'AI 분석에 실패했습니다.')
          return
        }
        setAiInsights(data.aiInsights || null)
      }
    } catch {
      setAiStreamingText('')
      setAiError('AI 분석 중 네트워크 오류가 발생했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  const cq = patterns?.contentQuality

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">상위노출 분석</h1>
        <p className="mt-1 text-muted-foreground">
          키워드 상위 노출 블로그를 분석하여 콘텐츠 전략을 수립하세요
        </p>
      </div>

      {/* 검색 폼 */}
      <Card>
        <CardContent className="pt-6">
          <KeywordSearch onSearch={handleSearch} loading={loading} />
        </CardContent>
      </Card>

      {/* 플랜 제한 안내 */}
      {planGateMessage && (
        <PlanGateAlert message={planGateMessage} />
      )}

      {/* 에러 */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">상위 블로그 분석 중...</span>
          <span className="text-xs text-muted-foreground">콘텐츠 품질 및 독자 반응 데이터를 수집합니다</span>
        </div>
      )}

      {/* 결과 */}
      {!loading && searched && competitors.length > 0 && patterns && (
        <>
          {/* 데모 배지 */}
          {isDemo && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              네이버 API 키가 설정되지 않아 데모 데이터를 표시합니다.
            </div>
          )}

          {/* 경쟁 난이도 */}
          {difficulty && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${getDifficultyInfo(difficulty.level).bg}`}>
                    <Shield className={`h-6 w-6 ${getDifficultyInfo(difficulty.level).color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold">경쟁 진입 난이도</h3>
                      <Badge className={`${getDifficultyInfo(difficulty.level).bg} ${getDifficultyInfo(difficulty.level).color} border-0`}>
                        {getDifficultyInfo(difficulty.level).label}
                      </Badge>
                      <span className="text-sm text-muted-foreground ml-auto">{difficulty.score}점 / 100</span>
                    </div>

                    {/* 4차원 프로그레스바 */}
                    {difficulty.breakdown && (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
                        {([
                          ['경쟁 치열도', difficulty.breakdown.competition],
                          ['콘텐츠 품질 장벽', difficulty.breakdown.quality],
                          ['사용자 반응 장벽', difficulty.breakdown.engagement],
                          ['최신성 경쟁', difficulty.breakdown.freshness],
                        ] as const).map(([label, value]) => (
                          <div key={label}>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
                              <span>{label}</span>
                              <span>{value}/25</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted">
                              <div
                                className={`h-1.5 rounded-full transition-all ${getBarColor(value, 25)}`}
                                style={{ width: `${(value / 25) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <ul className="space-y-1">
                      {difficulty.reasons.map((reason, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 요약 통계 */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">분석 대상</p>
                    <p className="text-xl font-bold">{competitors.length}개</p>
                    {cq && <p className="text-xs text-muted-foreground">{cq.scrapedCount}개 심층</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">본문 깊이</p>
                    <p className="text-xl font-bold">{cq ? `${cq.medianCharCount.toLocaleString()}자` : '-'}</p>
                    <p className="text-xs text-muted-foreground">중앙값</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <ImageIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">평균 이미지</p>
                    <p className="text-xl font-bold">{cq ? `${cq.avgImageCount}장` : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100">
                    <Heart className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">평균 반응</p>
                    <p className="text-xl font-bold">
                      {cq && (cq.avgCommentCount !== null || cq.avgSympathyCount !== null)
                        ? `${Math.round((cq.avgCommentCount ?? 0) + (cq.avgSympathyCount ?? 0))}개`
                        : '-'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">댓글+공감</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">평균 작성시기</p>
                    <p className="text-xl font-bold">{formatDaysAgo(patterns.dateStats.avgDaysAgo)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">블로그 다양성</p>
                    <p className="text-xl font-bold">{patterns.blogDiversity.diversityRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 경쟁사 테이블 */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg">
                  상위 블로그
                  {dateFilter !== 'all' && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({filteredCompetitors.length}/{competitors.length}개)
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {([
                    ['all', '전체'],
                    ['1m', '1개월'],
                    ['3m', '3개월'],
                    ['6m', '6개월'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setDateFilter(value)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        dateFilter === value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="w-14 pb-3 pr-2 font-medium">순위</th>
                      <th className="pb-3 pr-4 font-medium">제목</th>
                      <th className="hidden w-32 pb-3 pr-4 font-medium md:table-cell">블로그</th>
                      <th className="w-24 pb-3 pr-4 font-medium">작성일</th>
                      <th className="hidden w-20 pb-3 pr-2 font-medium text-right lg:table-cell">글자수</th>
                      <th className="hidden w-20 pb-3 pr-2 font-medium text-center lg:table-cell">
                        <span className="flex items-center justify-center gap-0.5"><MessageCircle className="h-3 w-3" />댓글</span>
                      </th>
                      <th className="hidden w-20 pb-3 font-medium text-center lg:table-cell">
                        <span className="flex items-center justify-center gap-0.5"><Heart className="h-3 w-3" />공감</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompetitors.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                          해당 기간에 작성된 글이 없습니다
                        </td>
                      </tr>
                    )}
                    {filteredCompetitors.map(comp => (
                      <tr key={comp.rank} className="border-b last:border-0">
                        <td className="py-3 pr-2">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            comp.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            {comp.rank}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <a
                            href={ensureUrl(comp.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-1 font-medium hover:text-primary"
                          >
                            <span className="line-clamp-2">{comp.title}</span>
                            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                          </a>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {comp.description}
                          </p>
                        </td>
                        <td className="hidden py-3 pr-4 md:table-cell">
                          <span className="text-muted-foreground truncate block">{comp.bloggerName}</span>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          <div className="whitespace-nowrap">{comp.postDateFormatted}</div>
                          <div className="text-xs">{formatDaysAgo(comp.daysSincePosted)}</div>
                        </td>
                        <td className="hidden py-3 pr-2 lg:table-cell whitespace-nowrap text-right text-muted-foreground">
                          {comp.charCount != null ? `${comp.charCount.toLocaleString()}자` : '-'}
                        </td>
                        <td className="hidden py-3 pr-2 lg:table-cell whitespace-nowrap text-center text-muted-foreground">
                          {comp.commentCount != null ? (
                            <span className="flex items-center justify-center gap-0.5">
                              <MessageCircle className="h-3 w-3" />{comp.commentCount}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="hidden py-3 lg:table-cell whitespace-nowrap text-center text-muted-foreground">
                          {comp.sympathyCount != null ? (
                            <span className="flex items-center justify-center gap-0.5">
                              <Heart className="h-3 w-3" />{comp.sympathyCount}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 패턴 분석 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* 제목 분석 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Type className="h-4 w-4" />
                  제목 분석
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">평균 제목 길이</span>
                  <span className="font-medium">{patterns.titleStats.avgLength}자</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">제목 길이 범위</span>
                  <span className="font-medium">{patterns.titleStats.minLength}~{patterns.titleStats.maxLength}자</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">키워드 포함</span>
                  <span className="font-medium">{patterns.titleStats.keywordInTitleCount}/{competitors.length}개</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${patterns.titleStats.keywordInTitleRate}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 콘텐츠 품질 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  콘텐츠 품질
                  {cq && <Badge variant="secondary" className="text-xs ml-auto">{cq.scrapedCount}개 분석</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cq ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">본문 중앙값</span>
                      <span className="font-medium">{cq.medianCharCount.toLocaleString()}자</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">본문 범위</span>
                      <span className="font-medium">{cq.charCountRange[0].toLocaleString()}~{cq.charCountRange[1].toLocaleString()}자</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">평균 이미지</span>
                      <span className="font-medium">{cq.avgImageCount}장</span>
                    </div>
                    {cq.avgVideoCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">평균 동영상</span>
                        <span className="font-medium">{cq.avgVideoCount}개</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {cq.medianCharCount >= 2000
                        ? '정보 밀도가 높은 콘텐츠 — 충실한 콘텐츠가 필요합니다'
                        : cq.medianCharCount >= 1000
                        ? '적정 수준의 콘텐츠 — 질 높은 구조로 차별화 가능'
                        : '콘텐츠 깊이가 낮아 양질의 글로 쉽게 차별화 가능'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">스크래핑 데이터 없음</p>
                )}
              </CardContent>
            </Card>

            {/* 사용자 반응 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Heart className="h-4 w-4" />
                  사용자 반응
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cq ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> 평균 댓글</span>
                      <span className="font-medium">{cq.avgCommentCount !== null ? `${cq.avgCommentCount}개` : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> 평균 공감</span>
                      <span className="font-medium">{cq.avgSympathyCount !== null ? `${cq.avgSympathyCount}개` : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> 분석 글 수</span>
                      <span className="font-medium">{cq.scrapedCount}개</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(cq.avgCommentCount ?? 0) >= 10
                        ? '독자 참여도가 높은 경쟁 구간입니다'
                        : (cq.avgSympathyCount ?? 0) >= 20
                        ? '공감 반응이 활발한 구간입니다'
                        : '독자 반응이 낮아 적극적 소통으로 차별화 가능'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">반응 데이터 없음</p>
                )}
              </CardContent>
            </Card>

            {/* 포스트 연령 분포 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  포스트 연령
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">30일 이내</span>
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                    {patterns.dateStats.within30Days}개
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">31~90일</span>
                  <Badge variant="outline">
                    {patterns.dateStats.within90Days - patterns.dateStats.within30Days}개
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">91~365일</span>
                  <Badge variant="outline">
                    {patterns.dateStats.within365Days - patterns.dateStats.within90Days}개
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">1년 이상</span>
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                    {patterns.dateStats.older}개
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  가장 최근: {formatDaysAgo(patterns.dateStats.newestDaysAgo)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 제목 패턴 워드 */}
          {titlePatterns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Hash className="h-4 w-4" />
                  상위 글 제목 키워드 패턴
                </CardTitle>
                <p className="text-xs text-muted-foreground">상위 블로그 제목에 자주 등장하는 단어입니다. 제목 작성 시 참고하세요.</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {titlePatterns.map((tp) => (
                    <Badge
                      key={tp.word}
                      variant="secondary"
                      className="text-sm px-3 py-1"
                    >
                      {tp.word}
                      <span className="ml-1.5 text-xs text-muted-foreground">&times;{tp.count}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI 인사이트 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI 경쟁 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!aiInsights && !aiLoading && (
                <div className="text-center">
                  <p className="mb-4 text-sm text-muted-foreground">
                    AI가 상위 블로그 패턴을 분석하고 최적의 콘텐츠 전략을 추천합니다
                  </p>
                  <Button onClick={handleAiAnalysis} disabled={aiLoading} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI 전략 분석 시작
                  </Button>
                </div>
              )}

              {aiLoading && (
                aiStreamingText ? (
                  <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50/50 to-white p-4">
                    <div className="flex items-center gap-2 text-purple-700 mb-3">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      <span className="text-sm font-medium">AI가 분석 결과를 작성하고 있습니다...</span>
                    </div>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/80 max-h-[300px] overflow-y-auto">
                      {(() => {
                        // 부분 JSON에서 summary 필드 추출
                        const sumMatch = aiStreamingText.match(/"summary"\s*:\s*"([\s\S]*?)(?:(?<!\\)"|\s*$)/)
                        return sumMatch ? sumMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : aiStreamingText.substring(0, 500)
                      })()}
                      <span className="inline-block w-0.5 h-4 bg-purple-500 animate-pulse ml-0.5 align-text-bottom" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-500" />
                    <span className="text-muted-foreground">AI가 경쟁 상황을 분석 중...</span>
                  </div>
                )
              )}

              {aiError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {aiError}
                </div>
              )}

              {aiInsights && (
                <div className="space-y-6">
                  {/* 요약 */}
                  <div className="rounded-lg bg-purple-50 p-4 prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiInsights.summary}</ReactMarkdown>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* 상위 패턴 */}
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 font-medium">
                        <Target className="h-4 w-4 text-blue-500" />
                        상위 노출 공통 패턴
                      </h4>
                      <ul className="space-y-2">
                        {aiInsights.topPatterns.map((pattern, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">{i + 1}</span>
                            <InlineMarkdown>{pattern}</InlineMarkdown>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 콘텐츠 기회 */}
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 font-medium">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        콘텐츠 기회
                      </h4>
                      <ul className="space-y-2">
                        {aiInsights.contentGaps.map((gap, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-xs font-medium text-yellow-600">{i + 1}</span>
                            <InlineMarkdown>{gap}</InlineMarkdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 추천 전략 */}
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 font-medium">
                      <BookOpen className="h-4 w-4 text-green-500" />
                      추천 전략
                    </h4>
                    <div className="rounded-lg border p-3 text-sm leading-relaxed prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiInsights.recommendedStrategy}</ReactMarkdown>
                    </div>
                  </div>

                  {/* 추천 제목 */}
                  <div>
                    <h4 className="mb-2 font-medium">추천 제목</h4>
                    <div className="space-y-2">
                      {aiInsights.titleSuggestions.map((title, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
                          <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
                          {title}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 이미지 전략 분석 */}
                  {aiInsights.imageAnalysis && (
                    <div>
                      <h4 className="mb-2 font-medium flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-emerald-500" />
                        이미지 전략 분석
                        <Badge variant="secondary" className="text-xs">{aiInsights.imageAnalysis.totalImages}장 분석</Badge>
                      </h4>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {aiInsights.imageAnalysis.imageTypes.map((type, i) => (
                            <Badge key={i} variant="outline" className="border-emerald-200 text-emerald-700">{type}</Badge>
                          ))}
                        </div>
                        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                          {aiInsights.imageAnalysis.recommendation}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 워크플로우 액션 */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex-1">
              <p className="text-sm font-medium">분석이 완료되었습니다</p>
              <p className="text-xs text-muted-foreground">분석 데이터가 자동으로 적용되어 최적화된 블로그 글을 바로 생성합니다</p>
            </div>
            <Button className="gap-2" onClick={() => {
              const contentPreset = {
                keyword: searchedKeyword,
                relatedKeywords: [
                  ...(aiInsights?.relatedKeywords || []),
                  ...titlePatterns.slice(0, 5).map(p => p.word),
                ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8),
                referenceUrl: competitors[0]?.link || '',
                contentType: aiInsights?.recommendedContentType || '',
                tone: aiInsights?.recommendedTone || '',
                titleSuggestions: aiInsights?.titleSuggestions || [],
                strategy: aiInsights?.recommendedStrategy || '',
                difficulty: difficulty ? { level: difficulty.level, score: difficulty.score } : null,
                avgCharCount: cq?.medianCharCount ?? null,
                avgImageCount: cq?.avgImageCount ?? null,
                avgEngagement: cq ? {
                  comments: cq.avgCommentCount,
                  sympathy: cq.avgSympathyCount,
                } : null,
              }
              sessionStorage.setItem('naverseo-competitor-preset', JSON.stringify(contentPreset))
              router.push(`/content?keyword=${encodeURIComponent(searchedKeyword)}&from=competitors`)
            }}>
              <Wand2 className="h-4 w-4" />
              이 키워드로 글쓰기
            </Button>
          </div>
        </>
      )}

      {/* 빈 상태 */}
      {!loading && !searched && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-medium">키워드를 입력하여 경쟁사를 분석하세요</h3>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              네이버 블로그 상위 10개 결과의 콘텐츠 품질, 독자 반응, 패턴을 심층 분석합니다
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['다이어트 식단', '강남 맛집', '제주도 여행', '인테리어 비용'].map(kw => (
                <Badge
                  key={kw}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => handleSearch(kw)}
                >
                  {kw}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 검색 후 결과 없음 */}
      {!loading && searched && competitors.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-4 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">검색 결과가 없습니다. 다른 키워드를 시도해보세요.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
