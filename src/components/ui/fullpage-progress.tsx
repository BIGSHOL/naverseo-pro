'use client'

import { Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ProgressState, ProgressOptions } from '@/types/progress'
import { getProgressPercent, getProgressMessage, getProgressDetail } from '@/types/progress'

type FullPageProgressProps = {
  progress: ProgressState
  options?: ProgressOptions
  className?: string
  /** 배경 오버레이 투명도 */
  overlay?: boolean
  /** 오버레이 클릭 가능 여부 */
  dismissible?: boolean
  onDismiss?: () => void
}

/**
 * Full Page Progress 컴포넌트
 *
 * 전체 화면을 덮는 로딩 오버레이
 * 주로 페이지 전환이나 큰 작업 시 사용
 *
 * @example
 * <FullPageProgress
 *   progress={{ percent: 65, message: '콘텐츠 생성 중...' }}
 *   options={{ showBar: true, showPercent: true }}
 *   overlay
 * />
 */
export function FullPageProgress({
  progress,
  options,
  className,
  overlay = true,
  dismissible = false,
  onDismiss,
}: FullPageProgressProps) {
  const {
    showBar = true,
    showPercent = true,
    showDetail = true,
    size = 'lg',
    variant = 'default',
  } = options || {}

  const percent = getProgressPercent(progress)
  const message = getProgressMessage(progress)
  const detail = getProgressDetail(progress)

  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  const progressHeights = {
    sm: 'h-2',
    md: 'h-2.5',
    lg: 'h-3',
  }

  const variantColors = {
    default: 'text-primary',
    primary: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }

  const handleClick = () => {
    if (dismissible && onDismiss) {
      onDismiss()
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        overlay && 'bg-background/80 backdrop-blur-sm',
        dismissible && 'cursor-pointer',
        className
      )}
      onClick={handleClick}
    >
      <div
        className="flex flex-col items-center gap-6 rounded-lg bg-card p-8 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Loader2 className={cn('animate-spin', iconSizes[size], variantColors[variant])} />

        <div className="w-full max-w-md space-y-3">
          <div className="text-center">
            <h3 className="text-lg font-semibold">{message}</h3>
            {showDetail && detail && (
              <p className="text-sm text-muted-foreground mt-1">{detail}</p>
            )}
          </div>

          {showBar && (
            <div className="space-y-2">
              <Progress
                value={percent}
                className={progressHeights[size]}
              />
              {showPercent && (
                <p className="text-center text-sm font-medium">{percent}%</p>
              )}
            </div>
          )}
        </div>

        {dismissible && (
          <p className="text-xs text-muted-foreground">클릭하여 닫기</p>
        )}
      </div>
    </div>
  )
}
