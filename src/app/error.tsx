'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('페이지 오류:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">오류가 발생했습니다</h2>
        <p className="mt-2 text-muted-foreground">
          페이지를 불러오는 중 문제가 발생했습니다.
        </p>
        <Button onClick={reset} className="mt-6">
          다시 시도
        </Button>
      </div>
    </div>
  )
}
