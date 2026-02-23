import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code, referred_by')
      .eq('id', user.id)
      .single()

    const { data: rewards } = await supabase
      .from('referral_rewards')
      .select('id, referrer_credits, created_at')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      referralCode: profile?.referral_code || '',
      referredBy: profile?.referred_by || null,
      totalReferrals: rewards?.length ?? 0,
      totalCreditsEarned: rewards?.reduce((sum, r) => sum + r.referrer_credits, 0) ?? 0,
      rewards: rewards || [],
    })
  } catch {
    return NextResponse.json({ error: '추천 정보 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
