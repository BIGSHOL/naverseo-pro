/**
 * 통합 크레딧 시스템 - 사용량 체크 & 차감
 *
 * - checkCredits(): 잔액 확인 + 플랜별 기능 게이트 + lazy 월간 리셋
 * - deductCredits(): RPC 원자적 차감 + 로그 기록
 *
 * 플랜별 기능 제한:
 * - Free (3기능): keyword_research, seo_check, blog_index
 * - Lite (5기능): Free + content_generation, seo_report
 * - Starter 이상: 모든 기능 사용 가능
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

import {
  CREDIT_COSTS,
  CREDIT_FEATURE_LABELS,
  FREE_ALLOWED_FEATURES,
  LITE_ALLOWED_FEATURES,
  type CreditFeature,
  type Plan,
} from '@/types/database'

export { CREDIT_COSTS, CREDIT_FEATURE_LABELS }

export interface CreditCheckResult {
  allowed: boolean
  balance: number
  cost: number
  plan: Plan
  message?: string
  /** true면 플랜 업그레이드 필요 (Free 기능 제한) */
  planGate?: boolean
}

/**
 * 크레딧 잔액 확인 + Free 플랜 기능 게이트
 * - Admin: 항상 허용
 * - Free: keyword_research, content_generation, seo_check만 허용
 * - Starter+: 모든 기능 허용 (잔액 확인만)
 * - lazy 월간 리셋 포함
 */
export async function checkCredits(
  supabase: SupabaseClient,
  userId: string,
  feature: CreditFeature
): Promise<CreditCheckResult> {
  const cost = CREDIT_COSTS[feature]
  const featureLabel = CREDIT_FEATURE_LABELS[feature]

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance, credits_monthly_quota, credits_reset_at, plan, role')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan || 'free') as Plan

  // Admin 바이패스
  if (profile?.role === 'admin') {
    return { allowed: true, balance: profile.credits_balance ?? 999999, cost, plan }
  }

  // Free 플랜 기능 게이트 (3기능만 허용)
  if (plan === 'free' && !FREE_ALLOWED_FEATURES.includes(feature)) {
    return {
      allowed: false,
      balance: profile?.credits_balance ?? 0,
      cost,
      plan,
      planGate: true,
      message: `${featureLabel} 기능은 Lite 이상 플랜에서 사용할 수 있습니다. 플랜을 업그레이드해주세요.`,
    }
  }

  // Lite 플랜 기능 게이트 (5기능만 허용)
  if (plan === 'lite' && !LITE_ALLOWED_FEATURES.includes(feature)) {
    return {
      allowed: false,
      balance: profile?.credits_balance ?? 0,
      cost,
      plan,
      planGate: true,
      message: `${featureLabel} 기능은 Starter 이상 플랜에서 사용할 수 있습니다. 플랜을 업그레이드해주세요.`,
    }
  }

  let balance = profile?.credits_balance ?? 0

  // Lazy 월간 리셋 (null이면 초기화, 만료되면 리셋)
  if (!profile?.credits_reset_at) {
    // credits_reset_at이 설정되지 않은 경우 → 다음 달 1일로 초기화
    await supabase
      .from('profiles')
      .update({
        credits_reset_at: getNextMonthReset(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
  } else if (new Date(profile.credits_reset_at) <= new Date()) {
    balance = profile.credits_monthly_quota ?? 30
    await supabase
      .from('profiles')
      .update({
        credits_balance: balance,
        credits_reset_at: getNextMonthReset(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
  }

  // 잔액 부족
  if (balance < cost) {
    return {
      allowed: false,
      balance,
      cost,
      plan,
      message: `크레딧이 부족합니다. (잔여: ${balance}, 필요: ${cost}) 플랜을 업그레이드하거나 다음 달까지 기다려주세요.`,
    }
  }

  return { allowed: true, balance, cost, plan }
}

/**
 * 크레딧 차감 (API 호출 성공 후 호출)
 * RPC deduct_credits → 원자적 차감 + 로그 자동 기록
 * RPC 실패 시 수동 폴백
 */
export async function deductCredits(
  supabase: SupabaseClient,
  userId: string,
  feature: CreditFeature,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; remaining: number }> {
  const cost = CREDIT_COSTS[feature]

  // RPC 호출 시도
  try {
    const { data, error } = await supabase
      .rpc('deduct_credits', {
        uid: userId,
        cost,
        feature_name: feature,
        meta: metadata || null,
      })
      .single()

    if (!error && data?.success) {
      return { success: true, remaining: data.remaining }
    }

    if (data && !data.success) {
      return { success: false, remaining: data.remaining }
    }
  } catch {
    // RPC 미배포 시 폴백
  }

  // 폴백: 수동 차감 (RPC 없는 환경)
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance, role')
    .eq('id', userId)
    .single()

  if (profile?.role === 'admin') {
    return { success: true, remaining: profile.credits_balance }
  }

  const newBalance = Math.max(0, (profile?.credits_balance ?? 0) - cost)
  await supabase
    .from('profiles')
    .update({ credits_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', userId)

  return { success: true, remaining: newBalance }
}

function getNextMonthReset(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return next.toISOString()
}
