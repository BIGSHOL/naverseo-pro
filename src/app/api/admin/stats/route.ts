import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const adminDb = createAdminClient()

    const [
      { count: totalUsers },
      { data: planDistribution },
      { count: totalContent },
      { count: totalKeywordSearches },
      { data: recentSignups },
      { data: todaySignups },
    ] = await Promise.all([
      adminDb.from('profiles').select('*', { count: 'exact', head: true }),
      adminDb.from('profiles').select('plan'),
      adminDb.from('generated_content').select('*', { count: 'exact', head: true }),
      adminDb.from('keyword_research').select('*', { count: 'exact', head: true }),
      adminDb
        .from('profiles')
        .select('id, email, plan, role, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      adminDb
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').toISOString()),
    ])

    // 플랜 분포 집계
    const planCounts = { free: 0, lite: 0, starter: 0, pro: 0, enterprise: 0 }
    ;(planDistribution || []).forEach((p: { plan: string }) => {
      if (p.plan in planCounts) planCounts[p.plan as keyof typeof planCounts]++
    })

    const paidUsers = planCounts.lite + planCounts.starter + planCounts.pro + planCounts.enterprise

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      paidUsers,
      todaySignups: todaySignups || 0,
      planDistribution: planCounts,
      totalContent: totalContent || 0,
      totalKeywordSearches: totalKeywordSearches || 0,
      recentSignups: recentSignups || [],
    })
  } catch (error) {
    console.error('[Admin Stats] 오류:', error)
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
