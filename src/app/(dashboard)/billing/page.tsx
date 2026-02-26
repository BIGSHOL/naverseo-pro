'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CreditCard, Check, ArrowLeft, Zap, AlertCircle,
  ArrowDown, CalendarDays, ExternalLink, RefreshCw,
} from 'lucide-react'
import { PLANS, type Plan, type PlanInfo } from '@/types/database'
import Link from 'next/link'

type SubscriptionStatus = 'none' | 'on_trial' | 'active' | 'paused' | 'past_due' | 'cancelled' | 'expired'

const STATUS_LABELS: Record<SubscriptionStatus, { label: string; color: string }> = {
  none: { label: '미구독', color: 'bg-gray-100 text-gray-700' },
  on_trial: { label: '체험 중', color: 'bg-blue-100 text-blue-700' },
  active: { label: '구독 중', color: 'bg-green-100 text-green-700' },
  paused: { label: '일시정지', color: 'bg-yellow-100 text-yellow-700' },
  past_due: { label: '결제 실패', color: 'bg-red-100 text-red-700' },
  cancelled: { label: '해지 예정', color: 'bg-orange-100 text-orange-700' },
  expired: { label: '만료됨', color: 'bg-gray-100 text-gray-700' },
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentPlan, setCurrentPlan] = useState<Plan>('free')
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('none')
  const [hasSubscription, setHasSubscription] = useState(false)
  const [creditsResetAt, setCreditsResetAt] = useState<string | null>(null)
  const [lsConfigured, setLsConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [downgradeConfirm, setDowngradeConfirm] = useState<Plan | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadBilling = useCallback(async () => {
    try {
      const res = await fetch('/api/billing')
      if (!res.ok) {
        setError('결제 정보를 불러오지 못했습니다.')
        return
      }
      const data = await res.json()
      const profile = data.profile
      // admin 역할이면 plan='admin'으로 표시 (sidebar와 동일 패턴)
      const effectivePlan = profile?.role === 'admin' ? 'admin' : (profile?.plan || 'free')
      setCurrentPlan(effectivePlan as Plan)
      setSubscriptionStatus((profile?.subscription_status || 'none') as SubscriptionStatus)
      setHasSubscription(!!profile?.lemonsqueezy_subscription_id)
      setCreditsResetAt(profile?.credits_reset_at || null)
      setLsConfigured(data.lemonSqueezyConfigured || false)
    } catch {
      setError('결제 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBilling()
  }, [loadBilling])

  // 체크아웃 성공 후 돌아온 경우
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccess('결제가 완료되었습니다! 잠시 후 플랜이 반영됩니다.')
      const timer = setTimeout(() => loadBilling(), 3000)
      return () => clearTimeout(timer)
    }
  }, [searchParams, loadBilling])

  // Lemon.js 초기화
  useEffect(() => {
    if (typeof window !== 'undefined' && window.createLemonSqueezy) {
      window.createLemonSqueezy()
    }
  }, [])

  // 업그레이드 (LemonSqueezy 체크아웃)
  const handleUpgrade = async (planKey: Plan) => {
    const planInfo = PLANS[planKey]
    if (!planInfo || planInfo.price === 0) return

    setPaymentLoading(planKey)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '체크아웃 생성에 실패했습니다.')
        return
      }

      // 데모 모드: 바로 플랜 변경됨
      if (data.demo) {
        setCurrentPlan(planKey)
        setSubscriptionStatus('active')
        setSuccess(`${data.planName} 플랜으로 변경되었습니다. (데모 모드)`)
        return
      }

      // LemonSqueezy 오버레이 체크아웃 열기
      if (data.checkoutUrl) {
        if (window.LemonSqueezy) {
          window.LemonSqueezy.Url.Open(data.checkoutUrl)
        } else {
          window.open(data.checkoutUrl, '_blank')
        }
      }
    } catch {
      setError('결제 요청 중 오류가 발생했습니다.')
    } finally {
      setPaymentLoading(null)
    }
  }

  // 다운그레이드 / 무료 전환
  const handleDowngrade = async (planKey: Plan) => {
    setPaymentLoading(planKey)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '플랜 변경에 실패했습니다.')
        return
      }

      setCurrentPlan(planKey)
      setDowngradeConfirm(null)
      setSuccess(data.message || `${data.planName} 플랜으로 변경되었습니다.`)
      setTimeout(() => loadBilling(), 2000)
    } catch {
      setError('플랜 변경 중 오류가 발생했습니다.')
    } finally {
      setPaymentLoading(null)
    }
  }

  // 구독 관리 (고객 포털)
  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/billing/portal')
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '구독 관리 페이지를 열 수 없습니다.')
        return
      }

      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank')
      }
    } catch {
      setError('구독 관리 페이지를 여는 중 오류가 발생했습니다.')
    }
  }

  const planOrder: Plan[] = ['free', 'lite', 'starter', 'pro', 'enterprise']
  // admin은 모든 플랜보다 상위 (index = planOrder.length)
  const currentPlanIndex = currentPlan === 'admin' ? planOrder.length : planOrder.indexOf(currentPlan)

  const formatResetDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    // 과거 날짜(lazy reset 트리거용 epoch 등)이면 다음 달 1일로 표시
    if (d <= new Date()) {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return `${next.getFullYear()}년 ${next.getMonth() + 1}월 ${next.getDate()}일`
    }
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[subscriptionStatus]

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">구독 관리</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 플랜: <Badge variant="outline" className="ml-1">{PLANS[currentPlan].name}</Badge>
              {subscriptionStatus !== 'none' && (
                <Badge className={`ml-2 ${statusInfo.color}`}>{statusInfo.label}</Badge>
              )}
              {creditsResetAt && (
                <span className="ml-2">
                  <CalendarDays className="mr-1 inline h-3 w-3" />
                  다음 갱신: {formatResetDate(creditsResetAt)}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <Check className="h-4 w-4 shrink-0" />
          {success}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => loadBilling()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            새로고침
          </Button>
        </div>
      )}

      {!lsConfigured && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          결제 시스템이 아직 설정되지 않았습니다. 데모 모드에서는 실제 결제가 이루어지지 않습니다.
        </div>
      )}

      {/* 구독 관리 버튼 */}
      {hasSubscription && subscriptionStatus !== 'expired' && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">구독 관리</p>
              <p className="text-xs text-muted-foreground">
                결제수단 변경, 인보이스 확인, 구독 해지를 할 수 있습니다.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleManageSubscription}>
              <ExternalLink className="h-4 w-4" />
              구독 관리
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 다운그레이드 확인 */}
      {downgradeConfirm && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            정말로 <strong>{PLANS[downgradeConfirm].name}</strong> 플랜으로 변경하시겠습니까?
          </p>
          <p className="mt-1 text-sm text-amber-700">
            {downgradeConfirm === 'free'
              ? '구독이 해지되며, 현재 결제 기간 만료 후 무료 플랜으로 전환됩니다.'
              : `월간 크레딧이 ${PLANS[downgradeConfirm].credits.toLocaleString()}으로 줄어듭니다.`
            }
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDowngrade(downgradeConfirm)}
              disabled={!!paymentLoading}
            >
              {paymentLoading === downgradeConfirm ? '변경 중...' : '변경 확인'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDowngradeConfirm(null)}
              disabled={!!paymentLoading}
            >
              취소
            </Button>
          </div>
        </div>
      )}

      {/* 관리자 안내 */}
      {currentPlan === 'admin' && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">관리자 계정</p>
              <p className="text-sm text-muted-foreground">
                모든 기능을 무제한으로 사용할 수 있습니다. 결제가 필요하지 않습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 플랜 카드 그리드 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {planOrder.map((planKey) => {
          const planInfo = PLANS[planKey] as PlanInfo
          const isCurrent = planKey === currentPlan
          const isAdmin = currentPlan === 'admin'
          const isDowngrade = planOrder.indexOf(planKey) < currentPlanIndex
          const isFree = planKey === 'free'

          return (
            <Card
              key={planKey}
              className={`relative flex flex-col ${
                isCurrent
                  ? 'border-primary bg-primary/5 ring-2 ring-primary'
                  : planInfo.popular
                  ? 'ring-1 ring-primary/50'
                  : ''
              }`}
            >
              {isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  현재 플랜
                </Badge>
              )}
              {planInfo.popular && !isCurrent && (
                <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  인기
                </Badge>
              )}

              <CardHeader className="pb-3 pt-6">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg">{planInfo.name}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {planInfo.credits.toLocaleString()} 크레딧/월
                </p>
                <div className="mt-2">
                  <span className="text-3xl font-bold">
                    {planInfo.price === 0 ? '무료' : planInfo.priceLabel}
                  </span>
                  {planInfo.price > 0 && (
                    <span className="text-sm text-muted-foreground">/월</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-2">
                  {planInfo.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 pt-3">
                  {isAdmin ? (
                    <Button variant="outline" className="w-full" disabled>
                      관리자
                    </Button>
                  ) : isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      사용 중
                    </Button>
                  ) : isDowngrade || (isFree && currentPlan !== 'free') ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setDowngradeConfirm(planKey)}
                      disabled={!!paymentLoading || downgradeConfirm === planKey}
                    >
                      <ArrowDown className="h-4 w-4" />
                      {isFree ? '무료로 전환' : `${planInfo.name}으로 변경`}
                    </Button>
                  ) : (
                    <Button
                      className="w-full gap-2"
                      onClick={() => handleUpgrade(planKey)}
                      disabled={!!paymentLoading}
                    >
                      {paymentLoading === planKey ? (
                        '결제 진행 중...'
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          {planInfo.priceLabel}/월 구독
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 안내 사항 */}
      <Card>
        <CardContent className="py-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>- 구독은 <strong>월간 자동 갱신</strong>됩니다.</p>
            <p>- 크레딧은 매월 갱신일에 자동으로 충전됩니다.</p>
            <p>- 구독 해지 시 현재 결제 기간 만료까지 서비스를 이용할 수 있습니다.</p>
            <p>- 플랜 업그레이드 시 즉시 반영됩니다.</p>
            <p>- 결제는 LemonSqueezy를 통해 안전하게 처리됩니다.</p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Link href="/settings">
          <Button variant="link" size="sm">
            설정 페이지로 돌아가기
          </Button>
        </Link>
      </div>
    </div>
  )
}
