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

    // admin 클라이언트로 프로필 조회 (RLS 우회, 컬럼 누락 방지)
    const adminDb = createAdminClient()
    const { data: profile, error: profileError } = await adminDb
      .from('profiles')
      .select('id, plan, credits_balance, credits_monthly_quota, credits_reset_at, email, created_at, subscription_status, lemonsqueezy_subscription_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[Billing] 프로필 조회 실패:', profileError.message, profileError.code)
      return NextResponse.json({ error: '프로필 정보를 불러오지 못했습니다.' }, { status: 500 })
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
