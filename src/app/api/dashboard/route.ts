import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 모든 쿼리를 병렬 실행
    const [
      { data: profile },
      { data: recentKeywords },
      { data: recentContent },
      { data: allContent },
      { data: recentKeywordActivity },
      { data: recentContentActivity },
      { data: trackedKeywords },
    ] = await Promise.all([
      // 프로필 정보
      supabase
        .from('profiles')
        .select('plan, keywords_used_this_month, content_generated_this_month, analysis_used_today, analysis_reset_date')
        .eq('id', user.id)
        .single(),
      // 최근 키워드 검색 (5개)
      supabase
        .from('keyword_research')
        .select('id, seed_keyword, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      // 최근 생성 콘텐츠 (5개) - seo_score 추가
      supabase
        .from('generated_content')
        .select('id, target_keyword, title, status, seo_score, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      // 콘텐츠 통계: 전체 콘텐츠의 status, seo_score
      supabase
        .from('generated_content')
        .select('status, seo_score')
        .eq('user_id', user.id),
      // 7일 활동: 키워드 검색
      supabase
        .from('keyword_research')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      // 7일 활동: 콘텐츠 생성
      supabase
        .from('generated_content')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      // 트래킹 키워드 수
      supabase
        .from('rank_tracking')
        .select('keyword')
        .eq('user_id', user.id),
    ])

    // 콘텐츠 통계 집계
    const contentItems = allContent || []
    const draft = contentItems.filter(c => c.status === 'draft').length
    const published = contentItems.filter(c => c.status === 'published').length
    const archived = contentItems.filter(c => c.status === 'archived').length
    const scoresWithValue = contentItems.filter(c => c.seo_score != null).map(c => c.seo_score as number)
    const avgSeoScore = scoresWithValue.length > 0
      ? Math.round(scoresWithValue.reduce((a, b) => a + b, 0) / scoresWithValue.length)
      : 0

    // 7일 활동 일별 집계
    const dailyActivity: { date: string; keywords: number; content: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

      const kwCount = (recentKeywordActivity || []).filter(r => {
        const t = new Date(r.created_at)
        return t >= dayStart && t < dayEnd
      }).length

      const ctCount = (recentContentActivity || []).filter(r => {
        const t = new Date(r.created_at)
        return t >= dayStart && t < dayEnd
      }).length

      dailyActivity.push({ date: dateStr, keywords: kwCount, content: ctCount })
    }

    // 트래킹 키워드 distinct 카운트
    const uniqueKeywords = new Set((trackedKeywords || []).map(r => r.keyword))
    const trackedKeywordsCount = uniqueKeywords.size

    return NextResponse.json({
      profile: profile || { plan: 'free', keywords_used_this_month: 0, content_generated_this_month: 0, analysis_used_today: 0, analysis_reset_date: '' },
      recentKeywords: recentKeywords || [],
      recentContent: recentContent || [],
      contentStats: { total: contentItems.length, draft, published, archived, avgSeoScore },
      dailyActivity,
      trackedKeywordsCount,
    })
  } catch {
    return NextResponse.json({
      profile: { plan: 'free', keywords_used_this_month: 0, content_generated_this_month: 0, analysis_used_today: 0, analysis_reset_date: '' },
      recentKeywords: [],
      recentContent: [],
      contentStats: { total: 0, draft: 0, published: 0, archived: 0, avgSeoScore: 0 },
      dailyActivity: [],
      trackedKeywordsCount: 0,
    })
  }
}
