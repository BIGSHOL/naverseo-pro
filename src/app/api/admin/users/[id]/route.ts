import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const adminDb = createAdminClient()

    const [
      { data: profile },
      { data: recentKeywords },
      { data: recentContent },
      { count: totalContent },
      { count: totalKeywords },
    ] = await Promise.all([
      adminDb
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single(),
      adminDb
        .from('keyword_research')
        .select('id, seed_keyword, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      adminDb
        .from('generated_content')
        .select('id, target_keyword, title, status, seo_score, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      adminDb
        .from('generated_content')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id),
      adminDb
        .from('keyword_research')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id),
    ])

    if (!profile) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      profile,
      recentKeywords: recentKeywords || [],
      recentContent: recentContent || [],
      totalContent: totalContent || 0,
      totalKeywords: totalKeywords || 0,
    })
  } catch (error) {
    console.error('[Admin User Detail] 오류:', error)
    return NextResponse.json(
      { error: '사용자 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const body = await request.json()
    const adminDb = createAdminClient()

    // 자기 자신의 admin 역할 해제 방지
    if (id === auth.userId && body.role === 'user') {
      return NextResponse.json(
        { error: '자신의 관리자 권한은 해제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 허용된 필드만 업데이트
    const allowedFields: Record<string, unknown> = {}

    if (body.plan && ['free', 'lite', 'starter', 'pro', 'business', 'agency'].includes(body.plan)) {
      allowedFields.plan = body.plan
    }

    if (body.role && ['user', 'admin'].includes(body.role)) {
      allowedFields.role = body.role
    }

    if (typeof body.keywords_used_this_month === 'number') {
      allowedFields.keywords_used_this_month = body.keywords_used_this_month
    }

    if (typeof body.content_generated_this_month === 'number') {
      allowedFields.content_generated_this_month = body.content_generated_this_month
    }

    if (typeof body.analysis_used_today === 'number') {
      allowedFields.analysis_used_today = body.analysis_used_today
    }

    // 크레딧 관련 필드
    if (typeof body.credits_balance === 'number') {
      allowedFields.credits_balance = Math.max(0, body.credits_balance)
    }

    if (typeof body.credits_monthly_quota === 'number') {
      allowedFields.credits_monthly_quota = Math.max(0, body.credits_monthly_quota)
    }

    // 크레딧 추가 (현재 잔액에 더함)
    if (typeof body.add_credits === 'number' && body.add_credits > 0) {
      const { data: currentProfile } = await adminDb
        .from('profiles')
        .select('credits_balance')
        .eq('id', id)
        .single()
      allowedFields.credits_balance = (currentProfile?.credits_balance ?? 0) + body.add_credits
    }

    // 크레딧 리셋 (잔액을 월간 할당량으로 복원)
    if (body.reset_credits === true) {
      const { data: currentProfile } = await adminDb
        .from('profiles')
        .select('credits_monthly_quota')
        .eq('id', id)
        .single()
      const quota = body.credits_monthly_quota ?? currentProfile?.credits_monthly_quota ?? 30
      allowedFields.credits_balance = quota
      allowedFields.credits_monthly_quota = quota
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1)
      nextMonth.setHours(0, 0, 0, 0)
      allowedFields.credits_reset_at = nextMonth.toISOString()
    }

    if (body.ai_provider && ['gemini', 'claude'].includes(body.ai_provider)) {
      allowedFields.ai_provider = body.ai_provider
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json(
        { error: '수정할 항목이 없습니다.' },
        { status: 400 }
      )
    }

    allowedFields.updated_at = new Date().toISOString()

    const { data: updated, error } = await adminDb
      .from('profiles')
      .update(allowedFields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Admin User Update] DB 오류:', error)
      return NextResponse.json(
        { error: '사용자 정보 수정 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile: updated })
  } catch (error) {
    console.error('[Admin User Update] 오류:', error)
    return NextResponse.json(
      { error: '사용자 정보 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
