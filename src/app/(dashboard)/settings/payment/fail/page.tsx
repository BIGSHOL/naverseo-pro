'use client'

import { useSearchParams } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function PaymentFailPage() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('code')
  const errorMessage = searchParams.get('message')

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12">
          <div className="rounded-full bg-red-100 p-4">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>
          <h2 className="mt-4 text-xl font-bold">결제 실패</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessage || '결제 처리 중 문제가 발생했습니다.'}
          </p>
          {errorCode && (
            <p className="mt-1 text-xs text-muted-foreground">
              오류 코드: {errorCode}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <Link href="/settings">
              <Button>다시 시도</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">대시보드로 이동</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
