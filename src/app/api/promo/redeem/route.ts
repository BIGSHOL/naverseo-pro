import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { code } = await request.json()
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: '프로모 코드를 입력해주세요.' }, { status: 400 })
    }

    const adminDb = createAdminClient()

    // 1. 프로모 코드 조회
    const { data: promo } = await adminDb
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!promo) {
      return NextResponse.json({ error: '유효하지 않은 프로모 코드입니다.' }, { status: 404 })
    }

    // 2. 만료일 확인
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return NextResponse.json({ error: '만료된 프로모 코드입니다.' }, { status: 400 })
    }

    // 3. 최대 사용 횟수 확인
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      return NextResponse.json({ error: '사용 횟수가 초과된 프로모 코드입니다.' }, { status: 400 })
    }

    // 4. 이미 사용했는지 확인
    const { data: existingRedemption } = await adminDb
      .from('promo_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('promo_code_id', promo.id)

    if (existingRedemption && existingRedemption.length > 0) {
      return NextResponse.json({ error: '이미 사용한 프로모 코드입니다.' }, { status: 400 })
    }

    // 5. 보상 적용
    const { data: profile } = await adminDb
      .from('profiles')
      .select('credits_balance')
      .eq('id', user.id)
      .single()

    if (promo.reward_type === 'credits') {
      await adminDb
        .from('profiles')
        .update({
          credits_balance: (profile?.credits_balance ?? 0) + promo.bonus_credits,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    // 6. 사용 기록 저장
    await adminDb.from('promo_redemptions').insert({
      user_id: user.id,
      promo_code_id: promo.id,
      reward_type: promo.reward_type,
      bonus_credits: promo.reward_type === 'credits' ? promo.bonus_credits : 0,
      upgrade_plan: promo.reward_type === 'plan_upgrade' ? promo.upgrade_plan : null,
    })

    // 7. 사용 횟수 증가
    await adminDb
      .from('promo_codes')
      .update({
        current_uses: promo.current_uses + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promo.id)

    return NextResponse.json({
      success: true,
      message: promo.reward_type === 'credits'
        ? `${promo.bonus_credits} 크레딧이 지급되었습니다!`
        : '프로모 코드가 적용되었습니다!',
      reward: {
        type: promo.reward_type,
        credits: promo.bonus_credits,
      },
    })
  } catch {
    return NextResponse.json({ error: '프로모 코드 적용 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
