import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const adminDb = createAdminClient()

    const [
      { count: totalReferrals },
      { data: recentReferrals },
      { data: configRow },
      { data: allRewards },
    ] = await Promise.all([
      adminDb.from('referral_rewards').select('*', { count: 'exact', head: true }),
      adminDb
        .from('referral_rewards')
        .select('id, referrer_id, referee_id, referrer_credits, referee_credits, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      adminDb.from('system_settings').select('value').eq('key', 'referral_config').single(),
      adminDb.from('referral_rewards').select('referrer_credits, referee_credits'),
    ])

    // 총 지급 크레딧 계산
    const totalCreditsGiven = (allRewards || []).reduce(
      (sum, r) => sum + r.referrer_credits + r.referee_credits, 0
    )

    // 최근 추천에 이메일 추가
    const enrichedReferrals = []
    for (const r of recentReferrals || []) {
      const [{ data: referrer }, { data: referee }] = await Promise.all([
        adminDb.from('profiles').select('email').eq('id', r.referrer_id).single(),
        adminDb.from('profiles').select('email').eq('id', r.referee_id).single(),
      ])
      enrichedReferrals.push({
        ...r,
        referrer_email: referrer?.email || '-',
        referee_email: referee?.email || '-',
      })
    }

    return NextResponse.json({
      totalReferrals: totalReferrals || 0,
      totalCreditsGiven,
      config: configRow?.value || { referrer_credits: 10, referee_credits: 10, enabled: true },
      recentReferrals: enrichedReferrals,
    })
  } catch {
    return NextResponse.json({ error: '추천 통계 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
