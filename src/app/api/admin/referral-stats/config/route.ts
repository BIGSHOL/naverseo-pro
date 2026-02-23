import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { referrer_credits, referee_credits, enabled } = body

    const adminDb = createAdminClient()

    // 현재 설정 조회
    const { data: current } = await adminDb
      .from('system_settings')
      .select('value')
      .eq('key', 'referral_config')
      .single()

    const currentConfig = current?.value || { referrer_credits: 10, referee_credits: 10, enabled: true }

    const newConfig = {
      referrer_credits: typeof referrer_credits === 'number' ? referrer_credits : currentConfig.referrer_credits,
      referee_credits: typeof referee_credits === 'number' ? referee_credits : currentConfig.referee_credits,
      enabled: typeof enabled === 'boolean' ? enabled : currentConfig.enabled,
    }

    const { error } = await adminDb
      .from('system_settings')
      .upsert({
        key: 'referral_config',
        value: newConfig,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      return NextResponse.json({ error: '추천 설정 저장 중 오류가 발생했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ config: newConfig })
  } catch {
    return NextResponse.json({ error: '추천 설정 변경 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
