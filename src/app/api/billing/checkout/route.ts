import { NextRequest, NextResponse } from 'next/server'
import { configureLemonSqueezy, createCheckout, PLAN_VARIANT_MAP, isLemonSqueezyConfigured } from '@/lib/lemonsqueezy'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS, PLAN_CREDITS, type Plan } from '@/types/database'

// LemonSqueezy 체크아웃 세션 생성
export async function POST(request: NextRequest) {
  try {
    // 인증 확인 (사용자 클라이언트)
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

    // 데모 모드: LemonSqueezy 미설정 시 직접 플랜 변경 (admin 클라이언트)
    if (!isLemonSqueezyConfigured()) {
      console.warn('[Billing Checkout] LemonSqueezy 미설정 → 데모 모드')

      const targetPlan = plan as Plan
      const credits = PLAN_CREDITS[targetPlan]
      const nextReset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()

      const adminDb = createAdminClient()
      const updateData: Record<string, unknown> = {
        plan: targetPlan,
        credits_balance: credits,
        credits_monthly_quota: credits,
        credits_reset_at: nextReset,
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      }

      let updateError = (await adminDb.from('profiles').update(updateData).eq('id', user.id)).error

      // subscription_status 컬럼이 아직 없는 경우 해당 필드 제외하고 재시도
      if (updateError?.code === '42703') {
        console.warn('[Billing Checkout] subscription_status 컬럼 미존재, 제외하고 재시도')
        delete updateData.subscription_status
        updateError = (await adminDb.from('profiles').update(updateData).eq('id', user.id)).error
      }

      if (updateError) {
        console.error('[Billing Checkout] DB 업데이트 오류:', updateError)
        return NextResponse.json({ error: '플랜 변경에 실패했습니다.' }, { status: 500 })
      }

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
