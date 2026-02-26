import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// 현재 사용자 결제/플랜 정보 조회
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // admin 클라이언트로 프로필 조회 (RLS 우회)
    const adminDb = createAdminClient()

    // 먼저 LemonSqueezy 컬럼 포함하여 시도, 실패 시 기본 컬럼만 조회
    let profile: Record<string, unknown> | null = null
    const { data: fullProfile, error: fullError } = await adminDb
      .from('profiles')
      .select('id, plan, role, credits_balance, credits_monthly_quota, credits_reset_at, email, created_at, subscription_status, lemonsqueezy_subscription_id')
      .eq('id', user.id)
      .single()

    if (fullError && fullError.code === '42703') {
      // subscription_status 등 LemonSqueezy 컬럼이 아직 없는 경우 → 기본 컬럼만 조회
      console.warn('[Billing] LemonSqueezy 컬럼 미존재, 기본 컬럼으로 폴백')
      const { data: basicProfile, error: basicError } = await adminDb
        .from('profiles')
        .select('id, plan, role, credits_balance, credits_monthly_quota, credits_reset_at, email, created_at')
        .eq('id', user.id)
        .single()

      if (basicError) {
        console.error('[Billing] 프로필 조회 실패:', basicError.message, basicError.code)
        return NextResponse.json({ error: '프로필 정보를 불러오지 못했습니다.' }, { status: 500 })
      }
      profile = { ...basicProfile, subscription_status: 'none', lemonsqueezy_subscription_id: null }
    } else if (fullError) {
      console.error('[Billing] 프로필 조회 실패:', fullError.message, fullError.code)
      return NextResponse.json({ error: '프로필 정보를 불러오지 못했습니다.' }, { status: 500 })
    } else {
      profile = fullProfile
    }

    return NextResponse.json({
      profile,
      lemonSqueezyConfigured: !!(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID),
    })
  } catch (error) {
    console.error('[Billing] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
