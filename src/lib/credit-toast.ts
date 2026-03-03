import { toast } from '@/hooks/use-toast'
import { CREDIT_COSTS, CREDIT_FEATURE_LABELS, type CreditFeature } from '@/types/database'

/** API 호출 성공 후 크레딧 소모 토스트 표시 */
export function creditToast(feature: CreditFeature, count = 1) {
  const cost = CREDIT_COSTS[feature] * count
  toast({
    title: CREDIT_FEATURE_LABELS[feature],
    description: `${cost}크레딧 사용됨`,
  })
}
