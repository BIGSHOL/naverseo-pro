import { NextResponse } from 'next/server'

interface AdminCheckResult {
  userId: string
  error?: NextResponse
}

/**
 * 관리자 권한 확인 유틸리티
 * 사용법: const auth = await verifyAdmin(); if (auth.error) return auth.error;
 */
export async function verifyAdmin(): Promise<AdminCheckResult> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        userId: '',
        error: NextResponse.json(
          { error: '로그인이 필요합니다.' },
          { status: 401 }
        ),
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return {
        userId: user.id,
        error: NextResponse.json(
          { error: '관리자 권한이 필요합니다.' },
          { status: 403 }
        ),
      }
    }

    return { userId: user.id }
  } catch {
    return {
      userId: '',
      error: NextResponse.json(
        { error: '인증 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      ),
    }
  }
}
