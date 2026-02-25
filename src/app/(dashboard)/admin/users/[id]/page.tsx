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
import { Input } from '@/components/ui/input'
import { ArrowLeft, Bot, Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Coins, Link2, Save, Shield, ShieldOff, User } from 'lucide-react'
import { CREDIT_FEATURE_LABELS, type CreditFeature } from '@/types/database'

interface UserProfile {
  id: string
  email: string
  plan: string
  role: string
  credits_balance: number
  credits_monthly_quota: number
  credits_reset_at: string
  keywords_used_this_month: number
  content_generated_this_month: number
  analysis_used_today: number
  analysis_reset_date: string
  ai_provider: string
  lemonsqueezy_subscription_id: string | null
  subscription_status: string | null
  blog_verification_blocked: boolean | null
  blog_verification_attempts: number | null
  blog_verification_last_attempt_at: string | null
  created_at: string
  updated_at: string
}

interface Identity {
  provider: string
  created_at?: string
  identity_id?: string
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

interface CreditLog {
  feature: string
  credits_spent: number
  created_at: string
}

interface UserDetailData {
  profile: UserProfile
  identities: Identity[]
  lastSignIn: string | null
  recentKeywords: RecentKeyword[]
  recentContent: RecentContent[]
  totalContent: number
  totalKeywords: number
  creditLogs: CreditLog[]
  kwPage: number
  ctPage: number
  perPage: number
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  kakao: 'Kakao',
  email: '이메일',
  phone: '전화번호',
}

const STATUS_LABELS: Record<string, string> = {
  draft: '초안',
  published: '발행됨',
  archived: '보관됨',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-700',
}

const SUBSCRIPTION_LABELS: Record<string, string> = {
  none: '없음',
  on_trial: '체험 중',
  active: '구독 중',
  paused: '일시정지',
  past_due: '결제 지연',
  cancelled: '해지됨',
  expired: '만료됨',
}

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  lite: 'bg-green-100 text-green-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-orange-100 text-orange-700',
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
  const [addCreditsAmount, setAddCreditsAmount] = useState('')
  const [kwPage, setKwPage] = useState(1)
  const [ctPage, setCtPage] = useState(1)

  async function loadUser(kwP = 1, ctP = 1) {
    try {
      const res = await fetch(`/api/admin/users/${id}?kwPage=${kwP}&ctPage=${ctP}`)
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
      setKwPage(userData.kwPage)
      setCtPage(userData.ctPage)
    } catch {
      setError('사용자 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleResetCredits() {
    if (!data) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_credits: true }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || '크레딧 리셋 중 오류가 발생했습니다.')
        return
      }

      setData({ ...data, profile: result.profile })
      setSuccess('크레딧이 월간 할당량으로 리셋되었습니다.')
    } catch {
      setError('크레딧 리셋 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUnblockVerification() {
    if (!data) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/blog-verification/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || '차단 해제 중 오류가 발생했습니다.')
        return
      }

      setData({
        ...data,
        profile: {
          ...data.profile,
          blog_verification_blocked: false,
          blog_verification_attempts: 0,
          blog_verification_last_attempt_at: null,
        },
      })
      setSuccess('블로그 인증 차단이 해제되었습니다.')
    } catch {
      setError('차단 해제 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCredits() {
    if (!data) return
    const amount = parseInt(addCreditsAmount, 10)
    if (!amount || amount <= 0) {
      setError('추가할 크레딧 수를 입력해주세요.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_credits: amount }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || '크레딧 추가 중 오류가 발생했습니다.')
        return
      }

      setData({ ...data, profile: result.profile })
      setAddCreditsAmount('')
      setSuccess(`${amount} 크레딧이 추가되었습니다.`)
    } catch {
      setError('크레딧 추가 중 오류가 발생했습니다.')
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

  const { profile, identities, lastSignIn, recentKeywords, recentContent, totalContent, totalKeywords, perPage } = data
  const kwTotalPages = Math.ceil(totalKeywords / perPage)
  const ctTotalPages = Math.ceil(totalContent / perPage)

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
              {lastSignIn && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">최근 로그인</span>
                  <span className="text-sm">{new Date(lastSignIn).toLocaleString('ko-KR')}</span>
                </div>
              )}

              {/* 연동 계정 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> 연동 계정
                </span>
                <div className="flex gap-1">
                  {identities && identities.length > 0 ? identities.map((ident, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {PROVIDER_LABELS[ident.provider] || ident.provider}
                    </Badge>
                  )) : (
                    <span className="text-xs text-muted-foreground">정보 없음</span>
                  )}
                </div>
              </div>

              {/* 구독 상태 */}
              {profile.subscription_status && profile.subscription_status !== 'none' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">구독 상태</span>
                  <Badge variant={profile.subscription_status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {SUBSCRIPTION_LABELS[profile.subscription_status] || profile.subscription_status}
                  </Badge>
                </div>
              )}

              {/* 플랜 변경 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">플랜</span>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="lite">Lite</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
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

            {/* 블로그 인증 차단 상태 */}
            {profile.blog_verification_blocked && (
              <div className="border-t pt-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-destructive flex items-center gap-1">
                        <ShieldOff className="h-4 w-4" />
                        블로그 인증 차단됨
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        시도 횟수: {profile.blog_verification_attempts ?? 0}회
                        {profile.blog_verification_last_attempt_at && (
                          <> · 마지막 시도: {new Date(profile.blog_verification_last_attempt_at).toLocaleDateString('ko-KR')}</>
                        )}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={saving}>
                          차단 해제
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>블로그 인증 차단 해제</AlertDialogTitle>
                          <AlertDialogDescription>
                            이 사용자의 블로그 인증 차단을 해제하고 시도 횟수를 초기화합니다. 계속하시겠습니까?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction onClick={handleUnblockVerification}>해제</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 크레딧 관리 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Coins className="h-5 w-5" />
              크레딧 관리
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 현재 크레딧 잔액 */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">크레딧 잔액</span>
                <span className="text-2xl font-bold">
                  {(profile.credits_balance ?? 0).toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}/ {(profile.credits_monthly_quota ?? 30).toLocaleString()}
                  </span>
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${profile.credits_monthly_quota ? Math.min(100, ((profile.credits_balance ?? 0) / profile.credits_monthly_quota) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                다음 리셋: {profile.credits_reset_at
                  ? new Date(profile.credits_reset_at).toLocaleDateString('ko-KR')
                  : '미설정 (첫 사용 시 자동 설정)'}
              </p>
            </div>

            {/* 크레딧 추가 (입력 + 빠른 버튼 한 행) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">크레딧 추가</label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  placeholder="직접 입력"
                  value={addCreditsAmount}
                  onChange={(e) => setAddCreditsAmount(e.target.value)}
                  min={1}
                  className="w-28"
                />
                {[10, 50, 100, 500].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={saving}
                    onClick={() => setAddCreditsAmount(String(amount))}
                  >
                    +{amount}
                  </Button>
                ))}
                <Button onClick={handleAddCredits} disabled={saving} size="sm">
                  추가
                </Button>
              </div>
            </div>

            {/* 크레딧 리셋 */}
            <div className="border-t pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    크레딧 리셋
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>크레딧 리셋</AlertDialogTitle>
                    <AlertDialogDescription>
                      이 사용자의 크레딧을 월간 할당량({(profile.credits_monthly_quota ?? 30).toLocaleString()})으로 리셋합니다. 계속하시겠습니까?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetCredits}>리셋</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t pt-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">전체 콘텐츠</span>
                <span className="text-lg font-semibold">{totalContent}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">전체 키워드</span>
                <span className="text-lg font-semibold">{totalKeywords}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 크레딧 사용 내역 */}
      <CreditUsageCard logs={data.creditLogs} />

      {/* 최근 활동 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>최근 키워드 검색</span>
              <span className="text-sm font-normal text-muted-foreground">{totalKeywords}건</span>
            </CardTitle>
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
            {kwTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={kwPage <= 1}
                  onClick={() => { setKwPage(kwPage - 1); loadUser(kwPage - 1, ctPage) }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {kwPage} / {kwTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={kwPage >= kwTotalPages}
                  onClick={() => { setKwPage(kwPage + 1); loadUser(kwPage + 1, ctPage) }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>최근 콘텐츠 생성</span>
              <span className="text-sm font-normal text-muted-foreground">{totalContent}건</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentContent.map((ct) => (
                <div key={ct.id} className="rounded-lg border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{ct.title}</span>
                    <Badge className={STATUS_COLORS[ct.status] || 'bg-gray-100 text-gray-700'}>
                      {STATUS_LABELS[ct.status] || ct.status}
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
            {ctTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={ctPage <= 1}
                  onClick={() => { setCtPage(ctPage - 1); loadUser(kwPage, ctPage - 1) }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {ctPage} / {ctTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={ctPage >= ctTotalPages}
                  onClick={() => { setCtPage(ctPage + 1); loadUser(kwPage, ctPage + 1) }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** 월별/일별 크레딧 소모 요약 카드 */
function CreditUsageCard({ logs }: { logs: CreditLog[] }) {
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            크레딧 사용 내역
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">사용 내역이 없습니다</p>
        </CardContent>
      </Card>
    )
  }

  // 월별 또는 일별로 그룹핑
  const grouped = new Map<string, { total: number; byFeature: Map<string, number> }>()
  for (const log of logs) {
    const d = new Date(log.created_at)
    const key = viewMode === 'monthly'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const entry = grouped.get(key) || { total: 0, byFeature: new Map<string, number>() }
    entry.total += log.credits_spent
    entry.byFeature.set(log.feature, (entry.byFeature.get(log.feature) || 0) + log.credits_spent)
    grouped.set(key, entry)
  }

  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))

  function formatKey(key: string) {
    const parts = key.split('-')
    if (parts.length === 2) return `${parts[0]}년 ${parseInt(parts[1])}월`
    return `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            크레딧 사용 내역
          </span>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => { setViewMode('monthly'); setExpandedKey(null) }}
            >
              월별
            </Button>
            <Button
              variant={viewMode === 'daily' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => { setViewMode('daily'); setExpandedKey(null) }}
            >
              일별
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {sortedKeys.slice(0, viewMode === 'daily' ? 14 : 6).map((key) => {
            const entry = grouped.get(key)!
            const isExpanded = expandedKey === key
            return (
              <div key={key} className="rounded-lg border">
                <button
                  className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <span className="text-sm font-medium">{formatKey(key)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-destructive">-{entry.total}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-2 space-y-1">
                    {Array.from(entry.byFeature.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([feature, spent]) => (
                        <div key={feature} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {CREDIT_FEATURE_LABELS[feature as CreditFeature] || feature}
                          </span>
                          <span className="text-destructive">-{spent}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground text-center">
          총 {logs.length}건 · 누적 {logs.reduce((s, l) => s + l.credits_spent, 0)} 크레딧 소모
        </p>
      </CardContent>
    </Card>
  )
}
