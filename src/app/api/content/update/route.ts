import { NextRequest, NextResponse } from 'next/server'

// 콘텐츠 상태 변경 (draft → published → archived)
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { contentId, status } = await request.json()

    if (!contentId || !status) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    if (!['draft', 'published', 'archived'].includes(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 })
    }

    const { error, count } = await supabase
      .from('generated_content')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', contentId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Content Update] 오류:', error)
      return NextResponse.json({ error: '업데이트 실패' }, { status: 500 })
    }

    if (count === 0) {
      return NextResponse.json({ error: '콘텐츠를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Content Update] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
