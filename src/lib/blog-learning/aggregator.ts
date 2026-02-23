/**
 * Blog Content Learning - 패턴 집계기
 *
 * analyzed_posts 테이블의 데이터를 keyword_patterns 테이블로 집계
 * 키워드별 + 카테고리 전체 두 레벨로 집계
 */

import type { ContentType } from '@/lib/content/engine'

/**
 * 키워드별 + 카테고리 전체 집계 패턴 업데이트
 *
 * collector가 배치 저장 완료 후 호출
 */
export async function updateAggregatePatterns(
  keyword: string,
  category: ContentType | null
): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    // 1. 키워드별 집계
    await aggregateForKeyword(supabase, keyword, category)

    // 2. 카테고리 전체 집계 (keyword=NULL)
    if (category) {
      await aggregateForCategory(supabase, category)
    }
  } catch (err) {
    console.warn('[BlogLearning] 집계 오류:', err instanceof Error ? err.message : err)
  }
}

async function aggregateForKeyword(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  keyword: string,
  category: ContentType | null
): Promise<void> {
  // 해당 키워드의 모든 분석 포스트 조회
  const { data: posts, error } = await supabase
    .from('analyzed_posts')
    .select('*')
    .eq('keyword', keyword)

  if (error || !posts || posts.length === 0) return

  const aggregated = calculateAggregates(posts)

  // 성공 패턴 (quality_score >= 9)
  const successPosts = posts.filter((p: Record<string, unknown>) => (p.quality_score as number) >= 9)
  const successPatterns = successPosts.length >= 2
    ? calculateSuccessPatterns(successPosts)
    : {}

  // 태그 빈도 집계
  const topTags = calculateTopTags(posts)

  // 최적 범위 (p25-p75)
  const optimalCharRange = calculatePercentileRange(posts.map((p: Record<string, unknown>) => p.char_count as number))
  const optimalImageRange = calculatePercentileRange(posts.map((p: Record<string, unknown>) => p.image_count as number))
  const optimalHeadingRange = calculatePercentileRange(posts.map((p: Record<string, unknown>) => p.heading_count as number))

  // 톤 분포
  const toneDistribution = calculateToneDistribution(posts)

  await supabase
    .from('keyword_patterns')
    .upsert({
      keyword,
      keyword_category: category || 'informational',
      sample_count: posts.length,
      ...aggregated,
      keyword_in_title_rate: avg(posts, 'has_keyword_in_title', true),
      list_format_rate: avg(posts, 'has_list_format', true),
      table_usage_rate: avg(posts, 'has_table', true),
      naver_map_rate: avg(posts, 'has_naver_map', true),
      youtube_rate: avg(posts, 'has_youtube', true),
      tone_distribution: toneDistribution,
      top_tags: topTags,
      success_patterns: successPatterns,
      optimal_char_range: optimalCharRange,
      optimal_image_range: optimalImageRange,
      optimal_heading_range: optimalHeadingRange,
      last_updated_at: new Date().toISOString(),
    }, {
      onConflict: 'keyword,keyword_category',
    })
}

async function aggregateForCategory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  category: ContentType
): Promise<void> {
  // 해당 카테고리의 모든 분석 포스트 조회 (최대 500개)
  const { data: posts, error } = await supabase
    .from('analyzed_posts')
    .select('*')
    .eq('keyword_category', category)
    .order('collected_at', { ascending: false })
    .limit(500)

  if (error || !posts || posts.length < 3) return

  const aggregated = calculateAggregates(posts)
  const successPosts = posts.filter((p: Record<string, unknown>) => (p.quality_score as number) >= 9)
  const successPatterns = successPosts.length >= 2
    ? calculateSuccessPatterns(successPosts)
    : {}
  const topTags = calculateTopTags(posts)
  const optimalCharRange = calculatePercentileRange(posts.map((p: Record<string, unknown>) => p.char_count as number))
  const optimalImageRange = calculatePercentileRange(posts.map((p: Record<string, unknown>) => p.image_count as number))
  const optimalHeadingRange = calculatePercentileRange(posts.map((p: Record<string, unknown>) => p.heading_count as number))
  const toneDistribution = calculateToneDistribution(posts)

  await supabase
    .from('keyword_patterns')
    .upsert({
      keyword: null,
      keyword_category: category,
      sample_count: posts.length,
      ...aggregated,
      keyword_in_title_rate: avg(posts, 'has_keyword_in_title', true),
      list_format_rate: avg(posts, 'has_list_format', true),
      table_usage_rate: avg(posts, 'has_table', true),
      naver_map_rate: avg(posts, 'has_naver_map', true),
      youtube_rate: avg(posts, 'has_youtube', true),
      tone_distribution: toneDistribution,
      top_tags: topTags,
      success_patterns: successPatterns,
      optimal_char_range: optimalCharRange,
      optimal_image_range: optimalImageRange,
      optimal_heading_range: optimalHeadingRange,
      last_updated_at: new Date().toISOString(),
    }, {
      onConflict: 'keyword,keyword_category',
    })
}

// ===== 집계 헬퍼 =====

/* eslint-disable @typescript-eslint/no-explicit-any */
function calculateAggregates(posts: any[]) {
  return {
    avg_char_count: avg(posts, 'char_count'),
    avg_image_count: avg(posts, 'image_count'),
    avg_heading_count: avg(posts, 'heading_count'),
    avg_paragraph_count: avg(posts, 'paragraph_count'),
    avg_internal_links: avg(posts, 'internal_link_count'),
    avg_external_links: avg(posts, 'external_link_count'),
    avg_title_length: avg(posts, 'title_length'),
  }
}

function calculateSuccessPatterns(posts: any[]): Record<string, number> {
  return {
    avg_char_count: avg(posts, 'char_count'),
    avg_image_count: avg(posts, 'image_count'),
    avg_heading_count: avg(posts, 'heading_count'),
    avg_paragraph_count: avg(posts, 'paragraph_count'),
    keyword_in_title_rate: avg(posts, 'has_keyword_in_title', true),
    list_format_rate: avg(posts, 'has_list_format', true),
    sample_count: posts.length,
  }
}

function calculateTopTags(posts: any[]): Array<{ tag: string; count: number }> {
  const tagCounts = new Map<string, number>()

  for (const post of posts) {
    const tags = post.tags as string[] | null
    if (!tags) continue
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    }
  }

  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }))
}

function calculateToneDistribution(posts: any[]): Record<string, number> {
  const toneCounts: Record<string, number> = {}
  let totalWithTone = 0

  for (const post of posts) {
    if (post.writing_tone) {
      toneCounts[post.writing_tone] = (toneCounts[post.writing_tone] || 0) + 1
      totalWithTone++
    }
  }

  if (totalWithTone === 0) return {}

  const distribution: Record<string, number> = {}
  for (const [tone, count] of Object.entries(toneCounts)) {
    distribution[tone] = Math.round((count / totalWithTone) * 100) / 100
  }
  return distribution
}

function calculatePercentileRange(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 }

  const sorted = [...values].sort((a, b) => a - b)
  const p25Index = Math.floor(sorted.length * 0.25)
  const p75Index = Math.floor(sorted.length * 0.75)

  return {
    min: sorted[p25Index] || 0,
    max: sorted[p75Index] || sorted[sorted.length - 1] || 0,
  }
}

function avg(posts: any[], field: string, isBoolean = false): number {
  if (posts.length === 0) return 0

  const sum = posts.reduce((acc: number, p: any) => {
    const val = p[field]
    if (isBoolean) return acc + (val ? 1 : 0)
    return acc + (typeof val === 'number' ? val : 0)
  }, 0)

  return Math.round((sum / posts.length) * 100) / 100
}
/* eslint-enable @typescript-eslint/no-explicit-any */
