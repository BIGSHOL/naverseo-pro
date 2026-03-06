/**
 * NaverSEO Pro - SEO 분석 엔진
 *
 * 네이버 블로그 SEO에 최적화된 콘텐츠 분석 엔진
 *
 * 주요 기능:
 * 1. 13개 항목 SEO 점수 분석 (100점 만점)
 * 2. 한국어 가독성 분석 (A~F 등급)
 * 3. 등급 체계 (16단계 - 블로그 지수와 동일 기준)
 * 4. 개선 우선순위 자동 산출
 *
 * 분석 항목:
 * - 기존 10개: 제목 키워드, 제목 길이, 소제목 구조, 키워드 밀도/분포,
 *   콘텐츠 길이, 멀티미디어, 가독성 요소, 관련 키워드, 태그 & CTA
 * - 신규 3개: 내부 링크, 메타 설명, 모바일 최적화
 */

import { detectStuffingPatterns, STOPWORDS } from '@/lib/utils/text'

// ===== 타입 정의 =====

/** URL 스크래핑 시 전달되는 메타 데이터 (SEO 엔진용) */
export interface SeoScrapedMeta {
  tags?: string[]
  formatting?: {
    hasBold: boolean
    hasHeading: boolean
    hasFontSize: boolean
    hasColor: boolean
    hasHighlight: boolean
    hasUnderline: boolean
    count: number
  }
}

/** SEO 분석 카테고리 */
export interface SeoCategory {
  id: string                                // 고유 ID (snake_case)
  name: string                              // 표시 이름 (한글)
  score: number                             // 획득 점수
  maxScore: number                          // 만점
  details: string                           // 상세 피드백
  priority: 'high' | 'medium' | 'low'       // 개선 우선순위
}

/** 등급 상세 정보 (16단계 - 블로그 지수와 동일 기준) */
export interface SeoGradeInfo {
  tier: number         // 1~16
  category: string     // '파워' | '최적화+' | '최적화' | '준최적화' | '일반'
  grade: string        // = label (예: '파워')
  label: string        // '파워' 등
  shortLabel: string   // '파워' 등
  color: string        // 'amber' 등
  badgeColor: string   // 'bg-amber-100 text-amber-700 border-amber-300'
  description: string
  nextTierScore: number | null
}

/** SEO 등급 테이블 항목 */
interface SeoGradeEntry {
  minScore: number
  info: SeoGradeInfo
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
  grade: string                    // 등급 라벨 (예: '파워')
  gradeInfo: SeoGradeInfo          // 등급 상세 (16단계)
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

// ===== 등급 체계 (16단계 - 블로그 지수와 동일 임계값) =====

import { GRADE_BADGES } from '@/lib/seo/grade-constants'

// v11.2: 등급 구간 상향 — "최적화" 진입을 더 어렵게 (평균 +5~7점)
const SEO_GRADE_TABLE: SeoGradeEntry[] = [
  // v16: 준최적화 구간 확대 (grading.ts/scoring.ts와 동기화)
  { minScore: 99, info: { tier: 16, category: '파워', grade: '파워', label: '파워', shortLabel: '파워', color: 'amber', badgeColor: GRADE_BADGES[16], description: '네이버 SEO에 완벽히 최적화된 파워 콘텐츠입니다', nextTierScore: null } },
  { minScore: 97, info: { tier: 15, category: '최적화+', grade: '최적화4+', label: '최적화4+', shortLabel: '최적화4+', color: 'emerald', badgeColor: GRADE_BADGES[15], description: '최상위 SEO 수준입니다. 파워 등급까지 한 걸음입니다', nextTierScore: 99 } },
  { minScore: 94, info: { tier: 14, category: '최적화+', grade: '최적화3+', label: '최적화3+', shortLabel: '최적화3+', color: 'emerald', badgeColor: GRADE_BADGES[14], description: '매우 높은 SEO 최적화 수준입니다', nextTierScore: 97 } },
  { minScore: 91, info: { tier: 13, category: '최적화+', grade: '최적화2+', label: '최적화2+', shortLabel: '최적화2+', color: 'teal', badgeColor: GRADE_BADGES[13], description: '경쟁 키워드에서도 우수한 검색 노출이 기대됩니다', nextTierScore: 94 } },
  { minScore: 86, info: { tier: 12, category: '최적화+', grade: '최적화1+', label: '최적화1+', shortLabel: '최적화1+', color: 'teal', badgeColor: GRADE_BADGES[12], description: 'SEO 최적화가 우수합니다. 고급 키워드 전략을 시도하세요', nextTierScore: 91 } },
  { minScore: 80, info: { tier: 11, category: '최적화', grade: '최적화3', label: '최적화3', shortLabel: '최적화3', color: 'green', badgeColor: GRADE_BADGES[11], description: '안정적인 SEO 최적화 상태입니다. 최적화+ 등급에 도전하세요', nextTierScore: 86 } },
  { minScore: 73, info: { tier: 10, category: '최적화', grade: '최적화2', label: '최적화2', shortLabel: '최적화2', color: 'green', badgeColor: GRADE_BADGES[10], description: '양호한 SEO 상태입니다. 콘텐츠 깊이를 더 높여보세요', nextTierScore: 80 } },
  { minScore: 65, info: { tier: 9, category: '최적화', grade: '최적화1', label: '최적화1', shortLabel: '최적화1', color: 'lime', badgeColor: GRADE_BADGES[9], description: '기본 SEO가 갖춰져 있습니다. 경쟁 키워드도 도전해보세요', nextTierScore: 73 } },
  { minScore: 54, info: { tier: 8, category: '준최적화', grade: '준최적화7', label: '준최적화7', shortLabel: '준최적화7', color: 'blue', badgeColor: GRADE_BADGES[8], description: 'SEO 기본 요소를 보강하면 검색 노출이 향상됩니다', nextTierScore: 65 } },
  { minScore: 43, info: { tier: 7, category: '준최적화', grade: '준최적화6', label: '준최적화6', shortLabel: '준최적화6', color: 'blue', badgeColor: GRADE_BADGES[7], description: 'SEO 개선 여지가 많습니다. 주요 항목부터 보완하세요', nextTierScore: 54 } },
  { minScore: 33, info: { tier: 6, category: '준최적화', grade: '준최적화5', label: '준최적화5', shortLabel: '준최적화5', color: 'sky', badgeColor: GRADE_BADGES[6], description: '콘텐츠 구조와 키워드 배치를 개선하세요', nextTierScore: 43 } },
  { minScore: 24, info: { tier: 5, category: '준최적화', grade: '준최적화4', label: '준최적화4', shortLabel: '준최적화4', color: 'sky', badgeColor: GRADE_BADGES[5], description: '키워드 전략과 콘텐츠 길이부터 개선이 필요합니다', nextTierScore: 33 } },
  { minScore: 16, info: { tier: 4, category: '준최적화', grade: '준최적화3', label: '준최적화3', shortLabel: '준최적화3', color: 'indigo', badgeColor: GRADE_BADGES[4], description: 'SEO 기본기를 갖추는 단계입니다. 제목과 소제목부터 최적화하세요', nextTierScore: 24 } },
  { minScore: 9,  info: { tier: 3, category: '준최적화', grade: '준최적화2', label: '준최적화2', shortLabel: '준최적화2', color: 'indigo', badgeColor: GRADE_BADGES[3], description: '기본적인 SEO 최적화를 시작해보세요', nextTierScore: 16 } },
  { minScore: 3,  info: { tier: 2, category: '준최적화', grade: '준최적화1', label: '준최적화1', shortLabel: '준최적화1', color: 'violet', badgeColor: GRADE_BADGES[2], description: '콘텐츠 길이와 키워드 포함부터 시작하세요', nextTierScore: 9 } },
  { minScore: 0,  info: { tier: 1, category: '일반', grade: '일반', label: '일반', shortLabel: '일반', color: 'slate', badgeColor: GRADE_BADGES[1], description: 'SEO 최적화가 거의 되어 있지 않습니다', nextTierScore: 3 } },
]

/** 점수로 등급 정보 조회 (내부용) */
function calculateGrade(score: number): SeoGradeInfo {
  for (const entry of SEO_GRADE_TABLE) {
    if (score >= entry.minScore) {
      return entry.info
    }
  }
  return SEO_GRADE_TABLE[SEO_GRADE_TABLE.length - 1].info
}

/** 점수로 등급 정보 조회 (외부 export용) */
export function getGradeByScore(score: number): SeoGradeInfo {
  return calculateGrade(score)
}

/** 등급 문자열로 등급 상세 조회 */
export function getGradeInfo(grade: string): SeoGradeInfo {
  const found = SEO_GRADE_TABLE.find(e => e.info.grade === grade)
  return found?.info || SEO_GRADE_TABLE[SEO_GRADE_TABLE.length - 1].info
}

// ===== 개별 분석 함수 =====

/** 1. 제목 키워드 (8점) */
function analyzeTitleKeyword(keyword: string, title: string): { category: SeoCategory; strength?: string; improvement?: string } {
  // 빈 키워드 → 0점 (includes('') = true 오작동 방지)
  if (!keyword.trim()) {
    return {
      category: { id: 'title_keyword', name: '제목 키워드', score: 0, maxScore: 8, details: '키워드 미지정', priority: 'high' },
      improvement: '분석할 핵심 키워드를 입력하세요',
    }
  }

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
  // v11.1: 기준 강화 - 2개 이상부터 점수 (1개는 0점)
  if (h2Count >= 3 && h3Count >= 2) {
    score = 8
  } else if (h2Count >= 3) {
    score = 6
  } else if (h2Count >= 2) {
    score = 4  // 2개부터 점수
  }
  // h2Count === 1 → 0점 (이전 2점 폐지)

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
    improvement: h2Count < 2
      ? h2Count === 0
        ? '소제목(##)을 사용하여 콘텐츠를 구조화하세요'
        : '소제목(H2)을 2개 이상 사용하세요 (현재 1개만 있음)'
      : h2Count >= 2 && h2Count < 3
        ? '소제목(H2)을 3개 이상 사용하면 더 좋습니다'
        : undefined,
    h2Count,
    h3Count,
  }
}

/** 4. 키워드 밀도 (8점) - 스터핑 패턴 감지 포함 */
function analyzeKeywordDensity(keyword: string, content: string): { category: SeoCategory; strength?: string; improvement?: string; keywordCount: number; density: number } {
  // 빈 키워드 → 즉시 0점 반환 (split('') 오작동 + 무한루프 방지)
  if (!keyword.trim()) {
    return {
      category: { id: 'keyword_density', name: '키워드 밀도', score: 0, maxScore: 8, details: '키워드 미지정 (0점)', priority: 'high' },
      improvement: '분석할 핵심 키워드를 입력하세요',
      keywordCount: 0,
      density: 0,
    }
  }

  const keywordCount = content.split(keyword).length - 1
  const spaceBasedWords = (content.match(/\S+/g) || []).length
  const estimatedWords = spaceBasedWords > 10 ? spaceBasedWords : Math.ceil(content.length / 3.5)
  const density = estimatedWords > 0 ? (keywordCount / estimatedWords) * 100 : 0

  let score = 0
  let improvement: string | undefined

  if (density >= 0.5 && density <= 2.5) {
    score = 8
  } else if (density >= 0.3 && density < 0.5) {
    score = 5
    improvement = '키워드 사용 빈도를 조금 더 늘려보세요 (권장: 0.5~2.5%)'
  } else if (density >= 0.1 && density < 0.3) {
    score = 2
    improvement = '키워드가 매우 부족합니다. 본문에 자연스럽게 더 많이 포함하세요'
  } else if (density > 2.5 && density <= 4) {
    score = 5
    improvement = '키워드가 약간 과도합니다. 동의어로 대체하세요'
  } else if (density > 4) {
    score = 2
    improvement = '키워드 스터핑 위험! 자연스러운 표현으로 교체하세요'
  } else {
    score = 0
    improvement = '본문에 핵심 키워드를 포함하세요 (현재 밀도: 0%)'
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
  // 빈 키워드 → 0점 (includes('') = true 오작동 방지)
  if (!keyword.trim()) {
    return {
      category: { id: 'keyword_distribution', name: '키워드 분포', score: 0, maxScore: 7, details: '키워드 미지정 (0점)', priority: 'high' },
      improvement: '분석할 핵심 키워드를 입력하세요',
    }
  }

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

/** 6. 콘텐츠 길이 (7점) - 블로그 지수와 동일 기준 */
function analyzeContentLength(content: string): { category: SeoCategory; strength?: string; improvement?: string } {
  const contentLength = content.length
  let score = 0
  let improvement: string | undefined
  let strength: string | undefined

  if (contentLength >= 1500 && contentLength <= 2500) {
    score = 7
    strength = `최적 콘텐츠 분량 (${contentLength.toLocaleString()}자)`
  } else if (contentLength >= 1000 && contentLength < 1500) {
    score = 6
    improvement = '1,500자 이상으로 늘리면 SEO 효과가 더 좋습니다'
  } else if (contentLength > 2500 && contentLength <= 3000) {
    score = 5
    improvement = '약간 깁니다. 핵심 내용 위주로 2,500자 이하 권장'
  } else if (contentLength >= 800 && contentLength < 1000) {
    score = 3
    improvement = '콘텐츠가 짧습니다. 최소 1,500자 이상 권장'
  } else if (contentLength > 3000 && contentLength <= 4000) {
    score = 2
    improvement = '콘텐츠가 깁니다. 핵심 위주로 압축 권장 (최적: 1,500~2,500자)'
  } else if (contentLength > 4000) {
    score = 1
    improvement = '콘텐츠가 과도하게 깁니다. 사용자 이탈 위험 (권장: 1,500~2,500자)'
  } else {
    score = 0
    improvement = '콘텐츠가 너무 짧습니다. 최소 1,500자 이상 작성하세요'
  }

  return {
    category: {
      id: 'content_length',
      name: '콘텐츠 길이',
      score,
      maxScore: 7,
      details: `${contentLength.toLocaleString()}자 (최적: 1,500~2,500자)`,
      priority: score < 4 ? 'high' : score < 6 ? 'medium' : 'low',
    },
    strength,
    improvement,
  }
}

/** 7. 멀티미디어 (7점) */
function analyzeMultimedia(content: string): { category: SeoCategory; strength?: string; improvement?: string; imageCount: number } {
  // [이미지: 설명] (직접 작성) 및 [이미지] (URL 스크래핑 시 위치 마커) 모두 감지
  const imageMatches = content.match(/\[이미지[\]:\s]/g) || []
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
function analyzeReadabilityElements(content: string, scrapedMeta?: SeoScrapedMeta): { category: SeoCategory; strength?: string; improvement?: string } {
  let score = 0
  // 마크다운 서식 또는 스크래핑된 서식 데이터 활용
  const hasBold = content.includes('**') || (scrapedMeta?.formatting?.hasBold ?? false)
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

  // 관련 키워드 없으면 0점 처리 (무상 점수 폐지)
  return {
    category: {
      id: 'related_keywords',
      name: '관련 키워드',
      score: 0,
      maxScore: 8,
      details: '관련 키워드 미지정 (0점)',
      priority: 'high',
    },
    improvement: '추가 키워드를 지정하여 콘텐츠 주제 관련성을 높이세요',
  }
}

/** 10. 태그 & CTA (7점) */
function analyzeTagsAndCta(content: string, scrapedMeta?: SeoScrapedMeta): { category: SeoCategory; strength?: string; improvement?: string } {
  let score = 0
  const hasHashtags = content.includes('#')
  const hasCta = /댓글|공감|구독|팔로우|즐겨찾기|공유|좋아요/i.test(content)

  // 본문 내 해시태그 또는 스크래핑된 태그 활용
  const contentTagCount = (content.match(/#[가-힣a-zA-Z0-9_]+/g) || []).length
  const scrapedTagCount = scrapedMeta?.tags?.length ?? 0
  const tagCount = Math.max(contentTagCount, scrapedTagCount)
  const hasTags = hasHashtags || scrapedTagCount > 0

  if (hasTags) {
    if (tagCount >= 5) score += 4
    else if (tagCount >= 3) score += 3
    else score += 1
  }

  if (hasCta) {
    score += 3
  }

  const improvements: string[] = []
  if (!hasTags) improvements.push('관련 태그(#)를 5~10개 추가하세요')
  if (!hasCta) improvements.push('마무리에 댓글/공감 유도 문구를 추가하세요')

  return {
    category: {
      id: 'tags_cta',
      name: '태그 & CTA',
      score,
      maxScore: 7,
      details: `태그(${hasTags ? `${tagCount}개` : 'X'}), CTA(${hasCta ? 'O' : 'X'})`,
      priority: score < 4 ? 'medium' : 'low',
    },
    strength: hasCta ? '독자 참여 유도 문구 포함' : undefined,
    improvement: improvements[0],
  }
}

/** 11. 내부 링크 (10점) - 신규 */
function analyzeInternalLinks(content: string): { category: SeoCategory; strength?: string; improvement?: string; internalCount: number; externalCount: number } {
  // 마크다운 링크에서 URL 추출: [text](url) → url
  const mdLinkUrls: string[] = []
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let mdMatch: RegExpExecArray | null
  while ((mdMatch = mdLinkRegex.exec(content)) !== null) {
    mdLinkUrls.push(mdMatch[2])  // URL 부분만 추출
  }

  // HTML 링크에서 URL 추출: <a href="url"> → url
  const htmlLinkUrls: string[] = []
  const htmlLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi
  let htmlMatch: RegExpExecArray | null
  while ((htmlMatch = htmlLinkRegex.exec(content)) !== null) {
    htmlLinkUrls.push(htmlMatch[1])
  }

  const allUrls = [...mdLinkUrls, ...htmlLinkUrls]

  // 내부/외부 분류
  let internalCount = 0
  let externalCount = 0

  for (const url of allUrls) {
    // 내부 링크: 상대 경로(./), 루트 경로(/), #앵커, blog.naver.com
    if (/blog\.naver\.com/i.test(url) || /^(\.\/|\.\.\/|\/|#)/.test(url)) {
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
  additionalKeywords?: string[],
  scrapedMeta?: SeoScrapedMeta,
): SeoAnalysisResult {
  const categories: SeoCategory[] = []
  const strengths: string[] = []
  const improvements: string[] = []

  // 13개 항목 분석 실행 (스크래핑 데이터 있으면 태그/서식 정보 활용)
  const results = [
    analyzeTitleKeyword(keyword, title),
    analyzeTitleLength(title),
    analyzeHeadingStructure(content),
    analyzeKeywordDensity(keyword, content),
    analyzeKeywordDistribution(keyword, content),
    analyzeContentLength(content),
    analyzeMultimedia(content),
    analyzeReadabilityElements(content, scrapedMeta),
    analyzeRelatedKeywords(content, additionalKeywords),
    analyzeTagsAndCta(content, scrapedMeta),
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

  // 총점 계산 (기본 13항목)
  const baseScore = categories.reduce((sum, c) => sum + c.score, 0)

  // 광고성 키워드 감점 적용
  const adCheck = detectAdKeywords(content, scrapedMeta?.tags)
  let penaltyScore = adCheck.penalty

  // 문장 반복 스팸 감점 (-5점 max)
  const repCheck = detectSentenceRepetition(content)
  penaltyScore += repCheck.penalty
  if (repCheck.warning) {
    improvements.unshift(repCheck.warning)
  }

  // 불용어 과다 감점 (-4점 max)
  const stopCheck = detectStopwordDensity(content)
  penaltyScore += stopCheck.penalty
  if (stopCheck.warning) {
    improvements.unshift(stopCheck.warning)
  }

  const totalScore = Math.max(0, baseScore + penaltyScore)
  if (adCheck.warning) {
    improvements.unshift(adCheck.warning)
  }

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

// ===== 광고성 키워드 감지 =====

/** 광고성/제휴 키워드 (블로그 지수 모듈과 동일 기준) */
const AD_KEYWORDS = [
  '제휴마케팅', '제휴링크', '쿠팡파트너스', '파트너스활동', '일정액의수수료',
  '소정의원고료', '원고료를제공', '업체로부터제공', '무상으로제공', '협찬',
  '광고포함', '유료광고', '#광고', '#협찬', '#제공',
]

/** 상업적/홍보성 키워드 (네이버 D.I.A. 감점 대상) */
const COMMERCIAL_KEYWORDS = [
  '최저가', '구매링크', '바로가기', '무료체험', '당첨자발표',
  '할인코드', '쿠폰코드', '프로모션코드', '제휴할인',
  '원고료', '소정의대가', '경제적대가',
]

/**
 * 광고성 키워드 감지
 * - 감점: 광고 키워드 3개 이상 → -3점, 5개 이상 → -5점
 * - 상업적 키워드 2개 이상 추가 감점 -2점
 */
function detectAdKeywords(content: string, tags?: string[]): { penalty: number; warning?: string; details: string[] } {
  const normalizedContent = content.replace(/\s/g, '').toLowerCase()
  const normalizedTags = (tags || []).join(' ').replace(/\s/g, '').toLowerCase()

  const foundAd: string[] = []
  const foundCommercial: string[] = []

  for (const kw of AD_KEYWORDS) {
    const normalized = kw.replace(/\s/g, '').toLowerCase()
    if (normalizedContent.includes(normalized) || normalizedTags.includes(normalized)) {
      foundAd.push(kw)
    }
  }

  for (const kw of COMMERCIAL_KEYWORDS) {
    const normalized = kw.replace(/\s/g, '').toLowerCase()
    if (normalizedContent.includes(normalized)) {
      foundCommercial.push(kw)
    }
  }

  let penalty = 0
  const details: string[] = []

  if (foundAd.length >= 5) {
    penalty -= 5
    details.push(`광고성 키워드 ${foundAd.length}개 감지 (-5)`)
  } else if (foundAd.length >= 3) {
    penalty -= 3
    details.push(`광고성 키워드 ${foundAd.length}개 감지 (-3)`)
  } else if (foundAd.length >= 1) {
    details.push(`광고성 키워드 ${foundAd.length}개 감지 (경고)`)
  }

  if (foundCommercial.length >= 2) {
    penalty -= 2
    details.push(`상업적 키워드 ${foundCommercial.length}개 감지 (-2)`)
  }

  const allFound = [...foundAd, ...foundCommercial]
  const warning = allFound.length > 0
    ? `광고성/상업적 키워드 감지: ${allFound.slice(0, 5).join(', ')}${allFound.length > 5 ? ` 외 ${allFound.length - 5}개` : ''} — 네이버 D.I.A. 알고리즘이 검색 노출을 제한할 수 있습니다`
    : undefined

  return { penalty, warning, details }
}

// ===== 문장 반복 스팸 감지 =====

/**
 * 포스트 내 문장 반복 감지
 * - 동일 문장이 반복되면 글자수 부풀리기/AI 저품질 콘텐츠 의심
 * - 감점: 20%+ 반복 → -3점, 40%+ 반복 → -5점
 */
function detectSentenceRepetition(content: string): { penalty: number; warning?: string } {
  // 마크다운 헤더/이미지/링크 제거 후 문장 분리
  const plain = content
    .replace(/^#{1,3}\s+.+$/gm, '')
    .replace(/\[이미지[:\]][^\]]*\]?/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  const sentences = plain.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length >= 10)
  if (sentences.length < 6) return { penalty: 0 }

  const freq: Record<string, number> = {}
  sentences.forEach(s => { freq[s] = (freq[s] || 0) + 1 })
  const duplicateCount = Object.values(freq).reduce((sum, c) => sum + (c > 1 ? c - 1 : 0), 0)
  const repeatRate = duplicateCount / sentences.length

  if (repeatRate >= 0.4) {
    return {
      penalty: -5,
      warning: `문장 반복 심각: 동일 문장 ${Math.round(repeatRate * 100)}% 반복 — 네이버가 저품질 콘텐츠로 판정할 수 있습니다`,
    }
  }
  if (repeatRate >= 0.2) {
    return {
      penalty: -3,
      warning: `문장 반복 주의: 동일 문장 ${Math.round(repeatRate * 100)}% 반복 — 다양한 표현으로 변경하세요`,
    }
  }
  return { penalty: 0 }
}

// ===== 불용어 과다 감지 =====

/**
 * 불용어(의미 없는 단어) 비율 감지
 * - 불용어가 전체 단어의 60% 이상이면 경고
 * - 감점: 60%+ → -2점, 70%+ → -4점
 * - 자주 사용된 불용어 Top 5를 구체적으로 안내
 */
function detectStopwordDensity(content: string): { penalty: number; warning?: string } {
  // 마크다운/HTML 태그 제거 후 순수 텍스트 추출
  const plain = content
    .replace(/^#{1,3}\s+.+$/gm, '')
    .replace(/\[이미지[:\]][^\]]*\]?/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[#*_~`>]/g, '')
    .trim()

  // 한글 단어 추출 (2글자 이상)
  const allWords = plain.match(/[가-힣]{2,}/g) || []
  if (allWords.length < 20) return { penalty: 0 } // 너무 짧은 글은 제외

  // 불용어 빈도 집계
  const stopwordFreq: Record<string, number> = {}
  let stopCount = 0

  for (const word of allWords) {
    if (STOPWORDS.has(word)) {
      stopCount++
      stopwordFreq[word] = (stopwordFreq[word] || 0) + 1
    }
  }

  const ratio = stopCount / allWords.length

  if (ratio < 0.6) return { penalty: 0 }

  // Top 5 빈출 불용어
  const topWords = Object.entries(stopwordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w, c]) => `${w}(${c}회)`)
    .join(', ')

  if (ratio >= 0.7) {
    return {
      penalty: -4,
      warning: `불용어 과다 (${Math.round(ratio * 100)}%): ${topWords} — 의미 있는 정보 중심으로 문장을 다듬으세요`,
    }
  }

  return {
    penalty: -2,
    warning: `불용어 비율 높음 (${Math.round(ratio * 100)}%): ${topWords} — 불필요한 수식어를 줄이고 핵심 내용에 집중하세요`,
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
  const imageCount = (content.match(/\[이미지[\]:\s]/g) || []).length

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
