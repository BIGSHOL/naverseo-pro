import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 프로필 정보
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, keywords_used_this_month, content_generated_this_month')
      .eq('id', user.id)
      .single()

    // 최근 키워드 검색 (5개)
    const { data: recentKeywords } = await supabase
      .from('keyword_research')
      .select('id, seed_keyword, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // 최근 생성 콘텐츠 (5개)
    const { data: recentContent } = await supabase
      .from('generated_content')
      .select('id, target_keyword, title, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      profile: profile || { plan: 'free', keywords_used_this_month: 0, content_generated_this_month: 0 },
      recentKeywords: recentKeywords || [],
      recentContent: recentContent || [],
    })
  } catch {
    return NextResponse.json({
      profile: { plan: 'free', keywords_used_this_month: 0, content_generated_this_month: 0 },
      recentKeywords: [],
      recentContent: [],
    })
  }
}
