import { NextRequest, NextResponse } from 'next/server'
import { configureLemonSqueezy, createCheckout, PLAN_VARIANT_MAP, isLemonSqueezyConfigured } from '@/lib/lemonsqueezy'
import { PLANS, PLAN_CREDITS, type Plan } from '@/types/database'

// LemonSqueezy 체크아웃 세션 생성
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { plan } = await request.json()

    if (!plan || !PLANS[plan as Plan] || plan === 'free' || plan === 'admin') {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
    }

    // 데모 모드: LemonSqueezy 미설정 시 직접 플랜 변경
    if (!isLemonSqueezyConfigured()) {
      console.warn('[Billing Checkout] LemonSqueezy 미설정 → 데모 모드')

      const targetPlan = plan as Plan
      const credits = PLAN_CREDITS[targetPlan]
      const nextReset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()

      await supabase
        .from('profiles')
        .update({
          plan: targetPlan,
          credits_balance: credits,
          credits_monthly_quota: credits,
          credits_reset_at: nextReset,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      return NextResponse.json({
        demo: true,
        plan: targetPlan,
        planName: PLANS[targetPlan].name,
      })
    }

    const variantId = PLAN_VARIANT_MAP[plan]
    if (!variantId) {
      return NextResponse.json({ error: '플랜 Variant ID가 설정되지 않았습니다.' }, { status: 500 })
    }

    configureLemonSqueezy()

    const storeId = process.env.LEMONSQUEEZY_STORE_ID!
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.naverseopro.com'

    const { data: checkout, error } = await createCheckout(storeId, variantId, {
      checkoutData: {
        email: user.email || undefined,
        custom: {
          user_id: user.id,
        },
      },
      productOptions: {
        redirectUrl: `${appUrl}/billing?success=true`,
        receiptButtonText: '대시보드로 돌아가기',
        receiptThankYouNote: 'NaverSEO Pro를 구독해 주셔서 감사합니다!',
      },
    })

    if (error) {
      console.error('[Billing Checkout] LemonSqueezy 오류:', error)
      return NextResponse.json({ error: '체크아웃 생성에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      checkoutUrl: checkout?.data?.attributes?.url,
    })
  } catch (error) {
    console.error('[Billing Checkout] 오류:', error)
    return NextResponse.json(
      { error: '체크아웃 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
