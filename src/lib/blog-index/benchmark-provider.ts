/**
 * 벤치마크 기준값 조회
 *
 * 항상 리서치 기반 정적 테이블(STATIC_CATEGORY_BENCHMARKS)을 반환합니다.
 * 자체 축적 데이터(category_benchmarks)는 점수 기준에 사용하지 않습니다.
 * → 축적 데이터는 사용자 편향(초보 블로거 비율)이 높아 표준 기준으로 부적합
 * → 축적은 계속 진행 (benchmark-accumulator.ts), 향후 참고용으로 보관
 */

import type { BlogCategory, CategoryBenchmarkValues } from './categories'
import { STATIC_CATEGORY_BENCHMARKS } from './categories'

export interface CategoryBenchmarkResult {
  values: CategoryBenchmarkValues
  source: 'accumulated' | 'static'
  sampleCount: number
}

export async function getCategoryBenchmark(
  blogCategory: BlogCategory
): Promise<CategoryBenchmarkResult> {
  return {
    values: STATIC_CATEGORY_BENCHMARKS[blogCategory],
    source: 'static',
    sampleCount: 0,
  }
}
