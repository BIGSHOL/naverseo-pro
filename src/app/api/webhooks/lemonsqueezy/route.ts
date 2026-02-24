import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CREDITS, type Plan } from '@/types/database'
import { variantToPlan } from '@/lib/lemonsqueezy'

// ============================================================
// LemonSqueezy Webhook 핸들러
// - 구독 생성/변경/취소/만료/결제 성공/실패 이벤트 처리
// - HMAC-SHA256 서명 검증으로 보안 확보
// - createAdminClient 사용 (webhook에는 사용자 세션 없음)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
    if (!secret) {
      console.error('[LS Webhook] LEMONSQUEEZY_WEBHOOK_SECRET 미설정')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // 1. 서명 검증
    const rawBody = await request.text()
    const signature = request.headers.get('x-signature') || ''

    if (!signature || !rawBody) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    // 길이가 다르면 timingSafeEqual이 에러나므로 먼저 체크
    if (signature.length !== hmac.length) {
      console.error('[LS Webhook] 서명 길이 불일치')
      return NextResponse.json({ error: '서명 불일치' }, { status: 401 })
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(hmac, 'hex'))) {
      console.error('[LS Webhook] 서명 검증 실패')
      return NextResponse.json({ error: '서명 불일치' }, { status: 401 })
    }

    // 2. 페이로드 파싱
    const payload = JSON.parse(rawBody)
    const eventName: string = payload.meta?.event_name
    const customData = payload.meta?.custom_data as Record<string, string> | undefined
    const attrs = payload.data?.attributes
    const subscriptionId = String(payload.data?.id || '')

    console.log(`[LS Webhook] 이벤트: ${eventName}, 구독ID: ${subscriptionId}`)

    const adminDb = createAdminClient()

    // 3. 이벤트별 처리
    switch (eventName) {
      case 'subscription_created': {
        // checkout custom_data에서 user_id 추출
        const userId = customData?.user_id
        if (!userId) {
          console.error('[LS Webhook] subscription_created: user_id 누락')
          return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
        }

        const variantId = attrs.variant_id
        const plan = (variantToPlan(variantId) || 'free') as Plan
        const credits = PLAN_CREDITS[plan] ?? 30

        await adminDb
          .from('profiles')
          .update({
            plan,
            credits_balance: credits,
            credits_monthly_quota: credits,
            credits_reset_at: attrs.renews_at ? new Date(attrs.renews_at).toISOString() : null,
            lemonsqueezy_subscription_id: subscriptionId,
            lemonsqueezy_customer_id: String(attrs.customer_id || ''),
            lemonsqueezy_variant_id: variantId,
            subscription_status: attrs.status || 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        console.log(`[LS Webhook] 사용자 ${userId} → ${plan} 구독 시작`)
        break
      }

      case 'subscription_updated': {
        // subscription_id로 사용자 조회
        const { data: profile } = await adminDb
          .from('profiles')
          .select('id, lemonsqueezy_variant_id, credits_monthly_quota')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single()

        if (!profile) {
          console.error(`[LS Webhook] subscription_updated: 구독 ${subscriptionId} 사용자 없음`)
          break
        }

        const variantId = attrs.variant_id
        const updateData: Record<string, unknown> = {
          subscription_status: attrs.status,
          updated_at: new Date().toISOString(),
        }

        // Variant가 바뀌었으면 플랜 변경 (업/다운그레이드)
        if (profile.lemonsqueezy_variant_id !== variantId) {
          const newPlan = (variantToPlan(variantId) || 'free') as Plan
          const newCredits = PLAN_CREDITS[newPlan] ?? 30
          updateData.plan = newPlan
          updateData.credits_balance = newCredits
          updateData.credits_monthly_quota = newCredits
          updateData.lemonsqueezy_variant_id = variantId
        }

        if (attrs.renews_at) {
          updateData.credits_reset_at = new Date(attrs.renews_at).toISOString()
        }

        await adminDb.from('profiles').update(updateData).eq('id', profile.id)
        console.log(`[LS Webhook] 사용자 ${profile.id} 구독 업데이트: ${attrs.status}`)
        break
      }

      case 'subscription_cancelled': {
        // 취소 요청 → 만료일까지 유지, 상태만 변경
        const { data: profile } = await adminDb
          .from('profiles')
          .select('id')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single()

        if (profile) {
          await adminDb
            .from('profiles')
            .update({
              subscription_status: 'cancelled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id)

          console.log(`[LS Webhook] 사용자 ${profile.id} 구독 취소 (만료까지 유지)`)
        }
        break
      }

      case 'subscription_expired': {
        // 만료 → free 다운그레이드
        const { data: profile } = await adminDb
          .from('profiles')
          .select('id')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single()

        if (profile) {
          await adminDb
            .from('profiles')
            .update({
              plan: 'free',
              credits_balance: PLAN_CREDITS.free,
              credits_monthly_quota: PLAN_CREDITS.free,
              subscription_status: 'expired',
              lemonsqueezy_subscription_id: null,
              lemonsqueezy_variant_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id)

          console.log(`[LS Webhook] 사용자 ${profile.id} 구독 만료 → free 다운그레이드`)
        }
        break
      }

      case 'subscription_payment_success': {
        // 갱신 결제 성공 → 크레딧 리셋
        const { data: profile } = await adminDb
          .from('profiles')
          .select('id, credits_monthly_quota')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single()

        if (profile) {
          await adminDb
            .from('profiles')
            .update({
              credits_balance: profile.credits_monthly_quota,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id)

          console.log(`[LS Webhook] 사용자 ${profile.id} 결제 성공, 크레딧 ${profile.credits_monthly_quota}으로 리셋`)
        }
        break
      }

      case 'subscription_payment_failed': {
        const { data: profile } = await adminDb
          .from('profiles')
          .select('id')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single()

        if (profile) {
          await adminDb
            .from('profiles')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id)

          console.log(`[LS Webhook] 사용자 ${profile.id} 결제 실패 → past_due`)
        }
        break
      }

      default:
        console.log(`[LS Webhook] 미처리 이벤트: ${eventName}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[LS Webhook] 오류:', error)
    return NextResponse.json({ error: '웹훅 처리 오류' }, { status: 500 })
  }
}
