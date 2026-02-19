'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  User,
  CreditCard,
  Check,
  AlertCircle,
  RefreshCw,
  LogOut,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PLANS, type Plan } from '@/types/database'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ProfileData {
  plan: Plan
  keywords_used_this_month: number
  content_generated_this_month: number
  email: string
  created_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/billing')
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile)
    } catch {
      // 로드 실패
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

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

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

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
              <p className="text-sm text-muted-foreground">이번 달 사용량</p>
              <p className="text-sm">
                키워드 {profile?.keywords_used_this_month || 0}회
                {' · '}
                콘텐츠 {profile?.content_generated_this_month || 0}편
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700">
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                try {
                  const res = await fetch('/api/content/recalculate-seo', { method: 'POST' })
                  const data = await res.json()
                  setMessage({ type: 'success', text: data.message || 'SEO 점수가 업데이트되었습니다.' })
                } catch {
                  setMessage({ type: 'error', text: 'SEO 점수 재계산에 실패했습니다.' })
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />
              SEO 점수 재계산
            </Button>
          </div>
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
