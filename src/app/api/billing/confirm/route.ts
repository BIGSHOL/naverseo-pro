import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment, isPortOneConfigured } from '@/lib/portone/payments'
import { PLANS, PLAN_CREDITS, type Plan } from '@/types/database'

// 결제 검증 처리 (포트원)
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { paymentId, plan } = await request.json()

    if (!paymentId) {
      return NextResponse.json({ error: '결제 ID가 필요합니다.' }, { status: 400 })
    }

    if (!plan || !PLANS[plan as Plan]) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
    }

    const targetPlan = plan as Plan
    const expectedAmount = PLANS[targetPlan].price

    // 포트원 결제 검증
    if (!isPortOneConfigured()) {
      return NextResponse.json(
        { error: '결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.' },
        { status: 503 }
      )
    }

    const payment = await verifyPayment(paymentId)

    // 결제 상태 확인
    if (payment.status !== 'PAID') {
      return NextResponse.json(
        { error: `결제가 완료되지 않았습니다. (상태: ${payment.status})` },
        { status: 400 }
      )
    }

    // 금액 검증
    const paidAmount = payment.amount?.total
    if (paidAmount !== expectedAmount) {
      console.error('[Billing] 금액 불일치:', { paidAmount, expectedAmount })
      return NextResponse.json(
        { error: '결제 금액이 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    // 플랜 업그레이드 + 크레딧 동기화
    const newQuota = PLAN_CREDITS[targetPlan]
    const nextReset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan: targetPlan,
        credits_balance: newQuota,
        credits_monthly_quota: newQuota,
        credits_reset_at: nextReset,
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
      paymentId,
    })
  } catch (error) {
    console.error('[Billing Confirm] 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
