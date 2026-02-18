'use client'

import { useEffect, useState, useRef } from 'react'
import {
  FileDown,
  RefreshCw,
  Search,
  FileText,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PLANS, type Plan } from '@/types/database'

interface ReportData {
  profile: {
    plan: Plan
    email: string
    keywords_used_this_month: number
    content_generated_this_month: number
  }
  keywords: Array<{
    id: string
    seed_keyword: string
    created_at: string
  }>
  contents: Array<{
    id: string
    target_keyword: string
    title: string
    status: string
    seo_score: number | null
    created_at: string
  }>
  tracking: Array<{
    keyword: string
    blog_url: string
    rank_position: number | null
    section: string | null
    checked_at: string
  }>
  generatedAt: string
}

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await fetch('/api/report')
        if (!res.ok) return
        const json = await res.json()
        setData(json)
      } catch {
        // 로드 실패
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        리포트 데이터를 불러올 수 없습니다.
      </div>
    )
  }

  const planInfo = PLANS[data.profile.plan]
  const avgSeoScore =
    data.contents.filter((c) => c.seo_score !== null).length > 0
      ? Math.round(
          data.contents
            .filter((c) => c.seo_score !== null)
            .reduce((sum, c) => sum + (c.seo_score || 0), 0) /
            data.contents.filter((c) => c.seo_score !== null).length
        )
      : null
  const rankedCount = data.tracking.filter((t) => t.rank_position !== null).length
  const top10Count = data.tracking.filter(
    (t) => t.rank_position !== null && t.rank_position <= 10
  ).length

  return (
    <div className="space-y-6">
      {/* 헤더 (프린트 시 숨김) */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">SEO 리포트</h1>
          <p className="mt-1 text-muted-foreground">
            전체 SEO 활동 요약 리포트를 확인하고 PDF로 저장하세요
          </p>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <FileDown className="h-4 w-4" />
          PDF 저장
        </Button>
      </div>

      {/* 리포트 본문 */}
      <div ref={reportRef} className="space-y-6 print:space-y-4">
        {/* 리포트 헤더 (프린트용) */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">NaverSEO Pro - SEO 리포트</h1>
          <p className="text-sm text-muted-foreground">
            생성일: {new Date(data.generatedAt).toLocaleDateString('ko-KR')} · {data.profile.email}
          </p>
          <hr className="mt-2" />
        </div>

        {/* 요약 통계 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
          <Card className="print:border print:shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-muted-foreground">키워드 리서치</p>
              </div>
              <p className="mt-1 text-2xl font-bold">{data.keywords.length}건</p>
            </CardContent>
          </Card>
          <Card className="print:border print:shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <p className="text-sm text-muted-foreground">생성 콘텐츠</p>
              </div>
              <p className="mt-1 text-2xl font-bold">{data.contents.length}편</p>
            </CardContent>
          </Card>
          <Card className="print:border print:shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-600" />
                <p className="text-sm text-muted-foreground">평균 SEO 점수</p>
              </div>
              <p className="mt-1 text-2xl font-bold">
                {avgSeoScore !== null ? `${avgSeoScore}점` : '-'}
              </p>
            </CardContent>
          </Card>
          <Card className="print:border print:shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <p className="text-sm text-muted-foreground">순위 진입</p>
              </div>
              <p className="mt-1 text-2xl font-bold">
                {rankedCount}개
                {top10Count > 0 && (
                  <span className="ml-1 text-sm font-normal text-green-600">
                    (TOP10: {top10Count})
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 계정 정보 */}
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">계정 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">이메일:</span>{' '}
                <span className="font-medium">{data.profile.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">플랜:</span>{' '}
                <Badge variant="outline">{planInfo.name}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">이번 달 사용량:</span>{' '}
                <span className="font-medium">
                  키워드 {data.profile.keywords_used_this_month}회, 콘텐츠{' '}
                  {data.profile.content_generated_this_month}편
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 최근 키워드 리서치 */}
        {data.keywords.length > 0 && (
          <Card className="print:border print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">최근 키워드 리서치</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">시드 키워드</th>
                      <th className="pb-2 font-medium">조회일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keywords.map((kw, i) => (
                      <tr key={kw.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 font-medium">{kw.seed_keyword}</td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(kw.created_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 생성된 콘텐츠 */}
        {data.contents.length > 0 && (
          <Card className="print:border print:shadow-none print:break-before-page">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">생성된 콘텐츠</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">제목</th>
                      <th className="pb-2 font-medium">키워드</th>
                      <th className="pb-2 font-medium">상태</th>
                      <th className="pb-2 font-medium">SEO</th>
                      <th className="pb-2 font-medium">생성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contents.map((c, i) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{i + 1}</td>
                        <td className="max-w-[200px] truncate py-2 font-medium">
                          {c.title}
                        </td>
                        <td className="py-2">{c.target_keyword}</td>
                        <td className="py-2">
                          <Badge variant="secondary" className="text-xs">
                            {c.status === 'draft'
                              ? '초안'
                              : c.status === 'published'
                                ? '발행'
                                : '보관'}
                          </Badge>
                        </td>
                        <td className="py-2">
                          {c.seo_score !== null ? `${c.seo_score}점` : '-'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 순위 트래킹 */}
        {data.tracking.length > 0 && (
          <Card className="print:border print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">순위 트래킹 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">키워드</th>
                      <th className="pb-2 font-medium">블로그</th>
                      <th className="pb-2 font-medium">순위</th>
                      <th className="pb-2 font-medium">확인일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tracking.map((t, i) => (
                      <tr key={`${t.keyword}-${t.blog_url}`} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 font-medium">{t.keyword}</td>
                        <td className="max-w-[200px] truncate py-2 text-muted-foreground">
                          {t.blog_url}
                        </td>
                        <td className="py-2">
                          {t.rank_position !== null ? (
                            <span
                              className={
                                t.rank_position <= 10
                                  ? 'font-bold text-green-600'
                                  : 'font-medium'
                              }
                            >
                              {t.rank_position}위
                            </span>
                          ) : (
                            <span className="text-muted-foreground">100+</span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(t.checked_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 리포트 푸터 (프린트용) */}
        <div className="hidden text-center text-xs text-muted-foreground print:block">
          <hr className="mb-2" />
          NaverSEO Pro · {new Date(data.generatedAt).toLocaleDateString('ko-KR')}{' '}
          {new Date(data.generatedAt).toLocaleTimeString('ko-KR')} 생성
        </div>
      </div>
    </div>
  )
}
