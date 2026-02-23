import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const allowedFields: Record<string, unknown> = {}
    if (typeof body.is_active === 'boolean') allowedFields.is_active = body.is_active
    if (typeof body.max_uses === 'number') allowedFields.max_uses = body.max_uses
    if (body.expires_at !== undefined) allowedFields.expires_at = body.expires_at
    if (body.description !== undefined) allowedFields.description = body.description
    if (typeof body.bonus_credits === 'number') allowedFields.bonus_credits = body.bonus_credits
    allowedFields.updated_at = new Date().toISOString()

    const { data, error } = await adminDb
      .from('promo_codes')
      .update(allowedFields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '프로모 코드 수정 중 오류가 발생했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ code: data })
  } catch {
    return NextResponse.json({ error: '프로모 코드 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const adminDb = createAdminClient()

    const { error } = await adminDb.from('promo_codes').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: '프로모 코드 삭제 중 오류가 발생했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '프로모 코드 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
