'use client'

import { usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { pathToFeatureKey } from '@/lib/features'
import { useUserProfile } from '@/contexts/user-profile'

/**
 * 기능 비활성화 가드
 * 현재 페이지의 기능이 관리자에 의해 비활성화되었으면 차단 메시지를 표시
 * UserProfileProvider 컨텍스트에서 비활성화 목록을 읽어 별도 API 호출 없음
 */
export function FeatureGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { loaded, disabledFeatures } = useUserProfile()

  // 아직 로딩 중이면 children을 그대로 보여줌 (각 페이지가 자체 스켈레톤 처리)
  if (!loaded) return <>{children}</>

  const featureKey = pathToFeatureKey(pathname)
  if (!featureKey) return <>{children}</>

  if (disabledFeatures.includes(featureKey)) {
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
