import { NextResponse } from 'next/server'
import { configureLemonSqueezy, getSubscription, isLemonSqueezyConfigured } from '@/lib/lemonsqueezy'

export const dynamic = 'force-dynamic'

// 고객 포털 URL 조회 (구독 관리, 결제수단 변경, 인보이스)
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    if (!isLemonSqueezyConfigured()) {
      return NextResponse.json({ error: '결제 시스템이 설정되지 않았습니다.' }, { status: 503 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('lemonsqueezy_subscription_id')
      .eq('id', user.id)
      .single()

    if (!profile?.lemonsqueezy_subscription_id) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 404 })
    }

    configureLemonSqueezy()

    const { data: subscription, error } = await getSubscription(
      profile.lemonsqueezy_subscription_id
    )

    if (error) {
      console.error('[Billing Portal] 구독 조회 오류:', error)
      return NextResponse.json({ error: '구독 정보를 가져올 수 없습니다.' }, { status: 500 })
    }

    const portalUrl = subscription?.data?.attributes?.urls?.customer_portal
    const updatePaymentUrl = subscription?.data?.attributes?.urls?.update_payment_method

    if (!portalUrl) {
      return NextResponse.json({ error: '포털 URL을 가져올 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      portalUrl,
      updatePaymentUrl,
    })
  } catch (error) {
    console.error('[Billing Portal] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
