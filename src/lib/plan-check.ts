/**
 * 플랜별 기능 제한 체크 유틸리티
 *
 * 가격 정책:
 * | 플랜     | 키워드 조회 | AI 콘텐츠 | 순위 트래킹    | 분석(일간)  |
 * |---------|-----------|---------|-------------|-----------|
 * | Free    | 10회/월    | 3편/월   | X           | 3회/일     |
 * | Starter | 50회/월    | 10편/월  | 키워드 5개    | 10회/일    |
 * | Pro     | 무제한     | 50편/월  | 키워드 30개   | 무제한      |
 * | Agency  | 무제한     | 200편/월 | 키워드 100개  | 무제한      |
 *
 * 분석 = 블로그 지수 / 상위노출 분석 / 키워드 발굴 (외부 API 호출 기능)
 * 일간 제한으로 다계정 악용 방지
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type PlanType = 'free' | 'starter' | 'pro' | 'agency'

/**
 * 플랜별 기능 제한 설정
 * keywordsPerMonth: -1 = 무제한
 * trackingKeywords: 0 = 사용 불가
 * analysisPerDay: -1 = 무제한
 */
export const PLAN_LIMITS = {
  free: { keywordsPerMonth: 10, contentPerMonth: 3, trackingKeywords: 0, analysisPerDay: 3 },
  starter: { keywordsPerMonth: 50, contentPerMonth: 10, trackingKeywords: 5, analysisPerDay: 10 },
  pro: { keywordsPerMonth: -1, contentPerMonth: 50, trackingKeywords: 30, analysisPerDay: -1 },
  agency: { keywordsPerMonth: -1, contentPerMonth: 200, trackingKeywords: 100, analysisPerDay: -1 },
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
    .select('plan, role, keywords_used_this_month')
    .eq('id', userId)
    .single()

  // 관리자는 무제한
  if (profile?.role === 'admin') {
    return { allowed: true, plan: (profile.plan || 'free') as PlanType, limit: -1, used: profile.keywords_used_this_month || 0 }
  }

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
    .select('plan, role, content_generated_this_month')
    .eq('id', userId)
    .single()

  // 관리자는 무제한
  if (profile?.role === 'admin') {
    return { allowed: true, plan: (profile.plan || 'free') as PlanType, limit: -1, used: profile.content_generated_this_month || 0 }
  }

  const plan = (profile?.plan || 'free') as PlanType
  const limit = PLAN_LIMITS[plan].contentPerMonth as number
  const used = profile?.content_generated_this_month || 0

  if (limit !== -1 && used >= limit) {
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
    .select('plan, role')
    .eq('id', userId)
    .single()

  // 관리자는 무제한
  if (profile?.role === 'admin') {
    return { allowed: true, plan: (profile.plan || 'free') as PlanType, limit: -1, used: 0 }
  }

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
    .select('plan, role')
    .eq('id', userId)
    .single()

  // 관리자는 무제한
  if (profile?.role === 'admin') {
    return { allowed: true, plan: (profile.plan || 'free') as PlanType, limit: -1, used: 0 }
  }

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

/**
 * 일간 분석 사용량 체크 (블로그 지수 / 상위노출 분석 / 키워드 발굴)
 * 날짜가 바뀌면 자동 리셋
 */
export async function checkAnalysisLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanCheckResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, role, analysis_used_today, analysis_reset_date')
    .eq('id', userId)
    .single()

  // 관리자는 무제한
  if (profile?.role === 'admin') {
    return { allowed: true, plan: (profile.plan || 'free') as PlanType, limit: -1, used: 0 }
  }

  const plan = (profile?.plan || 'free') as PlanType
  const limit = PLAN_LIMITS[plan].analysisPerDay

  // 무제한 플랜
  if (limit === -1) {
    return { allowed: true, plan, limit, used: 0 }
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const resetDate = profile?.analysis_reset_date

  // 날짜가 바뀌었으면 카운터 리셋
  let used = profile?.analysis_used_today || 0
  if (resetDate !== today) {
    await supabase
      .from('profiles')
      .update({ analysis_used_today: 0, analysis_reset_date: today })
      .eq('id', userId)
    used = 0
  }

  if (used >= limit) {
    return {
      allowed: false, plan, limit, used,
      message: `일간 분석 한도(${limit}회)를 초과했습니다. 내일 다시 이용하거나 플랜을 업그레이드해주세요.`,
    }
  }
  return { allowed: true, plan, limit, used }
}

/**
 * 분석 사용량 1 증가 (API 호출 성공 후 호출)
 */
export async function incrementAnalysisUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)

  // RPC 호출로 원자적 증가 시도, 없으면 폴백
  try {
    const { error: rpcError } = await supabase.rpc('increment_analysis_usage', { uid: userId }).maybeSingle()
    if (!rpcError) return
  } catch {
    // RPC 함수가 없으면 폴백
  }

  // 폴백: read-then-write (RPC 없는 환경 호환)
  const { data: profile } = await supabase
    .from('profiles')
    .select('analysis_used_today, analysis_reset_date')
    .eq('id', userId)
    .single()

  if (profile?.analysis_reset_date !== today) {
    await supabase
      .from('profiles')
      .update({ analysis_used_today: 1, analysis_reset_date: today })
      .eq('id', userId)
  } else {
    await supabase
      .from('profiles')
      .update({ analysis_used_today: (profile?.analysis_used_today || 0) + 1 })
      .eq('id', userId)
  }
}
