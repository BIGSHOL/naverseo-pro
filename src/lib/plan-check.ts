/**
 * 플랜별 기능 제한 체크 유틸리티
 *
 * 가격 정책:
 * | 플랜     | 키워드 조회 | AI 콘텐츠 | 순위 트래킹    |
 * |---------|-----------|---------|-------------|
 * | Free    | 10회/월    | 3편/월   | X           |
 * | Starter | 50회/월    | 10편/월  | 키워드 5개    |
 * | Pro     | 무제한     | 50편/월  | 키워드 30개   |
 * | Agency  | 무제한     | 200편/월 | 키워드 100개  |
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type PlanType = 'free' | 'starter' | 'pro' | 'agency'

/**
 * 플랜별 기능 제한 설정
 * keywordsPerMonth: -1 = 무제한
 * trackingKeywords: 0 = 사용 불가
 */
export const PLAN_LIMITS = {
  free: { keywordsPerMonth: 10, contentPerMonth: 3, trackingKeywords: 0 },
  starter: { keywordsPerMonth: 50, contentPerMonth: 10, trackingKeywords: 5 },
  pro: { keywordsPerMonth: -1, contentPerMonth: 50, trackingKeywords: 30 },
  agency: { keywordsPerMonth: -1, contentPerMonth: 200, trackingKeywords: 100 },
} as const

export interface PlanCheckResult {
  allowed: boolean
  plan: PlanType
  limit: number   // -1 = 무제한
  used: number
  message?: string
}

/**
 * 키워드 조회 사용량 체크
 */
export async function checkKeywordLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanCheckResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, keywords_used_this_month')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan || 'free') as PlanType
  const limit = PLAN_LIMITS[plan].keywordsPerMonth
  const used = profile?.keywords_used_this_month || 0

  if (limit !== -1 && used >= limit) {
    return {
      allowed: false, plan, limit, used,
      message: `월간 키워드 조회 한도(${limit}회)를 초과했습니다. 플랜을 업그레이드해주세요.`,
    }
  }
  return { allowed: true, plan, limit, used }
}

/**
 * AI 콘텐츠 생성 사용량 체크
 */
export async function checkContentLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanCheckResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, content_generated_this_month')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan || 'free') as PlanType
  const limit = PLAN_LIMITS[plan].contentPerMonth
  const used = profile?.content_generated_this_month || 0

  if (used >= limit) {
    return {
      allowed: false, plan, limit, used,
      message: `월간 AI 콘텐츠 생성 한도(${limit}편)를 초과했습니다. 플랜을 업그레이드해주세요.`,
    }
  }
  return { allowed: true, plan, limit, used }
}

/**
 * 순위 트래킹 접근 가능 여부 체크 (플랜 레벨만 확인)
 */
export async function checkTrackingAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanCheckResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan || 'free') as PlanType
  const limit = PLAN_LIMITS[plan].trackingKeywords

  if (limit === 0) {
    return {
      allowed: false, plan, limit: 0, used: 0,
      message: 'Free 플랜에서는 순위 트래킹을 사용할 수 없습니다. Starter 이상 플랜으로 업그레이드해주세요.',
    }
  }
  return { allowed: true, plan, limit, used: 0 }
}

/**
 * 순위 트래킹 키워드 추가 가능 여부 체크 (고유 키워드 수 확인)
 */
export async function checkTrackingCount(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanCheckResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan || 'free') as PlanType
  const limit = PLAN_LIMITS[plan].trackingKeywords

  if (limit === 0) {
    return {
      allowed: false, plan, limit: 0, used: 0,
      message: 'Free 플랜에서는 순위 트래킹을 사용할 수 없습니다. Starter 이상 플랜으로 업그레이드해주세요.',
    }
  }

  // 고유 키워드+블로그URL 조합 수 조회
  const { data: trackingData } = await supabase
    .from('rank_tracking')
    .select('keyword, blog_url')
    .eq('user_id', userId)

  const uniqueKeys = new Set(
    (trackingData || []).map((r: { keyword: string; blog_url: string }) =>
      `${r.keyword}||${r.blog_url}`
    )
  )
  const used = uniqueKeys.size

  if (used >= limit) {
    return {
      allowed: false, plan, limit, used,
      message: `트래킹 키워드 한도(${limit}개)를 초과했습니다. 플랜을 업그레이드해주세요.`,
    }
  }
  return { allowed: true, plan, limit, used }
}
