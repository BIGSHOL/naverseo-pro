import { NextRequest, NextResponse } from 'next/server'
import { extractBlogId } from '@/lib/utils/text'

export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const blogUrl = request.nextUrl.searchParams.get('blogUrl')
    if (!blogUrl?.trim()) {
      return NextResponse.json(
        { error: '블로그 URL이 필요합니다.' },
        { status: 400 }
      )
    }

    // blog_id 추출하여 매칭 (URL 형식이 달라도 같은 블로그면 매칭)
    const blogId = extractBlogId(blogUrl.trim())

    // latest=true: 최신 1건의 full_result 반환 (캐시 즉시 로딩용)
    const latest = request.nextUrl.searchParams.get('latest') === 'true'

    if (latest) {
      let query = supabase
        .from('blog_index_history')
        .select('id, full_result, checked_at')
        .eq('user_id', user.id)

      // blog_id로 매칭 (우선), 없으면 blog_url 폴백
      if (blogId) {
        query = query.eq('blog_id', blogId)
      } else {
        query = query.eq('blog_url', blogUrl.trim())
      }

      const { data: latestEntry, error } = await query
        .order('checked_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !latestEntry) {
        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows found (정상), 그 외는 실제 에러
          console.error('[BlogIndexHistory] 캐시 조회 실패:', error.message, error.code, error.hint)
        }
        return NextResponse.json({ cached: null })
      }

      // v5+ 형식 검증: categories 배열이 5축이면 유효 (searchBonus 또는 categories 존재 확인)
      const result = latestEntry.full_result as Record<string, unknown> | null
      if (!result || (!result.searchBonus && !result.categories)) {
        return NextResponse.json({ cached: null })
      }

      return NextResponse.json({
        cached: latestEntry.full_result,
        checkedAt: latestEntry.checked_at,
      })
    }

    // 기본: 히스토리 목록 + 통계 (추이 차트용)
    let historyQuery = supabase
      .from('blog_index_history')
      .select('id, total_score, search_score, popularity_score, content_score, activity_score, abuse_penalty, level_tier, level_label, metrics, is_demo, checked_at')
      .eq('user_id', user.id)

    if (blogId) {
      historyQuery = historyQuery.eq('blog_id', blogId)
    } else {
      historyQuery = historyQuery.eq('blog_url', blogUrl.trim())
    }

    const { data: history, error } = await historyQuery
      .order('checked_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('[BlogIndexHistory] 조회 오류:', error)
      return NextResponse.json(
        { error: '히스토리 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (!history || history.length === 0) {
      return NextResponse.json({ history: [], stats: null })
    }

    // 통계 계산
    const scores = history.map(h => h.total_score)
    const highestScore = Math.max(...scores)
    const lowestScore = Math.min(...scores)
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    // 최근 변화량 (가장 최근 vs 그 이전)
    let latestChange = 0
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (history.length >= 2) {
      latestChange = history[0].total_score - history[1].total_score
      if (latestChange > 0) trend = 'up'
      else if (latestChange < 0) trend = 'down'
    }

    return NextResponse.json({
      history,
      stats: {
        measurements: history.length,
        highestScore,
        lowestScore,
        avgScore,
        latestChange,
        trend,
      },
    })
  } catch (error) {
    console.error('[BlogIndexHistory] 오류:', error)
    return NextResponse.json(
      { error: '히스토리 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
