import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 개인화된 키워드 추천 생성
function generateRecommendedKeywords(
  keywordHistory: { seed_keyword: string; created_at: string }[],
  contentHistory: { target_keyword: string }[]
): string[] {
  if (keywordHistory.length === 0) {
    // 히스토리가 없으면 인기 키워드 반환
    return ['다이어트 식단', '인테리어 팁', '맛집 추천', '여행 코스']
  }

  // 1. 이미 콘텐츠를 생성한 키워드는 제외
  const usedKeywords = new Set(contentHistory.map(c => c.target_keyword.toLowerCase()))

  // 2. 키워드 빈도 분석 (최근 것일수록 가중치 높게)
  const keywordFreq: Record<string, number> = {}
  keywordHistory.forEach((kw, idx) => {
    const k = kw.seed_keyword.toLowerCase().trim()
    if (usedKeywords.has(k)) return // 이미 사용한 키워드 제외

    // 최근 키워드일수록 가중치 높게 (최근 = 높은 점수)
    const weight = Math.max(1, keywordHistory.length - idx)
    keywordFreq[k] = (keywordFreq[k] || 0) + weight
  })

  // 3. 빈도가 높은 상위 키워드 추출
  const topKeywords = Object.entries(keywordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw]) => kw)

  // 4. 관련 키워드 생성 (간단한 확장)
  const recommendations: string[] = []
  const suffixes = ['추천', '방법', '후기', '꿀팁', '정보', '가이드', '리스트', 'TOP5', '비교']

  for (const baseKeyword of topKeywords) {
    // 원본 키워드가 이미 접미사를 포함하고 있으면 그대로 추가
    if (!usedKeywords.has(baseKeyword)) {
      recommendations.push(baseKeyword)
    }

    // 관련 키워드 생성
    for (const suffix of suffixes) {
      const variant = `${baseKeyword} ${suffix}`
      if (!usedKeywords.has(variant) && recommendations.length < 6) {
        recommendations.push(variant)
      }
    }

    if (recommendations.length >= 6) break
  }

  // 5. 최소 4개 보장
  if (recommendations.length < 4) {
    const fallbacks = ['블로그 글쓰기 팁', 'SEO 최적화 방법', '상위노출 전략', '콘텐츠 기획']
    for (const fb of fallbacks) {
      if (!recommendations.includes(fb) && recommendations.length < 4) {
        recommendations.push(fb)
      }
    }
  }

  return recommendations.slice(0, 6)
}

export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 프로필 쿼리 (별도 실행 - SSR 세션 경합 방지)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, role, credits_balance, credits_monthly_quota, credits_reset_at, keywords_used_this_month, content_generated_this_month, analysis_used_today, analysis_reset_date, recommended_keywords, recommendations_updated_at, blog_url, blog_id, blog_name, blog_thumbnail, blog_total_posts, blog_score, blog_level, blog_category_keywords, blog_last_post_date, blog_updated_at, blog_verification_code, blog_verified, blog_verified_at')
      .eq('id', user.id)
      .single()

    // 추천 키워드 캐시 확인 (KST 기준 하루 1회 갱신)
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000 // UTC+9
    const todayKST = new Date(now.getTime() + kstOffset).toISOString().split('T')[0]

    let needsUpdate = true
    if (profile?.recommendations_updated_at) {
      const lastUpdateKST = new Date(new Date(profile.recommendations_updated_at).getTime() + kstOffset).toISOString().split('T')[0]
      needsUpdate = lastUpdateKST !== todayKST
    }

    const [
      { data: recentKeywords },
      { data: allKeywords },
      { data: recentContent },
      { data: allContent },
      { data: creditActivityLogs },
      { data: trackedKeywords },
    ] = await Promise.all([
      // 최근 키워드 검색 (5개)
      supabase
        .from('keyword_research')
        .select('id, seed_keyword, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      // 키워드 히스토리 (최근 30개 - 추천용)
      supabase
        .from('keyword_research')
        .select('seed_keyword, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      // 최근 생성 콘텐츠 (5개) - seo_score 추가
      supabase
        .from('generated_content')
        .select('id, target_keyword, title, content, status, seo_score, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      // 콘텐츠 통계: 전체 콘텐츠의 status, seo_score
      supabase
        .from('generated_content')
        .select('status, seo_score')
        .eq('user_id', user.id),
      // 7일 활동: credit_usage_log에서 전체 기능 집계
      supabase
        .from('credit_usage_log')
        .select('feature, created_at')
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

    // 7일 활동 일별 집계 (credit_usage_log 기반 4카테고리)
    const keywordFeatures = ['keyword_research', 'keyword_discovery']
    const contentFeatures = ['content_generation', 'content_improve']
    const seoFeatures = ['seo_check', 'seo_report', 'competitor_analysis', 'blog_index']
    const trackingFeatures = ['tracking_per_keyword']

    const dailyActivity: { date: string; keywords: number; content: number; seo: number; tracking: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

      const logsForDay = (creditActivityLogs || []).filter(r => {
        const t = new Date(r.created_at)
        return t >= dayStart && t < dayEnd
      })

      dailyActivity.push({
        date: dateStr,
        keywords: logsForDay.filter(r => keywordFeatures.includes(r.feature)).length,
        content: logsForDay.filter(r => contentFeatures.includes(r.feature)).length,
        seo: logsForDay.filter(r => seoFeatures.includes(r.feature)).length,
        tracking: logsForDay.filter(r => trackingFeatures.includes(r.feature)).length,
      })
    }

    // 트래킹 키워드 distinct 카운트
    const uniqueKeywords = new Set((trackedKeywords || []).map(r => r.keyword))
    const trackedKeywordsCount = uniqueKeywords.size

    // 개인화된 키워드 추천 (하루 1회 갱신)
    let recommendedKeywords: string[]

    if (!needsUpdate && profile?.recommended_keywords && Array.isArray(profile.recommended_keywords)) {
      // 캐시된 추천 사용 (오늘 이미 생성됨)
      recommendedKeywords = profile.recommended_keywords as string[]
    } else {
      // 새로운 추천 생성
      recommendedKeywords = generateRecommendedKeywords(allKeywords || [], recentContent || [])

      // DB에 비동기 저장 (응답 블로킹 방지)
      supabase
        .from('profiles')
        .update({
          recommended_keywords: recommendedKeywords,
          recommendations_updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .then(() => console.log('[Dashboard] 추천 키워드 업데이트 완료'), err => console.error('[Dashboard] 추천 키워드 업데이트 실패:', err))
    }

    // 블로그 프로필 객체 구성
    const blogProfile = profile?.blog_url ? {
      blogUrl: profile.blog_url,
      blogId: profile.blog_id,
      blogName: profile.blog_name || profile.blog_id || '',
      blogThumbnail: profile.blog_thumbnail,
      totalPosts: profile.blog_total_posts || 0,
      blogScore: profile.blog_score || 0,
      blogLevel: profile.blog_level || '',
      categoryKeywords: profile.blog_category_keywords || [],
      lastPostDate: profile.blog_last_post_date,
      updatedAt: profile.blog_updated_at,
      verificationCode: profile.blog_verification_code,
      verified: profile.blog_verified || false,
      verifiedAt: profile.blog_verified_at,
    } : null

    return NextResponse.json({
      profile: profile || { plan: 'free', role: 'user', credits_balance: 30, credits_monthly_quota: 30, credits_reset_at: '', keywords_used_this_month: 0, content_generated_this_month: 0, analysis_used_today: 0, analysis_reset_date: '' },
      blogProfile,
      recentKeywords: recentKeywords || [],
      recentContent: recentContent || [],
      contentStats: { total: contentItems.length, draft, published, archived, avgSeoScore },
      dailyActivity,
      trackedKeywordsCount,
      recommendedKeywords,
    })
  } catch (error) {
    console.error('[Dashboard] 오류:', error)
    return NextResponse.json({
      profile: { plan: 'free', role: 'user', credits_balance: 30, credits_monthly_quota: 30, credits_reset_at: '', keywords_used_this_month: 0, content_generated_this_month: 0, analysis_used_today: 0, analysis_reset_date: '' },
      recentKeywords: [],
      recentContent: [],
      contentStats: { total: 0, draft: 0, published: 0, archived: 0, avgSeoScore: 0 },
      dailyActivity: [],
      trackedKeywordsCount: 0,
    })
  }
}
