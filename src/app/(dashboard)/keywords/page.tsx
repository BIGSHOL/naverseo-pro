'use client'

import { useState } from 'react'
import { KeywordSearch } from '@/components/keywords/keyword-search'
import { KeywordResults, type KeywordData } from '@/components/keywords/keyword-results'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, TrendingUp, BarChart3 } from 'lucide-react'

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [loading, setLoading] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const handleSearch = async (keyword: string) => {
    setLoading(true)
    setError('')
    setSearched(true)

    try {
      const res = await fetch(`/api/naver/keywords?keyword=${encodeURIComponent(keyword)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '키워드 조회에 실패했습니다.')
        setKeywords([])
        return
      }

      setKeywords(data.keywords)
      setIsDemo(data.isDemo || false)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setKeywords([])
    } finally {
      setLoading(false)
    }
  }

  // 요약 통계
  const totalSearchVolume = keywords.reduce((sum, kw) => sum + kw.totalSearch, 0)
  const avgScore = keywords.length > 0
    ? Math.round(keywords.reduce((sum, kw) => sum + kw.score, 0) / keywords.length)
    : 0
  const lowCompCount = keywords.filter((kw) => kw.compIdx === 'LOW').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">키워드 리서치</h1>
        <p className="mt-1 text-muted-foreground">
          네이버 검색량과 경쟁도를 분석하여 최적의 키워드를 찾으세요
        </p>
      </div>

      {/* 검색 폼 */}
      <KeywordSearch onSearch={handleSearch} loading={loading} />

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
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
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {['다이어트 식단', '맛집 추천', '여행 코스', '인테리어 팁'].map((example) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
