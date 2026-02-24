'use client'

import { Lock, Zap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PLANS, type Plan } from '@/types/database'

interface PlanGateAlertProps {
  /** API 에러 응답에서 받은 메시지 */
  message: string
  /** 현재 사용자 플랜 (선택) */
  currentPlan?: Plan
}

/**
 * 플랜 제한으로 기능 사용이 불가할 때 표시하는 업그레이드 안내 카드.
 * API 에러 응답에서 planGate: true일 때 setError 대신 이 컴포넌트를 렌더하면 됩니다.
 */
export function PlanGateAlert({ message, currentPlan }: PlanGateAlertProps) {
  const planName = currentPlan ? PLANS[currentPlan]?.name : null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Lock className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">플랜 업그레이드 필요</h3>
          <p className="mt-1 text-sm text-amber-700">{message}</p>
          {planName && (
            <p className="mt-1 text-xs text-amber-600">
              현재 플랜: {planName}
            </p>
          )}
          <Link href="/billing" className="mt-3 inline-block">
            <Button size="sm" className="gap-2">
              <Zap className="h-4 w-4" />
              플랜 업그레이드
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
