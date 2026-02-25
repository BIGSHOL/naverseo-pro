/**
 * 블로그 지수 - 2. 방문자 & 인기도 분석 — 25점 (v4 신규)
 *
 * 일평균 방문자(10) + 평균 댓글 수(8) + 평균 공감 수(7)
 *
 * 데이터 수집 실패 시 중립 점수: 방문자(3) + 댓글(2) + 공감(2) = 7/25
 */

import type { VisitorData, EngagementData, AnalysisCategory } from '../types'

export function analyzePopularity(
  visitorData?: VisitorData | null,
  engagementData?: EngagementData | null
): AnalysisCategory {
  const maxScore = 25
  const details: string[] = []
  let score = 0

  // === 일평균 방문자 수 (10점) ===
  if (visitorData && visitorData.isAvailable) {
    const avg = visitorData.avgDailyVisitors
    if (avg >= 1000) {
      score += 10
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (최우수)`)
    } else if (avg >= 500) {
      score += 8
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (우수)`)
    } else if (avg >= 200) {
      score += 6
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (양호)`)
    } else if (avg >= 50) {
      score += 4
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (보통)`)
    } else if (avg >= 10) {
      score += 2
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (부족)`)
    } else {
      score += 0
      details.push(`일평균 방문자: ${avg}명 (매우 부족)`)
    }
  } else {
    // 방문자 데이터 수집 실패 → 중립 점수
    score += 3
    details.push('방문자 데이터 미제공 (기본 3점)')
  }

  // === 평균 댓글 수 (8점) ===
  if (engagementData && engagementData.isAvailable && engagementData.avgCommentCount !== null) {
    const avgComments = engagementData.avgCommentCount
    if (avgComments >= 20) {
      score += 8
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (최우수)`)
    } else if (avgComments >= 10) {
      score += 6
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (우수)`)
    } else if (avgComments >= 5) {
      score += 4
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (양호)`)
    } else if (avgComments >= 2) {
      score += 2
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (보통)`)
    } else if (avgComments >= 0.5) {
      score += 1
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (부족)`)
    } else {
      score += 0
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (매우 부족)`)
    }
  } else {
    // 댓글 데이터 수집 실패 → 중립 점수
    score += 2
    details.push('댓글 데이터 미제공 (기본 2점)')
  }

  // === 평균 공감 수 (7점) ===
  if (engagementData && engagementData.isAvailable && engagementData.avgSympathyCount !== null) {
    const avgSympathy = engagementData.avgSympathyCount
    if (avgSympathy >= 30) {
      score += 7
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (최우수)`)
    } else if (avgSympathy >= 15) {
      score += 5
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (우수)`)
    } else if (avgSympathy >= 5) {
      score += 3
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (양호)`)
    } else if (avgSympathy >= 1) {
      score += 1
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (보통)`)
    } else {
      score += 0
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (부족)`)
    }
  } else {
    // 공감 데이터 수집 실패 → 중립 점수
    score += 2
    details.push('공감 데이터 미제공 (기본 2점)')
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: '방문자 & 인기도', score: Math.min(maxScore, score), maxScore, grade, details }
}
