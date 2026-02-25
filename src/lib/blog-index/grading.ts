/**
 * 블로그 지수 - 등급 체계 및 추천 (v4 업데이트)
 *
 * 11등급 블로그 지수 체계 (변경 없음)
 * 추천 로직: 새로운 4축 이름에 맞게 업데이트
 */

import type { BlogLevelInfo, AnalysisCategory, AbusePenalty, BenchmarkData, PostDetail, BlogProfile } from './types'

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

/** 추천 생성에 필요한 컨텍스트 */
export interface RecommendationContext {
  categories: AnalysisCategory[]
  abusePenalty: AbusePenalty
  benchmark?: BenchmarkData
  level?: BlogLevelInfo
  totalScore?: number
  recentPosts?: PostDetail[]
  blogProfile?: BlogProfile
}

export function generateRecommendations(
  categories: AnalysisCategory[],
  abusePenalty: AbusePenalty,
  ctx?: Omit<RecommendationContext, 'categories' | 'abusePenalty'>
): string[] {
  const recs: string[] = []
  const bm = ctx?.benchmark
  const level = ctx?.level
  const posts = ctx?.recentPosts
  const profile = ctx?.blogProfile

  // ── 1단계: 어뷰징 페널티 (최우선) ──
  if (abusePenalty.score < -5) {
    if (abusePenalty.flags.includes('keyword_stuffing')) {
      const density = bm ? ` (현재 ${bm.keywordDensity.mine}%)` : ''
      recs.push(`키워드 과다 반복 감지${density} - 자연스러운 문맥에서 키워드를 사용하세요 (권장 0.5~3%)`)
    }
    if (abusePenalty.flags.includes('title_template')) {
      recs.push('제목이 템플릿처럼 유사합니다 - 각 포스트마다 고유하고 매력적인 제목을 작성하세요')
    }
    if (abusePenalty.flags.includes('content_duplication')) {
      recs.push('설명문에 반복 패턴이 감지되었습니다 - 각 글마다 독창적인 도입부를 작성하세요')
    }
  }

  // ── 2단계: 다음 등급 목표 + 가장 빠른 개선 카테고리 ──
  if (level?.nextTierScore != null && ctx?.totalScore != null) {
    const gap = level.nextTierScore - ctx.totalScore
    const sorted = [...categories].sort((a, b) =>
      (b.maxScore - b.score) - (a.maxScore - a.score)
    )
    const best = sorted[0]
    if (best && gap > 0) {
      const remaining = best.maxScore - best.score
      recs.push(
        `다음 등급(${level.nextTierScore}점)까지 ${gap}점 필요 → "${best.name}" 영역에서 최대 ${remaining}점 확보 가능`
      )
    }
  }

  // ── 3단계: 카테고리별 3단계 임계값 추천 ──
  for (const cat of categories) {
    const pct = cat.score / cat.maxScore

    if (pct < 0.4) {
      // [Critical] 40% 미만 - 긴급 개선
      switch (cat.name) {
        case '검색 성과':
          recs.push('검색 성과가 매우 낮습니다 - 경쟁이 낮은 롱테일 키워드부터 공략하세요')
          recs.push('제목에 검색 키워드를 자연스럽게 포함하고, 본문 첫 문단에도 키워드를 배치하세요')
          break
        case '방문자 & 인기도':
          recs.push('방문자와 인기도가 매우 낮습니다 - 검색 유입 키워드를 최적화하고, 글 마무리에 댓글/공감 유도 문구를 넣으세요')
          recs.push('이웃 블로그 소통과 댓글 달기로 방문자 유입을 늘리세요')
          break
        case '콘텐츠 경쟁력':
          recs.push('콘텐츠 경쟁력이 부족합니다 - 글 길이를 1,500~2,000자로 늘리고 소제목으로 구조화하세요')
          if (bm && bm.avgImageCount.mine < 1) {
            recs.push(`이미지가 거의 없습니다 (평균 ${bm.avgImageCount.mine}개) → 포스트당 3~5장 삽입하세요`)
          }
          break
        case '활동 & 신뢰도':
          if (bm && bm.postingFrequency.mine < 1) {
            recs.push(`현재 주 ${bm.postingFrequency.mine}회 포스팅 중입니다 - 최소 주 3회로 늘리세요`)
          } else {
            recs.push('최소 주 3회 이상 꾸준히 포스팅하세요')
          }
          if (profile?.blogAgeDays != null && profile.blogAgeDays < 180) {
            recs.push('블로그 운영 기간이 짧습니다 - 6개월 이상 꾸준히 운영하면 신뢰도가 크게 올라갑니다')
          }
          break
      }
    } else if (pct < 0.6) {
      // [Important] 40~60% - 보강 필요
      switch (cat.name) {
        case '검색 성과':
          recs.push('검색 성과를 높이려면 월간 검색량 100~500 사이의 니치 키워드를 공략해보세요')
          break
        case '방문자 & 인기도':
          recs.push('댓글과 공감을 늘리기 위해 글 마무리에 질문형 문구를 사용하세요')
          if (bm?.dailyVisitors && bm.dailyVisitors.mine < bm.dailyVisitors.recommended) {
            recs.push(`일평균 방문자 ${bm.dailyVisitors.mine}명 → ${bm.dailyVisitors.recommended}명 달성을 목표로 키워드를 최적화하세요`)
          }
          break
        case '콘텐츠 경쟁력':
          if (bm && bm.imageRate.mine < bm.imageRate.recommended) {
            recs.push(`이미지 포함률 ${bm.imageRate.mine}% → ${bm.imageRate.recommended}% 달성 시 품질 점수가 크게 올라갑니다`)
          }
          if (bm && bm.topicFocus.mine < bm.topicFocus.recommended) {
            recs.push(`주제 집중도 ${bm.topicFocus.mine}% → ${bm.topicFocus.recommended}% 이상으로 올리면 C-Rank 효과가 높아집니다`)
          }
          break
        case '활동 & 신뢰도':
          if (bm && bm.postingFrequency.mine < bm.postingFrequency.recommended) {
            recs.push(`포스팅 빈도 주 ${bm.postingFrequency.mine}회 → ${bm.postingFrequency.recommended}회로 늘리면 활동성 점수가 올라갑니다`)
          }
          break
      }
    } else if (pct < 0.8) {
      // [Optimization] 60~80% - 최적화 여지
      switch (cat.name) {
        case '검색 성과':
          recs.push('중경쟁 키워드에도 도전해보세요 - 상위 노출 블로그의 제목/구조를 분석한 뒤 차별화하세요')
          break
        case '방문자 & 인기도':
          recs.push('방문자 유입을 더 늘리려면 검색 트렌드에 맞는 시의성 있는 콘텐츠를 발행하세요')
          break
        case '콘텐츠 경쟁력':
          if (bm && bm.avgImageCount.mine < bm.avgImageCount.recommended) {
            recs.push(`이미지 수 평균 ${bm.avgImageCount.mine}개 → ${bm.avgImageCount.recommended}개로 늘리면 D.I.A. 점수에 유리합니다`)
          }
          recs.push('연관 키워드를 활용한 시리즈 포스팅으로 주제 깊이를 강화해보세요')
          break
        case '활동 & 신뢰도':
          if (profile && !profile.isActive) {
            recs.push('최근 30일간 포스팅이 없습니다 - 꾸준한 활동 재개가 검색 노출에 핵심입니다')
          }
          break
      }
    }
  }

  // ── 4단계: 벤치마크 기반 구체적 수치 추천 ──
  if (bm && recs.length < 5) {
    if (bm.avgTitleLength.mine > 0 && Math.abs(bm.avgTitleLength.mine - bm.avgTitleLength.optimal) > 8) {
      if (bm.avgTitleLength.mine < bm.avgTitleLength.optimal - 5) {
        recs.push(`제목이 짧습니다 (평균 ${bm.avgTitleLength.mine}자) → ${bm.avgTitleLength.optimal}자 내외로 키워드와 매력적인 표현을 담으세요`)
      } else if (bm.avgTitleLength.mine > 35) {
        recs.push(`제목이 깁니다 (평균 ${bm.avgTitleLength.mine}자) → 25~30자로 줄여 검색 결과에서 잘리지 않게 하세요`)
      }
    }

    if (bm.keywordDensity.mine > 0) {
      if (bm.keywordDensity.mine > bm.keywordDensity.optimal[1]) {
        recs.push(`키워드 밀도 ${bm.keywordDensity.mine}%로 높습니다 → ${bm.keywordDensity.optimal[0]}~${bm.keywordDensity.optimal[1]}% 범위로 조절하세요`)
      } else if (bm.keywordDensity.mine < bm.keywordDensity.optimal[0]) {
        recs.push(`키워드 밀도 ${bm.keywordDensity.mine}%로 낮습니다 → 본문에 키워드를 자연스럽게 더 배치하세요`)
      }
    }
  }

  // ── 5단계: 포스트별 빠른 개선 기회 ──
  if (posts && posts.length > 0 && recs.length < 6) {
    const lowQualityPosts = posts.filter(p => p.quality.tier <= 3)
    const improvablePosts = posts.filter(p => p.quality.tier >= 4 && p.quality.tier <= 6)

    if (lowQualityPosts.length >= 3) {
      recs.push(`최근 포스트 중 ${lowQualityPosts.length}개가 저품질입니다 - 이미지 추가 + 본문 보강으로 빠르게 개선할 수 있습니다`)
    } else if (improvablePosts.length >= 2) {
      recs.push(`"일반" 등급 포스트 ${improvablePosts.length}개를 소제목 구조화 + 이미지 추가로 "준최적화"로 업그레이드하세요`)
    }

    const noImagePosts = posts.filter(p => !p.hasImage)
    if (noImagePosts.length > 0 && noImagePosts.length <= 5) {
      recs.push(`이미지 없는 포스트 ${noImagePosts.length}개에 관련 이미지를 추가하면 즉시 품질 점수가 올라갑니다`)
    }
  }

  // ── 6단계: 추천이 없거나 부족하면 등급별 맞춤 가이드 ──
  if (recs.length < 2) {
    const tier = level?.tier || 0
    if (tier >= 9) {
      recs.push('현재 높은 수준을 유지하고 있습니다 - 경쟁 키워드 분석으로 새로운 상위 노출 기회를 발굴하세요')
      recs.push('기존 인기 글을 주기적으로 업데이트하면 검색 노출이 장기적으로 유지됩니다')
    } else if (tier >= 6) {
      recs.push('콘텐츠에 직접 경험, 비교 정보, 구체적 수치를 추가하면 D.I.A. 품질 점수가 올라갑니다')
      recs.push('같은 주제로 시리즈 포스팅을 작성하면 C-Rank 전문성이 빠르게 쌓입니다')
    } else {
      recs.push('현재 전략을 유지하면서 경쟁이 높은 키워드도 공략해보세요')
      recs.push('콘텐츠의 최신성을 유지하고, 기존 글도 주기적으로 업데이트하세요')
    }
  }

  // 중복 제거 후 최대 8개 반환
  return Array.from(new Set(recs)).slice(0, 8)
}
