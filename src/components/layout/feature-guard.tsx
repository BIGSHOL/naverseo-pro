'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { pathToFeatureKey } from '@/lib/features'

/**
 * 기능 비활성화 가드
 * 현재 페이지의 기능이 관리자에 의해 비활성화되었으면 차단 메시지를 표시
 */
export function FeatureGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [disabled, setDisabled] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const featureKey = pathToFeatureKey(pathname)
    if (!featureKey) {
      setChecked(true)
      return
    }

    async function checkFeature() {
      try {
        const res = await fetch('/api/features')
        if (!res.ok) {
          setChecked(true)
          return
        }
        const data = await res.json()
        const disabledFeatures: string[] = data.disabledFeatures || []
        setDisabled(disabledFeatures.includes(featureKey!))
      } catch {
        // 오류 시 기능 활성화 상태로 처리
      } finally {
        setChecked(true)
      }
    }
    checkFeature()
  }, [pathname])

  if (!checked) return null

  if (disabled) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-lg font-semibold">기능 비활성화</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              이 기능은 현재 관리자에 의해 비활성화되어 있습니다.
              <br />
              서비스 점검 중이거나 기능이 일시 중단되었을 수 있습니다.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard">대시보드로 돌아가기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
