/**
 * 블로그 지수 - 등급 체계 및 추천 (v6 업데이트)
 *
 * 16등급 블로그 지수 체계 (일반 / 준최적화 / 최적화 / 최적화+ / 파워)
 * "저품질" 카테고리 폐지 → 긍정적 등급 체계
 */

import type { BlogLevelInfo, AnalysisCategory, AbusePenalty, BenchmarkData, PostDetail, BlogProfile } from './types'

export function determineLevelInfo(totalScore: number): BlogLevelInfo {
  if (totalScore >= 95) return {
    tier: 16, category: '파워', label: 'Lv.16 파워', shortLabel: '파워',
    description: '최상위 검색 노출력을 가진 파워 블로그입니다. 현재 전략을 유지하세요.',
    color: 'amber', badgeColor: 'bg-amber-100 text-amber-700 border-amber-300', nextTierScore: null,
  }
  if (totalScore >= 89) return {
    tier: 15, category: '최적화+', label: 'Lv.15 최적화4+', shortLabel: '최적화4+',
    description: '파워 블로그 직전 단계입니다. 꾸준함이 마지막 열쇠입니다.',
    color: 'emerald', badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300', nextTierScore: 95,
  }
  if (totalScore >= 82) return {
    tier: 14, category: '최적화+', label: 'Lv.14 최적화3+', shortLabel: '최적화3+',
    description: '매우 높은 검색 노출력을 갖추고 있습니다. 파워까지 한 걸음 남았습니다.',
    color: 'emerald', badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300', nextTierScore: 89,
  }
  if (totalScore >= 76) return {
    tier: 13, category: '최적화+', label: 'Lv.13 최적화2+', shortLabel: '최적화2+',
    description: '경쟁 키워드에서도 안정적으로 상위 노출됩니다. 전문성을 더 강화하세요.',
    color: 'teal', badgeColor: 'bg-teal-100 text-teal-700 border-teal-300', nextTierScore: 82,
  }
  if (totalScore >= 70) return {
    tier: 12, category: '최적화+', label: 'Lv.12 최적화1+', shortLabel: '최적화1+',
    description: '검색 노출이 매우 우수합니다. 고급 키워드 전략으로 더 높은 등급에 도전하세요.',
    color: 'teal', badgeColor: 'bg-teal-100 text-teal-700 border-teal-300', nextTierScore: 76,
  }
  if (totalScore >= 64) return {
    tier: 11, category: '최적화', label: 'Lv.11 최적화3', shortLabel: '최적화3',
    description: '안정적인 검색 노출력을 보유하고 있습니다. 최적화+ 등급을 향해 도전하세요.',
    color: 'green', badgeColor: 'bg-green-100 text-green-700 border-green-300', nextTierScore: 70,
  }
  if (totalScore >= 57) return {
    tier: 10, category: '최적화', label: 'Lv.10 최적화2', shortLabel: '최적화2',
    description: '안정적인 검색 노출력을 보유하고 있습니다. 콘텐츠 깊이를 더 높여보세요.',
    color: 'green', badgeColor: 'bg-green-100 text-green-700 border-green-300', nextTierScore: 64,
  }
  if (totalScore >= 51) return {
    tier: 9, category: '최적화', label: 'Lv.9 최적화1', shortLabel: '최적화1',
    description: '안정적인 검색 노출력을 보유하고 있습니다. 경쟁 키워드도 도전해보세요.',
    color: 'lime', badgeColor: 'bg-lime-100 text-lime-700 border-lime-300', nextTierScore: 57,
  }
  if (totalScore >= 45) return {
    tier: 8, category: '준최적화', label: 'Lv.8 준최적화7', shortLabel: '준최적화7',
    description: '검색 노출이 시작되는 단계입니다. 콘텐츠 품질을 더 높여보세요.',
    color: 'blue', badgeColor: 'bg-blue-100 text-blue-700 border-blue-300', nextTierScore: 51,
  }
  if (totalScore >= 38) return {
    tier: 7, category: '준최적화', label: 'Lv.7 준최적화6', shortLabel: '준최적화6',
    description: '검색 노출이 시작되는 단계입니다. 주제 전문성을 강화하세요.',
    color: 'blue', badgeColor: 'bg-blue-100 text-blue-700 border-blue-300', nextTierScore: 45,
  }
  if (totalScore >= 32) return {
    tier: 6, category: '준최적화', label: 'Lv.6 준최적화5', shortLabel: '준최적화5',
    description: '검색 노출이 시작되는 단계입니다. 활동성을 강화하세요.',
    color: 'sky', badgeColor: 'bg-sky-100 text-sky-700 border-sky-300', nextTierScore: 38,
  }
  if (totalScore >= 26) return {
    tier: 5, category: '준최적화', label: 'Lv.5 준최적화4', shortLabel: '준최적화4',
    description: '검색 노출이 시작되는 단계입니다. 키워드 전략을 세워보세요.',
    color: 'sky', badgeColor: 'bg-sky-100 text-sky-700 border-sky-300', nextTierScore: 32,
  }
  if (totalScore >= 20) return {
    tier: 4, category: '준최적화', label: 'Lv.4 준최적화3', shortLabel: '준최적화3',
    description: 'SEO 기본기가 갖춰지고 있습니다. 꾸준한 포스팅이 중요합니다.',
    color: 'indigo', badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-300', nextTierScore: 26,
  }
  if (totalScore >= 13) return {
    tier: 3, category: '준최적화', label: 'Lv.3 준최적화2', shortLabel: '준최적화2',
    description: '기본적인 활동은 하고 있습니다. SEO 최적화를 시작해보세요.',
    color: 'indigo', badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-300', nextTierScore: 20,
  }
  if (totalScore >= 7) return {
    tier: 2, category: '준최적화', label: 'Lv.2 준최적화1', shortLabel: '준최적화1',
    description: '블로그를 시작한 초기 단계입니다. 주 3회 이상 양질의 글을 발행하세요.',
    color: 'violet', badgeColor: 'bg-violet-100 text-violet-700 border-violet-300', nextTierScore: 13,
  }
  return {
    tier: 1, category: '일반', label: 'Lv.1 일반', shortLabel: '일반',
    description: '블로그를 시작한 초기 단계입니다. 꾸준한 포스팅이 핵심입니다.',
    color: 'slate', badgeColor: 'bg-slate-100 text-slate-700 border-slate-300', nextTierScore: 7,
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
  searchBonus?: { score: number; maxScore: number; grade: string; details: string[] }
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

  // ── 1단계: 감점 항목 기반 추천 (각 축 items에서 감점 추출) ──
  for (const cat of categories) {
    const negativeItems = (cat.items ?? []).filter(item => item.points < 0)
    for (const item of negativeItems) {
      const label = item.label.toLowerCase()
      if (label.includes('제목 유사도') || label.includes('템플릿')) {
        recs.push('제목이 유사합니다 - 각 포스트마다 고유하고 매력적인 제목을 작성하세요')
      } else if (label.includes('콘텐츠 중복') || label.includes('반복')) {
        recs.push('콘텐츠 중복이 감지되었습니다 - 각 글마다 독창적인 내용을 작성하세요')
      } else if (label.includes('스팸')) {
        recs.push('스팸성 키워드가 감지되었습니다 - 저품질 키워드 사용을 피하세요')
      } else if (label.includes('외부 링크') || label.includes('단축 URL')) {
        recs.push('외부 링크가 과다합니다 - 불필요한 외부 링크와 단축 URL을 줄이세요')
      } else if (label.includes('특수문자')) {
        recs.push('제목 특수문자/이모지를 줄이세요 - 깔끔한 제목이 검색 노출에 유리합니다')
      } else if (label.includes('짧은 글')) {
        recs.push('짧은 글이 많습니다 - 최소 1,000자 이상의 충실한 콘텐츠를 작성하세요')
      }
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

  // ── 3단계: 카테고리별 3단계 임계값 추천 (v9: 4축 기반) ──
  for (const cat of categories) {
    const pct = cat.score / cat.maxScore

    if (pct < 0.4) {
      // [Critical] 40% 미만 - 긴급 개선
      switch (cat.name) {
        case '방문자 활동':
          recs.push('방문자와 참여도가 매우 낮습니다 - 검색 유입 키워드를 최적화하고, 글 마무리에 댓글/공감 유도 문구를 넣으세요')
          recs.push('이웃 블로그 소통과 댓글 달기로 방문자 유입을 늘리세요')
          break
        case '콘텐츠 품질':
          recs.push('콘텐츠 품질이 부족합니다 - 글 길이를 1,500~2,000자로 늘리고 소제목으로 구조화하세요')
          if (bm && bm.avgImageCount.mine < 1) {
            recs.push(`이미지가 거의 없습니다 (평균 ${bm.avgImageCount.mine}개) → 포스트당 3~5장 삽입하세요`)
          }
          if (bm && bm.topicFocus.mine < bm.topicFocus.recommended) {
            recs.push(`주제 집중도 ${bm.topicFocus.mine}% → ${bm.topicFocus.recommended}% 이상으로 올리면 C-Rank 효과가 높아집니다`)
          }
          break
        case 'SEO 최적화':
          recs.push('검색 노출이 매우 낮습니다 - 경쟁이 낮은 롱테일 키워드부터 공략하고, 제목에 핵심 키워드를 배치하세요')
          recs.push('제목 20~35자에 핵심 키워드를 자연스럽게 포함하면 검색 노출에 유리합니다')
          break
        case '신뢰도':
          if (bm && bm.postingFrequency.mine < 1) {
            recs.push(`현재 주 ${bm.postingFrequency.mine}회 포스팅 중입니다 - 최소 주 3회로 늘리세요`)
          } else {
            recs.push('최소 주 3회 이상 꾸준히 포스팅하세요')
          }
          recs.push('양질의 글을 꾸준히 축적하여 누적 포스팅 수를 늘리세요')
          break
      }
    } else if (pct < 0.6) {
      // [Important] 40~60% - 보강 필요
      switch (cat.name) {
        case '방문자 활동':
          recs.push('댓글과 공감을 늘리기 위해 글 마무리에 질문형 문구를 사용하세요')
          if (bm?.dailyVisitors && bm.dailyVisitors.mine < bm.dailyVisitors.recommended) {
            recs.push(`일평균 방문자 ${bm.dailyVisitors.mine}명 → ${bm.dailyVisitors.recommended}명 달성을 목표로 키워드를 최적화하세요`)
          }
          break
        case '콘텐츠 품질':
          if (bm && bm.imageRate.mine < bm.imageRate.recommended) {
            recs.push(`이미지 포함률 ${bm.imageRate.mine}% → ${bm.imageRate.recommended}% 달성 시 품질 점수가 크게 올라갑니다`)
          }
          if (bm && bm.topicFocus.mine < bm.topicFocus.recommended) {
            recs.push(`주제 집중도 ${bm.topicFocus.mine}% → ${bm.topicFocus.recommended}% 이상으로 올리면 C-Rank 효과가 높아집니다`)
          }
          break
        case 'SEO 최적화':
          recs.push('검색 노출률을 높이려면 제목에 핵심 키워드를 포함하고, 제목 길이를 20~35자로 최적화하세요')
          break
        case '신뢰도':
          if (bm && bm.postingFrequency.mine < bm.postingFrequency.recommended) {
            recs.push(`포스팅 빈도 주 ${bm.postingFrequency.mine}회 → ${bm.postingFrequency.recommended}회로 늘리면 신뢰도 점수가 올라갑니다`)
          }
          recs.push('규칙적인 포스팅 주기를 유지하면 블로그 신뢰도가 크게 향상됩니다')
          break
      }
    } else if (pct < 0.8) {
      // [Optimization] 60~80% - 최적화 여지
      switch (cat.name) {
        case '방문자 활동':
          recs.push('방문자 유입을 더 늘리려면 검색 트렌드에 맞는 시의성 있는 콘텐츠를 발행하세요')
          break
        case '콘텐츠 품질':
          if (bm && bm.avgImageCount.mine < bm.avgImageCount.recommended) {
            recs.push(`이미지 수 평균 ${bm.avgImageCount.mine}개 → ${bm.avgImageCount.recommended}개로 늘리면 D.I.A. 점수에 유리합니다`)
          }
          recs.push('연관 키워드를 활용한 시리즈 포스팅으로 콘텐츠 깊이를 강화해보세요')
          break
        case 'SEO 최적화':
          recs.push('경쟁이 높은 키워드에서도 TOP10에 진입하려면 키워드 밀도와 콘텐츠 깊이를 함께 높이세요')
          break
        case '신뢰도':
          if (profile && !profile.isActive) {
            recs.push('최근 30일간 포스팅이 없습니다 - 꾸준한 활동 재개가 검색 노출에 핵심입니다')
          }
          recs.push('기존 인기 글을 주기적으로 업데이트하면 검색 노출이 장기적으로 유지됩니다')
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
    const lowQualityPosts = posts.filter(p => p.quality.tier <= 1)
    const improvablePosts = posts.filter(p => p.quality.tier === 2)

    if (lowQualityPosts.length >= 3) {
      recs.push(`최근 포스트 중 ${lowQualityPosts.length}개가 일반 등급입니다 - 이미지 추가 + 본문 보강으로 빠르게 개선할 수 있습니다`)
    } else if (improvablePosts.length >= 2) {
      recs.push(`"준최적화1" 등급 포스트 ${improvablePosts.length}개를 소제목 구조화 + 이미지 추가로 업그레이드하세요`)
    }

    const noImagePosts = posts.filter(p => !p.hasImage)
    if (noImagePosts.length > 0 && noImagePosts.length <= 5) {
      recs.push(`이미지 없는 포스트 ${noImagePosts.length}개에 관련 이미지를 추가하면 즉시 품질 점수가 올라갑니다`)
    }
  }

  // ── 6단계: 추천이 없거나 부족하면 등급별 맞춤 가이드 ──
  if (recs.length < 2) {
    const tier = level?.tier || 0
    if (tier >= 12) {
      recs.push('현재 높은 수준을 유지하고 있습니다 - 경쟁 키워드 분석으로 새로운 상위 노출 기회를 발굴하세요')
      recs.push('기존 인기 글을 주기적으로 업데이트하면 검색 노출이 장기적으로 유지됩니다')
    } else if (tier >= 9) {
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
