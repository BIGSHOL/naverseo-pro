import { NextResponse } from 'next/server'

// 현재 사용자 결제/플랜 정보 조회
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
      .select('plan, keywords_used_this_month, content_generated_this_month, analysis_used_today, analysis_reset_date, email, created_at')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      profile: profile || {
        plan: 'free',
        keywords_used_this_month: 0,
        content_generated_this_month: 0,
        analysis_used_today: 0,
        analysis_reset_date: null,
        email: user.email,
        created_at: user.created_at,
      },
      tossClientKey: process.env.TOSS_CLIENT_KEY || null,
    })
  } catch (error) {
    console.error('[Billing] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
