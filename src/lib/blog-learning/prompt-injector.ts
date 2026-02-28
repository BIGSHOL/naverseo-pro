/**
 * Blog Content Learning - 프롬프트 주입 모듈
 *
 * keyword_patterns에서 학습된 패턴을 조회하여
 * AI 콘텐츠 생성 프롬프트에 주입할 텍스트를 생성
 */

import type { ContentType, DomainCategory } from '@/lib/content/engine'
import type { AggregatedPattern, PromptPatternData } from './types'

const TONE_LABELS: Record<string, string> = {
  casual: '친근/해요체',
  formal: '격식/합니다체',
  review: '경험/후기형',
  informational: '정보/데이터형',
}

/**
 * 키워드/카테고리 패턴 조회 → 프롬프트 주입 텍스트 생성
 *
 * 조회 우선순위:
 * 1. 정확한 키워드 매치 (sample_count >= 3)
 * 2. 카테고리 전체 매치 (keyword=NULL, sample_count >= 5)
 * 3. 데이터 없으면 null
 */
export async function getPatternPromptSection(
  keyword: string,
  category: ContentType,
  domain: DomainCategory | null = null
): Promise<PromptPatternData | null> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    // 1차: 정확한 키워드 매치
    const { data: exactMatch } = await supabase
      .from('keyword_patterns')
      .select('*')
      .eq('keyword', keyword)
      .eq('keyword_category', category)
      .single()

    if (exactMatch && (exactMatch.sample_count as number) >= 3) {
      return {
        text: formatPatternText(exactMatch as AggregatedPattern, keyword),
        sampleCount: exactMatch.sample_count as number,
        matchType: 'exact_keyword',
      }
    }

    // 2차: 카테고리 전체 매치
    const { data: categoryMatch } = await supabase
      .from('keyword_patterns')
      .select('*')
      .is('keyword', null)
      .eq('keyword_category', category)
      .single()

    if (categoryMatch && (categoryMatch.sample_count as number) >= 5) {
      return {
        text: formatPatternText(categoryMatch as AggregatedPattern, null),
        sampleCount: categoryMatch.sample_count as number,
        matchType: 'category',
      }
    }

    // 3차: 도메인 매치 (domain_category 기준)
    if (domain) {
      const { data: domainMatch } = await supabase
        .from('keyword_patterns')
        .select('*')
        .is('keyword', null)
        .eq('domain_category', domain)
        .single()

      if (domainMatch && (domainMatch.sample_count as number) >= 5) {
        return {
          text: formatPatternText(domainMatch as AggregatedPattern, null),
          sampleCount: domainMatch.sample_count as number,
          matchType: 'domain',
        }
      }
    }

    return null
  } catch {
    // DB 조회 실패 시 null 반환 (프롬프트 주입 없이 진행)
    return null
  }
}

/**
 * 집계 패턴 → AI 프롬프트용 텍스트 포맷
 */
function formatPatternText(
  pattern: AggregatedPattern,
  keyword: string | null
): string {
  const scope = keyword
    ? `"${keyword}" 키워드, ${pattern.sample_count}개 포스트 기반`
    : `${getCategoryLabel(pattern.keyword_category)} 콘텐츠, ${pattern.sample_count}개 포스트 기반`

  let text = `## 상위 노출 포스트 패턴 분석 (${scope})\n\n`

  // 최적 콘텐츠 구조
  text += '### 최적 콘텐츠 구조\n'

  const charRange = pattern.optimal_char_range || { min: 0, max: 0 }
  const imageRange = pattern.optimal_image_range || { min: 0, max: 0 }
  const headingRange = pattern.optimal_heading_range || { min: 0, max: 0 }

  if (charRange.min > 0 && charRange.max > 0) {
    text += `- 권장 글자 수: ${formatNum(charRange.min)}~${formatNum(charRange.max)}자 (평균 ${formatNum(pattern.avg_char_count)}자)\n`
  } else if (pattern.avg_char_count > 0) {
    text += `- 평균 글자 수: ${formatNum(pattern.avg_char_count)}자\n`
  }

  if (imageRange.min > 0 && imageRange.max > 0) {
    text += `- 권장 이미지 수: ${imageRange.min}~${imageRange.max}개 (평균 ${Math.round(pattern.avg_image_count)}개)\n`
  } else if (pattern.avg_image_count > 0) {
    text += `- 평균 이미지 수: ${Math.round(pattern.avg_image_count)}개\n`
  }

  if (headingRange.min > 0 && headingRange.max > 0) {
    text += `- 권장 소제목 수: ${headingRange.min}~${headingRange.max}개 (평균 ${Math.round(pattern.avg_heading_count)}개)\n`
  }

  if (pattern.avg_internal_links > 0) {
    text += `- 내부 링크: 평균 ${Math.round(pattern.avg_internal_links * 10) / 10}개\n`
  }

  // 성공 패턴 (quality_score >= 9인 상위 포스트)
  const sp = pattern.success_patterns || {}
  const spCount = sp.sample_count || 0
  if (spCount >= 2) {
    text += '\n### 성공 포스트 공통점 (상위 20%)\n'

    if (sp.avg_char_count && pattern.avg_char_count > 0) {
      const diff = Math.round(((sp.avg_char_count - pattern.avg_char_count) / pattern.avg_char_count) * 100)
      text += `- 글자 수: 평균 ${formatNum(sp.avg_char_count)}자`
      if (diff > 0) text += ` (+${diff}%)`
      text += '\n'
    }

    if (sp.avg_image_count && pattern.avg_image_count > 0) {
      const diff = Math.round(((sp.avg_image_count - pattern.avg_image_count) / pattern.avg_image_count) * 100)
      text += `- 이미지 수: 평균 ${Math.round(sp.avg_image_count)}개`
      if (diff > 0) text += ` (+${diff}%)`
      text += '\n'
    }

    if (sp.keyword_in_title_rate != null) {
      text += `- 제목에 키워드 포함률: ${Math.round(sp.keyword_in_title_rate * 100)}%\n`
    }

    if (sp.list_format_rate != null && sp.list_format_rate > 0.3) {
      text += `- 목록/표 형식 사용률: ${Math.round(sp.list_format_rate * 100)}%\n`
    }
  }

  // 톤 분포
  const tones = pattern.tone_distribution || {}
  const toneEntries = Object.entries(tones).sort(([, a], [, b]) => (b as number) - (a as number))
  if (toneEntries.length > 0) {
    text += '\n### 톤 분포\n'
    for (const [tone, ratio] of toneEntries) {
      const label = TONE_LABELS[tone] || tone
      text += `- ${Math.round((ratio as number) * 100)}% ${label}\n`
    }
  }

  // 자주 사용되는 태그
  const tags = pattern.top_tags as Array<{ tag: string; count: number }> | null
  if (tags && tags.length > 0) {
    const tagList = tags.slice(0, 10).map(t => `#${t.tag}`).join(' ')
    text += `\n### 자주 사용되는 태그\n${tagList}\n`
  }

  // 비율 기반 인사이트
  const insights: string[] = []
  if (pattern.keyword_in_title_rate > 0.7) {
    insights.push(`제목에 키워드 포함률 ${Math.round(pattern.keyword_in_title_rate * 100)}% - 제목에 키워드를 반드시 포함하세요`)
  }
  if (pattern.list_format_rate > 0.5) {
    insights.push('목록/번호 형식을 적극 활용하세요 (상위 글의 과반이 사용)')
  }
  if (pattern.naver_map_rate > 0.3) {
    insights.push('네이버 지도 링크 포함을 고려하세요 (지역 키워드)')
  }

  if (insights.length > 0) {
    text += '\n### 핵심 인사이트\n'
    for (const insight of insights) {
      text += `- ${insight}\n`
    }
  }

  text += '\n위 패턴을 참고하되, 더 풍부하고 차별화된 콘텐츠를 작성하세요.'

  return text
}

/**
 * 이미지 생성 프롬프트 강화용 패턴 조회
 *
 * keyword_patterns에서 이미지 배치/유형 패턴을 조회하여
 * AI 이미지 생성 프롬프트에 주입할 텍스트 생성
 */
export async function getImagePatternPrompt(
  keyword: string,
  category: ContentType,
  domain: DomainCategory | null = null
): Promise<string | null> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    // 1차: 정확한 키워드 매치
    const { data: exactMatch } = await supabase
      .from('keyword_patterns')
      .select('image_position_rates, top_image_types, avg_image_count, optimal_image_range, sample_count')
      .eq('keyword', keyword)
      .eq('keyword_category', category)
      .single()

    if (exactMatch && (exactMatch.sample_count as number) >= 3) {
      return formatImagePatternPrompt(exactMatch, keyword)
    }

    // 2차: 카테고리 매치
    const { data: categoryMatch } = await supabase
      .from('keyword_patterns')
      .select('image_position_rates, top_image_types, avg_image_count, optimal_image_range, sample_count')
      .is('keyword', null)
      .eq('keyword_category', category)
      .single()

    if (categoryMatch && (categoryMatch.sample_count as number) >= 5) {
      return formatImagePatternPrompt(categoryMatch, null)
    }

    // 3차: 도메인 매치
    if (domain) {
      const { data: domainMatch } = await supabase
        .from('keyword_patterns')
        .select('image_position_rates, top_image_types, avg_image_count, optimal_image_range, sample_count')
        .is('keyword', null)
        .eq('domain_category', domain)
        .single()

      if (domainMatch && (domainMatch.sample_count as number) >= 5) {
        return formatImagePatternPrompt(domainMatch, null)
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * 이미지 패턴 → 프롬프트 텍스트
 */
function formatImagePatternPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pattern: any,
  keyword: string | null
): string | null {
  const parts: string[] = []

  // 이미지 유형 패턴
  const types = pattern.top_image_types as Array<{ type: string; rate: number }> | null
  if (types && types.length > 0) {
    const typeList = types
      .filter(t => t.rate >= 0.2)
      .map(t => `${t.type}(${Math.round(t.rate * 100)}%)`)
      .join(', ')
    if (typeList) {
      parts.push(`이 키워드의 상위 블로그에서 자주 사용하는 이미지 유형: ${typeList}`)
    }
  }

  // 이미지 배치 패턴
  const positions = pattern.image_position_rates as Record<string, number> | null
  if (positions && Object.keys(positions).length > 0) {
    const posLabels: Record<string, string> = {
      intro: '도입부',
      after_heading: '소제목 직후',
      mid_content: '본문 중간',
      before_conclusion: '마무리 직전',
      conclusion: '마무리',
    }
    const posInfo = Object.entries(positions)
      .filter(([, rate]) => rate >= 0.3)
      .sort(([, a], [, b]) => b - a)
      .map(([pos, rate]) => `${posLabels[pos] || pos}(${Math.round(rate * 100)}%)`)
      .join(', ')
    if (posInfo) {
      parts.push(`이미지 배치 패턴: ${posInfo}`)
    }
  }

  // 이미지 수 참고
  const imgRange = pattern.optimal_image_range as { min: number; max: number } | null
  if (imgRange && imgRange.min > 0 && imgRange.max > 0) {
    parts.push(`상위 블로그 이미지 수: ${imgRange.min}~${imgRange.max}개`)
  }

  if (parts.length === 0) return null

  const scope = keyword ? `"${keyword}" 키워드` : '해당 카테고리'
  return `[${scope} 상위 블로그 이미지 패턴 (${pattern.sample_count}개 분석)]\n${parts.join('\n')}`
}

// ===== 헬퍼 =====

function formatNum(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    informational: '정보형',
    comparison: '비교/추천형',
    review: '후기/리뷰형',
    howto: '방법/가이드형',
    listicle: '리스트형',
    local: '지역업종형',
  }
  return labels[category] || category
}
