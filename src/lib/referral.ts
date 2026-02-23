import { SupabaseClient } from '@supabase/supabase-js'
import type { ReferralConfig } from '@/types/database'

/**
 * 추천인 코드를 처리하여 양쪽에 보상 지급
 * - 가입 후 auth callback에서 호출
 * - adminDb (service role) 사용 필수
 */
export async function processReferral(
  adminDb: SupabaseClient,
  newUserId: string,
  referralCode: string
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. 추천 설정 조회
    const { data: configRow } = await adminDb
      .from('system_settings')
      .select('value')
      .eq('key', 'referral_config')
      .single()

    const config = configRow?.value as ReferralConfig | null
    if (!config?.enabled) {
      return { success: false, message: '추천인 시스템이 비활성화되어 있습니다.' }
    }

    // 2. 추천 코드로 추천인 조회
    const { data: referrer } = await adminDb
      .from('profiles')
      .select('id, credits_balance')
      .eq('referral_code', referralCode.toUpperCase())
      .single()

    if (!referrer) {
      return { success: false, message: '유효하지 않은 추천 코드입니다.' }
    }

    // 3. 자기 추천 방지
    if (referrer.id === newUserId) {
      return { success: false, message: '자기 자신을 추천할 수 없습니다.' }
    }

    // 4. 이미 추천됐는지 확인
    const { data: existing } = await adminDb
      .from('referral_rewards')
      .select('id')
      .eq('referee_id', newUserId)
      .limit(1)

    if (existing && existing.length > 0) {
      return { success: false, message: '이미 추천인이 등록되어 있습니다.' }
    }

    // 5. 피추천인 프로필 조회
    const { data: referee } = await adminDb
      .from('profiles')
      .select('credits_balance')
      .eq('id', newUserId)
      .single()

    // 6. 양쪽 크레딧 지급
    const referrerCredits = config.referrer_credits
    const refereeCredits = config.referee_credits

    await adminDb
      .from('profiles')
      .update({
        credits_balance: (referrer.credits_balance ?? 0) + referrerCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', referrer.id)

    await adminDb
      .from('profiles')
      .update({
        credits_balance: (referee?.credits_balance ?? 30) + refereeCredits,
        referred_by: referrer.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', newUserId)

    // 7. 보상 기록
    await adminDb
      .from('referral_rewards')
      .insert({
        referrer_id: referrer.id,
        referee_id: newUserId,
        referrer_credits: referrerCredits,
        referee_credits: refereeCredits,
        status: 'completed',
      })

    return { success: true, message: '추천인 보상이 지급되었습니다.' }
  } catch (error) {
    console.error('[Referral] 처리 오류:', error)
    return { success: false, message: '추천인 처리 중 오류가 발생했습니다.' }
  }
}
