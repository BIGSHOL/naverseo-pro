import { NextRequest, NextResponse } from 'next/server'

/**
 * 검색 히스토리 API
 * - GET: 최근 검색 키워드 조회 (type별)
 * - POST: 검색 키워드 저장
 *
 * type: 'keyword-research' → keyword_research 테이블에서 조회
 * type: 'keyword-discovery' → search_history 테이블에서 조회
 */

export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ history: [] })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'keyword-research'

    if (type === 'keyword-research') {
      // 기존 keyword_research 테이블에서 최근 시드 키워드 조회 (중복 제거)
      const { data } = await supabase
        .from('keyword_research')
        .select('seed_keyword, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      // 중복 제거하여 최근 5개만
      const unique: string[] = []
      for (const row of data || []) {
        if (!unique.includes(row.seed_keyword) && unique.length < 5) {
          unique.push(row.seed_keyword)
        }
      }

      return NextResponse.json({ history: unique })
    }

    // keyword-discovery: search_history 테이블에서 조회
    const { data, error } = await supabase
      .from('search_history')
      .select('keyword')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      // 테이블이 없을 수 있음 → 빈 배열 반환
      return NextResponse.json({ history: [] })
    }

    return NextResponse.json({
      history: (data || []).map((row) => row.keyword),
    })
  } catch {
    return NextResponse.json({ history: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { keyword, type } = body

    if (!keyword || !type) {
      return NextResponse.json({ error: '키워드와 타입이 필요합니다.' }, { status: 400 })
    }

    // keyword-research는 이미 keywords API에서 저장하므로 스킵
    if (type === 'keyword-research') {
      return NextResponse.json({ ok: true })
    }

    // 같은 키워드가 이미 있으면 삭제 후 재삽입 (최신 순서 유지)
    await supabase
      .from('search_history')
      .delete()
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('keyword', keyword)

    await supabase
      .from('search_history')
      .insert({ user_id: user.id, keyword, type })

    // 오래된 히스토리 정리 (5개 초과 시)
    const { data: all } = await supabase
      .from('search_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('created_at', { ascending: false })

    if (all && all.length > 5) {
      const idsToDelete = all.slice(5).map((row) => row.id)
      await supabase
        .from('search_history')
        .delete()
        .in('id', idsToDelete)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '히스토리 저장 실패' }, { status: 500 })
  }
}
