'use client'

import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ProgressState, ProgressOptions } from '@/types/progress'
import { getProgressPercent, getProgressMessage, getProgressDetail } from '@/types/progress'

type CardProgressProps = {
  progress: ProgressState
  options?: ProgressOptions
  className?: string
}

/**
 * Card Progress 컴포넌트
 *
 * 카드나 모달 내부에서 사용하는 중간 크기 진행률 표시
 *
 * @example
 * <CardProgress
 *   progress={{ current: 15, total: 100, message: '키워드 분석 중...' }}
 *   options={{ showBar: true, showPercent: true, showDetail: true }}
 * />
 */
export function CardProgress({ progress, options, className }: CardProgressProps) {
  const {
    showBar = true,
    showPercent = true,
    showDetail = true,
    size = 'md',
    variant = 'default',
  } = options || {}

  const percent = getProgressPercent(progress)
  const message = getProgressMessage(progress)
  const detail = getProgressDetail(progress)

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  const progressHeights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }

  const variantColors = {
    default: 'text-primary',
    primary: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }

  return (
    <Card className={className}>
      <CardContent className="py-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={cn('animate-spin', iconSizes[size], variantColors[variant])} />

          {showBar && (
            <div className="w-full max-w-sm space-y-2">
              <Progress
                value={percent}
                className={progressHeights[size]}
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{message}</span>
                <div className="flex items-center gap-2">
                  {showPercent && (
                    <span className="font-medium">{percent}%</span>
                  )}
                  {showDetail && detail && (
                    <span className="text-muted-foreground">({detail})</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {!showBar && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{message}</p>
              {showDetail && detail && (
                <p className="text-xs text-muted-foreground mt-1">({detail})</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
