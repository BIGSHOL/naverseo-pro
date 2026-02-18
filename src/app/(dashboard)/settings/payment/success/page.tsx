'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, RefreshCw, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [planName, setPlanName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function confirmPayment() {
      const paymentKey = searchParams.get('paymentKey')
      const orderId = searchParams.get('orderId')
      const amount = searchParams.get('amount')
      const plan = searchParams.get('plan')

      if (!paymentKey || !orderId || !amount || !plan) {
        setStatus('error')
        setErrorMessage('결제 정보가 올바르지 않습니다.')
        return
      }

      try {
        const res = await fetch('/api/billing/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), plan }),
        })

        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setErrorMessage(data.error || '결제 확인에 실패했습니다.')
          return
        }

        setPlanName(data.planName)
        setStatus('success')
      } catch {
        setStatus('error')
        setErrorMessage('네트워크 오류가 발생했습니다.')
      }
    }

    confirmPayment()
  }, [searchParams])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12">
          {status === 'loading' && (
            <>
              <RefreshCw className="h-12 w-12 animate-spin text-primary" />
              <h2 className="mt-4 text-lg font-semibold">결제 확인 중...</h2>
              <p className="mt-2 text-sm text-muted-foreground">잠시만 기다려주세요</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="mt-4 text-xl font-bold">결제 완료!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-primary">{planName}</span> 플랜으로 업그레이드되었습니다
              </p>
              <div className="mt-6 flex gap-3">
                <Link href="/dashboard">
                  <Button>대시보드로 이동</Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline">설정 페이지</Button>
                </Link>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="rounded-full bg-red-100 p-4">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
              <h2 className="mt-4 text-xl font-bold">결제 오류</h2>
              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
              <div className="mt-6 flex gap-3">
                <Link href="/settings">
                  <Button>다시 시도</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline">대시보드로 이동</Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
