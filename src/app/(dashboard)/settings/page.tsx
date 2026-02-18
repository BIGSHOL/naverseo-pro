'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  User,
  CreditCard,
  Crown,
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
  const [tossClientKey, setTossClientKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<Plan | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/billing')
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile)
      setTossClientKey(data.tossClientKey)
    } catch {
      // 로드 실패
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleUpgrade = async (targetPlan: Plan) => {
    if (!profile) return
    if (targetPlan === profile.plan) return
    if (targetPlan === 'free') return

    const planInfo = PLANS[targetPlan]
    setUpgrading(targetPlan)
    setMessage(null)

    // 토스페이먼츠 클라이언트 키가 있으면 실제 결제
    if (tossClientKey) {
      try {
        const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk')
        const tossPayments = await loadTossPayments(tossClientKey)
        const payment = tossPayments.payment({ customerKey: profile.email })

        const orderId = `NSEO_${targetPlan}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

        await payment.requestPayment({
          method: 'CARD',
          amount: { currency: 'KRW', value: planInfo.price },
          orderId,
          orderName: `NaverSEO Pro ${planInfo.name} 플랜`,
          successUrl: `${window.location.origin}/settings/payment/success?plan=${targetPlan}`,
          failUrl: `${window.location.origin}/settings/payment/fail`,
        })
      } catch (error) {
        if (error instanceof Error && error.message.includes('취소')) {
          setMessage({ type: 'error', text: '결제가 취소되었습니다.' })
        } else {
          setMessage({ type: 'error', text: '결제 창을 열 수 없습니다.' })
        }
      } finally {
        setUpgrading(null)
      }
    } else {
      // 데모 모드: 토스 키 없이 바로 플랜 변경
      try {
        const res = await fetch('/api/billing/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey: `demo_${Date.now()}`,
            orderId: `demo_${targetPlan}_${Date.now()}`,
            amount: planInfo.price,
            plan: targetPlan,
          }),
        })

        const data = await res.json()
        if (res.ok) {
          setMessage({ type: 'success', text: `${data.planName} 플랜으로 변경되었습니다! (데모)` })
          await loadProfile()
        } else {
          setMessage({ type: 'error', text: data.error || '플랜 변경에 실패했습니다.' })
        }
      } catch {
        setMessage({ type: 'error', text: '네트워크 오류가 발생했습니다.' })
      } finally {
        setUpgrading(null)
      }
    }
  }

  const handleDowngradeToFree = async () => {
    setUpgrading('free')
    setMessage(null)

    try {
      const res = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentKey: `downgrade_${Date.now()}`,
          orderId: `downgrade_free_${Date.now()}`,
          amount: 0,
          plan: 'free',
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Free 플랜으로 변경되었습니다.' })
        await loadProfile()
      } else {
        setMessage({ type: 'error', text: data.error || '플랜 변경에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했습니다.' })
    } finally {
      setUpgrading(null)
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

  const currentPlan = profile?.plan || 'free'
  const currentPlanInfo = PLANS[currentPlan]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="mt-1 text-muted-foreground">
          계정 정보와 결제 설정을 관리하세요
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

      {!tossClientKey && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          토스페이먼츠 키가 설정되지 않아 데모 모드로 동작합니다. 실제 결제 없이 플랜 변경이 가능합니다.
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
          <div className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700">
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 플랜 변경 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            플랜 변경
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(
              ([planKey, planInfo]) => {
                const isCurrent = planKey === currentPlan
                const isDowngrade = planInfo.price < currentPlanInfo.price
                const isUpgrade = planInfo.price > currentPlanInfo.price

                return (
                  <div
                    key={planKey}
                    className={`relative flex flex-col rounded-lg border p-4 ${
                      isCurrent
                        ? 'border-primary bg-primary/5'
                        : planInfo.popular
                          ? 'border-primary/50'
                          : ''
                    }`}
                  >
                    {planInfo.popular && !isCurrent && (
                      <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <Crown className="mr-1 h-3 w-3" />
                        인기
                      </Badge>
                    )}
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
                      ) : isUpgrade ? (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleUpgrade(planKey)}
                          disabled={upgrading !== null}
                        >
                          {upgrading === planKey && (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          업그레이드
                        </Button>
                      ) : isDowngrade ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() =>
                            planKey === 'free'
                              ? handleDowngradeToFree()
                              : handleUpgrade(planKey)
                          }
                          disabled={upgrading !== null}
                        >
                          {upgrading === planKey && (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          다운그레이드
                        </Button>
                      ) : null}
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
