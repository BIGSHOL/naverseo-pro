import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'

export const dynamic = 'force-dynamic'

// 블로그 인증 차단 해제 (관리자 전용)
export async function POST(req: Request) {
  try {
    const auth = await verifyAdmin()
    if (auth.error) return auth.error

    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 })
    }

    // 차단 해제
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        blog_verification_blocked: false,
        blog_verification_attempts: 0,
        blog_verification_last_attempt_at: null,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[Admin] 차단 해제 실패:', updateError)
      return NextResponse.json({ error: '차단 해제에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '블로그 인증 차단이 해제되었습니다.',
    })
  } catch (error) {
    console.error('[Admin] 차단 해제 오류:', error)
    return NextResponse.json({ error: '차단 해제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
