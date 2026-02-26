/**
 * 하이브리드 벤치마크 조회
 *
 * 1. DB category_benchmarks 테이블 조회
 * 2. sample_count >= MIN_SAMPLES → 축적 데이터 반환
 * 3. 미달 → STATIC_CATEGORY_BENCHMARKS 폴백
 */

import type { BlogCategory, CategoryBenchmarkValues } from './categories'
import { STATIC_CATEGORY_BENCHMARKS } from './categories'

const MIN_SAMPLES = 20

export interface CategoryBenchmarkResult {
  values: CategoryBenchmarkValues
  source: 'accumulated' | 'static'
  sampleCount: number
}

export async function getCategoryBenchmark(
  blogCategory: BlogCategory
): Promise<CategoryBenchmarkResult> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('category_benchmarks')
      .select('*')
      .eq('blog_category', blogCategory)
      .single()

    if (!error && data && data.sample_count >= MIN_SAMPLES) {
      return {
        values: {
          postingFrequency: {
            recommended: Math.round(data.avg_posting_frequency * 10) / 10,
            topBlogger: Math.round((data.p75_posting_frequency || data.avg_posting_frequency * 1.5) * 10) / 10,
          },
          avgTitleLength: { optimal: Math.round(data.avg_title_length) },
          avgContentLength: { recommended: Math.round(data.avg_content_length) },
          imageRate: { recommended: Math.round(data.avg_image_rate) },
          topicFocus: { recommended: Math.round(data.avg_topic_focus) },
          avgImageCount: { recommended: Math.round(data.avg_image_count * 10) / 10 },
          avgCommentCount: { recommended: Math.round(data.avg_comment_count * 10) / 10 },
          avgSympathyCount: { recommended: Math.round(data.avg_sympathy_count * 10) / 10 },
          dailyVisitors: {
            recommended: Math.round(data.avg_daily_visitors),
            topBlogger: Math.round(data.p75_daily_visitors || data.avg_daily_visitors * 2),
          },
          blogAge: { recommended: Math.round(data.avg_blog_age) },
          totalPostCount: { recommended: Math.round(data.avg_total_post_count) },
        },
        source: 'accumulated',
        sampleCount: data.sample_count,
      }
    }
  } catch (err) {
    console.error('[BenchmarkProvider] DB 조회 실패 (정적 폴백):', err)
  }

  // 폴백: 정적 테이블
  return {
    values: STATIC_CATEGORY_BENCHMARKS[blogCategory],
    source: 'static',
    sampleCount: 0,
  }
}
