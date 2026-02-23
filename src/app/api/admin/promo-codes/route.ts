import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const adminDb = createAdminClient()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    const { data: codes, count } = await adminDb
      .from('promo_codes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({
      codes: codes || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch {
    return NextResponse.json({ error: '프로모 코드 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { code, description, reward_type, bonus_credits, upgrade_plan, upgrade_days, max_uses, expires_at } = body

    if (!code || !reward_type) {
      return NextResponse.json({ error: '코드와 보상 유형은 필수입니다.' }, { status: 400 })
    }

    if (reward_type === 'credits' && (!bonus_credits || bonus_credits <= 0)) {
      return NextResponse.json({ error: '보너스 크레딧은 1 이상이어야 합니다.' }, { status: 400 })
    }

    const adminDb = createAdminClient()

    // 중복 코드 확인
    const { data: existing } = await adminDb
      .from('promo_codes')
      .select('id')
      .eq('code', code.toUpperCase())

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: '이미 존재하는 코드입니다.' }, { status: 409 })
    }

    const { data, error } = await adminDb
      .from('promo_codes')
      .insert({
        code: code.toUpperCase(),
        description: description || null,
        reward_type,
        bonus_credits: reward_type === 'credits' ? bonus_credits : 0,
        upgrade_plan: reward_type === 'plan_upgrade' ? upgrade_plan : null,
        upgrade_days: upgrade_days || 30,
        max_uses: max_uses || null,
        expires_at: expires_at || null,
        is_active: true,
        created_by: auth.userId,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '프로모 코드 생성 중 오류가 발생했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ code: data })
  } catch {
    return NextResponse.json({ error: '프로모 코드 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
