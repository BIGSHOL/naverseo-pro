import { NextResponse } from 'next/server'

/**
 * 블로그 학습 파이프라인 통계 API
 * GET /api/blog-learning/stats
 *
 * 수집된 포스트 수, 키워드 커버리지, 카테고리 분포 등 표시
 */
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 1. 총 분석 포스트 수
    const { count: totalPosts } = await supabase
      .from('analyzed_posts')
      .select('*', { count: 'exact', head: true })

    // 2. 고유 키워드 수
    const { data: keywordData } = await supabase
      .from('analyzed_posts')
      .select('keyword')

    const uniqueKeywords = new Set(keywordData?.map(r => r.keyword) || [])

    // 3. 카테고리별 분포
    const { data: categoryData } = await supabase
      .from('analyzed_posts')
      .select('keyword_category')

    const categoryCounts: Record<string, number> = {}
    for (const row of categoryData || []) {
      const cat = row.keyword_category || 'unknown'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    }

    // 4. 수집 출처별 분포
    const { data: sourceData } = await supabase
      .from('analyzed_posts')
      .select('collected_from')

    const sourceCounts: Record<string, number> = {}
    for (const row of sourceData || []) {
      const src = row.collected_from || 'unknown'
      sourceCounts[src] = (sourceCounts[src] || 0) + 1
    }

    // 5. 집계 패턴 수
    const { count: patternCount } = await supabase
      .from('keyword_patterns')
      .select('*', { count: 'exact', head: true })

    // 6. 최근 수집 (최신 50개 - 프론트에서 더보기 페이지네이션)
    const { data: recentPosts } = await supabase
      .from('analyzed_posts')
      .select('keyword, keyword_category, post_url, quality_score, collected_from, collected_at')
      .order('collected_at', { ascending: false })
      .limit(50)

    // 7. 평균 품질 점수
    const { data: qualityData } = await supabase
      .from('analyzed_posts')
      .select('quality_score')

    const avgQuality = qualityData && qualityData.length > 0
      ? Math.round(qualityData.reduce((sum, r) => sum + (r.quality_score || 0), 0) / qualityData.length * 10) / 10
      : 0

    // 8. 마지막 수집 시간
    const lastCollectedAt = recentPosts && recentPosts.length > 0
      ? recentPosts[0].collected_at
      : null

    // 9. 최근 14일 일별 수집 추이
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
    fourteenDaysAgo.setHours(0, 0, 0, 0)

    const { data: dailyData } = await supabase
      .from('analyzed_posts')
      .select('collected_at')
      .gte('collected_at', fourteenDaysAgo.toISOString())

    const dailyCounts: Record<string, number> = {}
    for (let d = 0; d < 14; d++) {
      const date = new Date(fourteenDaysAgo)
      date.setDate(date.getDate() + d)
      dailyCounts[date.toISOString().slice(0, 10)] = 0
    }
    for (const row of dailyData || []) {
      const dateKey = new Date(row.collected_at).toISOString().slice(0, 10)
      if (dailyCounts[dateKey] !== undefined) {
        dailyCounts[dateKey]++
      }
    }
    const dailyTrend = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      count,
    }))

    return NextResponse.json({
      totalPosts: totalPosts || 0,
      uniqueKeywords: uniqueKeywords.size,
      categoryDistribution: categoryCounts,
      sourceDistribution: sourceCounts,
      patternCount: patternCount || 0,
      avgQualityScore: avgQuality,
      recentCollections: recentPosts || [],
      lastCollectedAt,
      dailyTrend,
    })
  } catch (error) {
    console.error('[BlogLearning Stats] 오류:', error)
    return NextResponse.json(
      { error: '학습 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
