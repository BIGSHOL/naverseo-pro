/**
 * NaverSEO Pro - 콘텐츠 생성 엔진
 *
 * 네이버 블로그 SEO에 최적화된 콘텐츠를 생성하는 핵심 엔진
 *
 * 주요 기능:
 * 1. 콘텐츠 유형 자동 분류 (정보형/비교형/후기형/방법형/리스트형)
 * 2. SEO 최적화 프롬프트 자동 생성
 * 3. 네이버 C-Rank / D.I.A. 알고리즘 최적화
 * 4. 고급 SEO 점수 분석 (100점 만점, 10개 항목)
 * 5. 가독성 분석 (한국어 특화)
 * 6. 태그 자동 생성
 * 7. 메타 설명 자동 생성
 */

import { analyzeSeo, analyzeReadability, type SeoAnalysisResult, type ReadabilityResult } from '@/lib/seo/engine'
import { STOPWORDS } from '@/lib/utils/text'

// ===== 타입 정의 =====

/** 콘텐츠 유형 */
export type ContentType =
  | 'informational'  // 정보형: ~란?, ~이란, ~알아보기
  | 'comparison'     // 비교형: ~추천, ~비교, ~순위, ~TOP
  | 'review'         // 후기형: ~후기, ~리뷰, ~솔직후기
  | 'howto'          // 방법형: ~방법, ~하는법, ~하기
  | 'listicle'       // 리스트형: ~가지, ~선, ~BEST

/** 콘텐츠 생성 요청 파라미터 */
export interface ContentGenerationRequest {
  keyword: string
  tone?: string               // 톤앤매너 (기본: 친근하고 정보적인)
  additionalKeywords?: string[] // 관련 키워드
  contentType?: ContentType    // 자동 감지 또는 수동 지정
  targetLength?: 'short' | 'medium' | 'long' // 짧은(1000자), 중간(2000자), 긴(3000자+)
  includeImages?: boolean      // 이미지 위치 표시 여부 (기본: true)
  includeFaq?: boolean         // FAQ 섹션 포함 여부 (기본: true)
}

/** 생성된 콘텐츠 결과 */
export interface ContentGenerationResult {
  title: string
  content: string
  tags: string[]
  metaDescription: string
  contentType: ContentType
  contentTypeName: string
  outline: ContentOutline
  seoAnalysis: SeoAnalysisResult
  readabilityAnalysis: ReadabilityResult
  isDemo: boolean
}

/** 콘텐츠 아웃라인 */
export interface ContentOutline {
  sections: OutlineSection[]
  estimatedLength: number
  keywordPlacements: string[]
}

export interface OutlineSection {
  heading: string
  level: 2 | 3
  keyPoints: string[]
}

// SEO 분석 타입 및 함수는 독립 모듈에서 re-export (호환성 유지)
export { analyzeSeo, analyzeReadability } from '@/lib/seo/engine'
export type { SeoAnalysisResult, SeoCategory, ReadabilityResult } from '@/lib/seo/engine'

// ===== 콘텐츠 유형 감지 =====

const CONTENT_TYPE_PATTERNS: Record<ContentType, RegExp[]> = {
  comparison: [
    /추천/i, /비교/i, /순위/i, /TOP\s?\d/i, /BEST/i,
    /선택/i, /고르/i, /랭킹/i, /vs/i,
  ],
  review: [
    /후기/i, /리뷰/i, /솔직/i, /체험/i, /사용기/i,
    /경험/i, /실제/i, /착용/i, /먹어/i,
  ],
  howto: [
    /방법/i, /하는\s?법/i, /하기/i, /따라/i, /시작/i,
    /가이드/i, /설치/i, /만들/i, /셋팅/i, /설정/i,
  ],
  listicle: [
    /\d+가지/i, /\d+선/i, /\d+개/i, /모음/i, /총정리/i,
    /리스트/i, /체크리스트/i, /목록/i,
  ],
  informational: [
    /이란/i, /뜻/i, /의미/i, /알아보/i, /정리/i,
    /개념/i, /차이/i, /종류/i, /특징/i, /효과/i, /효능/i,
  ],
}

const CONTENT_TYPE_NAMES: Record<ContentType, string> = {
  informational: '정보형',
  comparison: '비교/추천형',
  review: '후기/리뷰형',
  howto: '방법/가이드형',
  listicle: '리스트형',
}

export function detectContentType(keyword: string): ContentType {
  let bestType: ContentType = 'informational'
  let bestScore = 0

  for (const [type, patterns] of Object.entries(CONTENT_TYPE_PATTERNS) as [ContentType, RegExp[]][]) {
    let score = 0
    for (const pattern of patterns) {
      if (pattern.test(keyword)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestType = type
    }
  }

  return bestType
}

// ===== 프롬프트 엔지니어링 =====

/** 콘텐츠 유형별 구조 가이드 */
const STRUCTURE_GUIDES: Record<ContentType, string> = {
  informational: `구조:
1. 도입부: 키워드에 대한 궁금증을 유발하는 질문으로 시작
2. 본론 1: 핵심 개념/정의 설명 (이해하기 쉬운 예시 포함)
3. 본론 2: 세부 분류/종류/특징 정리 (표 또는 리스트 활용)
4. 본론 3: 실제 활용법/주의사항
5. 정리: 핵심 내용 3줄 요약 + 관련 글 유도`,

  comparison: `구조:
1. 도입부: "어떤 것을 선택해야 할지 고민이시죠?" 식의 공감 시작
2. 선정 기준 설명: 비교 기준을 먼저 제시
3. 추천 항목별 상세 분석 (각 항목마다 H3 소제목)
   - 장점/단점 명시
   - 가격/성능/특징 비교
4. 비교표: 한눈에 보는 비교 (표 형태)
5. 결론: 상황별 추천 (예산별, 용도별)`,

  review: `구조:
1. 도입부: "직접 OO 써봤습니다" 식의 경험 시작
2. 기본 정보: 제품/서비스 소개, 구매처, 가격
3. 실사용 후기: 첫 인상 → 장기 사용 → 장단점
   - 구체적 수치, 날짜 등 포함
4. 사진/스크린샷 위치 표시
5. 총평: 별점 + 한줄 평가 + 추천 대상`,

  howto: `구조:
1. 도입부: "이 글을 읽으면 OO을 할 수 있습니다" 기대효과 제시
2. 준비물/전제조건 정리
3. 단계별 가이드 (Step 1, 2, 3...)
   - 각 단계마다 구체적 설명
   - 주의사항 및 팁
4. 자주 하는 실수 & 해결법
5. 마무리: 핵심 요약 + 다음 단계 안내`,

  listicle: `구조:
1. 도입부: "OO가지를 엄선했습니다" 식의 가치 제안
2. 리스트 항목 (번호 매기기)
   - 각 항목에 H3 소제목
   - 2~3문장 설명 + 이미지 위치
   - 핵심 포인트 볼드 처리
3. 보너스 팁 (추가 1~2개)
4. 마무리: 독자 참여 유도 (댓글, 공감)`,
}

/** 톤앤매너 가이드 */
function getToneGuide(tone: string): string {
  const toneMap: Record<string, string> = {
    '친근하고 정보적인': '친구에게 설명하듯 편안하면서도 전문적인 정보를 전달하는 톤. "~해요", "~인데요" 체를 사용.',
    '전문적인': '전문가의 관점에서 깊이 있게 분석하는 톤. "~입니다", "~됩니다" 체를 사용. 데이터와 근거 중심.',
    '재미있는': '유머와 비유를 적절히 섞어 읽는 재미가 있는 톤. 이모티콘이나 감탄사 활용.',
    '솔직한': '개인적 경험을 솔직하게 공유하는 톤. 장점과 단점을 균형 있게 서술.',
  }

  return toneMap[tone] || toneMap['친근하고 정보적인']
}

/** 콘텐츠 길이별 가이드 */
function getLengthGuide(length: 'short' | 'medium' | 'long'): string {
  switch (length) {
    case 'short': return '본문 1,000~1,500자. 핵심만 간결하게.'
    case 'medium': return '본문 2,000~2,500자. 네이버 블로그 최적 길이.'
    case 'long': return '본문 3,000~4,000자. 깊이 있는 전문 콘텐츠.'
    default: return '본문 2,000~2,500자. 네이버 블로그 최적 길이.'
  }
}

/**
 * AI에 보낼 최적화된 시스템 프롬프트 생성
 */
export function buildSystemPrompt(request: ContentGenerationRequest): string {
  const contentType = request.contentType || detectContentType(request.keyword)
  const typeName = CONTENT_TYPE_NAMES[contentType]
  const structure = STRUCTURE_GUIDES[contentType]
  const toneGuide = getToneGuide(request.tone || '친근하고 정보적인')
  const lengthGuide = getLengthGuide(request.targetLength || 'medium')

  return `당신은 네이버 블로그 SEO 전문 작가입니다.
네이버 C-Rank와 D.I.A. 알고리즘에 최적화된 블로그 글을 작성합니다.

## 이번 콘텐츠 유형: ${typeName}

## 톤앤매너
${toneGuide}

## 분량
${lengthGuide}

## ${typeName} 콘텐츠 ${structure}

## 네이버 SEO 최적화 규칙

### 제목 최적화
- 핵심 키워드를 제목 앞쪽(처음 15자 이내)에 배치
- 제목 길이: 20~40자 (네이버 검색 결과에서 잘리지 않는 길이)
- 클릭을 유도하는 수식어 활용: 완벽 가이드, 총정리, BEST, 실제 후기, ${new Date().getFullYear()}년 등
- 숫자 활용: "5가지 방법", "TOP 7", "3분만에" 등

### 키워드 배치 전략
- 핵심 키워드: 제목, 첫 문단, 중간 소제목, 마지막 문단에 자연스럽게 포함
- 키워드 밀도: 전체 대비 1~2% (과다하면 스팸으로 판단됨)
- 관련 키워드: 동의어, 유사어를 골고루 사용하여 주제 전문성 표현
- 키워드를 본문 전체에 균등 분포 (앞쪽에만 몰리면 안 됨)

### 콘텐츠 품질 (D.I.A. 최적화)
- 독창적이고 경험 기반의 내용 작성 (단순 정보 나열 금지)
- 구체적 수치, 날짜, 가격 등 정확한 정보 포함
- 핵심 내용은 **볼드** 처리하여 스캔 가능하게
- 적절한 이미지 삽입 위치: [이미지: 설명] 형태로 3~5개
- 리스트(- )와 번호(1. ) 활용으로 가독성 향상

### 구조 최적화
- 소제목(## H2, ### H3)으로 논리적 구조화 (H2 3~5개, 필요 시 H3 추가)
- 도입-본문-정리 3단 구조 유지
- 각 문단은 2~4문장으로 짧게 (모바일 가독성)
- 문장 길이: 40자 이내 권장 (한국어 기준)

### 태그 & 마무리
- 본문 마지막에 관련 태그 7~10개 제안 (#키워드 형태)
- 독자 참여 유도 문구로 마무리 (댓글, 공감 유도)

### 2025-2026 최신 트렌드
- **질문형 소제목** 활용: "~방법" 대신 "~어떻게 해야 하나요?" 형태의 질문형 소제목 사용
- **경험 정보 강화**: 직접 체험, 구체적 수치, 개인 의견 등 대체 불가능한 정보 포함
- **VLM 시각 최적화**: 문단 2~3문장 단위 호흡, 이미지와 텍스트의 맥락 정합성
- **권위 있는 출처 인용**: 통계, 공식 발표 등 객관적 근거 제시
- **주제 심도 집중**: 양보다 밀도, 하나의 주제에 대한 깊이 있는 정보

## 응답 형식 (JSON)
반드시 유효한 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 출력합니다.
{
  "title": "블로그 제목",
  "content": "블로그 본문 (마크다운 형식)",
  "tags": ["태그1", "태그2", ...],
  "metaDescription": "검색 결과에 표시될 1~2문장 요약 (120자 이내)"
}`
}

/**
 * AI에 보낼 유저 프롬프트 생성
 */
export function buildUserPrompt(request: ContentGenerationRequest): string {
  const contentType = request.contentType || detectContentType(request.keyword)
  const typeName = CONTENT_TYPE_NAMES[contentType]

  let prompt = `타겟 키워드: "${request.keyword}"
콘텐츠 유형: ${typeName}
톤앤매너: ${request.tone || '친근하고 정보적인'}`

  if (request.additionalKeywords && request.additionalKeywords.length > 0) {
    prompt += `\n관련 키워드 (본문에 자연스럽게 포함): ${request.additionalKeywords.join(', ')}`
  }

  if (request.includeFaq !== false) {
    prompt += `\n\n본문 하단에 "자주 묻는 질문 (FAQ)" 섹션도 포함해주세요 (3~4개 질문).`
  }

  prompt += `\n\n위 키워드로 네이버 블로그 SEO에 최적화된 ${typeName} 글을 작성해주세요.`

  return prompt
}

// ===== 아웃라인 생성 =====

/**
 * 콘텐츠 아웃라인 자동 생성 (AI 호출 없이 로컬에서 생성)
 */
export function generateOutline(request: ContentGenerationRequest): ContentOutline {
  const contentType = request.contentType || detectContentType(request.keyword)
  const keyword = request.keyword
  const sections: OutlineSection[] = []

  switch (contentType) {
    case 'informational':
      sections.push(
        { heading: `${keyword}이란? 핵심 개념 정리`, level: 2, keyPoints: ['정의', '역사/배경', '왜 중요한지'] },
        { heading: `${keyword}의 종류와 특징`, level: 2, keyPoints: ['분류 기준', '각 종류별 설명', '비교표'] },
        { heading: `${keyword} 활용법`, level: 2, keyPoints: ['실전 적용', '주의사항', '팁'] },
        { heading: `${keyword} 관련 자주 묻는 질문`, level: 2, keyPoints: ['FAQ 3~4개'] },
      )
      break
    case 'comparison':
      sections.push(
        { heading: `${keyword} 선정 기준`, level: 2, keyPoints: ['비교 항목', '평가 방법'] },
        { heading: `${keyword} TOP 추천 리스트`, level: 2, keyPoints: ['각 항목 상세'] },
        { heading: `한눈에 보는 비교표`, level: 2, keyPoints: ['가격/성능/특징 비교'] },
        { heading: `상황별 추천 정리`, level: 2, keyPoints: ['예산별', '용도별'] },
      )
      break
    case 'review':
      sections.push(
        { heading: `${keyword} 기본 정보`, level: 2, keyPoints: ['소개', '가격', '구매처'] },
        { heading: `실제 사용 후기`, level: 2, keyPoints: ['첫 인상', '장기 사용감'] },
        { heading: `장점과 단점`, level: 2, keyPoints: ['장점 3가지', '단점 2가지'] },
        { heading: `총평 및 추천 대상`, level: 2, keyPoints: ['별점', '추천 대상'] },
      )
      break
    case 'howto':
      sections.push(
        { heading: `${keyword} 시작하기 전 준비`, level: 2, keyPoints: ['필요한 것', '전제 조건'] },
        { heading: `${keyword} 단계별 가이드`, level: 2, keyPoints: ['Step 1~5'] },
        { heading: `자주 하는 실수 & 해결법`, level: 2, keyPoints: ['실수 3가지', '해결법'] },
        { heading: `마무리 및 다음 단계`, level: 2, keyPoints: ['요약', '심화 학습'] },
      )
      break
    case 'listicle':
      sections.push(
        { heading: `${keyword} 엄선 리스트`, level: 2, keyPoints: ['선정 기준 간략 설명'] },
        { heading: `리스트 항목 1~N`, level: 2, keyPoints: ['각 항목 소제목 + 설명'] },
        { heading: `보너스 팁`, level: 2, keyPoints: ['추가 정보'] },
        { heading: `마무리`, level: 2, keyPoints: ['핵심 요약', '참여 유도'] },
      )
      break
  }

  const targetLength = request.targetLength || 'medium'
  const estimatedLength = targetLength === 'short' ? 1200 : targetLength === 'long' ? 3500 : 2200

  const keywordPlacements = [
    '제목 (앞쪽 배치)',
    '첫 번째 문단 (도입부)',
    ...sections.map(s => `소제목: ${s.heading}`),
    '마지막 문단 (정리)',
  ]

  return { sections, estimatedLength, keywordPlacements }
}

// ===== 태그 자동 생성 =====

/**
 * 콘텐츠에서 자동으로 태그 생성 (AI 응답 태그와 병합용)
 */
export function generateAutoTags(keyword: string, content: string, maxTags: number = 10): string[] {
  const tags = new Set<string>()

  // 기본: 핵심 키워드
  tags.add(keyword)

  // 키워드 변형 태그
  const suffixes = ['추천', '방법', '후기', '가이드', '정보', '비교', '총정리']
  for (const suffix of suffixes) {
    if (content.includes(keyword + suffix) || content.includes(keyword + ' ' + suffix)) {
      tags.add(keyword + suffix)
    }
  }

  // 본문에서 자주 등장하는 2~4글자 한국어 명사 추출
  const koreanWords = content.match(/[가-힣]{2,4}/g) || []
  const wordFreq: Record<string, number> = {}
  for (const word of koreanWords) {
    if (!STOPWORDS.has(word) && word !== keyword) {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    }
  }

  // 빈도 상위 단어를 태그로 추가
  const sorted = Object.entries(wordFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])

  for (const [word] of sorted) {
    if (tags.size >= maxTags) break
    tags.add(word)
  }

  // 부족하면 일반 키워드 태그 추가
  if (tags.size < 5) {
    for (const suffix of suffixes) {
      if (tags.size >= maxTags) break
      tags.add(keyword + suffix)
    }
  }

  return Array.from(tags).slice(0, maxTags)
}

// ===== 메타 설명 생성 =====

/**
 * 검색 결과에 표시될 메타 설명 자동 생성
 */
export function generateMetaDescription(keyword: string, content: string): string {
  // 본문에서 키워드가 포함된 첫 번째 문장 찾기
  const sentences = content
    .replace(/^#{1,3}\s.+$/gm, '') // 제목 제거
    .replace(/\[이미지[^\]]*\]/g, '') // 이미지 태그 제거
    .replace(/\*\*/g, '') // 볼드 제거
    .split(/[.!?。]\s/)
    .map(s => s.trim())
    .filter(s => s.length >= 20 && s.length <= 100)

  const keywordSentence = sentences.find(s => s.includes(keyword))
  const firstSentence = keywordSentence || sentences[0] || ''

  if (firstSentence.length > 120) {
    return firstSentence.substring(0, 117) + '...'
  }

  // 너무 짧으면 두 번째 문장도 추가
  if (firstSentence.length < 60 && sentences.length > 1) {
    const combined = firstSentence + '. ' + (sentences[1] || '')
    return combined.length > 120 ? combined.substring(0, 117) + '...' : combined
  }

  return firstSentence
}

// ===== 데모 콘텐츠 생성 (개선 버전) =====

/**
 * API 키 없을 때 사용하는 데모 콘텐츠 생성
 */
export function generateDemoContent(request: ContentGenerationRequest): ContentGenerationResult {
  const keyword = request.keyword
  const contentType = request.contentType || detectContentType(keyword)
  const typeName = CONTENT_TYPE_NAMES[contentType]
  const outline = generateOutline(request)

  let title: string
  let content: string

  switch (contentType) {
    case 'comparison':
      title = `${keyword} TOP 5 완벽 비교 (${new Date().getFullYear()}년 최신)`
      content = generateDemoComparisonContent(keyword)
      break
    case 'review':
      title = `${keyword} 솔직 후기: 3개월 사용 리얼 리뷰`
      content = generateDemoReviewContent(keyword)
      break
    case 'howto':
      title = `${keyword} 완벽 가이드: 초보자도 5분만에 따라하기`
      content = generateDemoHowtoContent(keyword)
      break
    case 'listicle':
      title = `${keyword} 꼭 알아야 할 7가지 총정리`
      content = generateDemoListicleContent(keyword)
      break
    default:
      title = `${keyword} 완벽 정리: 개념부터 활용법까지 한눈에`
      content = generateDemoInfoContent(keyword)
  }

  const tags = generateAutoTags(keyword, content)
  const metaDescription = generateMetaDescription(keyword, content)
  const seoAnalysis = analyzeSeo(keyword, title, content, request.additionalKeywords)
  const readabilityAnalysis = analyzeReadability(content)

  return {
    title,
    content,
    tags,
    metaDescription,
    contentType,
    contentTypeName: typeName,
    outline,
    seoAnalysis,
    readabilityAnalysis,
    isDemo: true,
  }
}

// ----- 유형별 데모 콘텐츠 -----

function generateDemoInfoContent(keyword: string): string {
  return `## ${keyword}이란? 핵심 개념 완벽 정리

안녕하세요! 오늘은 많은 분들이 궁금해하시는 **${keyword}**에 대해 깊이 있게 알아보려고 합니다.

최근 **${keyword}**에 대한 관심이 급격히 높아지고 있는데요, 정확한 정보를 모르고 시작하면 시행착오를 겪기 쉽습니다. 이 글 하나로 ${keyword}의 A부터 Z까지 완벽하게 정리해드리겠습니다.

[이미지: ${keyword} 관련 대표 이미지]

## ${keyword}의 정의와 역사

**${keyword}**는 간단히 말해 효율적이고 체계적인 접근 방법을 의미합니다. 2020년대 들어 디지털 전환이 가속화되면서 ${keyword}의 중요성은 더욱 커지고 있습니다.

기존의 전통적인 방식과 비교했을 때, ${keyword}는 다음과 같은 차별점이 있습니다:

- **시간 효율성**: 기존 대비 약 40% 시간 절감
- **비용 절감**: 불필요한 비용 요소 제거
- **결과 품질**: 데이터 기반의 정확한 의사결정

[이미지: ${keyword} 발전 과정 타임라인]

## ${keyword}의 종류와 특징

${keyword}는 크게 3가지 유형으로 나눌 수 있습니다.

### 1. 기본형 ${keyword}

초보자에게 적합한 형태로, 핵심 기능만 갖추고 있습니다. **입문 단계**에서 기초를 다지기에 최적입니다.

### 2. 표준형 ${keyword}

가장 많이 사용되는 형태로, 대부분의 상황에서 충분한 성능을 발휘합니다. **가성비가 가장 뛰어난** 선택지입니다.

### 3. 전문가형 ${keyword}

고급 사용자를 위한 형태로, 세밀한 커스터마이징이 가능합니다. 전문적인 결과물이 필요할 때 추천합니다.

[이미지: 유형별 비교 인포그래픽]

## ${keyword} 실전 활용법

실제로 ${keyword}를 활용할 때는 다음 순서로 진행하면 됩니다.

1. **목표를 명확하게 설정**합니다
2. **현재 상황을 정확히 분석**합니다
3. **적합한 유형을 선택**합니다
4. **단계별로 실행하고 결과를 측정**합니다

> 💡 **꿀팁**: ${keyword}를 처음 시작할 때는 기본형부터 시작하여 점진적으로 확장하는 것이 좋습니다.

## 자주 묻는 질문 (FAQ)

### Q. ${keyword}를 시작하기에 가장 좋은 시기는?
지금이 가장 좋은 시기입니다. 빨리 시작할수록 경험이 쌓이고, 더 나은 결과를 얻을 수 있습니다.

### Q. ${keyword}에 필요한 비용은?
기본형은 무료로 시작 가능하며, 표준형은 월 3~5만원 수준입니다.

### Q. ${keyword}의 효과는 얼마나 걸려야 나타나나요?
보통 2~4주 정도면 초기 효과를 체감할 수 있습니다. 꾸준히 3개월 이상 지속하면 눈에 띄는 변화를 경험하실 수 있습니다.

[이미지: FAQ 시각화]

## 마무리

오늘 **${keyword}**에 대해 개념부터 활용법까지 총정리해보았습니다. 핵심을 다시 정리하면:

1. ${keyword}는 3가지 유형이 있으며, 목적에 맞게 선택
2. 기본형부터 시작하여 점진적으로 확장
3. 꾸준한 실행이 성공의 핵심

이 글이 도움이 되셨다면 **공감**과 **댓글** 부탁드립니다! 궁금한 점은 댓글로 남겨주시면 답변드리겠습니다. 😊

#${keyword} #${keyword}정보 #${keyword}추천 #${keyword}방법 #${keyword}가이드 #${keyword}총정리 #초보자가이드`
}

function generateDemoComparisonContent(keyword: string): string {
  return `## ${keyword} 어떤 걸 선택해야 할까?

**${keyword}**를 찾고 계신가요? 수많은 선택지 중에서 어떤 것이 나에게 맞는지 고민되실 텐데요.

직접 5가지를 비교 분석하고, 상황별 추천까지 정리했습니다. 이 글 하나면 **${keyword}** 선택 고민이 끝납니다!

[이미지: ${keyword} TOP 5 비교 대표 이미지]

## 선정 기준

${keyword}를 비교할 때 가장 중요한 4가지 기준입니다:

- **가성비**: 가격 대비 성능
- **사용 편의성**: 초보자도 쉽게 사용 가능한지
- **기능 완성도**: 핵심 기능이 잘 갖춰져 있는지
- **고객 후기**: 실제 사용자들의 만족도

## ${keyword} TOP 5 비교

### 1. A 제품/서비스 ⭐ 추천

**가격**: 월 29,000원
**장점**: 가성비 최고, 초보자 친화적
**단점**: 고급 기능 부족

> "${keyword} 입문자에게 가장 추천하는 선택지입니다"

[이미지: A 제품 스크린샷]

### 2. B 제품/서비스

**가격**: 월 49,000원
**장점**: 균형 잡힌 기능, 안정적
**단점**: 디자인이 아쉬움

### 3. C 제품/서비스

**가격**: 월 59,000원
**장점**: 전문가급 기능, 커스터마이징 가능
**단점**: 학습 곡선이 높음

### 4. D 제품/서비스

**가격**: 월 19,000원
**장점**: 최저가, 핵심 기능 포함
**단점**: 고객 지원 부실

### 5. E 제품/서비스

**가격**: 월 79,000원
**장점**: 올인원 솔루션, 프리미엄 지원
**단점**: 가격이 부담

[이미지: TOP 5 비교표]

## 한눈에 보는 비교표

| 항목 | A | B | C | D | E |
|------|---|---|---|---|---|
| 가격 | ₩29,000 | ₩49,000 | ₩59,000 | ₩19,000 | ₩79,000 |
| 사용성 | ★★★★★ | ★★★★ | ★★★ | ★★★★ | ★★★★ |
| 기능 | ★★★★ | ★★★★ | ★★★★★ | ★★★ | ★★★★★ |
| 추천도 | ★★★★★ | ★★★★ | ★★★★ | ★★★ | ★★★★ |

## 상황별 추천

- **가성비 중시**: A 제품 추천 (월 29,000원으로 핵심 기능 모두 사용)
- **전문가용**: C 제품 추천 (고급 커스터마이징 가능)
- **예산 부담**: D 제품 추천 (최저가로 시작)
- **올인원**: E 제품 추천 (모든 기능 포함)

## 자주 묻는 질문

### Q. ${keyword} 무료 체험이 가능한가요?
대부분 7~14일 무료 체험을 제공합니다. A 제품은 30일 무료 체험이 가능합니다.

### Q. 중간에 변경할 수 있나요?
네, 대부분 월 단위 구독이라 언제든 변경 가능합니다.

### Q. 초보자에게 가장 추천하는 것은?
**A 제품**입니다. 직관적인 인터페이스와 합리적인 가격이 장점입니다.

## 마무리

**${keyword}** TOP 5를 비교해보았습니다. 개인적으로는 **A 제품**을 가장 추천드리지만, 상황에 따라 최적의 선택이 달라질 수 있습니다.

궁금한 점이 있으시면 **댓글**로 남겨주세요! 더 자세한 리뷰도 준비하겠습니다.

#${keyword} #${keyword}추천 #${keyword}비교 #${keyword}순위 #${keyword}TOP5 #${keyword}가격비교 #${new Date().getFullYear()}추천`
}

function generateDemoReviewContent(keyword: string): string {
  return `## ${keyword} 3개월 실사용 솔직 후기

안녕하세요! 오늘은 **${keyword}**를 3개월간 직접 사용해본 솔직한 후기를 공유합니다.

구매 전에 정보가 없어서 고민하시는 분들이 많을 텐데요, 장점과 단점 모두 솔직하게 정리했으니 참고해주세요!

[이미지: ${keyword} 실물 사진]

## 기본 정보

- **구매처**: 공식 홈페이지
- **구매 가격**: 39,900원 (할인가)
- **구매 시기**: ${new Date().getFullYear()}년 1월
- **사용 기간**: 약 3개월

## 첫 인상

처음 ${keyword}를 접했을 때 **패키징부터 깔끔하다**는 느낌을 받았습니다. 기대했던 것 이상으로 퀄리티가 좋았어요.

설정 과정은 약 10분 정도 소요되었고, 초보자도 충분히 따라할 수 있는 수준입니다.

[이미지: 첫 사용 과정]

## 3개월 장기 사용 후기

### 장점 3가지

1. **내구성이 뛰어납니다**: 3개월 매일 사용했는데도 처음과 동일한 성능을 유지하고 있습니다
2. **사용법이 직관적**: 복잡한 설명서 없이도 바로 사용 가능합니다
3. **고객 서비스 우수**: 문의 사항에 24시간 내 답변을 받을 수 있었습니다

### 단점 2가지

1. **가격이 다소 높은 편**: 비슷한 제품 대비 10~20% 비쌉니다 (하지만 품질을 생각하면 납득 가능)
2. **색상 옵션 부족**: 현재 3가지 색상만 제공됩니다

[이미지: 3개월 사용 후 상태]

## 다른 사용자들의 평가

온라인에서 확인한 다른 사용자들의 평가도 대체로 긍정적입니다:

- "처음 써봤는데 만족합니다" ⭐⭐⭐⭐⭐
- "가격만 좀 더 저렴하면 완벽" ⭐⭐⭐⭐
- "선물용으로도 좋아요" ⭐⭐⭐⭐⭐

## 총평

### 별점: ⭐⭐⭐⭐☆ (4.5/5)

**한줄평**: "${keyword}, 가격만 감수하면 후회 없는 선택입니다"

**추천 대상**:
- 처음 시작하는 분
- 품질을 중시하는 분
- 장기적으로 사용할 계획인 분

**비추천 대상**:
- 예산이 매우 제한적인 분
- 단기 사용만 필요한 분

[이미지: 총평 요약 인포그래픽]

## 마무리

3개월간 직접 사용해본 **${keyword}** 솔직 후기였습니다. 전반적으로 **만족스러운 경험**이었고, 재구매 의사도 있습니다.

궁금한 점이 있으시면 **댓글**로 물어봐 주세요! 아는 만큼 답변드리겠습니다. 😊

#${keyword} #${keyword}후기 #${keyword}리뷰 #${keyword}솔직후기 #${keyword}사용기 #3개월후기 #실사용리뷰`
}

function generateDemoHowtoContent(keyword: string): string {
  return `## ${keyword} 초보자 완벽 가이드

이 글을 끝까지 읽으시면 **${keyword}**를 혼자서도 완벽하게 할 수 있게 됩니다!

어렵게 느껴지시나요? 걱정 마세요. **5단계**로 나눠서 하나씩 따라하면 됩니다. 저도 처음에는 막막했지만, 이 방법대로 하니 30분 만에 성공했습니다.

[이미지: ${keyword} 완성 결과]

## 시작하기 전 준비할 것

${keyword}를 시작하기 전에 다음을 준비해주세요:

- **필수**: 기본 도구 (상세 설명 아래)
- **선택**: 참고 자료, 메모장
- **예상 소요 시간**: 약 30분~1시간

> ⚠️ **주의**: 준비 없이 바로 시작하면 중간에 막힐 수 있습니다. 준비물을 먼저 챙기세요!

## ${keyword} 5단계 가이드

### Step 1. 목표 설정하기 (5분)

가장 먼저 **구체적인 목표**를 설정합니다.

"${keyword}를 잘하고 싶다"보다는 "${keyword}로 OO한 결과를 얻겠다"처럼 구체적으로 설정하는 것이 중요합니다.

[이미지: 목표 설정 예시]

### Step 2. 기초 세팅하기 (10분)

다음으로 기본 환경을 세팅합니다:

1. 필요한 도구를 준비합니다
2. 설정을 확인합니다
3. 테스트를 진행합니다

### Step 3. 핵심 작업 진행하기 (15분)

여기가 가장 중요한 단계입니다.

- **포인트 1**: 순서를 반드시 지켜주세요
- **포인트 2**: 중간에 결과를 확인하세요
- **포인트 3**: 실수해도 괜찮습니다. 다시 하면 됩니다

[이미지: 핵심 작업 과정]

### Step 4. 결과 확인 및 수정 (5분)

작업이 완료되면 결과를 확인합니다.

체크리스트:
- [ ] 목표한 대로 되었는지 확인
- [ ] 오류나 문제가 없는지 점검
- [ ] 필요한 수정 사항 반영

### Step 5. 마무리 및 저장 (5분)

마지막으로 결과물을 저장하고 정리합니다.

> 💡 **꿀팁**: 완성 후 24시간 뒤에 다시 확인하면 놓친 부분을 발견할 수 있습니다.

## 자주 하는 실수 & 해결법

### 실수 1: 준비 없이 바로 시작
**해결법**: Step 1의 준비물 체크리스트를 꼭 확인하세요.

### 실수 2: 단계를 건너뛰기
**해결법**: 각 단계를 순서대로 진행하세요. 건너뛰면 나중에 문제가 발생합니다.

### 실수 3: 완벽주의
**해결법**: 80% 완성도면 충분합니다. 나머지는 경험이 쌓이면 자연스럽게 해결됩니다.

[이미지: 실수 해결 가이드]

## 마무리

오늘 **${keyword}**를 5단계로 쉽게 따라할 수 있는 가이드를 정리해보았습니다.

**핵심 요약:**
1. 목표를 구체적으로 설정하고
2. 단계별로 차근차근 진행하면
3. 누구나 성공할 수 있습니다

도움이 되셨다면 **공감**과 **이웃 추가** 부탁드립니다! 다음에는 심화 가이드로 찾아뵐게요.

#${keyword} #${keyword}방법 #${keyword}하는법 #${keyword}가이드 #초보자가이드 #쉬운설명 #단계별가이드`
}

function generateDemoListicleContent(keyword: string): string {
  return `## ${keyword} 꼭 알아야 할 7가지

**${keyword}**에 대해 알아보고 계신가요? 수많은 정보 중에서 **꼭 알아야 할 핵심 7가지**만 엄선했습니다.

이 글 하나로 ${keyword}의 핵심을 빠르게 파악할 수 있습니다!

[이미지: ${keyword} 7가지 핵심 요약]

## 1. 기본 원리 이해하기

${keyword}의 가장 기본이 되는 원리입니다. **기초가 탄탄해야** 응용이 가능합니다.

핵심 포인트: 원리를 이해하면 나머지는 자연스럽게 따라옵니다.

## 2. 올바른 시작 방법

많은 분들이 **잘못된 방법으로 시작**하여 시간을 낭비합니다. 처음부터 올바르게 시작하는 것이 중요합니다.

- 첫째, 목표를 명확히 세우기
- 둘째, 기본 도구 준비하기
- 셋째, 작은 것부터 시작하기

[이미지: 올바른 시작 방법]

## 3. 가장 중요한 핵심 요소

${keyword}에서 **가장 중요한 것은 꾸준함**입니다. 한 번에 많이 하기보다 매일 조금씩 하는 것이 훨씬 효과적입니다.

## 4. 흔한 실수 피하기

초보자들이 가장 많이 하는 실수 3가지:

1. **너무 많은 것을 한 번에** 하려고 함
2. **다른 사람과 비교**하며 조급해함
3. **기록을 하지 않아** 진행 상황을 파악하지 못함

## 5. 효율을 높이는 팁

시간 대비 효과를 최대화하는 방법:

- **우선순위** 정하기
- **집중 시간** 활용하기 (25분 집중 + 5분 휴식)
- **불필요한 것은 과감히 제거**하기

[이미지: 효율 향상 팁]

## 6. 중급자로 레벨업하기

기초를 마스터했다면 다음 단계로 넘어갈 차례입니다:

- 심화 학습 시작
- 커뮤니티 참여
- 실전 프로젝트 도전

## 7. 지속하는 방법

**지속성이 곧 실력**입니다. 동기부여를 유지하는 방법:

- 작은 성과를 축하하기
- 같은 목표를 가진 동료 찾기
- 정기적으로 성장 기록 남기기

[이미지: 지속 방법 인포그래픽]

## 보너스 팁

위 7가지 외에 추가로 도움이 될 팁 2가지:

- **무료 리소스 활용**: 유료 교육 전에 무료 콘텐츠로 기초를 다지세요
- **실전이 최고의 학습**: 이론보다 직접 해보는 것이 10배 빠릅니다

## 마무리

**${keyword}**에 대해 꼭 알아야 할 7가지를 정리해보았습니다.

모든 것을 한 번에 다 할 필요는 없습니다. **하나씩 차근차근** 적용해보세요!

이 글이 도움이 되셨다면 **좋아요**와 **이웃 추가** 부탁드립니다. 궁금한 점은 **댓글**로 남겨주세요! 😊

#${keyword} #${keyword}정리 #${keyword}총정리 #${keyword}꿀팁 #${keyword}가이드 #알아야할것 #핵심정리`
}

// ===== 콘텐츠 후처리 =====

/**
 * AI가 생성한 콘텐츠를 후처리 (SEO 분석 + 가독성 분석 + 태그/메타 보강)
 */
export function postProcessContent(
  request: ContentGenerationRequest,
  aiResult: { title: string; content: string; tags: string[]; metaDescription?: string }
): ContentGenerationResult {
  const contentType = request.contentType || detectContentType(request.keyword)
  const typeName = CONTENT_TYPE_NAMES[contentType]
  const outline = generateOutline(request)

  // SEO 분석
  const seoAnalysis = analyzeSeo(
    request.keyword,
    aiResult.title,
    aiResult.content,
    request.additionalKeywords
  )

  // 가독성 분석
  const readabilityAnalysis = analyzeReadability(aiResult.content)

  // 태그 보강 (AI 태그 + 자동 태그 병합)
  const autoTags = generateAutoTags(request.keyword, aiResult.content)
  const mergedTags = Array.from(new Set([...aiResult.tags, ...autoTags])).slice(0, 10)

  // 메타 설명 (AI가 생성했으면 사용, 없으면 자동 생성)
  const metaDescription = aiResult.metaDescription || generateMetaDescription(request.keyword, aiResult.content)

  return {
    title: aiResult.title,
    content: aiResult.content,
    tags: mergedTags,
    metaDescription,
    contentType,
    contentTypeName: typeName,
    outline,
    seoAnalysis,
    readabilityAnalysis,
    isDemo: false,
  }
}
