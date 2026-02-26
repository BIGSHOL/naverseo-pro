import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS, PLAN_CREDITS, type Plan } from '@/types/database'

// 플랜 변경 (다운그레이드 / 무료 전환)
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

    if (!plan || !PLANS[plan as Plan]) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
    }

    const targetPlan = plan as Plan
    if (targetPlan === 'admin') {
      return NextResponse.json({ error: '관리자 플랜으로는 변경할 수 없습니다.' }, { status: 400 })
    }

    // DB 작업은 admin 클라이언트 사용 (RLS 우회 - webhook과 동일 패턴)
    const adminDb = createAdminClient()

    // 현재 플랜 확인
    let profile: Record<string, unknown> | null = null
    const { data: fullProfile, error: fullError } = await adminDb
      .from('profiles')
      .select('plan, credits_balance, lemonsqueezy_subscription_id')
      .eq('id', user.id)
      .single()

    if (fullError && fullError.code === '42703') {
      // lemonsqueezy_subscription_id 컬럼 미존재 시 기본 컬럼만 조회
      console.warn('[Billing ChangePlan] LemonSqueezy 컬럼 미존재, 기본 컬럼으로 폴백')
      const { data: basicProfile, error: basicError } = await adminDb
        .from('profiles')
        .select('plan, credits_balance')
        .eq('id', user.id)
        .single()
      if (basicError || !basicProfile) {
        console.error('[Billing ChangePlan] 프로필 조회 실패:', basicError)
        return NextResponse.json({ error: '프로필 정보를 불러올 수 없습니다.' }, { status: 500 })
      }
      profile = { ...basicProfile, lemonsqueezy_subscription_id: null }
    } else if (fullError || !fullProfile) {
      console.error('[Billing ChangePlan] 프로필 조회 실패:', fullError)
      return NextResponse.json({ error: '프로필 정보를 불러올 수 없습니다.' }, { status: 500 })
    } else {
      profile = fullProfile
    }

    const currentPlan = (profile.plan || 'free') as Plan

    if (currentPlan === targetPlan) {
      return NextResponse.json({ error: '이미 동일한 플랜을 사용 중입니다.' }, { status: 400 })
    }

    // 유료 → 유료 업그레이드는 결제 필요 (이 API는 다운그레이드/무료 전환용)
    const planOrder: Plan[] = ['free', 'lite', 'starter', 'pro', 'enterprise']
    const currentIdx = planOrder.indexOf(currentPlan)
    const targetIdx = planOrder.indexOf(targetPlan)

    if (targetIdx > currentIdx && PLANS[targetPlan].price > 0) {
      return NextResponse.json({ error: '업그레이드는 결제를 통해 진행해주세요.' }, { status: 400 })
    }

    // LemonSqueezy 구독이 있으면 API로 취소/변경 처리
    const subscriptionId = profile.lemonsqueezy_subscription_id as string | null
    if (subscriptionId) {
      try {
        const { isLemonSqueezyConfigured, configureLemonSqueezy } = await import('@/lib/lemonsqueezy')

        if (isLemonSqueezyConfigured()) {
          configureLemonSqueezy()

          if (targetPlan === 'free') {
            // 무료 전환 = 구독 취소
            const { cancelSubscription } = await import('@/lib/lemonsqueezy')
            const result = await cancelSubscription(subscriptionId)
            if (result.error) {
              console.error('[Billing ChangePlan] 구독 취소 실패:', result.error)
            }
            return NextResponse.json({
              success: true,
              plan: currentPlan,
              planName: PLANS[currentPlan].name,
              message: '구독이 해지 예약되었습니다. 현재 결제 기간 만료 후 무료 플랜으로 전환됩니다.',
            })
          } else {
            // 유료 → 유료 다운그레이드 = variant 변경
            const { updateSubscription, PLAN_VARIANT_MAP } = await import('@/lib/lemonsqueezy')
            const newVariantId = PLAN_VARIANT_MAP[targetPlan]
            if (newVariantId) {
              const result = await updateSubscription(subscriptionId, {
                variantId: newVariantId,
              })
              if (result.error) {
                console.error('[Billing ChangePlan] variant 변경 실패:', result.error)
              }
              return NextResponse.json({
                success: true,
                plan: targetPlan,
                planName: PLANS[targetPlan].name,
                message: `${PLANS[targetPlan].name} 플랜으로 변경되었습니다. 다음 결제일부터 적용됩니다.`,
              })
            }
          }
        }
      } catch (lsError) {
        console.error('[Billing ChangePlan] LemonSqueezy API 오류:', lsError)
        // LemonSqueezy 오류 시 데모 모드로 폴백
      }
    }

    // 데모 모드 또는 구독 없는 경우: 직접 DB 업데이트 (admin 클라이언트)
    const newQuota = PLAN_CREDITS[targetPlan]
    const newBalance = Math.min((profile.credits_balance as number) ?? 0, newQuota)
    const nextReset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()

    const updateData: Record<string, unknown> = {
      plan: targetPlan,
      credits_balance: targetPlan === 'free' ? newQuota : newBalance,
      credits_monthly_quota: newQuota,
      credits_reset_at: nextReset,
      subscription_status: targetPlan === 'free' ? 'none' : 'active',
      updated_at: new Date().toISOString(),
    }

    let updateError = (await adminDb.from('profiles').update(updateData).eq('id', user.id)).error

    // subscription_status 컬럼이 아직 없는 경우 해당 필드 제외하고 재시도
    if (updateError?.code === '42703') {
      console.warn('[Billing ChangePlan] subscription_status 컬럼 미존재, 제외하고 재시도')
      delete updateData.subscription_status
      updateError = (await adminDb.from('profiles').update(updateData).eq('id', user.id)).error
    }

    if (updateError) {
      console.error('[Billing ChangePlan] DB 업데이트 오류:', updateError)
      return NextResponse.json({ error: '플랜 변경에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      plan: targetPlan,
      planName: PLANS[targetPlan].name,
      credits: targetPlan === 'free' ? newQuota : newBalance,
    })
  } catch (error) {
    console.error('[Billing ChangePlan] 오류:', error)
    return NextResponse.json(
      { error: '플랜 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
