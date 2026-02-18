import { NextRequest, NextResponse } from 'next/server'
import { confirmPayment, isTossConfigured } from '@/lib/toss/payments'
import { PLANS, type Plan } from '@/types/database'

// 결제 승인 처리
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { paymentKey, orderId, amount, plan } = await request.json()

    if (!plan || !PLANS[plan as Plan]) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
    }

    const targetPlan = plan as Plan
    const expectedAmount = PLANS[targetPlan].price

    // 금액 검증
    if (Number(amount) !== expectedAmount) {
      return NextResponse.json(
        { error: '결제 금액이 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    // 토스페이먼츠 결제 승인
    if (isTossConfigured()) {
      await confirmPayment(paymentKey, orderId, Number(amount))
    }

    // 플랜 업그레이드
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan: targetPlan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Billing] 플랜 업데이트 오류:', updateError)
      return NextResponse.json(
        { error: '플랜 업데이트에 실패했습니다. 고객센터에 문의해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      plan: targetPlan,
      planName: PLANS[targetPlan].name,
      orderId,
    })
  } catch (error) {
    console.error('[Billing Confirm] 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
