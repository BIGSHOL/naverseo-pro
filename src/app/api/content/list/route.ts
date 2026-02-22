import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 생성된 콘텐츠 + 전체 활동 목록 조회 (캘린더 + 목록용)
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
    const includeActivities = searchParams.get('activities') === 'true'

    // 날짜 범위 계산
    let startDate: string | null = null
    let endDate: string | null = null
    if (year && month) {
      startDate = new Date(Number(year), Number(month) - 1, 1).toISOString()
      endDate = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString()
    }

    // 1) 생성된 콘텐츠 조회
    let contentQuery = supabase
      .from('generated_content')
      .select('id, target_keyword, title, content, status, seo_score, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (startDate && endDate) {
      contentQuery = contentQuery.gte('created_at', startDate).lte('created_at', endDate)
    }

    const { data: contents, error } = await contentQuery.limit(100)

    if (error) {
      console.error('[Content List] 조회 오류:', error)
      return NextResponse.json({ error: '콘텐츠 조회 실패' }, { status: 500 })
    }

    // activities=true가 아니면 기존 응답 유지
    if (!includeActivities) {
      return NextResponse.json({ contents: contents || [] })
    }

    // 2) 키워드 리서치 조회
    let kwQuery = supabase
      .from('keyword_research')
      .select('id, seed_keyword, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (startDate && endDate) {
      kwQuery = kwQuery.gte('created_at', startDate).lte('created_at', endDate)
    }

    const { data: keywords } = await kwQuery.limit(100)

    // 3) 키워드 발굴 (search_history) 조회
    let discoveryQuery = supabase
      .from('search_history')
      .select('id, keyword, type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (startDate && endDate) {
      discoveryQuery = discoveryQuery.gte('created_at', startDate).lte('created_at', endDate)
    }

    const { data: discoveries } = await discoveryQuery.limit(100)

    // 4) 순위 트래킹 조회
    let trackingQuery = supabase
      .from('rank_tracking')
      .select('id, keyword, blog_url, rank_position, section, checked_at')
      .eq('user_id', user.id)
      .order('checked_at', { ascending: false })

    if (startDate && endDate) {
      trackingQuery = trackingQuery.gte('checked_at', startDate).lte('checked_at', endDate)
    }

    const { data: trackings } = await trackingQuery.limit(100)

    // 5) 크레딧 사용 내역 조회
    let creditQuery = supabase
      .from('credit_usage_log')
      .select('credits_spent, created_at')
      .eq('user_id', user.id)

    if (startDate && endDate) {
      creditQuery = creditQuery.gte('created_at', startDate).lte('created_at', endDate)
    }

    const { data: creditLogs } = await creditQuery.limit(500)

    // 일별 크레딧 합계 계산
    const dailyCredits: Record<string, number> = {}
    for (const log of (creditLogs || [])) {
      const d = new Date(log.created_at)
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      dailyCredits[dateKey] = (dailyCredits[dateKey] || 0) + log.credits_spent
    }

    // 월간 총 크레딧 소모
    const monthlyCreditsSpent = (creditLogs || []).reduce((sum, l) => sum + l.credits_spent, 0)

    // 통합 활동 데이터 구성
    const activities = [
      ...(contents || []).map((c) => ({
        id: c.id,
        type: 'content' as const,
        label: c.target_keyword,
        detail: c.title,
        status: c.status,
        score: c.seo_score,
        created_at: c.created_at,
      })),
      ...(keywords || []).map((k) => ({
        id: k.id,
        type: 'keyword' as const,
        label: k.seed_keyword,
        detail: null,
        status: null,
        score: null,
        created_at: k.created_at,
      })),
      ...(discoveries || []).map((d) => ({
        id: d.id,
        type: 'discovery' as const,
        label: d.keyword,
        detail: d.type,
        status: null,
        score: null,
        created_at: d.created_at,
      })),
      ...(trackings || []).map((t) => ({
        id: t.id,
        type: 'tracking' as const,
        label: t.keyword,
        detail: t.blog_url,
        status: t.rank_position ? `${t.rank_position}위` : '100위 밖',
        score: t.rank_position,
        created_at: t.checked_at,
      })),
    ]

    return NextResponse.json({
      contents: contents || [],
      activities,
      dailyCredits,
      monthlyCreditsSpent,
    })
  } catch (error) {
    console.error('[Content List] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
