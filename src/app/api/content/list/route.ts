import { NextRequest, NextResponse } from 'next/server'

// 생성된 콘텐츠 목록 조회 (캘린더 + 목록용)
export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    let query = supabase
      .from('generated_content')
      .select('id, target_keyword, title, content, status, seo_score, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // 연월 필터
    if (year && month) {
      const startDate = new Date(Number(year), Number(month) - 1, 1).toISOString()
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString()
      query = query.gte('created_at', startDate).lte('created_at', endDate)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      console.error('[Content List] 조회 오류:', error)
      return NextResponse.json({ error: '콘텐츠 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ contents: data || [] })
  } catch (error) {
    console.error('[Content List] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
