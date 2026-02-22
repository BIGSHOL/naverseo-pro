'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface UserItem {
  id: string
  email: string
  plan: string
  role: string
  credits_balance: number
  credits_monthly_quota: number
  credits_reset_at: string | null
  keywords_used_this_month: number
  content_generated_this_month: number
  analysis_used_today: number
  created_at: string
}

interface UsersResponse {
  users: UserItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  lite: 'bg-green-100 text-green-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  business: 'bg-orange-100 text-orange-700',
  agency: 'bg-amber-100 text-amber-700',
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (search) params.set('search', search)
      if (planFilter !== 'all') params.set('plan', planFilter)

      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || '사용자 목록을 불러올 수 없습니다.')
        return
      }
      setData(await res.json())
    } catch {
      setError('사용자 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, planFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  function handleSearch() {
    setPage(1)
    loadUsers()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          전체 사용자를 조회하고 관리합니다
        </p>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="이메일로 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Select
              value={planFilter}
              onValueChange={(v) => { setPlanFilter(v); setPage(1) }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="플랜 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 플랜</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="lite">Lite</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>검색</Button>
          </div>
        </CardContent>
      </Card>

      {/* 에러 */}
      {error && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 사용자 목록 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              사용자 ({data.total.toLocaleString()}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* 헤더 (데스크톱) */}
              <div className="hidden rounded-lg bg-muted p-3 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-7 sm:gap-4">
                <span className="col-span-2">이메일</span>
                <span>플랜</span>
                <span>역할</span>
                <span>크레딧</span>
                <span>리셋일</span>
                <span>가입일</span>
              </div>

              {data.users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                  className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent sm:grid sm:grid-cols-7 sm:items-center sm:gap-4"
                >
                  <div className="col-span-2 min-w-0">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                  </div>
                  <div>
                    <Badge className={planColors[user.plan]}>{user.plan}</Badge>
                  </div>
                  <div>
                    {user.role === 'admin' ? (
                      <Badge variant="destructive">관리자</Badge>
                    ) : (
                      <Badge variant="outline">사용자</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span>{(user.credits_balance ?? 0).toLocaleString()}/{(user.credits_monthly_quota ?? 30).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user.credits_reset_at
                      ? new Date(user.credits_reset_at).toLocaleDateString('ko-KR')
                      : '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              ))}

              {data.users.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  검색 결과가 없습니다
                </p>
              )}
            </div>

            {/* 페이지네이션 */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">표시</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">명</span>
              </div>
              {data.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
