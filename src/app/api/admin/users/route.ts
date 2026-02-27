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

    // auth.users와 profiles 동기화 (누락된 프로필 자동 생성)
    try {
      const { data: authUsers } = await adminDb.auth.admin.listUsers()
      if (authUsers?.users?.length) {
        const { data: existingProfiles } = await adminDb
          .from('profiles')
          .select('id')
        const existingIds = new Set((existingProfiles || []).map(p => p.id))

        const missing = authUsers.users.filter(u => !existingIds.has(u.id))
        if (missing.length > 0) {
          // 기존 referral_code 목록 조회 (중복 방지)
          const { data: existingCodes } = await adminDb
            .from('profiles')
            .select('referral_code')
          const usedCodes = new Set((existingCodes || []).map(p => p.referral_code))

          const rows = missing.map(u => {
            let code: string
            do {
              code = Math.random().toString(36).substring(2, 8).toUpperCase()
            } while (usedCodes.has(code))
            usedCodes.add(code)
            return {
              id: u.id,
              email: u.email || u.user_metadata?.email || '',
              plan: 'free' as const,
              credits_balance: 30,
              credits_monthly_quota: 30,
              referral_code: code,
            }
          })
          await adminDb.from('profiles').upsert(rows, { onConflict: 'id' })
          console.log(`[Admin Users] 누락 프로필 ${missing.length}건 동기화 완료`)
        }
      }
    } catch (syncError) {
      console.error('[Admin Users] 동기화 오류:', syncError)
    }

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
