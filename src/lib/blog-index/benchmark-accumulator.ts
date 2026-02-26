/**
 * 벤치마크 데이터 축적 (fire-and-forget)
 *
 * 블로그 지수 분석 완료 후 해당 카테고리의 벤치마크 데이터를 축적
 * - totalScore < 30인 저품질 블로그 제외
 * - incremental average 방식 (기존 평균에 새 값 가산)
 * - createAdminClient 사용 (기존 blog-learning과 동일 패턴)
 */

import type { BlogCategory } from './categories'
import type { BenchmarkData } from './types'

const MIN_SCORE_THRESHOLD = 30

interface AccumulateInput {
  postingFrequency: number
  avgTitleLength: number
  avgContentLength: number
  imageRate: number
  topicFocus: number
  avgImageCount: number
  avgCommentCount: number | null
  avgSympathyCount: number | null
  avgDailyVisitors: number | null
  blogAge: number
  totalPostCount: number
}

function extractAccumulateInput(benchmark: BenchmarkData): AccumulateInput {
  return {
    postingFrequency: benchmark.postingFrequency.mine,
    avgTitleLength: benchmark.avgTitleLength.mine,
    avgContentLength: benchmark.avgContentLength.mine,
    imageRate: benchmark.imageRate.mine,
    topicFocus: benchmark.topicFocus.mine,
    avgImageCount: benchmark.avgImageCount.mine,
    avgCommentCount: benchmark.avgCommentCount?.mine ?? null,
    avgSympathyCount: benchmark.avgSympathyCount?.mine ?? null,
    avgDailyVisitors: benchmark.dailyVisitors?.mine ?? null,
    blogAge: benchmark.blogAge?.mine ?? 0,
    totalPostCount: benchmark.totalPostCount?.mine ?? 0,
  }
}

export async function accumulateBenchmarkData(
  blogCategory: BlogCategory,
  benchmark: BenchmarkData,
  totalScore: number,
): Promise<void> {
  // 저품질 블로그 제외
  if (totalScore < MIN_SCORE_THRESHOLD) return

  const input = extractAccumulateInput(benchmark)

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    // 기존 행 조회
    const { data: existing } = await supabase
      .from('category_benchmarks')
      .select('*')
      .eq('blog_category', blogCategory)
      .single()

    if (existing) {
      // incremental average: new_avg = (old_avg * old_count + new_value) / (old_count + 1)
      const n = existing.sample_count
      const n1 = n + 1
      const inc = (oldAvg: number, newVal: number | null) =>
        newVal !== null ? (oldAvg * n + newVal) / n1 : oldAvg

      const { error } = await supabase
        .from('category_benchmarks')
        .update({
          sample_count: n1,
          avg_posting_frequency: inc(existing.avg_posting_frequency, input.postingFrequency),
          avg_title_length: inc(existing.avg_title_length, input.avgTitleLength),
          avg_content_length: inc(existing.avg_content_length, input.avgContentLength),
          avg_image_rate: inc(existing.avg_image_rate, input.imageRate),
          avg_topic_focus: inc(existing.avg_topic_focus, input.topicFocus),
          avg_image_count: inc(existing.avg_image_count, input.avgImageCount),
          avg_comment_count: inc(existing.avg_comment_count, input.avgCommentCount),
          avg_sympathy_count: inc(existing.avg_sympathy_count, input.avgSympathyCount),
          avg_daily_visitors: inc(existing.avg_daily_visitors, input.avgDailyVisitors),
          avg_blog_age: inc(existing.avg_blog_age, input.blogAge),
          avg_total_post_count: inc(existing.avg_total_post_count, input.totalPostCount),
          // p75는 단순 평균으로는 계산 불가 → 근사치: 상위권 값일 때만 갱신
          ...(input.postingFrequency > (existing.p75_posting_frequency || 0)
            ? { p75_posting_frequency: (existing.p75_posting_frequency * n + input.postingFrequency) / n1 }
            : {}),
          ...(input.avgDailyVisitors && input.avgDailyVisitors > (existing.p75_daily_visitors || 0)
            ? { p75_daily_visitors: (existing.p75_daily_visitors * n + input.avgDailyVisitors) / n1 }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('blog_category', blogCategory)

      if (error) {
        console.error('[BenchmarkAccumulator] 업데이트 실패:', error.message)
      }
    } else {
      // 최초 삽입
      const { error } = await supabase
        .from('category_benchmarks')
        .insert({
          blog_category: blogCategory,
          sample_count: 1,
          avg_posting_frequency: input.postingFrequency,
          avg_title_length: input.avgTitleLength,
          avg_content_length: input.avgContentLength,
          avg_image_rate: input.imageRate,
          avg_topic_focus: input.topicFocus,
          avg_image_count: input.avgImageCount,
          avg_comment_count: input.avgCommentCount ?? 0,
          avg_sympathy_count: input.avgSympathyCount ?? 0,
          avg_daily_visitors: input.avgDailyVisitors ?? 0,
          avg_blog_age: input.blogAge,
          avg_total_post_count: input.totalPostCount,
          p75_posting_frequency: input.postingFrequency,
          p75_daily_visitors: input.avgDailyVisitors ?? 0,
          updated_at: new Date().toISOString(),
        })

      if (error) {
        console.error('[BenchmarkAccumulator] 삽입 실패:', error.message)
      }
    }
  } catch (err) {
    console.error('[BenchmarkAccumulator] 축적 실패 (무시):', err)
  }
}
