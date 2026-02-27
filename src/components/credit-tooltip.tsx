'use client'

import { CREDIT_COSTS, CREDIT_FEATURE_LABELS, type CreditFeature } from '@/types/database'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Coins } from 'lucide-react'

interface CreditTooltipProps {
  feature: CreditFeature
  children: React.ReactNode
}

/** 버튼을 감싸면 호버 시 크레딧 소모량 툴팁 표시 */
export function CreditTooltip({ feature, children }: CreditTooltipProps) {
  const cost = CREDIT_COSTS[feature]
  const label = CREDIT_FEATURE_LABELS[feature]

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="top" className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-amber-500" />
          <span>{label} · <strong>{cost} 크레딧</strong> 소모</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
