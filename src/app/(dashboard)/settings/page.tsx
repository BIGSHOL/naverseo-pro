'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  User,
  CreditCard,
  Check,
  AlertCircle,
  RefreshCw,
  LogOut,
  Lock,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLANS, type Plan } from '@/types/database'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ProfileData {
  plan: Plan
  keywords_used_this_month: number
  content_generated_this_month: number
  analysis_used_today: number
  analysis_reset_date: string | null
  email: string
  created_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/billing')
      if (!res.ok) {
        setFetchError('설정 데이터를 불러오지 못했습니다.')
        return
      }
      const data = await res.json()
      setProfile(data.profile)
    } catch {
      setFetchError('설정 데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (!isSupabaseConfigured()) {
      setPwError('Supabase가 설정되지 않았습니다.')
      return
    }

    if (newPassword.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPwError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setPwLoading(true)
    try {
      const supabase = createClient()

      // 현재 비밀번호로 재인증
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: currentPassword,
      })

      if (signInError) {
        setPwError('현재 비밀번호가 올바르지 않습니다.')
        return
      }

      // 새 비밀번호로 변경
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        if (updateError.message.includes('same password')) {
          setPwError('현재 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.')
        } else {
          setPwError(updateError.message)
        }
        return
      }

      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch {
      setPwError('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setPwLoading(false)
    }
  }

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // ignore
      }
    }
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
        {fetchError}
      </div>
    )
  }

  const currentPlan = profile?.plan || 'free'
  const currentPlanInfo = PLANS[currentPlan]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="mt-1 text-muted-foreground">
          계정 정보를 관리하세요
        </p>
      </div>

      {/* 프로필 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            프로필 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">이메일</p>
              <p className="font-medium">{profile?.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">가입일</p>
              <p className="font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('ko-KR')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">현재 플랜</p>
              <div className="flex items-center gap-2">
                <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'}>
                  {currentPlanInfo.name}
                </Badge>
                <span className="text-sm font-medium">{currentPlanInfo.priceLabel}/월</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">사용량</p>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">월간</span>{' '}
                  키워드 {profile?.keywords_used_this_month || 0}/{currentPlanInfo.keywords}
                  {' · '}
                  콘텐츠 {profile?.content_generated_this_month || 0}/{currentPlanInfo.content}
                </p>
                <p>
                  <span className="text-muted-foreground">일간</span>{' '}
                  분석 {profile?.analysis_used_today || 0}/{currentPlanInfo.analysis}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700">
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            비밀번호 변경
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {pwError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                비밀번호가 성공적으로 변경되었습니다.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">현재 비밀번호</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="현재 비밀번호를 입력하세요"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">새 비밀번호</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="6자 이상 입력하세요"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">새 비밀번호 확인</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={pwLoading}>
              {pwLoading ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 플랜 변경 - 결제 기능 준비 중 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            플랜 변경
            <Badge variant="secondary" className="ml-2 text-xs">추후 공개</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            결제 기능은 준비 중입니다. 현재는 무료 플랜으로 모든 기능을 체험하실 수 있습니다.
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(
              ([planKey, planInfo]) => {
                const isCurrent = planKey === currentPlan

                return (
                  <div
                    key={planKey}
                    className={`relative flex flex-col rounded-lg border p-4 ${
                      isCurrent
                        ? 'border-primary bg-primary/5'
                        : ''
                    }`}
                  >
                    {isCurrent && (
                      <Badge variant="outline" className="absolute -top-2.5 left-1/2 -translate-x-1/2 border-primary bg-white">
                        현재 플랜
                      </Badge>
                    )}

                    <div className="mt-2">
                      <h3 className="font-semibold">{planInfo.name}</h3>
                      <p className="mt-1 text-2xl font-bold">
                        {planInfo.priceLabel}
                        <span className="text-sm font-normal text-muted-foreground">/월</span>
                      </p>
                    </div>

                    <ul className="mt-4 space-y-2">
                      {planInfo.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-4">
                      {isCurrent ? (
                        <Button variant="outline" size="sm" className="w-full" disabled>
                          사용 중
                        </Button>
                      ) : (
                        <Button size="sm" className="w-full" disabled>
                          준비 중
                        </Button>
                      )}
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
