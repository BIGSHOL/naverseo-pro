import { NextRequest, NextResponse } from 'next/server'

// 키워드 트래킹 삭제 (해당 keyword+blog_url의 모든 기록)
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { keyword, blogUrl } = await request.json()

    if (!keyword || !blogUrl) {
      return NextResponse.json(
        { error: '키워드와 블로그 URL이 필요합니다.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('rank_tracking')
      .delete()
      .eq('user_id', user.id)
      .eq('keyword', keyword)
      .eq('blog_url', blogUrl)

    if (error) {
      console.error('[Tracking Delete] 오류:', error)
      return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Tracking Delete] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
