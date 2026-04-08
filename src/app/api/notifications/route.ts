import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET: 알림 읽음/삭제 상태 조회
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const { data } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', user.id)
      .single()

    return NextResponse.json(data?.notification_prefs || { read: [], dismissed: [] })
  } catch {
    return NextResponse.json({ read: [], dismissed: [] })
  }
}

// PATCH: 알림 읽음/삭제 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const body = await request.json()
    const { read, dismissed } = body as { read?: string[]; dismissed?: string[] }

    // 현재 상태 조회
    const { data: current } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', user.id)
      .single()

    const prefs = current?.notification_prefs || { read: [], dismissed: [] }

    // 병합 (중복 제거)
    if (read) prefs.read = [...new Set([...(prefs.read || []), ...read])]
    if (dismissed) prefs.dismissed = [...new Set([...(prefs.dismissed || []), ...dismissed])]

    // 오래된 항목 정리 (최대 50개 유지)
    if (prefs.read.length > 50) prefs.read = prefs.read.slice(-50)
    if (prefs.dismissed.length > 50) prefs.dismissed = prefs.dismissed.slice(-50)

    await supabase
      .from('profiles')
      .update({ notification_prefs: prefs })
      .eq('id', user.id)

    return NextResponse.json(prefs)
  } catch {
    return NextResponse.json({ error: '업데이트 실패' }, { status: 500 })
  }
}
