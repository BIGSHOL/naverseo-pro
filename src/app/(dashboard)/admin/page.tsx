'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, CreditCard, FileText, Search, UserPlus, ArrowRight } from 'lucide-react'

interface AdminStats {
  totalUsers: number
  paidUsers: number
  todaySignups: number
  planDistribution: { free: number; lite: number; starter: number; pro: number; enterprise: number }
  totalContent: number
  totalKeywordSearches: number
  recentSignups: {
    id: string
    email: string
    plan: string
    role: string
    created_at: string
  }[]
}

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  lite: 'bg-green-100 text-green-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-orange-100 text-orange-700',
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/admin/stats')
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || '통계를 불러올 수 없습니다.')
          return
        }
        setStats(await res.json())
      } catch {
        setError('통계를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!stats) return null

  const statCards = [
    { label: '전체 사용자', value: stats.totalUsers, icon: Users, color: 'text-blue-600' },
    { label: '유료 사용자', value: stats.paidUsers, icon: CreditCard, color: 'text-green-600' },
    { label: '콘텐츠 총계', value: stats.totalContent, icon: FileText, color: 'text-purple-600' },
    { label: '키워드 조회 총계', value: stats.totalKeywordSearches, icon: Search, color: 'text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">관리자 대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            서비스 전체 현황을 한눈에 확인하세요
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <UserPlus className="h-3 w-3" />
          오늘 가입: {stats.todaySignups}명
        </Badge>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-3xl font-bold">{card.value.toLocaleString()}</p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 플랜 분포 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">플랜 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            {(Object.entries(stats.planDistribution) as [string, number][]).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between rounded-lg border p-3">
                <Badge className={planColors[plan]}>{plan.toUpperCase()}</Badge>
                <span className="text-lg font-semibold">{count}명</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 최근 가입자 + 빠른 링크 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">최근 가입자</CardTitle>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="gap-1">
                전체 보기 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentSignups.map((user) => (
                <Link
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={planColors[user.plan]}>{user.plan}</Badge>
                    {user.role === 'admin' && (
                      <Badge variant="destructive">관리자</Badge>
                    )}
                  </div>
                </Link>
              ))}
              {stats.recentSignups.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  아직 가입한 사용자가 없습니다
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">빠른 링크</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/users" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="h-4 w-4" />
                사용자 관리
              </Button>
            </Link>
            <Link href="/admin/system" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Search className="h-4 w-4" />
                시스템 설정
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
