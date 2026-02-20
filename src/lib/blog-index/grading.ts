/**
 * 블로그 지수 - 등급 체계 및 추천
 *
 * 11등급 블로그 지수 체계 (v3)
 *
 * 어뷰징 페널티로 인해 총점이 음수가 될 수 있으므로 0 하한 처리
 *
 * [저품질] 0~24점
 *   Lv.1  저품질 1 (0~12)
 *   Lv.2  저품질 2 (13~24)
 * [일반] 25~47점
 *   Lv.3  일반 1 (25~31)
 *   Lv.4  일반 2 (32~39)
 *   Lv.5  일반 3 (40~47)
 * [준최적화] 48~69점
 *   Lv.6  준최적화 1 (48~54)
 *   Lv.7  준최적화 2 (55~62)
 *   Lv.8  준최적화 3 (63~69)
 * [최적화] 70~89점
 *   Lv.9  최적화 1 (70~79)
 *   Lv.10 최적화 2 (80~89)
 * [파워] 90~100점
 *   Lv.11 파워 (90~100)
 */

import type { BlogLevelInfo, AnalysisCategory, AbusePenalty } from './types'

export function determineLevelInfo(totalScore: number): BlogLevelInfo {
  if (totalScore >= 90) return {
    tier: 11, category: '파워', label: 'Lv.11 파워', shortLabel: '파워',
    description: '최상위 검색 노출력을 가진 파워 블로그입니다. 현재 전략을 유지하세요.',
    color: 'emerald', badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300', nextTierScore: null,
  }
  if (totalScore >= 80) return {
    tier: 10, category: '최적화', label: 'Lv.10 최적화 2', shortLabel: '최적화2',
    description: '네이버 검색에 최적화된 블로그입니다. 파워블로그까지 거의 다 왔습니다.',
    color: 'green', badgeColor: 'bg-green-100 text-green-700 border-green-300', nextTierScore: 90,
  }
  if (totalScore >= 70) return {
    tier: 9, category: '최적화', label: 'Lv.9 최적화 1', shortLabel: '최적화1',
    description: '안정적인 검색 노출력을 보유하고 있습니다. 경쟁 키워드도 도전해보세요.',
    color: 'green', badgeColor: 'bg-green-100 text-green-700 border-green-300', nextTierScore: 80,
  }
  if (totalScore >= 63) return {
    tier: 8, category: '준최적화', label: 'Lv.8 준최적화 3', shortLabel: '준최적화3',
    description: '키워드에 따라 상위 노출이 가능합니다. 콘텐츠 품질을 더 높여보세요.',
    color: 'teal', badgeColor: 'bg-teal-100 text-teal-700 border-teal-300', nextTierScore: 70,
  }
  if (totalScore >= 55) return {
    tier: 7, category: '준최적화', label: 'Lv.7 준최적화 2', shortLabel: '준최적화2',
    description: '검색 노출이 본격화되는 단계입니다. 주제 전문성을 강화하세요.',
    color: 'blue', badgeColor: 'bg-blue-100 text-blue-700 border-blue-300', nextTierScore: 63,
  }
  if (totalScore >= 48) return {
    tier: 6, category: '준최적화', label: 'Lv.6 준최적화 1', shortLabel: '준최적화1',
    description: '검색 노출이 시작되는 단계입니다. 활동성을 강화하세요.',
    color: 'blue', badgeColor: 'bg-blue-100 text-blue-700 border-blue-300', nextTierScore: 55,
  }
  if (totalScore >= 40) return {
    tier: 5, category: '일반', label: 'Lv.5 일반 3', shortLabel: '일반3',
    description: 'SEO 기본기가 갖춰지고 있습니다. 키워드 전략을 세워보세요.',
    color: 'yellow', badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-300', nextTierScore: 48,
  }
  if (totalScore >= 32) return {
    tier: 4, category: '일반', label: 'Lv.4 일반 2', shortLabel: '일반2',
    description: '기본적인 활동은 하고 있으나 SEO 최적화가 부족합니다.',
    color: 'amber', badgeColor: 'bg-amber-100 text-amber-700 border-amber-300', nextTierScore: 40,
  }
  if (totalScore >= 25) return {
    tier: 3, category: '일반', label: 'Lv.3 일반 1', shortLabel: '일반1',
    description: '블로그를 시작한 단계입니다. 꾸준한 포스팅이 가장 중요합니다.',
    color: 'amber', badgeColor: 'bg-amber-100 text-amber-700 border-amber-300', nextTierScore: 32,
  }
  if (totalScore >= 13) return {
    tier: 2, category: '저품질', label: 'Lv.2 저품질 2', shortLabel: '저품질2',
    description: '블로그 활동이 매우 부족합니다. 주 3회 이상 양질의 글을 발행하세요.',
    color: 'rose', badgeColor: 'bg-rose-100 text-rose-700 border-rose-300', nextTierScore: 25,
  }
  return {
    tier: 1, category: '저품질', label: 'Lv.1 저품질 1', shortLabel: '저품질1',
    description: '저품질 블로그로 분류될 위험이 높습니다. 콘텐츠 품질부터 개선하세요.',
    color: 'red', badgeColor: 'bg-red-100 text-red-700 border-red-300', nextTierScore: 13,
  }
}

export function generateRecommendations(categories: AnalysisCategory[], abusePenalty: AbusePenalty): string[] {
  const recommendations: string[] = []

  // 어뷰징 페널티가 있으면 최우선 추천
  if (abusePenalty.score < -5) {
    if (abusePenalty.flags.includes('keyword_stuffing')) {
      recommendations.push('키워드 과다 반복이 감지되었습니다 - 자연스러운 문맥에서 키워드를 사용하세요 (권장 밀도: 0.5~3%)')
    }
    if (abusePenalty.flags.includes('title_template')) {
      recommendations.push('제목이 템플릿처럼 유사합니다 - 각 포스트마다 고유하고 매력적인 제목을 작성하세요')
    }
    if (abusePenalty.flags.includes('content_duplication')) {
      recommendations.push('설명문에 반복 패턴이 감지되었습니다 - 각 글마다 독창적인 도입부를 작성하세요')
    }
  }

  // 약한 영역에 대한 추천 (점수 비율 40% 미만)
  for (const cat of categories) {
    const pct = cat.score / cat.maxScore
    if (pct < 0.4) {
      switch (cat.name) {
        case '검색 파워':
          recommendations.push('경쟁이 낮은 롱테일 키워드부터 공략하여 상위 노출 경험을 쌓으세요')
          recommendations.push('제목에 검색 키워드를 자연스럽게 포함하세요')
          break
        case '콘텐츠 품질':
          recommendations.push('글 길이를 1,500~2,000자로 늘리고, 소제목(H2, H3)으로 구조화하세요')
          recommendations.push('직접 촬영한 이미지를 포스트당 3~5장 삽입하고, 텍스트와 교차 배치하세요')
          break
        case '주제 전문성':
          recommendations.push('하나의 주제 카테고리에 집중하여 C-Rank를 높이세요')
          recommendations.push('핵심 키워드와 연관 키워드를 함께 사용하여 문맥적 전문성을 보여주세요')
          break
        case '활동성':
          recommendations.push('최소 주 3회 이상 꾸준히 포스팅하세요')
          recommendations.push('매일 같은 시간대에 발행하면 규칙성 점수가 올라갑니다')
          break
      }
    }
  }

  // 추천이 없으면 일반 가이드
  if (recommendations.length === 0) {
    recommendations.push('현재 전략을 유지하면서 경쟁이 높은 키워드도 공략해보세요')
    recommendations.push('콘텐츠의 최신성을 유지하고, 기존 글도 주기적으로 업데이트하세요')
  }

  return recommendations.slice(0, 6) // 최대 6개
}
