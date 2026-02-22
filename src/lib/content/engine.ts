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
import { getFewShotExamples } from './examples'

// ===== 타입 정의 =====

/** 콘텐츠 유형 */
export type ContentType =
  | 'informational'  // 정보형: ~란?, ~이란, ~알아보기
  | 'comparison'     // 비교형: ~추천, ~비교, ~순위, ~TOP
  | 'review'         // 후기형: ~후기, ~리뷰, ~솔직후기
  | 'howto'          // 방법형: ~방법, ~하는법, ~하기
  | 'listicle'       // 리스트형: ~가지, ~선, ~BEST
  | 'local'          // 지역업종형: 침산동 수학학원, 강남역 맛집

/** 내 업체 홍보글용 업체 정보 */
export interface BusinessInfo {
  name: string              // 업체명 (필수)
  address?: string          // 위치/주소
  pricing?: string          // 가격 정보
  strengths?: string        // 강점/특징
  operatingHours?: string   // 운영 시간
  contact?: string          // 연락처/예약링크
  topic?: string            // 글 주제/소재 (자유 입력 - 핵심!)
}

/** 콘텐츠 생성 요청 파라미터 */
export interface ContentGenerationRequest {
  keyword: string
  tone?: string               // 톤앤매너 (기본: 친근하고 정보적인)
  additionalKeywords?: string[] // 관련 키워드
  contentType?: ContentType    // 자동 감지 또는 수동 지정
  targetLength?: 'short' | 'medium' | 'long' // 짧은(1000자), 중간(2000자), 긴(3000자+)
  includeImages?: boolean      // 이미지 위치 표시 여부 (기본: true)
  includeFaq?: boolean         // FAQ 섹션 포함 여부 (기본: true)
  businessInfo?: BusinessInfo  // 내 업체 홍보글 모드
  // 고급 옵션
  advancedOptions?: {
    // 구조/레이아웃
    imageCount?: number | 'auto'           // 이미지 개수 (2-5, 기본: auto)
    headingCount?: number | 'auto'         // 소제목 개수 (3-7, 기본: auto)
    structureRatio?: 'balanced' | 'intro-heavy' | 'content-heavy' // 글 구성 비율
    forcedSections?: string[]              // 강제 포함 섹션 (장단점, 가격표, 주의사항 등)
    // SEO/키워드
    keywordDensity?: 'natural' | 'moderate' | 'aggressive' // 키워드 밀도 (기본: moderate)
    internalLinkCount?: number | 'auto'    // 내부 링크 개수 (1-5, 기본: auto)
    // 스타일/형식
    forceListFormat?: boolean              // 리스트 형식 강제
    includeTable?: boolean                 // 표 포함
    useEmoji?: boolean                     // 이모지 사용
    includeQuotes?: boolean                // 인용구/팁박스 포함
    // 타겟 독자
    targetAudience?: 'beginner' | 'general' | 'expert' // 독자 수준
    ageGroup?: '10s' | '20-30s' | '40-50s' | '60+' | 'all' // 연령대
  }
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

const CONTENT_TYPE_PATTERNS: Record<Exclude<ContentType, 'local'>, RegExp[]> = {
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

// 지역 업종 감지 패턴 (위치 + 업종 둘 다 매칭되어야 local)
const LOCAL_LOCATION_PATTERNS: RegExp[] = [
  /[가-힣]{2,5}동(\s|$)/, // 침산동, 역삼동, 반포동
  /[가-힣]{2,5}구(\s|$)/, // 강남구, 해운대구
  /[가-힣]{2,5}시(\s|$)/, // 대구시, 부산시
  /[가-힣]{2,5}역(\s|$)/, // 강남역, 신촌역, 홍대역
  /[가-힣]{2,5}(군|읍|면)(\s|$)/, // 칠곡군, 다사읍
  /근처/, /주변/,
]

const LOCAL_BUSINESS_PATTERNS: RegExp[] = [
  // 교육
  /학원/, /과외/, /공부방/, /독서실/,
  // 의료
  /병원/, /치과/, /의원/, /한의원/, /약국/,
  /피부과/, /정형외과/, /안과/, /이비인후과/, /소아과/, /산부인과/,
  // 음식
  /맛집/, /카페/, /식당/, /음식점/, /술집/, /베이커리/, /빵집/, /분식/,
  // 뷰티
  /미용실/, /헤어/, /네일/, /피부관리/, /왁싱/,
  // 운동/레저
  /헬스/, /필라테스/, /요가/, /수영/, /체육관/, /골프/,
  // 생활서비스
  /부동산/, /인테리어/, /이사/, /세탁/, /세차/, /정비/, /수리/,
  // 숙박
  /호텔/, /모텔/, /펜션/, /숙소/, /게스트하우스/,
  // 교육/돌봄
  /유치원/, /어린이집/, /놀이방/, /돌봄/,
  // 전문직
  /변호사/, /법무사/, /회계사/, /세무사/,
  // 기타
  /꽃집/, /편의점/, /마트/, /사진/, /스튜디오/,
]

const CONTENT_TYPE_NAMES: Record<ContentType, string> = {
  informational: '정보형',
  comparison: '비교/추천형',
  review: '후기/리뷰형',
  howto: '방법/가이드형',
  listicle: '리스트형',
  local: '지역업종형',
}

export function detectContentType(keyword: string): ContentType {
  // 1. 지역 업종 키워드 우선 감지 (위치 + 업종 둘 다 있어야 함)
  const hasLocation = LOCAL_LOCATION_PATTERNS.some(p => p.test(keyword))
  const hasBusiness = LOCAL_BUSINESS_PATTERNS.some(p => p.test(keyword))
  if (hasLocation && hasBusiness) {
    return 'local'
  }

  // 2. 나머지 유형은 패턴 점수 기반 감지
  let bestType: ContentType = 'informational'
  let bestScore = 0

  for (const [type, patterns] of Object.entries(CONTENT_TYPE_PATTERNS) as [Exclude<ContentType, 'local'>, RegExp[]][]) {
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

/**
 * 지역 업종 키워드에서 지역명과 업종명을 분리
 * 예: "침산동 수학학원" → { location: "침산동", business: "수학학원" }
 */
function extractLocalParts(keyword: string): { location: string; business: string } {
  // 지역 패턴: 한글 2~5자 + (동/구/시/역/군/읍/면)
  const locationMatch = keyword.match(/[가-힣]{2,5}(동|구|시|역|군|읍|면)/)
  // "근처", "주변" 패턴도 처리
  const nearMatch = keyword.match(/(근처|주변)/)

  let location = ''
  let business = keyword

  if (locationMatch) {
    location = locationMatch[0]
    business = keyword.replace(location, '').trim()
  } else if (nearMatch) {
    location = nearMatch[0]
    business = keyword.replace(location, '').trim()
  }

  // 업종이 비어있으면 원래 키워드 사용
  if (!business) business = keyword
  if (!location) location = keyword.split(/\s/)[0]

  return { location, business }
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

  local: `구조:
1. 도입부: 해당 지역의 업종 현황과 선택 고민 공감 (예: "OO동에서 수학학원 찾고 계신가요?")
2. 추천 업체 TOP 3~5: 각 업체별 H3 소제목
   - 위치/접근성 (도보 몇 분, 주차 가능 여부)
   - 가격대/수업료/이용 요금
   - 특징/장점/차별점
   - 운영 시간/예약 방법
3. 선택 시 체크포인트: 해당 업종 고를 때 확인할 기준 리스트
4. 지역 꿀팁: 주변 시설 연계, 할인 정보, 체험 수업 안내 등
5. 자주 묻는 질문 (FAQ): 가격, 시간, 주차 등 실용 Q&A
6. 마무리: 핵심 요약 + 방문 전 체크리스트

⚠️ 중요 규칙 (절대 위반 금지!):
- 반드시 위 6단계 구조를 따를 것 (Step 1/2/3 같은 엉뚱한 템플릿 사용 금지)
- 구체적인 업체명·가격·위치를 포함할 것 (추상적 설명 금지)
- "목표 설정", "기초 세팅" 같은 범용 단계 사용 절대 금지
- 실제로 존재할 법한 현실적인 업체 정보를 작성 (검증 가능한 수준)`,
}

/** 홍보글 전용 구조 가이드 (businessInfo가 있을 때 local 대체) */
const LOCAL_PROMO_STRUCTURE_GUIDE = `구조:
1. 도입부: 업체 소개와 이야기 ("안녕하세요, OO입니다", "저희 OO을 소개합니다")
2. 업체 소개: 시작 계기, 철학, 분위기 (사장님/운영자 시점)
3. 서비스/상품 상세: 제공하는 서비스와 상품을 구체적으로 설명
   - 가격, 구성, 특징 등 실용 정보 포함
   - 사진 삽입 위치 표시
4. 고객 후기/사례: 실제 고객 만족 사례와 피드백 소개
5. 오시는 길 & 이용 안내: 주소, 운영시간, 예약 방법, 주차 정보 등
6. FAQ: 자주 궁금해할 질문 2~3개 (자연스러운 Q&A)
7. 마무리: 방문 안내 + 독자 참여 유도

중요 규칙:
- 업체 사장님/운영자가 직접 소개하는 따뜻하고 진정성 있는 톤으로 작성
- "최고", "대박" 등 과장 표현 최소화, 구체적 정보와 수치로 신뢰감 형성
- 다른 가상 업체를 나열하여 비교하지 말 것 (이 업체만 집중)
- 글 주제가 있으면 해당 주제에 맞는 구조로 자유롭게 변형 가능`

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
    case 'short': return '본문 800~1,200자. 핵심만 간결하게. 모바일 최적화.'
    case 'medium': return '본문 1,800~2,000자. **네이버 검색 알고리즘 최적 길이** (상위 노출에 가장 유리한 범위).'
    case 'long': return '본문 2,500~3,000자. 심도 있는 전문 콘텐츠. 과도하게 길면 이탈률 증가 주의.'
    default: return '본문 1,800~2,000자. **네이버 검색 알고리즘 최적 길이** (상위 노출에 가장 유리한 범위).'
  }
}

/**
 * AI에 보낼 최적화된 시스템 프롬프트 생성
 */
export function buildSystemPrompt(request: ContentGenerationRequest): string {
  const contentType = request.contentType || detectContentType(request.keyword)
  const isPromo = contentType === 'local' && !!request.businessInfo?.name
  const typeName = isPromo ? '내 업체 홍보글' : CONTENT_TYPE_NAMES[contentType]
  const structure = isPromo ? LOCAL_PROMO_STRUCTURE_GUIDE : STRUCTURE_GUIDES[contentType]
  const toneGuide = getToneGuide(request.tone || '친근하고 정보적인')
  const lengthGuide = getLengthGuide(request.targetLength || 'medium')
  const fewShotExamples = isPromo ? '' : getFewShotExamples(contentType)  // 홍보글은 예시 제외

  // 고급 옵션 처리
  const opts = request.advancedOptions || {}
  const imageCountGuide = opts.imageCount && opts.imageCount !== 'auto'
    ? `정확히 ${opts.imageCount}개`
    : '3~5개'
  const headingCountGuide = opts.headingCount && opts.headingCount !== 'auto'
    ? `H2 소제목을 정확히 ${opts.headingCount}개`
    : 'H2 3~5개'

  const keywordDensityGuide = opts.keywordDensity === 'natural'
    ? '3~5회 (자연스럽게)'
    : opts.keywordDensity === 'aggressive'
      ? '8~12회 (적극적으로)'
      : '5~8회 (권장)'

  const internalLinkGuide = opts.internalLinkCount && opts.internalLinkCount !== 'auto'
    ? `정확히 ${opts.internalLinkCount}개`
    : '2~3개'

  const structureRatioGuide = opts.structureRatio === 'intro-heavy'
    ? '도입부를 풍부하게 (30% 이상) 작성하여 독자의 관심을 끌어주세요.'
    : opts.structureRatio === 'content-heavy'
      ? '본문 정보를 충실하게 (70% 이상) 작성하여 깊이 있는 내용을 제공하세요.'
      : '도입 20% · 본문 60% · 결론 20% 균형잡힌 구성으로 작성하세요.'

  const forcedSectionsGuide = opts.forcedSections && opts.forcedSections.length > 0
    ? `\n\n### 필수 포함 섹션\n다음 섹션을 반드시 포함하세요:\n${opts.forcedSections.map(s => `- ${s}`).join('\n')}`
    : ''

  const styleGuide = [
    opts.forceListFormat ? '- 리스트 형식(-, 1. 등)을 적극 활용하여 가독성을 높이세요.' : null,
    opts.includeTable ? '- 비교/정리가 필요한 부분은 마크다운 표 형식으로 작성하세요.' : null,
    opts.useEmoji ? '- 소제목이나 강조 부분에 적절한 이모지를 사용하여 친근감을 더하세요.' : null,
    opts.includeQuotes ? '- 중요한 팁이나 주의사항은 인용구(> )나 강조 박스로 표현하세요.' : null,
  ].filter(Boolean).join('\n')

  const audienceGuide = opts.targetAudience === 'beginner'
    ? '\n\n### 타겟 독자: 초보자\n- 전문 용어는 쉬운 설명과 함께 사용하세요.\n- 단계별로 자세히 설명하여 누구나 따라할 수 있도록 작성하세요.\n- "처음 시작하시는 분", "초보자도 쉽게" 같은 표현을 활용하세요.'
    : opts.targetAudience === 'expert'
      ? '\n\n### 타겟 독자: 전문가\n- 전문 용어를 적극 사용하고 심화 내용을 다루세요.\n- 최신 트렌드와 고급 기술을 소개하세요.\n- "전문가들이 주목하는", "심화 과정" 같은 표현을 활용하세요.'
      : '' // general은 기본 스타일 유지

  const ageGroupGuide = opts.ageGroup && opts.ageGroup !== 'all'
    ? `\n\n### 타겟 연령대: ${opts.ageGroup === '10s' ? '10대' : opts.ageGroup === '20-30s' ? '20-30대' : opts.ageGroup === '40-50s' ? '40-50대' : '60대 이상'}\n- 해당 연령대가 관심 있어할 만한 예시와 표현을 사용하세요.\n- 독자의 생활 패턴과 관심사를 고려하여 공감할 수 있는 내용을 작성하세요.`
    : ''

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

### 키워드 배치 전략 (SEO 점수 핵심 요소)
- **키워드 밀도 (필수)**: 핵심 키워드를 본문에 ${keywordDensityGuide} 반복 (2000자 기준 약 0.5~2% 밀도)
  - 너무 적으면(3회 이하): SEO 효과 없음
  - 너무 많으면(10회 이상): 키워드 스터핑으로 감점
  - 예: 2500자 글이라면 핵심 키워드를 정확히 6~7회 사용
- **키워드 분포 (필수)**: 본문을 3등분하여 각 구간에 반드시 핵심 키워드 포함
  - 전반부(처음 1/3): 도입부 + 첫 번째 소제목 섹션에 반드시 포함
  - 중반부(중간 1/3): 중간 소제목 섹션들에 반드시 포함
  - 후반부(마지막 1/3): 마무리 섹션에 반드시 포함
  - 이 규칙을 어기면 SEO 점수 0점 처리됨
- 관련 키워드: 동의어, 유사어를 골고루 사용하여 주제 전문성 표현

### 키워드 스터핑 절대 금지 (매우 중요!)
- 키워드는 반드시 자연스러운 문장 속에 녹여서 사용할 것
- 절대 하지 말아야 할 패턴:
  × 인용문/후기 끝에 키워드 억지 삽입 (예: "정말 좋았어요" - 침산동 수학학원)
  × 키워드만 단독으로 한 줄에 삽입 (예: **침산동 수학학원**)
  × 100자 이내에 같은 키워드 2번 이상 반복
  × 소제목마다 키워드를 기계적으로 반복
  × 문장 끝에 키워드를 덧붙이기 (예: "만족스러웠던 침산동 수학학원")
- 올바른 키워드 사용 예시:
  ○ "침산동에 위치한 이 수학학원은 소수정예 수업이 특징이에요"
  ○ "학원을 고를 때 입지와 커리큘럼을 꼼꼼히 비교했어요"
  ○ 키워드를 주어·목적어·부사구 등 문장 성분으로 자연스럽게 활용

### 콘텐츠 품질 (D.I.A. 최적화)
- 독창적이고 경험 기반의 내용 작성 (단순 정보 나열 금지)
- 구체적 수치, 날짜, 가격 등 정확한 정보 포함
- 핵심 내용은 **볼드** 처리하여 스캔 가능하게
- 적절한 이미지 삽입 위치: [이미지: 설명] 형태로 ${imageCountGuide}

### 시각적 계층화 (탐색 용이성 극대화)
현대 독자는 글을 처음부터 끝까지 정독하지 않고 **스크롤하며 원하는 정보를 시각적으로 탐색**합니다.
따라서 다음 도구를 적극 활용하여 정보의 위계를 명확히 구분하세요:

- **목록 형식 필수 활용**: 재료, 순서, 항목 정리 시 반드시 목록(- 또는 1. 2. 3.) 형식 사용
  - ❌ 잘못된 예: "먼저 양파를 준비하고, 그 다음 당근을 썰고, 마지막으로 고기를 볶습니다." (줄글)
  - ✅ 올바른 예: "재료 준비:\n1. 양파 1개 (채썰기)\n2. 당근 1/2개 (얇게 썰기)\n3. 돼지고기 200g"
- **중요 문장 강조**: 핵심 팁, 주의사항, 결론은 **볼드** 처리
- **인용구 활용**: 특별히 강조할 팁이나 전문가 조언은 > 인용구로 표현
- **단락 호흡 짧게**: 각 문단은 2~4문장, 문장 길이는 40자 이내 (모바일 최적화)

### 내부 링크 (필수)
- 본문에 **반드시 ${internalLinkGuide}의 내부 링크** 플레이스홀더를 포함하세요
- 마크다운 링크 형식 사용: [관련 글: 제목](./placeholder)
- 예시:
  - [관련 글: 네이버 블로그 SEO 최적화 완벽 가이드](./naver-blog-seo-guide)
  - [이전 포스팅: 초보자를 위한 블로그 시작하기](./blog-start-guide)
- 링크는 본문 중간에 자연스럽게 배치 (마지막에만 몰지 말 것)
- 관련 주제로 자연스럽게 연결되는 내용으로 작성

### 구조 최적화
- 소제목(## H2, ### H3)으로 논리적 구조화 (${headingCountGuide}, 필요 시 H3 추가)
- ${structureRatioGuide}
- 각 문단은 2~4문장으로 짧게 (모바일 가독성)
- 문장 길이: 40자 이내 권장 (한국어 기준)${forcedSectionsGuide}${styleGuide ? `\n\n### 스타일 요구사항\n${styleGuide}` : ''}${audienceGuide}${ageGroupGuide}

### 태그 & 마무리
- 본문 마지막에 관련 태그 7~10개 제안 (#키워드 형태)
- 독자 참여 유도 문구로 마무리 (댓글, 공감 유도)

### 콘텐츠 유형별 최적화 전략
**${typeName}** 콘텐츠의 특성에 맞춰 다음 원칙을 반드시 따르세요:

${contentType === 'howto' || contentType === 'informational' ? `
**[정보성 콘텐츠]**
- **핵심 목적**: 독자의 문제 해결, 전문 지식 전달
- **구조**: 서론(문제 제기 및 공감) → 본론(해결책 나열) → 결론(요약)
- **필수 요소**:
  - 소제목의 명확한 계층화 (H2 → H3)
  - 목록 형식으로 핵심 정보 정리 (재료, 순서, 항목 등)
  - 인용구로 중요 팁 강조
  - 구체적 수치와 단계별 설명
- **시각적 도구**: 목록, 볼드, 인용구를 적극 활용하여 정보 탐색 용이하게` : ''}

${contentType === 'review' || contentType === 'comparison' ? `
**[리뷰/후기 콘텐츠]**
- **핵심 목적**: 제품/서비스/장소에 대한 간접 경험과 검증 제공
- **구조**: 첫인상 → 상세 사용 과정 → 장단점 비교 → 총평
- **필수 요소**:
  - 다량의 사진 ([이미지: 설명] 형태로 ${imageCountGuide})
  - 구체적 가격, 위치, 날짜 정보
  - 실제 사용 경험 기반 장단점 (표 형식 권장)
  - 개인적 의견과 객관적 사실 구분
- **시각적 도구**: 이미지 중심, 표로 비교 항목 정리, 별점/평가 강조` : ''}

${contentType === 'listicle' || contentType === 'local' ? `
**[추천/리스트 콘텐츠]**
- **핵심 목적**: 여러 옵션 비교 및 선별된 추천 제공
- **구조**: 도입(선정 기준) → 각 항목별 H3 소제목 → 종합 비교
- **필수 요소**:
  - TOP 3~7 형태의 명확한 순위
  - 각 항목마다 독립된 H3 소제목 + 사진
  - 가격, 위치, 특징을 표로 정리
  - 최종 선택 가이드 (어떤 사람에게 어떤 것 추천)
- **시각적 도구**: 번호 목록, 비교 표, 강조 박스` : ''}

### 2025-2026 최신 트렌드
- **질문형 소제목** 활용: "~방법" 대신 "~어떻게 해야 하나요?" 형태의 질문형 소제목 사용
- **경험 정보 강화**: 직접 체험, 구체적 수치, 개인 의견 등 대체 불가능한 정보 포함
- **VLM 시각 최적화**: 문단 2~3문장 단위 호흡, 이미지와 텍스트의 맥락 정합성
- **권위 있는 출처 인용**: 통계, 공식 발표 등 객관적 근거 제시
- **주제 심도 집중**: 양보다 밀도, 하나의 주제에 대한 깊이 있는 정보

## ⛔ 범용 템플릿 남용 금지 (CRITICAL)
절대 하지 말아야 할 것:
❌ "Step 1. 목표 설정하기", "Step 2. 기초 세팅하기" 같은 주제와 무관한 범용 단계
❌ "준비할 것", "체크리스트" 같은 추상적 섹션만 나열
❌ 지역 업종 키워드에 학원/맛집 이름 없이 "선택 방법"만 설명
❌ 비교/추천 키워드에 구체적 항목 없이 "비교 기준"만 설명

반드시 해야 할 것:
✅ 지정된 콘텐츠 유형 구조를 정확히 따를 것
✅ 구체적 정보(업체명, 가격, 위치, 제품명 등)를 포함할 것
✅ 주제에 딱 맞는 실용적 정보를 제공할 것

예시:
- "침산동 초등수학학원 추천" → TOP 3~5 학원을 H3 소제목으로 나열 (위치·가격·특징 포함)
- "React vs Vue 비교" → 각 프레임워크의 성능·생태계·학습곡선을 구체적으로 비교
- "김치찌개 끓이는 법" → 재료 리스트 + 단계별 조리법 (온도·시간 포함)
${fewShotExamples}
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
  const isPromo = contentType === 'local' && !!request.businessInfo?.name
  const typeName = isPromo ? '내 업체 홍보글' : CONTENT_TYPE_NAMES[contentType]

  let prompt = `타겟 키워드: "${request.keyword}"
콘텐츠 유형: ${typeName}
톤앤매너: ${request.tone || '친근하고 정보적인'}`

  if (request.additionalKeywords && request.additionalKeywords.length > 0) {
    prompt += `\n관련 키워드 (본문에 자연스럽게 포함): ${request.additionalKeywords.join(', ')}`
  }

  // 홍보글 모드: 업체 정보 + 글 주제 전달
  if (isPromo && request.businessInfo) {
    const bi = request.businessInfo
    prompt += `\n\n## 업체 정보 (홍보 대상)
- 업체명: ${bi.name}`
    if (bi.address) prompt += `\n- 위치/주소: ${bi.address}`
    if (bi.pricing) prompt += `\n- 가격 정보: ${bi.pricing}`
    if (bi.strengths) prompt += `\n- 강점/특징: ${bi.strengths}`
    if (bi.operatingHours) prompt += `\n- 운영 시간: ${bi.operatingHours}`
    if (bi.contact) prompt += `\n- 연락처/예약: ${bi.contact}`

    if (bi.topic) {
      prompt += `\n\n## 글 주제/소재
"${bi.topic}"
위 주제에 맞는 블로그 글을 작성해주세요. 업체 사장님/운영자가 직접 소개하는 톤으로, 광고가 아닌 진정성 있는 정보성 글 느낌으로 작성합니다.`
    } else {
      prompt += `\n\n위 업체를 사장님/운영자가 직접 소개하는 블로그 글을 작성해주세요. 과도한 광고가 아닌, 진정성 있고 따뜻한 톤으로 업체의 이야기와 강점을 자연스럽게 전달합니다.`
    }
  }

  if (request.includeFaq !== false) {
    prompt += `\n\n본문 하단에 "자주 묻는 질문 (FAQ)" 섹션도 포함해주세요 (3~4개 질문).`
  }

  if (!isPromo) {
    prompt += `\n\n위 키워드로 네이버 블로그 SEO에 최적화된 ${typeName} 글을 작성해주세요.`
  }

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
    case 'local': {
      const { location, business } = extractLocalParts(keyword)
      if (request.businessInfo?.name) {
        // 홍보글 모드
        const bName = request.businessInfo.name
        const topicLabel = request.businessInfo.topic
          ? ` - ${request.businessInfo.topic.length > 50 ? request.businessInfo.topic.substring(0, 50) + '…' : request.businessInfo.topic}`
          : ''
        sections.push(
          { heading: `${bName} 소개${topicLabel}`, level: 2, keyPoints: ['업체 이야기', '시작 계기'] },
          { heading: `${bName}의 특징과 강점`, level: 2, keyPoints: ['서비스/상품 상세', '차별점'] },
          { heading: `고객 후기 & 사례`, level: 2, keyPoints: ['만족 사례', '고객 피드백'] },
          { heading: `오시는 길 & 이용 안내`, level: 2, keyPoints: ['위치', '운영시간', '연락처'] },
          { heading: `자주 묻는 질문`, level: 2, keyPoints: ['가격', '주차', '예약 방법'] },
        )
      } else {
        // 일반 지역업종 비교글
        sections.push(
          { heading: `${location} ${business} 추천 TOP 5`, level: 2, keyPoints: ['각 업체별 위치/가격/특징'] },
          { heading: `${business} 선택 시 꼭 확인할 체크포인트`, level: 2, keyPoints: ['가격', '접근성', '전문성', '후기'] },
          { heading: `${location} ${business} 가격 비교`, level: 2, keyPoints: ['업체별 수업료/이용 요금 비교표'] },
          { heading: `${location} ${business} 자주 묻는 질문`, level: 2, keyPoints: ['주차', '체험/상담', '운영시간'] },
        )
      }
      break
    }
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
    case 'local':
      if (request.businessInfo?.name) {
        const bi = request.businessInfo
        title = bi.topic
          ? `${bi.name} ${bi.topic} | ${keyword}`
          : `${keyword} ${bi.name} 방문 후기 (${new Date().getFullYear()}년)`
        content = generateDemoLocalPromoContent(keyword, bi)
      } else {
        title = `${keyword} 추천 TOP 5 (${new Date().getFullYear()}년 최신)`
        content = generateDemoLocalContent(keyword)
      }
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

// ===== 콘텐츠 품질 검증 =====

/** 콘텐츠 검증 결과 */
export interface ContentValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number  // 0~100점 (80점 이상이면 합격)
}

/**
 * 생성된 콘텐츠의 품질을 검증하여 범용 템플릿 남용을 감지
 *
 * @param content 검증할 콘텐츠 본문
 * @param contentType 콘텐츠 유형
 * @param keyword 타겟 키워드
 * @returns 검증 결과 (isValid, errors, warnings, score)
 */
export function validateContentStructure(
  content: string,
  contentType: ContentType,
  keyword: string
): ContentValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let score = 100

  // 1. 범용 템플릿 금지 단어 감지
  const genericPhrases = [
    /Step\s*\d+[.:)]\s*(목표|기초|핵심|결과|마무리)\s*(설정|세팅|작업|확인)/gi,
    /준비할\s*것.*필수.*선택/gi,
    /체크리스트.*확인.*점검/gi,
    /단계별.*가이드.*따라하기/gi,
  ]

  for (const pattern of genericPhrases) {
    const matches = content.match(pattern)
    if (matches && matches.length >= 2) {
      errors.push(`범용 템플릿 감지: "${matches[0]}" 같은 주제와 무관한 추상적 단계 사용`)
      score -= 30
      break
    }
  }

  // 2. 콘텐츠 타입별 필수 요소 검증
  switch (contentType) {
    case 'local':
      // 지역 업종: 구체적 업체명, 가격, 위치 필수
      const hasBusinessNames = /###\s*\d+\.\s*[가-힣a-zA-Z0-9\s]+\s*\(/g.test(content) ||
                               /###\s*[가-힣a-zA-Z0-9\s]+(학원|카페|식당|병원|헬스장|맛집)/g.test(content)
      const hasPricing = /\d+[,\d]*원|월\s*\d+만|가격:/gi.test(content)
      const hasLocation = /(역|동|구|시)\s*\d+번\s*출구|도보\s*\d+분|주소:/gi.test(content)

      if (!hasBusinessNames) {
        errors.push('지역 업종 콘텐츠에 구체적 업체명이 없습니다 (예: ### 1. OO학원)')
        score -= 25
      }
      if (!hasPricing) {
        warnings.push('가격 정보가 부족합니다 (예: 월 22만원, 아메리카노 4,500원)')
        score -= 10
      }
      if (!hasLocation) {
        warnings.push('위치 정보가 부족합니다 (예: 역삼역 3번 출구 도보 5분)')
        score -= 10
      }
      break

    case 'comparison':
      // 비교형: 구체적 항목명, 비교표, 별점 권장
      const hasItemNames = /###\s*\d+[위.]?\s*[가-힣a-zA-Z0-9\s]+\s*\(/g.test(content)
      const hasTable = /\|.*\|.*\|/g.test(content)

      if (!hasItemNames) {
        errors.push('비교형 콘텐츠에 구체적 항목명이 없습니다 (예: ### 1위. 다이슨 V15)')
        score -= 25
      }
      if (!hasTable) {
        warnings.push('비교표가 없습니다. 한눈에 보는 비교표를 추가하면 좋습니다')
        score -= 5
      }
      break

    case 'howto':
      // 방법형: 코드 블록 또는 구체적 명령어 필수
      const hasCodeBlock = /```[\s\S]+?```/g.test(content)
      const hasCommands = /\$|>|#\s+[a-z-]+|cd\s+|git\s+|npm\s+/gi.test(content)
      const hasAbstractSteps = /Step\s*\d+[.:)]\s*(목표|기초)\s*설정/gi.test(content)

      if (hasAbstractSteps) {
        errors.push('추상적 단계 감지: "Step 1. 목표 설정" 같은 범용 템플릿 사용 금지')
        score -= 30
      }
      if (!hasCodeBlock && !hasCommands && keyword.match(/방법|하는법|설정|설치/)) {
        warnings.push('구체적 명령어나 코드 블록이 없습니다')
        score -= 10
      }
      break

    case 'review':
      // 후기형: 구매 정보, 별점, 장단점 필수
      const hasPurchaseInfo = /구매|가격|날짜|일/gi.test(content)
      const hasRating = /★|별점|점|\/5/gi.test(content)
      const hasProsAndCons = /(장점|단점|좋은점|아쉬운점)/gi.test(content)

      if (!hasPurchaseInfo) {
        warnings.push('구매 정보(날짜, 가격, 구매처)가 부족합니다')
        score -= 10
      }
      if (!hasRating) {
        warnings.push('별점 평가가 없습니다')
        score -= 5
      }
      if (!hasProsAndCons) {
        warnings.push('장단점 섹션이 명확하지 않습니다')
        score -= 10
      }
      break

    case 'listicle':
      // 리스트형: 번호 매기기, 각 항목별 설명
      const numberedItems = content.match(/###\s*\d+[위.]?\s*/g)
      if (!numberedItems || numberedItems.length < 3) {
        errors.push('리스트형 콘텐츠에 번호가 매겨진 항목이 3개 미만입니다')
        score -= 20
      }
      break
  }

  // 3. 키워드 관련성 검증
  const keywordAppearances = (content.match(new RegExp(keyword, 'gi')) || []).length
  if (keywordAppearances === 0) {
    errors.push(`본문에 핵심 키워드 "${keyword}"가 단 한 번도 등장하지 않습니다`)
    score -= 20
  } else if (keywordAppearances === 1) {
    warnings.push(`본문에 핵심 키워드가 1회만 등장합니다 (권장: 3~5회)`)
    score -= 5
  }

  // 4. 구체성 검증 (숫자, 고유명사)
  const hasNumbers = /\d+[.,\d]*%|\d+[.,\d]*원|\d+[.,\d]*개|\d+[.,\d]*명|\d+시간|\d+분/g.test(content)
  if (!hasNumbers) {
    warnings.push('구체적 수치가 부족합니다 (가격, 개수, 비율 등 추가 권장)')
    score -= 10
  }

  // 5. 최소 분량 검증
  if (content.length < 800) {
    errors.push(`콘텐츠가 너무 짧습니다 (${content.length}자, 최소 1,500자 권장)`)
    score -= 15
  }

  // 최종 판정
  const isValid = score >= 80 && errors.length === 0

  return {
    isValid,
    errors,
    warnings,
    score: Math.max(0, score),
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

function generateDemoLocalContent(keyword: string): string {
  const { location, business } = extractLocalParts(keyword)
  const year = new Date().getFullYear()

  return `## ${location} ${business} 어디로 가야 할까? ${year}년 추천 TOP 5

${location}에서 **${business}**을 찾고 계신가요? 직접 발품 팔아 알아본 **${location} ${business} 추천 리스트**를 정리했습니다.

가격, 위치, 후기까지 꼼꼼히 비교했으니 선택에 도움이 되실 거예요!

[이미지: ${location} ${business} 추천 대표 이미지]

## ${location} ${business} 추천 TOP 5

### 1. A ${business} ⭐ 추천

- **위치**: ${location} 중심가, 지하철역 도보 5분
- **가격**: 월 25만원~35만원
- **특징**: 소수정예 수업, 개별 맞춤 커리큘럼
- **운영시간**: 평일 14:00~22:00 / 토 10:00~18:00
- **주차**: 건물 내 무료 주차 가능

> "꼼꼼한 관리가 인상적이었습니다. 특히 상담이 정말 친절해요"

[이미지: A ${business} 내부 사진]

### 2. B ${business}

- **위치**: ${location} 대로변, 버스 정류장 1분
- **가격**: 월 20만원~30만원
- **특징**: 대형 ${business}, 다양한 프로그램
- **운영시간**: 평일 13:00~22:00 / 토 09:00~17:00
- **주차**: 주변 공영주차장 이용 (도보 3분)

### 3. C ${business}

- **위치**: ${location} 아파트 단지 내
- **가격**: 월 22만원~28만원
- **특징**: 아이 동선이 안전, 셔틀 운행
- **운영시간**: 평일 15:00~21:00
- **주차**: 아파트 방문 주차 가능

### 4. D ${business}

- **위치**: ${location} 먹자골목 인근
- **가격**: 월 18만원~25만원
- **특징**: 가성비 최고, 그룹 수업 중심
- **운영시간**: 평일 14:00~21:00 / 토 10:00~15:00

### 5. E ${business}

- **위치**: ${location} 신축 건물 3층
- **가격**: 월 30만원~40만원
- **특징**: 프리미엄 시설, 1:1 전담 관리
- **운영시간**: 평일 10:00~22:00 / 토·일 10:00~18:00

[이미지: ${location} ${business} 위치 지도]

## ${business} 선택 시 꼭 확인할 체크포인트

${location}에서 ${business}을 고를 때 **이 5가지**만 체크하세요:

1. **접근성**: 집/학교에서 도보 또는 대중교통 10분 이내인지
2. **가격 대비 만족도**: 수업료뿐 아니라 교재비, 추가 비용 확인
3. **강사/전문가 경력**: 경력 및 자격증 보유 여부
4. **후기 확인**: 네이버 블로그, 카페에서 실제 이용 후기 확인
5. **체험/상담**: 반드시 **무료 체험이나 상담** 후 결정하세요

> 💡 **꿀팁**: 대부분의 ${business}은 무료 체험 수업을 제공합니다. 최소 2~3곳은 직접 방문해보세요!

## ${location} ${business} 가격 비교표

| ${business} | 월 가격 | 위치 | 특징 |
|------|--------|------|------|
| A ${business} | 25~35만원 | 중심가 | 소수정예, 맞춤관리 |
| B ${business} | 20~30만원 | 대로변 | 대형, 다양한 프로그램 |
| C ${business} | 22~28만원 | 단지 내 | 안전한 동선, 셔틀 |
| D ${business} | 18~25만원 | 골목 인근 | 가성비, 그룹수업 |
| E ${business} | 30~40만원 | 신축 건물 | 프리미엄, 1:1관리 |

## 자주 묻는 질문 (FAQ)

### Q. ${location} ${business} 무료 체험이 가능한가요?
대부분 **무료 체험 수업**을 제공합니다. 전화 또는 온라인으로 사전 예약 후 방문하세요.

### Q. ${business} 수업료 외 추가 비용이 있나요?
교재비, 등록비 등 **별도 비용이 발생할 수 있습니다**. 상담 시 총 비용을 반드시 확인하세요.

### Q. ${location} ${business} 주차는 가능한가요?
업체마다 다릅니다. A ${business}는 무료 주차 가능하며, 나머지는 주변 공영주차장을 이용해야 합니다. 방문 전 확인 권장!

### Q. 언제부터 효과를 볼 수 있나요?
보통 **1~3개월** 정도면 변화를 체감할 수 있습니다. 꾸준한 참여가 가장 중요합니다.

[이미지: ${location} ${business} FAQ 시각화]

## 마무리

${location}에서 **${business}**을 찾고 계신다면, 위 TOP 5 중에서 **직접 체험 후 결정**하시길 추천드립니다.

**방문 전 체크리스트:**
- [ ] 무료 체험/상담 예약했는지
- [ ] 가격 + 추가 비용 확인했는지
- [ ] 운영 시간과 위치가 생활 동선에 맞는지
- [ ] 온라인 후기 2~3개 확인했는지

이 글이 도움이 되셨다면 **공감**과 **댓글** 부탁드립니다! 다른 ${location} 정보가 궁금하시면 말씀해주세요 😊

#${keyword} #${location}${business}추천 #${location}${business} #${business}추천 #${location} #${business}비교 #${location}추천 #${year}${business}`
}

function generateDemoLocalPromoContent(keyword: string, bi: BusinessInfo): string {
  const { location } = extractLocalParts(keyword)
  const name = bi.name
  const year = new Date().getFullYear()
  const topic = bi.topic || '방문 후기'

  const addressLine = bi.address ? `**${bi.address}**에 위치한` : `${location}에 위치한`
  const pricingSection = bi.pricing
    ? `\n\n### 가격/수업료\n\n${bi.pricing}\n\n가격 대비 만족도가 높다는 평이 많습니다.`
    : ''
  const strengthsSection = bi.strengths
    ? `\n\n### 이곳만의 차별점\n\n${bi.strengths}\n\n실제로 경험해보면 차이를 느낄 수 있는 부분들입니다.`
    : '\n\n### 이곳만의 차별점\n\n소수정예 운영으로 개인 맞춤 케어가 가능하다는 점이 가장 큰 장점입니다. 처음 방문하는 분들도 편안하게 상담받을 수 있는 분위기예요.'
  const hoursLine = bi.operatingHours || '평일 10:00~21:00 / 토 10:00~17:00 (일/공휴일 휴무)'
  const contactLine = bi.contact || '전화 또는 네이버 예약으로 문의 가능'

  return `## ${name} ${topic} | ${keyword}

안녕하세요! 오늘은 ${addressLine} **${name}**에 다녀온 이야기를 해볼게요.

${location}에서 오래 살면서 여러 곳을 다녀봤는데, ${name}은 확실히 인상 깊었던 곳이라 기록으로 남겨봅니다.

[이미지: ${name} 외관/입구 사진]

## ${name} 첫인상

처음 방문했을 때 깔끔한 인테리어와 정돈된 분위기가 눈에 들어왔어요. ${addressLine} 만큼 접근성도 좋고, 주변 환경도 쾌적합니다.

직원분들도 친절하게 맞아주셔서 첫 방문이어도 편안하게 둘러볼 수 있었습니다.

[이미지: ${name} 내부 분위기]

## ${name}의 특징과 강점
${strengthsSection}
${pricingSection}

[이미지: ${name} 서비스/수업 진행 모습]

## 실제 이용 후기

### 좋았던 점

1. **전문성이 느껴지는 상담**: 처음 방문했을 때 꼼꼼하게 상담해주셔서 신뢰가 갔습니다
2. **체계적인 시스템**: 관리가 잘 되어 있어서 매번 일관된 서비스를 받을 수 있었어요
3. **편안한 분위기**: 부담 없이 질문하고 소통할 수 있는 환경이 좋았습니다

### 아쉬운 점

- 인기가 많아서 원하는 시간대에 예약이 어려울 수 있어요
- 주차 공간이 넉넉하지 않아 대중교통을 추천드립니다

> "${name}, 지인에게도 추천할 만큼 만족스러웠습니다"

[이미지: 이용 후기 관련 사진]

## ${name} 방문 안내

- **위치**: ${bi.address || `${location} 중심가`}
- **운영시간**: ${hoursLine}
- **예약/문의**: ${contactLine}
- **주차**: 건물 내 주차 가능 (사전 확인 권장)

> 💡 **꿀팁**: 첫 방문이시라면 전화로 사전 상담을 받아보시는 것을 추천합니다!

[이미지: ${name} 위치 지도/약도]

## 자주 묻는 질문

### Q. ${name} 첫 방문 시 준비할 것이 있나요?
특별히 준비할 것은 없습니다. 편한 마음으로 방문하시면 됩니다. 상담을 통해 맞춤 안내를 받으실 수 있어요.

### Q. ${name} 주차가 가능한가요?
건물 내 주차 공간이 있지만 여유롭지 않을 수 있습니다. 가능하면 대중교통 이용을 권장합니다.

### Q. 체험이나 무료 상담이 가능한가요?
네, 첫 방문 시 무료 상담을 받으실 수 있습니다. 사전 예약 후 방문해주세요.

## 마무리

${location}에서 **${name}**을 찾고 계신다면, 한번 방문해보시길 추천합니다. 저도 앞으로 꾸준히 이용할 계획이에요!

궁금한 점이 있으시면 **댓글**로 남겨주세요. 아는 범위에서 답변드리겠습니다 😊

#${keyword} #${name} #${location} #${name}후기 #${keyword}추천 #${location}추천 #${year}추천`
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

// ===== AI 약점 개선 프롬프트 =====

/** 약점 카테고리 정보 */
export interface WeakCategory {
  id: string
  name: string
  score: number
  maxScore: number
  details: string
}

/** 카테고리 ID별 AI 개선 지시사항 */
const IMPROVEMENT_INSTRUCTIONS: Record<string, string> = {
  internal_links: `내부 링크를 3개 이상 추가하세요:
- 본문 중간에 "[관련 글: 제목](https://blog.naver.com/blogid/postid)" 형태로 삽입
- 글의 맥락과 자연스럽게 연결되는 위치에 배치
- "이전에 작성한 글에서 더 자세히 다뤘는데요" 같은 연결 문구 사용`,

  keyword_density: `타겟 키워드 사용 빈도를 높이세요:
- 본문 전체에서 키워드 밀도 1~2%가 되도록 자연스럽게 키워드를 추가
- 동의어나 유사 표현도 함께 활용 (키워드 스터핑은 절대 금지)
- 소제목에도 키워드를 자연스럽게 포함`,

  content_length: `본문을 2,500자 이상으로 확장하세요:
- 각 섹션에 구체적인 예시, 수치, 경험담을 추가
- 새로운 소제목 1~2개를 추가하여 내용을 보강
- 빈약한 섹션을 찾아 깊이 있는 정보로 보완
- 단순 반복이나 불필요한 수식어 추가는 금지`,

  mobile_optimization: `모바일 가독성을 개선하세요:
- 40자를 초과하는 긴 문장을 두 문장으로 분리
- 200자를 초과하는 긴 문단을 2~3문장씩 짧게 분리
- 불필요한 수식어를 제거하여 문장을 간결하게`,

  meta_description: `도입부(첫 번째 문단)를 개선하세요:
- 첫 문장을 50~120자 사이로 작성
- 첫 문장에 타겟 키워드를 자연스럽게 포함
- 독자의 궁금증을 유발하는 문장으로 시작`,

  heading_structure: `소제목 구조를 보강하세요:
- H2(##) 소제목을 최소 3개 이상 사용
- H3(###) 소제목도 2개 이상 추가
- 소제목에 키워드를 자연스럽게 포함
- 질문형 소제목 활용 (예: "~어떻게 해야 할까요?")`,

  keyword_distribution: `키워드를 본문 전체에 균등 분포시키세요:
- 도입부(첫 문단)에 키워드 포함
- 본문 중간 섹션에 키워드 포함
- 마무리(마지막 문단)에 키워드 포함
- 한 곳에 몰리지 않게 자연스럽게 분산`,

  readability_elements: `가독성 요소를 추가하세요:
- 핵심 정보에 **볼드** 강조 표시 추가
- 나열 정보는 리스트(- ) 형태로 정리
- 문단 사이에 적절한 줄바꿈 추가
- 8개 이상의 문단으로 구성`,

  related_keywords: `관련 키워드를 본문에 자연스럽게 포함하세요:
- 제공된 관련 키워드를 본문 곳곳에 배치
- 동의어, 유사어, 연관 검색어를 활용
- 키워드 간 자연스러운 문맥 연결`,

  tags_cta: `태그와 독자 참여 유도 문구를 추가하세요:
- 글 마지막에 #태그를 7~10개 추가
- "댓글로 알려주세요", "공감 부탁드립니다" 같은 CTA 문구 추가
- "구독", "이웃 추가" 유도 문구도 포함`,

  title_keyword: `제목에 타겟 키워드를 포함하세요:
- 제목 앞쪽 15자 이내에 키워드를 자연스럽게 배치
- 클릭을 유도하는 수식어 추가 (완벽 가이드, TOP, 총정리 등)`,

  title_length: `제목 길이를 20~40자로 조정하세요:
- 너무 짧으면 정보를 추가하고, 너무 길면 핵심만 남기세요
- 네이버 검색 결과에서 잘리지 않는 적정 길이 유지`,

  multimedia: `이미지 마커를 추가하세요:
- [이미지: 설명] 형태로 본문에 4개 이상 배치
- 각 주요 섹션 시작이나 끝에 이미지 위치 표시
- 이미지 설명은 본문 내용과 관련성 있게 작성`,
}

/**
 * 약점 개선용 시스템 프롬프트 생성
 */
export function buildImprovementSystemPrompt(weakCategories: WeakCategory[]): string {
  const improvements = weakCategories
    .map(cat => {
      const instruction = IMPROVEMENT_INSTRUCTIONS[cat.id]
      if (!instruction) return null
      return `### ${cat.name} (현재 ${cat.score}/${cat.maxScore}점)
${instruction}`
    })
    .filter(Boolean)
    .join('\n\n')

  return `당신은 네이버 블로그 SEO 최적화 전문가입니다.
기존 블로그 글의 약점을 개선하여 SEO 점수를 높여야 합니다.

## 중요 규칙
- 기존 글의 핵심 내용과 톤을 유지하면서 약점만 개선합니다
- 글 전체를 새로 쓰지 마세요. 기존 구조를 최대한 유지합니다
- 개선된 부분이 기존 글에 자연스럽게 녹아들어야 합니다
- 키워드 스터핑이나 부자연스러운 삽입은 절대 금지합니다

## 개선이 필요한 항목

${improvements}

## 응답 형식 (JSON)
반드시 유효한 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 출력합니다.
{
  "title": "개선된 제목 (제목 관련 약점이 있으면 개선, 없으면 원래 제목 유지)",
  "content": "개선된 본문 전체 (마크다운 형식)"
}`
}

/**
 * 약점 개선용 유저 프롬프트 생성
 */
export function buildImprovementUserPrompt(
  keyword: string,
  title: string,
  content: string,
  weakCategories: WeakCategory[]
): string {
  const weakNames = weakCategories.map(c => `${c.name}(${c.score}/${c.maxScore})`).join(', ')

  return `타겟 키워드: "${keyword}"

## 현재 글
제목: ${title}

본문:
${content}

## 개선 요청
위 글의 약한 항목(${weakNames})을 개선해주세요.
기존 글의 내용과 흐름을 유지하면서, 지적된 항목만 자연스럽게 보완해주세요.`
}
