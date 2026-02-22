import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 크레딧 사용 내역 API
 * GET /api/credits — 내 크레딧 잔액 + 사용 내역 + 기능별 집계
 */
export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days') || '30')))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '50')))

    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // 병렬: 프로필 + 사용 내역 + 기능별 집계
    const [
      { data: profile },
      { data: usageLogs },
      { data: dailyUsage },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('credits_balance, credits_monthly_quota, credits_reset_at, plan')
        .eq('id', user.id)
        .single(),
      // 최근 사용 내역
      supabase
        .from('credit_usage_log')
        .select('feature, credits_spent, credits_before, credits_after, metadata, created_at')
        .eq('user_id', user.id)
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(limit),
      // 일별 사용량 (최근 7일)
      supabase
        .from('credit_usage_log')
        .select('feature, credits_spent, created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    // 기능별 집계 계산
    const featureSummary: Record<string, { count: number; totalSpent: number }> = {}
    for (const log of (usageLogs || [])) {
      if (!featureSummary[log.feature]) {
        featureSummary[log.feature] = { count: 0, totalSpent: 0 }
      }
      featureSummary[log.feature].count++
      featureSummary[log.feature].totalSpent += log.credits_spent
    }

    // 일별 크레딧 소모 집계 (최근 7일)
    const dailyStats: { date: string; spent: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

      const spent = (dailyUsage || [])
        .filter(r => {
          const t = new Date(r.created_at)
          return t >= dayStart && t < dayEnd
        })
        .reduce((sum, r) => sum + r.credits_spent, 0)

      dailyStats.push({ date: dateStr, spent })
    }

    return NextResponse.json({
      balance: profile?.credits_balance ?? 0,
      quota: profile?.credits_monthly_quota ?? 30,
      resetAt: profile?.credits_reset_at ?? null,
      plan: profile?.plan ?? 'free',
      featureSummary,
      dailyStats,
      logs: usageLogs || [],
    })
  } catch (error) {
    console.error('[Credits API] 오류:', error)
    return NextResponse.json({ error: '크레딧 정보 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
