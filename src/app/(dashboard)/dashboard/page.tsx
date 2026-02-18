'use client'

import { useEffect, useState } from 'react'
import { Search, Wand2, BarChart3, TrendingUp, ArrowRight, Clock, FileText, CalendarDays, FileDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { PLANS, type Plan } from '@/types/database'

interface RecentKeyword {
  id: string
  seed_keyword: string
  created_at: string
}

interface RecentContent {
  id: string
  target_keyword: string
  title: string
  status: string
  created_at: string
}

const quickActions = [
  {
    title: '키워드 리서치',
    description: '검색량과 경쟁도를 분석하세요',
    href: '/keywords',
    icon: Search,
  },
  {
    title: 'AI 콘텐츠 생성',
    description: 'SEO 최적화된 블로그 글 작성',
    href: '/content',
    icon: Wand2,
  },
  {
    title: 'SEO 점수 체크',
    description: '콘텐츠 SEO 점수를 확인하세요',
    href: '/seo-check',
    icon: BarChart3,
  },
  {
    title: '순위 트래킹',
    description: '블로그 키워드 순위를 추적하세요',
    href: '/tracking',
    icon: TrendingUp,
  },
  {
    title: '콘텐츠 캘린더',
    description: '생성된 콘텐츠를 날짜별로 관리',
    href: '/content/calendar',
    icon: CalendarDays,
  },
  {
    title: 'SEO 리포트',
    description: '전체 SEO 활동 요약 리포트',
    href: '/report',
    icon: FileDown,
  },
]

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export default function DashboardPage() {
  const [plan, setPlan] = useState<Plan>('free')
  const [keywordsUsed, setKeywordsUsed] = useState(0)
  const [contentGenerated, setContentGenerated] = useState(0)
  const [recentKeywords, setRecentKeywords] = useState<RecentKeyword[]>([])
  const [recentContent, setRecentContent] = useState<RecentContent[]>([])
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('좋은 아침이에요!')
    else if (hour < 18) setGreeting('좋은 오후예요!')
    else setGreeting('좋은 저녁이에요!')

    async function loadDashboard() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) return
        const data = await res.json()

        setPlan((data.profile?.plan || 'free') as Plan)
        setKeywordsUsed(data.profile?.keywords_used_this_month || 0)
        setContentGenerated(data.profile?.content_generated_this_month || 0)
        setRecentKeywords(data.recentKeywords || [])
        setRecentContent(data.recentContent || [])
      } catch {
        // 로드 실패 시 기본값 유지
      }
    }

    loadDashboard()
  }, [])

  const planInfo = PLANS[plan]

  const stats = [
    {
      title: '키워드 조회',
      value: String(keywordsUsed),
      limit: `/ ${planInfo.keywords}`,
      icon: Search,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      title: 'AI 콘텐츠 생성',
      value: String(contentGenerated),
      limit: `/ ${planInfo.content}`,
      icon: Wand2,
      color: 'text-purple-600 bg-purple-100',
    },
    {
      title: 'SEO 체크',
      value: '무제한',
      limit: '',
      icon: BarChart3,
      color: 'text-green-600 bg-green-100',
    },
    {
      title: '순위 트래킹',
      value: planInfo.tracking === 'X' ? '-' : '0',
      limit: planInfo.tracking === 'X' ? '미지원' : `/ ${planInfo.tracking}`,
      icon: TrendingUp,
      color: 'text-orange-600 bg-orange-100',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting}</h1>
          <p className="mt-1 text-muted-foreground">
            이번 달 사용량과 빠른 액션을 확인하세요
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {planInfo.name} 플랜
        </Badge>
      </div>

      {/* 사용량 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg p-3 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">
                  {stat.value}
                  {stat.limit && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {stat.limit}
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 최근 활동 */}
      {(recentKeywords.length > 0 || recentContent.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* 최근 키워드 검색 */}
          {recentKeywords.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-4 w-4 text-blue-600" />
                  최근 키워드 검색
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {recentKeywords.map((kw) => (
                    <li key={kw.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{kw.seed_keyword}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(kw.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 최근 생성 콘텐츠 */}
          {recentContent.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-purple-600" />
                    최근 생성 콘텐츠
                  </CardTitle>
                  <Link href="/content/calendar">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                      전체보기
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {recentContent.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{c.target_keyword}</p>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                        {c.status === 'draft' ? '초안' : c.status === 'published' ? '발행' : '보관'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 빠른 액션 */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">빠른 시작</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="group transition-all duration-200 hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{action.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  {action.description}
                </p>
                <Link href={action.href}>
                  <Button variant="outline" size="sm" className="group-hover:border-primary group-hover:text-primary">
                    시작하기
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
