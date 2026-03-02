'use client'

import { Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ProgressState, ProgressOptions } from '@/types/progress'
import { getProgressPercent, getProgressMessage, getProgressDetail } from '@/types/progress'

type InlineProgressProps = {
  progress: ProgressState
  options?: ProgressOptions
  className?: string
}

/**
 * 인라인 Progress 컴포넌트
 *
 * 버튼 내부나 작은 영역에서 사용하는 간단한 진행률 표시
 *
 * @example
 * <InlineProgress
 *   progress={{ step: 2, totalSteps: 5, message: '분석 중...' }}
 *   options={{ showBar: true, showDetail: true }}
 * />
 */
export function InlineProgress({ progress, options, className }: InlineProgressProps) {
  const {
    showBar = false,
    showPercent = false,
    showDetail = true,
    size = 'md',
  } = options || {}

  const percent = getProgressPercent(progress)
  const message = getProgressMessage(progress)
  const detail = getProgressDetail(progress)

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-primary', iconSizes[size])} />
      <div className="flex flex-col gap-1 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-muted-foreground', textSizes[size])}>
            {message}
          </span>
          {showPercent && (
            <span className={cn('font-medium', textSizes[size])}>
              {percent}%
            </span>
          )}
          {showDetail && detail && (
            <span className={cn('text-muted-foreground', textSizes[size])}>
              ({detail})
            </span>
          )}
        </div>
        {showBar && (
          <Progress value={percent} className="h-1.5" />
        )}
      </div>
    </div>
  )
}
