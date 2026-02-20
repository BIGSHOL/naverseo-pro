'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Bot, Save, Shield, User } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  plan: string
  role: string
  keywords_used_this_month: number
  content_generated_this_month: number
  analysis_used_today: number
  analysis_reset_date: string
  ai_provider: string
  created_at: string
  updated_at: string
}

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
  seo_score: number | null
  created_at: string
}

interface UserDetailData {
  profile: UserProfile
  recentKeywords: RecentKeyword[]
  recentContent: RecentContent[]
  totalContent: number
  totalKeywords: number
}

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  agency: 'bg-amber-100 text-amber-700',
}

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [data, setData] = useState<UserDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editPlan, setEditPlan] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editAiProvider, setEditAiProvider] = useState('')

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch(`/api/admin/users/${id}`)
        if (!res.ok) {
          const d = await res.json()
          setError(d.error || '사용자 정보를 불러올 수 없습니다.')
          return
        }
        const userData: UserDetailData = await res.json()
        setData(userData)
        setEditPlan(userData.profile.plan)
        setEditRole(userData.profile.role)
        setEditAiProvider(userData.profile.ai_provider || 'gemini')
      } catch {
        setError('사용자 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [id])

  async function handleSave() {
    if (!data) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updates: Record<string, string> = {}
      if (editPlan !== data.profile.plan) updates.plan = editPlan
      if (editRole !== data.profile.role) updates.role = editRole
      if (editAiProvider !== (data.profile.ai_provider || 'gemini')) updates.ai_provider = editAiProvider

      if (Object.keys(updates).length === 0) {
        setSuccess('변경사항이 없습니다.')
        setSaving(false)
        return
      }

      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || '저장 중 오류가 발생했습니다.')
        return
      }

      setData({ ...data, profile: result.profile })
      setSuccess('사용자 정보가 수정되었습니다.')
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetUsage() {
    if (!data) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords_used_this_month: 0,
          content_generated_this_month: 0,
          analysis_used_today: 0,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || '초기화 중 오류가 발생했습니다.')
        return
      }

      setData({ ...data, profile: result.profile })
      setSuccess('사용량이 전체 초기화되었습니다.')
    } catch {
      setError('초기화 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetSingle(field: string, label: string) {
    if (!data) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: 0 }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || '초기화 중 오류가 발생했습니다.')
        return
      }

      setData({ ...data, profile: result.profile })
      setSuccess(`${label} 사용량이 초기화되었습니다.`)
    } catch {
      setError('초기화 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/admin/users')} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> 목록으로
        </Button>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const { profile, recentKeywords, recentContent, totalContent, totalKeywords } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">사용자 상세</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      {/* 메시지 */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700">{success}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 프로필 정보 + 수정 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">프로필 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">이메일</span>
                <span className="text-sm font-medium">{profile.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">가입일</span>
                <span className="text-sm">{new Date(profile.created_at).toLocaleDateString('ko-KR')}</span>
              </div>

              {/* 플랜 변경 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">플랜</span>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 역할 변경 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">역할</span>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> 사용자
                      </span>
                    </SelectItem>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" /> 관리자
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI 제공자 변경 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">AI 제공자</span>
                <Select
                  value={editAiProvider}
                  onValueChange={setEditAiProvider}
                  disabled={editPlan === 'free'}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" /> Gemini
                      </span>
                    </SelectItem>
                    <SelectItem value="claude">
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" /> Claude
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editPlan === 'free' && (
                <p className="text-xs text-muted-foreground">
                  Free 플랜은 Gemini만 사용 가능합니다.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="gap-1">
                <Save className="h-4 w-4" />
                {saving ? '저장 중...' : '변경사항 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 사용량 통계 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">사용량 통계</CardTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">전체 초기화</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>전체 사용량 초기화</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 사용자의 월간/일간 사용량을 모두 0으로 초기화합니다. 계속하시겠습니까?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetUsage}>전체 초기화</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <span className="text-sm">키워드 조회 (월간)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{profile.keywords_used_this_month}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    disabled={saving || profile.keywords_used_this_month === 0}
                    onClick={() => handleResetSingle('keywords_used_this_month', '키워드 조회')}
                  >
                    초기화
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <span className="text-sm">콘텐츠 생성 (월간)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{profile.content_generated_this_month}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    disabled={saving || profile.content_generated_this_month === 0}
                    onClick={() => handleResetSingle('content_generated_this_month', '콘텐츠 생성')}
                  >
                    초기화
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <span className="text-sm">블로그 분석 (일간)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{profile.analysis_used_today}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    disabled={saving || profile.analysis_used_today === 0}
                    onClick={() => handleResetSingle('analysis_used_today', '블로그 분석')}
                  >
                    초기화
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">전체 콘텐츠</span>
                <span className="text-lg font-semibold">{totalContent}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">전체 키워드 검색</span>
                <span className="text-lg font-semibold">{totalKeywords}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 최근 활동 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">최근 키워드 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentKeywords.map((kw) => (
                <div key={kw.id} className="flex items-center justify-between rounded-lg border p-2">
                  <span className="text-sm">{kw.seed_keyword}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(kw.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              ))}
              {recentKeywords.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">검색 기록이 없습니다</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">최근 콘텐츠 생성</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentContent.map((ct) => (
                <div key={ct.id} className="rounded-lg border p-2">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium">{ct.title}</span>
                    <Badge className={planColors[ct.status] || 'bg-gray-100 text-gray-700'}>
                      {ct.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>키워드: {ct.target_keyword}</span>
                    <span>SEO: {ct.seo_score ?? '-'}</span>
                  </div>
                </div>
              ))}
              {recentContent.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">생성된 콘텐츠가 없습니다</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
