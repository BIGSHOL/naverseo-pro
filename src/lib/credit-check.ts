/**
 * 통합 크레딧 시스템 - 사용량 체크 & 차감
 *
 * - checkCredits(): 잔액 확인 + 플랜별 기능 게이트 + lazy 월간 리셋
 * - deductCredits(): RPC 원자적 차감 + 로그 기록
 *
 * 플랜별 기능 제한:
 * - Free (4기능): keyword_research, seo_check, blog_index, post_check
 * - Lite (6기능): Free + content_generation, seo_report
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
 * - Free: keyword_research, seo_check, blog_index, post_check만 허용
 * - Lite: Free + content_generation, seo_report, image_generation
 * - Starter+: 모든 기능 허용 (잔액 확인만)
 * - lazy 월간 리셋 포함
 */
export async function checkCredits(
  supabase: SupabaseClient,
  userId: string,
  feature: CreditFeature,
  quantity: number = 1
): Promise<CreditCheckResult> {
  const cost = CREDIT_COSTS[feature] * quantity
  const featureLabel = CREDIT_FEATURE_LABELS[feature]

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credits_balance, credits_monthly_quota, credits_reset_at, plan, role, created_at')
    .eq('id', userId)
    .single()

  if (profileError) {
    console.error('[CreditCheck] 프로필 조회 실패:', profileError.message, profileError.code, 'userId:', userId)
  }

  const plan = (profile?.plan || 'free') as Plan

  // Admin도 동일하게 크레딧 체크 (바이패스 없음)

  // Free 플랜 기능 게이트 (4기능만 허용)
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

  // Lite 플랜 기능 게이트 (6기능만 허용)
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

  // Lazy 월간 리셋
  // - Free: 가입일(created_at) 기준 매월 같은 날 리셋
  // - 유료: 과금일(현재 시점) 기준 매월 1일 리셋
  if (!profile?.credits_reset_at) {
    const nextReset = plan === 'free' && profile?.created_at
      ? getNextResetFromSignup(profile.created_at)
      : getNextMonthReset()
    await supabase
      .from('profiles')
      .update({
        credits_reset_at: nextReset,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
  } else if (new Date(profile.credits_reset_at) <= new Date()) {
    balance = profile.credits_monthly_quota ?? 30
    const nextReset = plan === 'free' && profile?.created_at
      ? getNextResetFromSignup(profile.created_at)
      : getNextMonthReset()
    await supabase
      .from('profiles')
      .update({
        credits_balance: balance,
        credits_reset_at: nextReset,
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
  metadata?: Record<string, unknown>,
  quantity: number = 1
): Promise<{ success: boolean; remaining: number }> {
  const cost = CREDIT_COSTS[feature] * quantity

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

  const newBalance = Math.max(0, (profile?.credits_balance ?? 0) - cost)
  await supabase
    .from('profiles')
    .update({ credits_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', userId)

  // 폴백에서도 로그 기록
  await supabase
    .from('credit_usage_log')
    .insert({
      user_id: userId,
      feature,
      credits_spent: cost,
      credits_before: profile?.credits_balance ?? 0,
      credits_after: newBalance,
      metadata: metadata || null,
    })

  return { success: true, remaining: newBalance }
}

/** 유료 플랜: 다음 달 1일 리셋 */
function getNextMonthReset(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return next.toISOString()
}

/** Free 플랜: 가입일 기준 매월 같은 날 리셋 (예: 2/15 가입 → 매월 15일) */
function getNextResetFromSignup(createdAt: string): string {
  const signup = new Date(createdAt)
  const signupDay = signup.getDate()
  const now = new Date()

  // 이번 달의 가입일에 해당하는 날짜 (월말 보정 포함)
  let next = clampToMonth(now.getFullYear(), now.getMonth(), signupDay)

  // 이미 지났으면 다음 달로
  if (next <= now) {
    next = clampToMonth(now.getFullYear(), now.getMonth() + 1, signupDay)
  }

  return next.toISOString()
}

/** 월말 보정: 31일 가입인데 2월이면 28일로 클램프 */
function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}
