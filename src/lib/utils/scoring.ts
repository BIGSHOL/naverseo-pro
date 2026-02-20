/**
 * 공유 AI 점수 보정 유틸리티
 *
 * SEO AI 분석기와 블로그 지수 AI 분석기에서 중복되던
 * 점수 보정 알고리즘을 통합
 */

interface ScoreAdjustmentParams {
  /** 긍정 점수들의 평균 (1~10) */
  avgPositiveScore: number
  /** 어뷰징 위험 점수 (0~10, 선택) */
  abuseRisk?: number
  /** 긍정 보정 사유 생성 함수 */
  positiveReason: (avg: number) => string
  /** 약한 긍정 보정 사유 */
  mildPositiveReason: string
  /** 부정 보정 사유 생성 함수 */
  negativeReason: (avg: number) => string
  /** 어뷰징 감산 사유 생성 함수 (선택) */
  abuseReason?: (risk: number) => string
}

interface ScoreAdjustmentResult {
  adjustment: number  // -10 ~ +10
  reason: string
}

/**
 * AI 분석 결과에 기반한 점수 보정값 계산
 *
 * 공통 알고리즘:
 * - 평균 8점 이상 → 가산 (최대 +6)
 * - 평균 6점 이상 → 소폭 가산 (최대 +3)
 * - 평균 3점 이하 → 감산
 * - 평균 4점 이하 → 소폭 감산
 * - 어뷰징 위험 7+ → 감산 (블로그 지수용)
 * - 범위 제한: -10 ~ +10
 */
export function calculateScoreAdjustment(params: ScoreAdjustmentParams): ScoreAdjustmentResult {
  const { avgPositiveScore, abuseRisk, positiveReason, mildPositiveReason, negativeReason, abuseReason } = params

  let adjustment = 0
  let reason = ''

  // 어뷰징 위험이 높으면 최우선 감산 (blog-index용)
  if (abuseRisk !== undefined && abuseRisk >= 7 && abuseReason) {
    adjustment = -Math.round((abuseRisk - 5) * 2)  // 최대 -10
    reason = abuseReason(abuseRisk)
  } else if (avgPositiveScore >= 8 && (abuseRisk === undefined || abuseRisk <= 2)) {
    adjustment = Math.round((avgPositiveScore - 7) * 2)  // 최대 +6
    reason = positiveReason(avgPositiveScore)
  } else if (avgPositiveScore >= 6 && (abuseRisk === undefined || abuseRisk <= 3)) {
    adjustment = Math.round((avgPositiveScore - 6) * 1.5)  // 최대 +3
    reason = mildPositiveReason
  } else if (avgPositiveScore <= 3) {
    adjustment = -Math.round((4 - avgPositiveScore) * 2)  // 최대 -8 (SEO) / -1.5 (blog-index)
    reason = negativeReason(avgPositiveScore)
  } else if (avgPositiveScore <= 4) {
    adjustment = -Math.round((5 - avgPositiveScore) * 1.5)  // 최대 -3
    reason = `AI 분석: 콘텐츠 품질이 다소 낮아 소폭 감산`
  }

  // 범위 제한
  adjustment = Math.max(-10, Math.min(10, adjustment))

  return { adjustment, reason }
}
