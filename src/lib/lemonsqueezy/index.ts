import {
  lemonSqueezySetup,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  createCheckout,
} from '@lemonsqueezy/lemonsqueezy.js'

/**
 * LemonSqueezy SDK 초기화
 * - 모든 API route에서 호출 필요 (serverless 환경에서 안전)
 */
export function configureLemonSqueezy() {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  if (!apiKey) {
    throw new Error('LEMONSQUEEZY_API_KEY 환경변수가 설정되지 않았습니다.')
  }
  lemonSqueezySetup({
    apiKey,
    onError: (err) => console.error('[LemonSqueezy]', err.message),
  })
}

/** LemonSqueezy 설정 여부 확인 */
export function isLemonSqueezyConfigured(): boolean {
  return !!(
    process.env.LEMONSQUEEZY_API_KEY &&
    process.env.LEMONSQUEEZY_STORE_ID &&
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  )
}

/**
 * 플랜 → LemonSqueezy Variant ID 매핑
 * - LemonSqueezy 대시보드에서 생성한 Variant ID를 환경변수로 설정
 */
export const PLAN_VARIANT_MAP: Record<string, number> = {
  lite: Number(process.env.LEMONSQUEEZY_VARIANT_LITE || 0),
  starter: Number(process.env.LEMONSQUEEZY_VARIANT_STARTER || 0),
  pro: Number(process.env.LEMONSQUEEZY_VARIANT_PRO || 0),
  enterprise: Number(process.env.LEMONSQUEEZY_VARIANT_ENTERPRISE || 0),
}

/** Variant ID → 플랜 이름 역매핑 */
export function variantToPlan(variantId: number): string | null {
  for (const [plan, vid] of Object.entries(PLAN_VARIANT_MAP)) {
    if (vid === variantId) return plan
  }
  return null
}

export { getSubscription, updateSubscription, cancelSubscription, createCheckout }
