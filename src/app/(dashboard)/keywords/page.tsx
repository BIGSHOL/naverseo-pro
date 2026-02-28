'use client'

import { useState } from 'react'
import { KeywordSearch } from '@/components/keywords/keyword-search'
import { KeywordResults, type KeywordData } from '@/components/keywords/keyword-results'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, TrendingUp, BarChart3, Sparkles, Loader2, Wand2, Clock } from 'lucide-react'
import Link from 'next/link'
import { useKeywordHistory } from '@/hooks/use-keyword-history'

const DEFAULT_EXAMPLES = ['다이어트 식단', '맛집 추천', '여행 코스', '인테리어 팁']

interface AiSearchData {
  totalSearch: number
  monthlyPcQcCnt: number
  monthlyMobileQcCnt: number
  compIdx: string
  score: number
}

interface AiRecommendation {
  keyword: string
  intent: string
  reason: string
  searchData?: AiSearchData
}

interface SearchProgress {
  step: number
  totalSteps: number
  message: string
  keywordCount?: number
  current?: number
  total?: number
}

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [loading, setLoading] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [spaceNotice, setSpaceNotice] = useState('')
  const [expandedNotice, setExpandedNotice] = useState('')
  const [searchedKeyword, setSearchedKeyword] = useState('')
  const [progress, setProgress] = useState<SearchProgress | null>(null)

  // AI 키워드 추천
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // 키워드 검색 히스토리
  const { history, addKeyword } = useKeywordHistory('keyword-research-history')

  const handleSearch = async (keyword: string) => {
    addKeyword(keyword)
    setLoading(true)
    setError('')
    setSpaceNotice('')
    setExpandedNotice('')
    setSearched(true)
    setSearchedKeyword(keyword)
    setAiRecommendations([])
    setAiError('')
    setKeywords([])
    setProgress({ step: 0, totalSteps: 3, message: '검색 준비 중...' })

    try {
      const res = await fetch(`/api/naver/keywords?keyword=${encodeURIComponent(keyword)}`)

      // 에러 응답 (400, 401, 403 등) — 일반 JSON
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '키워드 조회에 실패했습니다.')
        setKeywords([])
        return
      }

      const contentType = res.headers.get('Content-Type') || ''

      // NDJSON 스트리밍 응답 (실제 API)
      if (contentType.includes('ndjson') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += decoder.decode()
          } else {
            buffer += decoder.decode(value, { stream: true })
          }

          const lines = buffer.split('\n')
          buffer = done ? '' : (lines.pop() || '')

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const data = JSON.parse(line)
              if (data.type === 'progress') {
                setProgress(data as SearchProgress)
              } else if (data.type === 'result') {
                setKeywords(data.keywords)
                setIsDemo(data.isDemo || false)
                setSpaceNotice(data.spaceNotice || '')
                setExpandedNotice(data.expandedNotice || '')
              } else if (data.type === 'error') {
                setError(data.error || '키워드 조회에 실패했습니다.')
                setKeywords([])
              }
            } catch {
              // JSON 파싱 실패 — 무시
            }
          }

          if (done) break
        }
      } else {
        // 일반 JSON 응답 (데모 모드)
        const data = await res.json()
        setKeywords(data.keywords)
        setIsDemo(data.isDemo || false)
        setSpaceNotice(data.spaceNotice || '')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setKeywords([])
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const handleAiRecommend = async () => {
    if (!searchedKeyword) return
    setAiLoading(true)
    setAiError('')

    try {
      const res = await fetch('/api/ai/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchedKeyword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setAiError(data.error || 'AI 추천에 실패했습니다.')
        return
      }

      setAiRecommendations(data.recommendations || [])
    } catch {
      setAiError('AI 추천 중 네트워크 오류가 발생했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  // 요약 통계
  const totalSearchVolume = keywords.reduce((sum, kw) => sum + kw.totalSearch, 0)
  const avgScore = keywords.length > 0
    ? Math.round(keywords.reduce((sum, kw) => sum + kw.score, 0) / keywords.length)
    : 0
  const lowCompCount = keywords.filter((kw) => kw.compIdx === 'LOW').length

  const intentColor: Record<string, string> = {
    '정보형': 'bg-blue-100 text-blue-700',
    '비교형': 'bg-purple-100 text-purple-700',
    '구매형': 'bg-green-100 text-green-700',
    '경험형': 'bg-orange-100 text-orange-700',
  }

  // 프로그레스 퍼센트 계산
  const progressPercent = progress
    ? progress.current && progress.total
      ? Math.round((progress.current / progress.total) * 100)
      : Math.round((progress.step / progress.totalSteps) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">키워드 검색</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          네이버 검색량과 경쟁도를 분석하여 최적의 키워드를 찾으세요
        </p>
      </div>

      {/* 검색 폼 */}
      <KeywordSearch onSearch={handleSearch} loading={loading} />

      {/* 프로그레스 표시 */}
      {loading && progress && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="w-full max-w-md space-y-3">
                <p className="text-center text-sm font-medium">
                  {progress.message}
                </p>

                {/* 프로그레스 바 */}
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* 단계 + 키워드 수 표시 */}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>단계 {progress.step}/{progress.totalSteps}</span>
                  <div className="flex gap-3">
                    {progress.keywordCount != null && (
                      <span>{progress.keywordCount.toLocaleString()}개 키워드</span>
                    )}
                    {progress.current != null && progress.total != null && (
                      <span>{progress.current}/{progress.total} 분석</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 공백 제거 안내 */}
      {spaceNotice && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          ⚠ {spaceNotice}
        </div>
      )}

      {/* 확장 검색 안내 */}
      {expandedNotice && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
          {expandedNotice}
        </div>
      )}

      {/* 결과가 적을 때 안내 (확장 검색 없이 3개 이하) */}
      {!loading && searched && keywords.length > 0 && keywords.length <= 3 && !expandedNotice && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
          검색 결과가 적습니다. 더 넓은 키워드로 검색하거나 하단의 AI 키워드 추천을 이용해보세요.
        </div>
      )}

      {/* 요약 통계 카드 */}
      {keywords.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 검색량</p>
                <p className="text-xl font-bold">{totalSearchVolume.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-lg bg-green-50 p-2.5">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">낮은 경쟁 키워드</p>
                <p className="text-xl font-bold">{lowCompCount}개</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-lg bg-purple-50 p-2.5">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">평균 추천 점수</p>
                <p className="text-xl font-bold">{avgScore}점</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 결과 테이블 */}
      {keywords.length > 0 && (
        <KeywordResults keywords={keywords} isDemo={isDemo} />
      )}

      {/* AI 키워드 추천 섹션 - 검색량 데이터 통합 뷰 */}
      {keywords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI 키워드 추천
                {aiRecommendations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{aiRecommendations.length}개</Badge>
                )}
              </CardTitle>
              {aiRecommendations.length === 0 && (
                <Button
                  onClick={handleAiRecommend}
                  disabled={aiLoading}
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI 추천 받기
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {aiError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {aiError}
              </div>
            )}

            {aiRecommendations.length === 0 && !aiLoading && !aiError && (
              <p className="text-sm text-muted-foreground">
                &quot;{searchedKeyword}&quot; 키워드를 기반으로 AI가 블로그 상위 노출에 유리한 롱테일 키워드를 추천해드립니다.
                검색량과 경쟁도 데이터도 함께 제공됩니다.
              </p>
            )}

            {aiLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-muted-foreground">AI가 키워드를 분석하고 검색량을 조회하고 있습니다...</span>
              </div>
            )}

            {aiRecommendations.length > 0 && (
              <div className="space-y-3">
                {aiRecommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{rec.keyword}</span>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${intentColor[rec.intent] || 'bg-gray-100 text-gray-700'}`}>
                            {rec.intent}
                          </span>
                          {rec.searchData && (
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                              rec.searchData.score >= 70 ? 'bg-green-50 text-green-600' :
                              rec.searchData.score >= 40 ? 'bg-yellow-50 text-yellow-600' :
                              'bg-red-50 text-red-600'
                            }`}>
                              {rec.searchData.score}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{rec.reason}</p>

                        {/* 검색량 데이터 통합 뷰 */}
                        {rec.searchData && (
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Search className="h-3 w-3" />
                              월 {rec.searchData.totalSearch.toLocaleString()}회
                            </span>
                            <span className="hidden sm:inline">
                              PC {rec.searchData.monthlyPcQcCnt.toLocaleString()} / 모바일 {rec.searchData.monthlyMobileQcCnt.toLocaleString()}
                            </span>
                            <Badge variant={
                              rec.searchData.compIdx === 'LOW' ? 'default' :
                              rec.searchData.compIdx === 'MEDIUM' ? 'secondary' : 'destructive'
                            } className={`text-[10px] px-1.5 py-0 ${
                              rec.searchData.compIdx === 'LOW' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''
                            }`}>
                              경쟁 {rec.searchData.compIdx === 'LOW' ? '낮음' : rec.searchData.compIdx === 'MEDIUM' ? '보통' : '높음'}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleSearch(rec.keyword)}
                        >
                          검색
                        </Button>
                        <Link href={`/content?keyword=${encodeURIComponent(rec.keyword)}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary"
                          >
                            <Wand2 className="mr-1 h-3 w-3" />
                            글쓰기
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 검색 전 안내 */}
      {!searched && keywords.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">키워드를 검색해보세요</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              키워드를 입력하면 네이버 월간 검색량, 경쟁도, 추천 점수를 분석합니다
            </p>

            {/* 최근 검색 히스토리 */}
            {history.length > 0 && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  최근 검색
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {history.map((kw) => (
                    <Badge
                      key={kw}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handleSearch(kw)}
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 추천 키워드 (히스토리 없을 때만 또는 항상 표시) */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {history.length > 0 && (
                <span className="text-xs text-muted-foreground">추천 키워드</span>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {DEFAULT_EXAMPLES.map((example) => (
                  <Badge
                    key={example}
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80"
                    onClick={() => handleSearch(example)}
                  >
                    {example}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
