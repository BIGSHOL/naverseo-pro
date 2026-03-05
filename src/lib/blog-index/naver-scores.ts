/**
 * 네이버 알고리즘 추정 점수 계산기 (v12)
 *
 * 5축 비균등 배분(25:25:20:15:15)을 가중 합산하여
 * D.I.A.와 C-Rank 추정치를 산출합니다.
 *
 * ⚠ 네이버 공식 알고리즘이 아닌 공개된 정보 기반의 "추정"입니다.
 */

import type { AnalysisCategory, NaverAlgorithmScore, NaverScoreFactor } from './types'

// ────────── D.I.A. 가중치 ──────────
// D.I.A. (Deep Intent Analysis): 콘텐츠가 검색 의도에 부합하는가?
// 핵심: 주제 전문성 + 콘텐츠 품질 + 사용자 반응(체류시간, 댓글, 공감)
const DIA_WEIGHTS: Record<string, number> = {
  '주제 전문성': 0.25,   // C-Rank 연계 — 주제 부합도
  '콘텐츠 품질': 0.25,   // 글 품질·이미지·구조 → 의도 부합도 핵심
  '활동 신뢰도': 0.20,   // 꾸준한 활동 → 신선한 콘텐츠
  '사용자 반응': 0.18,   // 체류시간·댓글·공감 → 만족도 지표
  '검색 노출력': 0.12,   // 키워드 부합·검색 노출 → 의도 매칭
}

// ────────── C-Rank 가중치 ──────────
// C-Rank: 해당 주제에 대한 블로그 권위도
// 핵심: 주제 집중도 + 꾸준한 포스팅 + 운영 이력
const CRANK_WEIGHTS: Record<string, number> = {
  '주제 전문성': 0.30,   // 주제 집중도·전문 용어·시리즈 연속성
  '활동 신뢰도': 0.25,   // 운영 기간·꾸준한 포스팅·규칙성
  '콘텐츠 품질': 0.20,   // 콘텐츠 깊이·경험 정보·구조
  '검색 노출력': 0.13,   // 검색 순위 = 검증된 권위
  '사용자 반응': 0.12,   // 댓글·공감 = 블로그 인지도
}

// 레거시 카테고리 이름 매핑 (v10 → v11)
const LEGACY_NAME_MAP: Record<string, string> = {
  '방문자 활동': '사용자 반응',
  'SEO 최적화': '검색 노출력',
  '신뢰도': '활동 신뢰도',
}

function assignGrade(score: number): string {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'B+'
  if (score >= 50) return 'B'
  if (score >= 40) return 'C'
  if (score >= 30) return 'D'
  return 'F'
}

function getDiaSummary(score: number): string {
  if (score >= 80) return '검색 의도 부합도가 높아 상위 노출에 유리합니다'
  if (score >= 60) return '콘텐츠 품질은 양호하나 사용자 반응을 더 높이세요'
  if (score >= 40) return '콘텐츠 깊이와 사용자 참여를 함께 개선하세요'
  return '검색 의도에 부합하는 양질의 콘텐츠가 필요합니다'
}

function getCrankSummary(score: number): string {
  if (score >= 80) return '주제 전문성과 블로그 신뢰도가 매우 높습니다'
  if (score >= 60) return '전문성은 양호하나 포스팅 일관성을 강화하세요'
  if (score >= 40) return '주제 집중도를 높이고 꾸준히 포스팅하세요'
  return '하나의 주제에 집중하여 꾸준히 포스팅하는 것이 핵심입니다'
}

function calculateScore(
  categories: AnalysisCategory[],
  weights: Record<string, number>,
  label: string,
  summaryFn: (score: number) => string,
): NaverAlgorithmScore {
  const factors: NaverScoreFactor[] = []
  let totalWeightedScore = 0

  for (const cat of categories) {
    // v11: 레거시 이름 호환
    const mappedName = LEGACY_NAME_MAP[cat.name] ?? cat.name
    const weight = weights[cat.name] ?? weights[mappedName] ?? 0
    if (weight <= 0) continue

    // 각 축은 maxScore 기준 → 0~100 스케일로 변환 후 가중치 적용
    const normalized = (cat.score / cat.maxScore) * 100
    const contribution = normalized * weight

    totalWeightedScore += contribution

    factors.push({
      name: cat.name,
      weight,
      score: cat.score,
      contribution,
    })
  }

  const finalScore = totalWeightedScore

  // v11: 5축 고정 순서
  const CATEGORY_ORDER = ['주제 전문성', '콘텐츠 품질', '활동 신뢰도', '사용자 반응', '검색 노출력']
  const sortedFactors = factors.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.name)
    const bi = CATEGORY_ORDER.indexOf(b.name)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  return {
    score: Math.min(100, Math.max(0, finalScore)),
    grade: assignGrade(finalScore),
    label,
    summary: summaryFn(finalScore),
    factors: sortedFactors,
  }
}

/** D.I.A. 추정 점수 계산 */
export function calculateDiaScore(categories: AnalysisCategory[]): NaverAlgorithmScore {
  return calculateScore(categories, DIA_WEIGHTS, 'D.I.A.', getDiaSummary)
}

/** C-Rank 추정 점수 계산 */
export function calculateCrankScore(categories: AnalysisCategory[]): NaverAlgorithmScore {
  return calculateScore(categories, CRANK_WEIGHTS, 'C-Rank', getCrankSummary)
}
