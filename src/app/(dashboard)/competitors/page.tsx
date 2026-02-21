'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Loader2, BarChart3, Clock, Type, Sparkles, ExternalLink, Lightbulb, Target, BookOpen, Wand2, Shield, Hash } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KeywordSearch } from '@/components/keywords/keyword-search'

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
}

interface DifficultyAssessment {
  level: 'easy' | 'medium' | 'hard' | 'very_hard'
  score: number
  reasons: string[]
}

interface TitlePatternWord {
  word: string
  count: number
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

// === 메인 페이지 ===

export default function CompetitorsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [searchedKeyword, setSearchedKeyword] = useState('')

  const [competitors, setCompetitors] = useState<CompetitorItem[]>([])
  const [patterns, setPatterns] = useState<PatternAnalysis | null>(null)
  const [difficulty, setDifficulty] = useState<DifficultyAssessment | null>(null)
  const [titlePatterns, setTitlePatterns] = useState<TitlePatternWord[]>([])

  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const handleSearch = async (keyword: string) => {
    setLoading(true)
    setError('')
    setSearched(true)
    setSearchedKeyword(keyword)
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
        setError(data.error || '상위노출 분석에 실패했습니다.')
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
    try {
      const res = await fetch('/api/ai/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchedKeyword, includeAi: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error || 'AI 분석에 실패했습니다.')
        return
      }
      setAiInsights(data.aiInsights || null)
    } catch {
      setAiError('AI 분석 중 네트워크 오류가 발생했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

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

      {/* 에러 */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">상위 블로그 분석 중...</span>
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
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">경쟁 진입 난이도</h3>
                      <Badge className={`${getDifficultyInfo(difficulty.level).bg} ${getDifficultyInfo(difficulty.level).color} border-0`}>
                        {getDifficultyInfo(difficulty.level).label}
                      </Badge>
                    </div>
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>쉬움</span>
                        <span>{difficulty.score}점</span>
                        <span>어려움</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full transition-all ${getDifficultyInfo(difficulty.level).barColor}`}
                          style={{ width: `${difficulty.score}%` }}
                        />
                      </div>
                    </div>
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">분석 대상</p>
                    <p className="text-xl font-bold">{competitors.length}개</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <Type className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">키워드 포함률</p>
                    <p className="text-xl font-bold">{patterns.titleStats.keywordInTitleRate}%</p>
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
                    <p className="text-sm text-muted-foreground">평균 포스트 연령</p>
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
              <CardTitle className="text-lg">상위 {competitors.length}개 블로그</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">순위</th>
                      <th className="pb-3 pr-4 font-medium">제목</th>
                      <th className="hidden pb-3 pr-4 font-medium md:table-cell">블로그</th>
                      <th className="pb-3 pr-4 font-medium">작성일</th>
                      <th className="hidden pb-3 font-medium lg:table-cell">키워드</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitors.map(comp => (
                      <tr key={comp.rank} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            comp.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            {comp.rank}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <a
                            href={comp.link}
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
                          <span className="text-muted-foreground">{comp.bloggerName}</span>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          <div className="whitespace-nowrap">{comp.postDateFormatted}</div>
                          <div className="text-xs">{formatDaysAgo(comp.daysSincePosted)}</div>
                        </td>
                        <td className="hidden py-3 lg:table-cell">
                          {comp.hasKeywordInTitle ? (
                            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">포함</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">미포함</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 패턴 분석 */}
          <div className="grid gap-4 md:grid-cols-3">
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

            {/* 포스트 연령 분포 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  포스트 연령 분포
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

            {/* 블로그 다양성 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  블로그 다양성
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">고유 블로그 수</span>
                  <span className="font-medium">{patterns.blogDiversity.uniqueBlogCount}/{patterns.blogDiversity.totalResults}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      patterns.blogDiversity.diversityRate >= 80 ? 'bg-green-500' :
                      patterns.blogDiversity.diversityRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${patterns.blogDiversity.diversityRate}%` }}
                  />
                </div>
                {patterns.blogDiversity.repeatedBlogs.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">중복 블로그:</p>
                    {patterns.blogDiversity.repeatedBlogs.map((blog) => (
                      <div key={blog.name} className="flex items-center justify-between text-xs">
                        <span className="truncate">{blog.name}</span>
                        <Badge variant="secondary" className="text-xs">{blog.count}개</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {patterns.blogDiversity.diversityRate >= 80
                    ? '다양한 블로그가 노출되어 신규 진입 기회가 있습니다'
                    : '특정 블로그가 독점 중이라 진입이 어려울 수 있습니다'}
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
                      <span className="ml-1.5 text-xs text-muted-foreground">×{tp.count}</span>
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
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-500" />
                  <span className="text-muted-foreground">AI가 경쟁 상황을 분석 중...</span>
                </div>
              )}

              {aiError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {aiError}
                </div>
              )}

              {aiInsights && (
                <div className="space-y-6">
                  {/* 요약 */}
                  <div className="rounded-lg bg-purple-50 p-4">
                    <p className="text-sm leading-relaxed">{aiInsights.summary}</p>
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
                            {pattern}
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
                            {gap}
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
                    <p className="rounded-lg border p-3 text-sm leading-relaxed">{aiInsights.recommendedStrategy}</p>
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
              // 분석 데이터를 sessionStorage에 저장하여 콘텐츠 페이지에 전달
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
              네이버 블로그 상위 10개 결과의 제목, 작성일, 블로그 패턴을 분석합니다
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
