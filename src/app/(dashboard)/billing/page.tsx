'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Check, ArrowLeft, Zap, AlertCircle, ArrowDown, CalendarDays } from 'lucide-react'
import { PLANS, type Plan, type PlanInfo } from '@/types/database'
import Link from 'next/link'

export default function BillingPage() {
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState<Plan>('free')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [creditsResetAt, setCreditsResetAt] = useState<string | null>(null)
  const [tossClientKey, setTossClientKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [downgradeConfirm, setDowngradeConfirm] = useState<Plan | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
        setCreditsResetAt(data.profile?.credits_reset_at || null)
        setTossClientKey(data.tossClientKey)
      } catch {
        setError('결제 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadBilling()
  }, [])

  // 업그레이드 (토스 결제)
  const handleUpgrade = async (planKey: Plan) => {
    const planInfo = PLANS[planKey]
    if (!planInfo || planInfo.price === 0) return

    if (!tossClientKey) {
      setError('결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.')
      return
    }

    setPaymentLoading(planKey)
    setError('')
    setSuccess('')

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
        customerName: '고객',
        card: {
          useEscrow: false,
          flowMode: 'DEFAULT',
          useCardPoint: false,
          useAppCardOnly: false,
        },
      })
    } catch (err: unknown) {
      // 사용자가 결제 취소한 경우
      const errorMessage = err instanceof Error ? err.message : String(err)
      const errorCode = (err as { code?: string })?.code

      if (
        errorMessage.includes('cancel') ||
        errorMessage.includes('Cancel') ||
        errorCode === 'USER_CANCEL' ||
        errorCode === 'PAY_PROCESS_CANCELED'
      ) {
        // 취소는 에러가 아님
      } else {
        console.error('[Billing] 결제 SDK 오류:', err)
        setError(`결제 요청 중 오류: ${errorMessage}`)
      }
    } finally {
      setPaymentLoading(null)
    }
  }

  // 다운그레이드 (결제 없이 플랜 변경)
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
      setSuccess(`${data.planName} 플랜으로 변경되었습니다. (크레딧: ${data.credits})`)
    } catch {
      setError('플랜 변경 중 오류가 발생했습니다.')
    } finally {
      setPaymentLoading(null)
    }
  }

  // 플랜 순서 (admin 제외)
  const planOrder: Plan[] = ['free', 'lite', 'starter', 'pro', 'business', 'agency']
  const currentPlanIndex = planOrder.indexOf(currentPlan)

  // 크레딧 리셋일 포맷
  const formatResetDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
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
            <h1 className="text-2xl font-bold">요금제 변경</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 플랜: <Badge variant="outline" className="ml-1">{PLANS[currentPlan].name}</Badge>
              {creditsResetAt && (
                <span className="ml-2">
                  <CalendarDays className="mr-1 inline h-3 w-3" />
                  크레딧 리셋: {formatResetDate(creditsResetAt)}
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
        </div>
      )}

      {!tossClientKey && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          결제 시스템이 아직 설정되지 않았습니다. 테스트 모드에서는 실제 결제가 이루어지지 않습니다.
        </div>
      )}

      {/* 다운그레이드 확인 모달 */}
      {downgradeConfirm && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            정말로 <strong>{PLANS[downgradeConfirm].name}</strong> 플랜으로 변경하시겠습니까?
          </p>
          <p className="mt-1 text-sm text-amber-700">
            월간 크레딧이 {PLANS[downgradeConfirm].credits.toLocaleString()}으로 줄어들며, 현재 잔여 크레딧이 새 한도를 초과하면 조정됩니다.
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

      {/* 플랜 카드 그리드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planOrder.map((planKey) => {
          const planInfo = PLANS[planKey] as PlanInfo
          const isCurrent = planKey === currentPlan
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
            <p>- 결제는 <strong>단건 결제</strong>입니다. (자동 갱신 아님)</p>
            <p>- 매월 이용을 원하시면 결제 기간 만료 전 다시 결제해주세요.</p>
            <p>- 크레딧은 매월 리셋일에 자동으로 충전됩니다.</p>
            <p>- 플랜 변경(업그레이드/다운그레이드) 시 크레딧이 즉시 조정됩니다.</p>
            <p>- 결제는 토스페이먼츠를 통해 안전하게 처리됩니다.</p>
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
