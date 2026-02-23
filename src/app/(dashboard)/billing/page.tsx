'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Check, ArrowLeft, Zap, AlertCircle } from 'lucide-react'
import { PLANS, type Plan, type PlanInfo } from '@/types/database'
import Link from 'next/link'

export default function BillingPage() {
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState<Plan>('free')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [tossClientKey, setTossClientKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadBilling() {
      try {
        const res = await fetch('/api/billing')
        if (!res.ok) {
          setError('결제 정보를 불러오지 못했습니다.')
          return
        }
        const data = await res.json()
        setCurrentPlan((data.profile?.plan || 'free') as Plan)
        setEmail(data.profile?.email || '')
        setUserId(data.profile?.id || '')
        setTossClientKey(data.tossClientKey)
      } catch {
        setError('결제 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadBilling()
  }, [])

  const handleUpgrade = async (planKey: Plan) => {
    const planInfo = PLANS[planKey]
    if (!planInfo || planInfo.price === 0) return

    if (!tossClientKey) {
      setError('결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.')
      return
    }

    setPaymentLoading(planKey)
    setError('')

    try {
      const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk')
      const tossPayments = await loadTossPayments(tossClientKey)

      const payment = tossPayments.payment({
        customerKey: userId,
      })

      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      const orderId = `NSEO_${planKey}_${timestamp}_${random}`

      await payment.requestPayment({
        method: 'CARD',
        amount: {
          currency: 'KRW',
          value: planInfo.price,
        },
        orderId,
        orderName: `NaverSEO Pro ${planInfo.name} 플랜 (월간)`,
        successUrl: `${window.location.origin}/settings/payment/success?plan=${planKey}`,
        failUrl: `${window.location.origin}/settings/payment/fail`,
        customerEmail: email || undefined,
      })
    } catch (err) {
      // 사용자가 결제 취소한 경우
      if (err instanceof Error && err.message?.includes('cancel')) {
        // 취소는 에러가 아님
      } else {
        setError('결제 요청 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    } finally {
      setPaymentLoading(null)
    }
  }

  // 플랜 순서 (admin 제외)
  const planOrder: Plan[] = ['free', 'lite', 'starter', 'pro', 'business', 'agency']
  const currentPlanIndex = planOrder.indexOf(currentPlan)

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
            <h1 className="text-2xl font-bold">요금제 업그레이드</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 플랜: <Badge variant="outline" className="ml-1">{PLANS[currentPlan].name}</Badge>
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

      {!tossClientKey && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          결제 시스템이 아직 설정되지 않았습니다. 테스트 모드에서는 실제 결제가 이루어지지 않습니다.
        </div>
      )}

      {/* 플랜 카드 그리드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planOrder.map((planKey) => {
          const planInfo = PLANS[planKey] as PlanInfo
          const isCurrent = planKey === currentPlan
          const isDowngrade = planOrder.indexOf(planKey) < currentPlanIndex
          const isFree = planKey === 'free'
          const isUpgradable = !isCurrent && !isDowngrade && !isFree

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

              <CardHeader className="pb-3 pt-5">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg">{planInfo.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {planInfo.credits.toLocaleString()} 크레딧/월
                  </span>
                </CardTitle>
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
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      사용 중
                    </Button>
                  ) : isFree || isDowngrade ? (
                    <Button variant="outline" className="w-full" disabled>
                      {isFree ? '무료 플랜' : '다운그레이드 불가'}
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
                          {planInfo.priceLabel}/월 업그레이드
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
            <p>- 결제는 토스페이먼츠를 통해 안전하게 처리됩니다.</p>
            <p>- 업그레이드 시 즉시 새 플랜의 크레딧이 적용됩니다.</p>
            <p>- 플랜 다운그레이드는 현재 지원하지 않습니다. 고객센터에 문의해주세요.</p>
            <p>- 문의사항은 설정 페이지에서 확인할 수 있습니다.</p>
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
