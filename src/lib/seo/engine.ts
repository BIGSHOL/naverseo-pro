/**
 * NaverSEO Pro - SEO 분석 엔진
 *
 * 네이버 블로그 SEO에 최적화된 콘텐츠 분석 엔진
 *
 * 주요 기능:
 * 1. 13개 항목 SEO 점수 분석 (100점 만점)
 * 2. 한국어 가독성 분석 (A~F 등급)
 * 3. 등급 체계 (S/A+/A/B+/B/C/D)
 * 4. 개선 우선순위 자동 산출
 *
 * 분석 항목:
 * - 기존 10개: 제목 키워드, 제목 길이, 소제목 구조, 키워드 밀도/분포,
 *   콘텐츠 길이, 멀티미디어, 가독성 요소, 관련 키워드, 태그 & CTA
 * - 신규 3개: 내부 링크, 메타 설명, 모바일 최적화
 */

import { determineGrade, type GradeTableEntry } from '@/lib/utils/grading'
import { detectStuffingPatterns } from '@/lib/utils/text'

// ===== 타입 정의 =====

/** SEO 분석 카테고리 */
export interface SeoCategory {
  id: string                                // 고유 ID (snake_case)
  name: string                              // 표시 이름 (한글)
  score: number                             // 획득 점수
  maxScore: number                          // 만점
  details: string                           // 상세 피드백
  priority: 'high' | 'medium' | 'low'       // 개선 우선순위
}

/** 등급 상세 정보 */
export interface SeoGradeInfo {
  grade: string        // S/A+/A/B+/B/C/D
  label: string        // 최적화 완료/우수/양호/보통 상위/보통/개선 필요/심각한 개선 필요
  color: string        // green/blue/yellow/orange/red
  description: string  // 상세 설명
}

/** SEO 분석 상세 정보 */
export interface SeoAnalysisDetails {
  contentLength: number
  titleLength: number
  keywordCount: number
  keywordDensity: number
  imageCount: number
  headingCount: { h2: number; h3: number }
  linkCount: { internal: number; external: number }
  analyzedAt: string
}

/** SEO 분석 결과 (100점 만점) */
export interface SeoAnalysisResult {
  totalScore: number
  grade: string                    // 기존 호환: 문자열 등급
  gradeInfo: SeoGradeInfo          // 신규: 등급 상세
  categories: SeoCategory[]
  strengths: string[]
  improvements: string[]
  details: SeoAnalysisDetails      // 신규: 분석 상세
}

/** 가독성 분석 */
export interface ReadabilityResult {
  score: number          // 0~100
  grade: string          // A/B/C/D/F
  avgSentenceLength: number
  avgParagraphLength: number
  totalCharacters: number
  totalParagraphs: number
  totalSentences: number
  boldCount: number
  listCount: number
  headingCount: number
  imageCount: number
  details: string[]
}

// ===== 등급 체계 =====

const SEO_GRADE_TABLE: GradeTableEntry[] = [
  { minScore: 90, info: { grade: 'S',  label: '최적화 완료',     color: 'green',  description: '네이버 SEO에 완벽히 최적화된 콘텐츠입니다' } },
  { minScore: 80, info: { grade: 'A+', label: '우수',           color: 'green',  description: '매우 높은 수준의 SEO 최적화 상태입니다' } },
  { minScore: 70, info: { grade: 'A',  label: '양호',           color: 'blue',   description: '전반적으로 잘 최적화되어 있으며 소폭 개선 여지가 있습니다' } },
  { minScore: 60, info: { grade: 'B+', label: '보통 상위',       color: 'blue',   description: '기본적인 SEO는 갖추었으나 개선하면 더 좋아집니다' } },
  { minScore: 50, info: { grade: 'B',  label: '보통',           color: 'yellow', description: '일부 SEO 요소가 부족합니다' } },
  { minScore: 40, info: { grade: 'C',  label: '개선 필요',       color: 'orange', description: '여러 SEO 요소에서 개선이 필요합니다' } },
  { minScore: 0,  info: { grade: 'D',  label: '심각한 개선 필요', color: 'red',    description: 'SEO 최적화가 거의 되어 있지 않습니다' } },
]

/** 점수로 등급 정보 조회 */
function calculateGrade(score: number): SeoGradeInfo {
  return determineGrade(score, SEO_GRADE_TABLE) as SeoGradeInfo
}

/** 등급 문자열로 등급 상세 조회 */
export function getGradeInfo(grade: string): SeoGradeInfo {
  const found = SEO_GRADE_TABLE.find(e => e.info.grade === grade)
  return (found?.info || SEO_GRADE_TABLE[SEO_GRADE_TABLE.length - 1].info) as SeoGradeInfo
}

// ===== 개별 분석 함수 =====

/** 1. 제목 키워드 (8점) */
function analyzeTitleKeyword(keyword: string, title: string): { category: SeoCategory; strength?: string; improvement?: string } {
  let score = 0
  const titleHasKeyword = title.includes(keyword)
  const keywordPos = title.indexOf(keyword)

  if (titleHasKeyword) {
    score += 4
    if (keywordPos >= 0 && keywordPos <= 10) {
      score += 4
    } else {
      score += 2
    }
  }

  return {
    category: {
      id: 'title_keyword',
      name: '제목 키워드',
      score,
      maxScore: 8,
      details: titleHasKeyword ? `키워드 위치: ${keywordPos + 1}번째 글자` : '키워드 미포함',
      priority: score < 4 ? 'high' : 'low',
    },
    strength: titleHasKeyword && keywordPos <= 10 ? '제목 앞쪽에 키워드가 잘 배치되어 있습니다' : undefined,
    improvement: !titleHasKeyword
      ? '제목에 핵심 키워드를 포함하세요'
      : keywordPos > 10
        ? '키워드를 제목 앞쪽(10자 이내)에 배치하면 더 좋습니다'
        : undefined,
  }
}

/** 2. 제목 길이 (7점) */
function analyzeTitleLength(title: string): { category: SeoCategory; strength?: string; improvement?: string } {
  let score = 0
  const titleLen = title.length

  if (titleLen >= 20 && titleLen <= 40) {
    score = 7
  } else if (titleLen >= 15 && titleLen <= 50) {
    score = 5
  } else if (titleLen >= 10) {
    score = 3
  } else {
    score = 1
  }

  return {
    category: {
      id: 'title_length',
      name: '제목 길이',
      score,
      maxScore: 7,
      details: `${titleLen}자 (권장: 20~40자)`,
      priority: score < 5 ? 'medium' : 'low',
    },
    strength: score === 7 ? `제목 길이 최적 (${titleLen}자)` : undefined,
    improvement: score < 5
      ? `제목이 ${titleLen > 50 ? '너무 깁니다' : '너무 짧습니다'} (권장: 20~40자)`
      : undefined,
  }
}

/** 3. 소제목 구조 (8점) */
function analyzeHeadingStructure(content: string): { category: SeoCategory; strength?: string; improvement?: string; h2Count: number; h3Count: number } {
  const h2Count = (content.match(/^## /gm) || []).length
  const h3Count = (content.match(/^### /gm) || []).length

  let score = 0
  if (h2Count >= 3 && h3Count >= 2) {
    score = 8
  } else if (h2Count >= 3) {
    score = 6
  } else if (h2Count >= 2) {
    score = 4
  } else if (h2Count >= 1) {
    score = 2
  }

  return {
    category: {
      id: 'heading_structure',
      name: '소제목 구조',
      score,
      maxScore: 8,
      details: `H2: ${h2Count}개, H3: ${h3Count}개 (총 ${h2Count + h3Count}개)`,
      priority: score < 4 ? 'high' : 'low',
    },
    strength: score >= 6 ? `H2(${h2Count}개) + H3(${h3Count}개) 구조 우수` : undefined,
    improvement: h2Count < 3
      ? h2Count === 0
        ? '소제목(##)을 사용하여 콘텐츠를 구조화하세요'
        : '소제목(H2)을 3개 이상 사용하세요'
      : undefined,
    h2Count,
    h3Count,
  }
}

/** 4. 키워드 밀도 (8점) - 스터핑 패턴 감지 포함 */
function analyzeKeywordDensity(keyword: string, content: string): { category: SeoCategory; strength?: string; improvement?: string; keywordCount: number; density: number } {
  const keywordCount = content.split(keyword).length - 1
  const spaceBasedWords = (content.match(/\S+/g) || []).length
  const estimatedWords = spaceBasedWords > 10 ? spaceBasedWords : Math.ceil(content.length / 3.5)
  const density = estimatedWords > 0 ? (keywordCount / estimatedWords) * 100 : 0

  let score = 0
  let improvement: string | undefined

  if (density >= 0.5 && density <= 2.5) {
    score = 8
  } else if (density > 0 && density < 0.5) {
    score = 4
    improvement = '키워드 사용 빈도를 조금 더 늘려보세요'
  } else if (density > 2.5 && density <= 4) {
    score = 5
    improvement = '키워드가 약간 과도합니다. 동의어로 대체하세요'
  } else if (density > 4) {
    score = 2
    improvement = '키워드 스터핑 위험! 자연스러운 표현으로 교체하세요'
  } else {
    score = 0
    improvement = '본문에 핵심 키워드를 포함하세요'
  }

  // 스터핑 패턴 감지 → 감점 적용
  if (keywordCount >= 2) {
    const stuffing = detectStuffingPatterns(keyword, content)
    const stuffRatio = stuffing.totalCount > 0 ? stuffing.stuffedCount / stuffing.totalCount : 0

    if (stuffRatio >= 0.5) {
      // 절반 이상이 부자연스러운 배치 → 큰 감점
      score = Math.min(score, 2)
      improvement = `키워드 스터핑 감지 (${stuffing.patterns.join(', ')}). 자연스러운 문장 속에 키워드를 녹여주세요`
    } else if (stuffRatio >= 0.3) {
      // 30% 이상 부자연스러운 배치 → 감점
      score = Math.min(score, 4)
      improvement = `부자연스러운 키워드 배치 감지 (${stuffing.patterns.join(', ')}). 자연스럽게 문장에 포함하세요`
    }
  }

  return {
    category: {
      id: 'keyword_density',
      name: '키워드 밀도',
      score,
      maxScore: 8,
      details: `${keywordCount}회 (밀도: ${density.toFixed(1)}%)`,
      priority: score < 4 ? 'high' : 'low',
    },
    strength: score === 8 ? `키워드 밀도 최적 (${density.toFixed(1)}%)` : undefined,
    improvement,
    keywordCount,
    density,
  }
}

/** 5. 키워드 분포 (7점) */
function analyzeKeywordDistribution(keyword: string, content: string): { category: SeoCategory; strength?: string; improvement?: string } {
  const third = Math.floor(content.length / 3)
  const firstThird = content.substring(0, third)
  const middleThird = content.substring(third, third * 2)
  const lastThird = content.substring(third * 2)

  const inFirst = firstThird.includes(keyword)
  const inMiddle = middleThird.includes(keyword)
  const inLast = lastThird.includes(keyword)
  const coverage = [inFirst, inMiddle, inLast].filter(Boolean).length

  let score = 0
  let improvement: string | undefined

  if (coverage === 3) {
    score = 7
  } else if (coverage === 2) {
    score = 4
    if (!inFirst) improvement = '도입부에 키워드를 포함하세요'
    else if (!inLast) improvement = '마무리 부분에 키워드를 포함하세요'
    else improvement = '중간 부분에 키워드를 포함하세요'
  } else if (coverage === 1) {
    score = 2
    improvement = '키워드를 본문 전반에 걸쳐 배치하세요'
  } else {
    score = 0
    improvement = '본문에 핵심 키워드가 발견되지 않습니다. 도입부·중간·마무리에 키워드를 자연스럽게 포함하세요'
  }

  return {
    category: {
      id: 'keyword_distribution',
      name: '키워드 분포',
      score,
      maxScore: 7,
      details: `앞(${inFirst ? 'O' : 'X'}) / 중(${inMiddle ? 'O' : 'X'}) / 뒤(${inLast ? 'O' : 'X'})`,
      priority: score < 4 ? 'medium' : 'low',
    },
    strength: coverage === 3 ? '키워드가 본문 전체에 고르게 분포되어 있습니다' : undefined,
    improvement,
  }
}

/** 6. 콘텐츠 길이 (7점) */
function analyzeContentLength(content: string): { category: SeoCategory; strength?: string; improvement?: string } {
  const contentLength = content.length
  let score = 0
  let improvement: string | undefined

  if (contentLength >= 2500) {
    score = 7
  } else if (contentLength >= 1800) {
    score = 5
  } else if (contentLength >= 1200) {
    score = 3
    improvement = '콘텐츠 분량을 2,000자 이상으로 늘리세요'
  } else if (contentLength >= 800) {
    score = 2
    improvement = '콘텐츠가 짧습니다 (최소 1,500자 권장)'
  } else {
    score = 1
    improvement = '콘텐츠가 너무 짧습니다 (2,000자 이상 권장)'
  }

  return {
    category: {
      id: 'content_length',
      name: '콘텐츠 길이',
      score,
      maxScore: 7,
      details: `${contentLength.toLocaleString()}자 (권장: 2,000~3,000자)`,
      priority: score < 3 ? 'high' : 'low',
    },
    strength: score === 7 ? `콘텐츠 분량 우수 (${contentLength.toLocaleString()}자)` : undefined,
    improvement,
  }
}

/** 7. 멀티미디어 (7점) */
function analyzeMultimedia(content: string): { category: SeoCategory; strength?: string; improvement?: string; imageCount: number } {
  const imageMatches = content.match(/\[이미지[:\s]/g) || []
  const imageCount = imageMatches.length

  let score = 0
  let improvement: string | undefined

  if (imageCount >= 4) {
    score = 7
  } else if (imageCount >= 2) {
    score = 5
  } else if (imageCount >= 1) {
    score = 3
    improvement = '이미지를 3개 이상 포함하면 체류 시간이 증가합니다'
  } else {
    score = 0
    improvement = '이미지를 추가하여 콘텐츠의 시각적 매력을 높이세요'
  }

  return {
    category: {
      id: 'multimedia',
      name: '멀티미디어',
      score,
      maxScore: 7,
      details: `이미지 ${imageCount}개`,
      priority: score < 3 ? 'medium' : 'low',
    },
    strength: imageCount >= 4 ? `이미지 ${imageCount}개 배치 (우수)` : undefined,
    improvement,
    imageCount,
  }
}

/** 8. 가독성 요소 (8점) */
function analyzeReadabilityElements(content: string): { category: SeoCategory; strength?: string; improvement?: string } {
  let score = 0
  const hasBold = content.includes('**')
  const hasList = (content.match(/^[-•]\s/gm) || []).length > 0
  const hasNumberedList = (content.match(/^\d+\.\s/gm) || []).length > 0
  const paragraphs = content.split('\n\n').filter(p => p.trim()).length

  if (hasBold) score += 2
  if (hasList || hasNumberedList) score += 2
  if (paragraphs >= 8) score += 4
  else if (paragraphs >= 5) score += 2

  const improvements: string[] = []
  if (!hasBold) improvements.push('**볼드** 처리로 핵심 내용을 강조하세요')
  if (!hasList && !hasNumberedList) improvements.push('리스트를 활용하면 가독성이 향상됩니다')

  return {
    category: {
      id: 'readability_elements',
      name: '가독성 요소',
      score,
      maxScore: 8,
      details: `볼드(${hasBold ? 'O' : 'X'}), 리스트(${hasList || hasNumberedList ? 'O' : 'X'}), 문단(${paragraphs}개)`,
      priority: score < 4 ? 'medium' : 'low',
    },
    strength: score >= 6 ? '가독성 요소 (볼드, 리스트, 문단 분리) 우수' : undefined,
    improvement: improvements[0],
  }
}

/** 9. 관련 키워드 활용 (8점) */
function analyzeRelatedKeywords(content: string, additionalKeywords?: string[]): { category: SeoCategory; strength?: string; improvement?: string } {
  let score = 0

  if (additionalKeywords && additionalKeywords.length > 0) {
    const used = additionalKeywords.filter(k => content.includes(k))
    const usageRate = used.length / additionalKeywords.length

    if (usageRate >= 0.7) {
      score = 8
    } else if (usageRate >= 0.4) {
      score = 5
    } else if (usageRate > 0) {
      score = 2
    }

    return {
      category: {
        id: 'related_keywords',
        name: '관련 키워드',
        score,
        maxScore: 8,
        details: `${used.length}/${additionalKeywords.length}개 활용`,
        priority: score < 5 ? 'medium' : 'low',
      },
      strength: usageRate >= 0.7 ? `관련 키워드 ${used.length}/${additionalKeywords.length}개 활용 (우수)` : undefined,
      improvement: usageRate < 0.4
        ? usageRate === 0
          ? '관련 키워드를 본문에 포함하여 주제 전문성을 높이세요'
          : '관련 키워드를 더 많이 활용하세요'
        : undefined,
    }
  }

  // 관련 키워드 없으면 만점 처리
  return {
    category: {
      id: 'related_keywords',
      name: '관련 키워드',
      score: 8,
      maxScore: 8,
      details: '관련 키워드 미지정 (기본 만점)',
      priority: 'low',
    },
  }
}

/** 10. 태그 & CTA (7점) */
function analyzeTagsAndCta(content: string): { category: SeoCategory; strength?: string; improvement?: string } {
  let score = 0
  const hasHashtags = content.includes('#')
  const hasCta = /댓글|공감|구독|팔로우|즐겨찾기|공유|좋아요/i.test(content)

  if (hasHashtags) {
    const tagCount = (content.match(/#[가-힣a-zA-Z0-9_]+/g) || []).length
    if (tagCount >= 5) score += 4
    else if (tagCount >= 3) score += 3
    else score += 1
  }

  if (hasCta) {
    score += 3
  }

  const improvements: string[] = []
  if (!hasHashtags) improvements.push('관련 태그(#)를 5~10개 추가하세요')
  if (!hasCta) improvements.push('마무리에 댓글/공감 유도 문구를 추가하세요')

  return {
    category: {
      id: 'tags_cta',
      name: '태그 & CTA',
      score,
      maxScore: 7,
      details: `태그(${hasHashtags ? 'O' : 'X'}), CTA(${hasCta ? 'O' : 'X'})`,
      priority: score < 4 ? 'medium' : 'low',
    },
    strength: hasCta ? '독자 참여 유도 문구 포함' : undefined,
    improvement: improvements[0],
  }
}

/** 11. 내부 링크 (10점) - 신규 */
function analyzeInternalLinks(content: string): { category: SeoCategory; strength?: string; improvement?: string; internalCount: number; externalCount: number } {
  // 마크다운 링크 추출: [text](url)
  const mdLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []
  // HTML 링크 추출: <a href="url">
  const htmlLinks = content.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi) || []

  const allLinks = [...mdLinks, ...htmlLinks]

  // 내부/외부 분류
  let internalCount = 0
  let externalCount = 0

  for (const link of allLinks) {
    // 내부 링크: 상대 경로, #앵커, blog.naver.com
    if (/blog\.naver\.com|^#|^\(#|^\(\/|href=["']#|href=["']\//i.test(link)) {
      internalCount++
    } else {
      externalCount++
    }
  }

  let score = 0
  if (internalCount >= 3) {
    score = 10
  } else if (internalCount >= 2) {
    score = 7
  } else if (internalCount >= 1) {
    score = 4
  } else {
    score = 0
  }

  return {
    category: {
      id: 'internal_links',
      name: '내부 링크',
      score,
      maxScore: 10,
      details: `내부 ${internalCount}개, 외부 ${externalCount}개`,
      priority: score < 4 ? 'high' : 'low',
    },
    strength: internalCount >= 3 ? `내부 링크 ${internalCount}개 배치 (우수)` : undefined,
    improvement: internalCount < 3
      ? `내부 링크를 ${3 - internalCount}개 이상 추가하면 체류 시간과 SEO가 향상됩니다`
      : undefined,
    internalCount,
    externalCount,
  }
}

/** 12. 메타 설명 (8점) - 신규 */
function analyzeMetaDescription(keyword: string, title: string, content: string): { category: SeoCategory; strength?: string; improvement?: string } {
  // 첫 문단에서 핵심 문장 추출 (도입부 = 메타 설명 후보)
  const cleanContent = content
    .replace(/^#{1,3}\s.+$/gm, '')  // 제목 제거
    .replace(/\[이미지[^\]]*\]/g, '')  // 이미지 태그 제거
    .replace(/\*\*/g, '')  // 볼드 제거
    .trim()

  const sentences = cleanContent
    .split(/[.!?。]\s/)
    .map(s => s.trim())
    .filter(s => s.length >= 10)

  const firstSentence = sentences[0] || ''
  const metaLen = firstSentence.length

  let score = 0

  // 길이 평가 (4점)
  if (metaLen >= 50 && metaLen <= 120) {
    score += 4
  } else if (metaLen >= 30 && metaLen <= 150) {
    score += 2
  } else {
    score += 0
  }

  // 키워드 포함 여부 (4점)
  const hasKeyword = keyword && firstSentence.includes(keyword)
  // 제목 핵심 단어 포함 여부도 체크
  const titleWords = title.match(/[가-힣]{2,}/g) || []
  const hasTitleWord = titleWords.some(w => firstSentence.includes(w))

  if (hasKeyword) {
    score += 4
  } else if (hasTitleWord) {
    score += 2
  }

  return {
    category: {
      id: 'meta_description',
      name: '메타 설명',
      score,
      maxScore: 8,
      details: `도입부 ${metaLen}자 (권장: 50~120자)${hasKeyword ? ', 키워드 포함' : ''}`,
      priority: score < 4 ? 'medium' : 'low',
    },
    strength: score >= 6 ? '도입부에 핵심 키워드가 포함되어 메타 설명에 유리합니다' : undefined,
    improvement: score < 4
      ? metaLen < 50
        ? '도입부 첫 문장을 50자 이상으로 작성하고 핵심 키워드를 포함하세요'
        : '도입부 첫 문장에 핵심 키워드를 자연스럽게 포함하세요'
      : undefined,
  }
}

/** 13. 모바일 최적화 (7점) - 신규 */
function analyzeMobileOptimization(content: string): { category: SeoCategory; strength?: string; improvement?: string } {
  const sentences = content.split(/[.!?。]\s/).filter(s => s.trim().length > 5)
  const paragraphs = content.split('\n\n').filter(p => p.trim())

  const avgSentenceLen = sentences.length > 0
    ? Math.round(sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length)
    : 0
  const avgParagraphLen = paragraphs.length > 0
    ? Math.round(paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length)
    : 0

  let score = 0

  // 문장 길이 (4점) - 모바일에서 40자 이내가 읽기 좋음
  if (avgSentenceLen <= 40) {
    score += 4
  } else if (avgSentenceLen <= 60) {
    score += 2
  } else {
    score += 1
  }

  // 문단 길이 (3점) - 모바일에서 짧은 문단이 가독성 좋음
  if (avgParagraphLen <= 200) {
    score += 3
  } else if (avgParagraphLen <= 300) {
    score += 2
  } else {
    score += 1
  }

  return {
    category: {
      id: 'mobile_optimization',
      name: '모바일 최적화',
      score,
      maxScore: 7,
      details: `문장 평균 ${avgSentenceLen}자, 문단 평균 ${avgParagraphLen}자`,
      priority: score < 4 ? 'medium' : 'low',
    },
    strength: score >= 6 ? '모바일 가독성에 최적화된 문장/문단 길이입니다' : undefined,
    improvement: score < 4
      ? avgSentenceLen > 60
        ? `문장이 너무 깁니다 (평균 ${avgSentenceLen}자, 권장: 40자 이내)`
        : `문단을 더 짧게 나눠주세요 (평균 ${avgParagraphLen}자, 권장: 200자 이내)`
      : undefined,
  }
}

// ===== 메인 분석 함수 =====

/**
 * 고급 SEO 분석 (100점 만점, 13개 세부 항목)
 *
 * 기존 analyzeSeo()와 동일한 시그니처를 유지하여 호환성 보장
 */
export function analyzeSeo(
  keyword: string,
  title: string,
  content: string,
  additionalKeywords?: string[]
): SeoAnalysisResult {
  const categories: SeoCategory[] = []
  const strengths: string[] = []
  const improvements: string[] = []

  // 13개 항목 분석 실행
  const results = [
    analyzeTitleKeyword(keyword, title),
    analyzeTitleLength(title),
    analyzeHeadingStructure(content),
    analyzeKeywordDensity(keyword, content),
    analyzeKeywordDistribution(keyword, content),
    analyzeContentLength(content),
    analyzeMultimedia(content),
    analyzeReadabilityElements(content),
    analyzeRelatedKeywords(content, additionalKeywords),
    analyzeTagsAndCta(content),
    analyzeInternalLinks(content),
    analyzeMetaDescription(keyword, title, content),
    analyzeMobileOptimization(content),
  ]

  // 결과 수집
  for (const result of results) {
    categories.push(result.category)
    if (result.strength) strengths.push(result.strength)
    if (result.improvement) improvements.push(result.improvement)
  }

  // 총점 계산
  const totalScore = categories.reduce((sum, c) => sum + c.score, 0)
  const gradeInfo = calculateGrade(totalScore)

  // 상세 정보 수집
  const headingResult = results[2] as ReturnType<typeof analyzeHeadingStructure>
  const densityResult = results[3] as ReturnType<typeof analyzeKeywordDensity>
  const multimediaResult = results[6] as ReturnType<typeof analyzeMultimedia>
  const linkResult = results[10] as ReturnType<typeof analyzeInternalLinks>

  const details: SeoAnalysisDetails = {
    contentLength: content.length,
    titleLength: title.length,
    keywordCount: densityResult.keywordCount,
    keywordDensity: densityResult.density,
    imageCount: multimediaResult.imageCount,
    headingCount: { h2: headingResult.h2Count, h3: headingResult.h3Count },
    linkCount: { internal: linkResult.internalCount, external: linkResult.externalCount },
    analyzedAt: new Date().toISOString(),
  }

  return {
    totalScore,
    grade: gradeInfo.grade,
    gradeInfo,
    categories,
    strengths: strengths.slice(0, 5),
    improvements: improvements.slice(0, 5),
    details,
  }
}

// ===== 가독성 분석 =====

/**
 * 한국어 가독성 분석
 */
export function analyzeReadability(content: string): ReadabilityResult {
  const details: string[] = []

  // 기본 메트릭
  const totalCharacters = content.length
  const paragraphs = content.split('\n\n').filter(p => p.trim() && !p.trim().startsWith('#'))
  const totalParagraphs = paragraphs.length
  const sentences = content.split(/[.!?。]\s|\n/).filter(s => s.trim().length > 5)
  const totalSentences = sentences.length

  const avgSentenceLength = totalSentences > 0 ? Math.round(totalCharacters / totalSentences) : totalCharacters
  const avgParagraphLength = totalParagraphs > 0 ? Math.round(totalCharacters / totalParagraphs) : totalCharacters

  const boldCount = (content.match(/\*\*[^*]+\*\*/g) || []).length
  const listCount = (content.match(/^[-•]\s|^\d+\.\s/gm) || []).length
  const headingCount = (content.match(/^#{1,3}\s/gm) || []).length
  const imageCount = (content.match(/\[이미지[:\s]/g) || []).length

  // 가독성 점수 계산
  let score = 0

  // 1. 문장 길이 (30점)
  if (avgSentenceLength <= 40) {
    score += 30
    details.push(`문장 길이 최적 (평균 ${avgSentenceLength}자)`)
  } else if (avgSentenceLength <= 60) {
    score += 22
    details.push(`문장 길이 양호 (평균 ${avgSentenceLength}자)`)
  } else if (avgSentenceLength <= 80) {
    score += 15
    details.push(`문장이 조금 깁니다 (평균 ${avgSentenceLength}자, 권장: 40자 이내)`)
  } else {
    score += 5
    details.push(`문장이 너무 깁니다 (평균 ${avgSentenceLength}자, 권장: 40자 이내)`)
  }

  // 2. 문단 구분 (20점)
  if (totalParagraphs >= 8) {
    score += 20
    details.push(`문단 구분 우수 (${totalParagraphs}개)`)
  } else if (totalParagraphs >= 5) {
    score += 15
  } else if (totalParagraphs >= 3) {
    score += 8
    details.push('문단을 더 많이 나눠주세요 (모바일 가독성)')
  } else {
    score += 2
    details.push('문단 구분이 부족합니다')
  }

  // 3. 시각적 요소 (30점)
  if (boldCount >= 5) score += 10
  else if (boldCount >= 2) score += 6
  else if (boldCount > 0) score += 3

  if (listCount >= 5) score += 10
  else if (listCount >= 3) score += 7
  else if (listCount > 0) score += 3

  if (imageCount >= 3) score += 10
  else if (imageCount >= 1) score += 5

  // 4. 구조 (20점)
  if (headingCount >= 5) score += 20
  else if (headingCount >= 3) score += 15
  else if (headingCount >= 1) score += 8

  score = Math.min(100, score)

  let grade: string
  if (score >= 85) grade = 'A'
  else if (score >= 70) grade = 'B'
  else if (score >= 50) grade = 'C'
  else if (score >= 30) grade = 'D'
  else grade = 'F'

  return {
    score,
    grade,
    avgSentenceLength,
    avgParagraphLength,
    totalCharacters,
    totalParagraphs,
    totalSentences,
    boldCount,
    listCount,
    headingCount,
    imageCount,
    details,
  }
}
