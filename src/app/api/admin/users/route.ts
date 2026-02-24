import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '20')))
    const search = searchParams.get('search') || ''
    const planFilter = searchParams.get('plan') || ''
    const offset = (page - 1) * limit

    const adminDb = createAdminClient()

    let query = adminDb
      .from('profiles')
      .select('id, email, plan, role, credits_balance, credits_monthly_quota, credits_reset_at, keywords_used_this_month, content_generated_this_month, analysis_used_today, created_at', { count: 'exact' })

    if (search) {
      query = query.ilike('email', `%${search}%`)
    }

    if (planFilter && ['free', 'lite', 'starter', 'pro', 'enterprise'].includes(planFilter)) {
      query = query.eq('plan', planFilter)
    }

    const { data: users, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({
      users: users || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('[Admin Users] 오류:', error)
    return NextResponse.json(
      { error: '사용자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
