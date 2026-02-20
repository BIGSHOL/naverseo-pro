/**
 * NaverSEO Pro - D.I.A. (Deep Intent Analysis) 엔진
 *
 * 네이버 D.I.A. 로직 관점에서 콘텐츠 품질을 평가하는 엔진
 * 기존 SEO 엔진(키워드 중심)과 별도로, "사용자에게 진짜 유용한가"를 분석
 *
 * 8개 카테고리 100점 만점:
 * 1. 경험 정보 (20점) ← D.I.A. 핵심
 * 2. 정보 충실성 (15점)
 * 3. 주제 적합도 (12점)
 * 4. 문서 의도 (12점)
 * 5. 독창성 (12점)
 * 6. 구조적 일관성 (12점)
 * 7. 가독성 & 체류시간 (10점)
 * 8. 멀티미디어 활용 (7점)
 *
 * 참고: data/네이버_DIA_로직_심층_연구보고서.md
 * 참고: data/naver-seo-2025-2026-research.md (AuthGR, VLM, 질문형 소제목 등)
 */

import { determineGrade, type GradeTableEntry } from '@/lib/utils/grading'
import { detectStuffingPatterns } from '@/lib/utils/text'

// ===== 타입 정의 =====

export interface DiaCategory {
  id: string
  name: string
  score: number
  maxScore: number
  details: string
  tip: string // 개선 팁
}

export interface DiaGradeInfo {
  grade: string       // S/A+/A/B+/B/C/D
  label: string
  color: string
  description: string
}

export interface DiaAnalysisResult {
  totalScore: number
  grade: string
  gradeInfo: DiaGradeInfo
  categories: DiaCategory[]
  strengths: string[]
  improvements: string[]
  experienceHighlights: string[]  // 경험 정보로 감지된 문장들
  intentWarnings: string[]        // 문서 의도 관련 경고
}

// ===== 등급 체계 (DIA 관점) =====

const DIA_GRADE_TABLE: GradeTableEntry[] = [
  { minScore: 88, info: { grade: 'S',  label: 'D.I.A. 최적화',  color: 'emerald', description: '사용자 의도를 완벽히 충족하는 고품질 콘텐츠입니다' } },
  { minScore: 78, info: { grade: 'A+', label: '매우 우수',       color: 'green',   description: '경험과 정보가 잘 어우러진 우수한 콘텐츠입니다' } },
  { minScore: 68, info: { grade: 'A',  label: '우수',           color: 'teal',    description: '전반적으로 좋은 품질이며 소폭 개선 여지가 있습니다' } },
  { minScore: 55, info: { grade: 'B+', label: '양호',           color: 'blue',    description: '기본 품질을 갖추었으나 경험적 요소를 보강하면 좋습니다' } },
  { minScore: 42, info: { grade: 'B',  label: '보통',           color: 'yellow',  description: '정보 전달은 되나 DIA 관점에서 개선이 필요합니다' } },
  { minScore: 28, info: { grade: 'C',  label: '개선 필요',       color: 'orange',  description: '경험/독창성이 부족하여 상위 노출이 어렵습니다' } },
  { minScore: 0,  info: { grade: 'D',  label: '부적합',         color: 'red',     description: 'DIA 로직에 의해 노출이 제한될 수 있는 수준입니다' } },
]

function calculateDiaGrade(score: number): DiaGradeInfo {
  return determineGrade(score, DIA_GRADE_TABLE) as DiaGradeInfo
}

// ===== 메인 분석 함수 =====

/**
 * D.I.A. 관점 콘텐츠 분석
 * 순수 함수: API 호출 없이 클라이언트에서 실행 가능
 */
export function analyzeDia(
  keyword: string,
  title: string,
  content: string,
): DiaAnalysisResult {
  const categories: DiaCategory[] = []
  const strengths: string[] = []
  const improvements: string[] = []
  const experienceHighlights: string[] = []
  const intentWarnings: string[] = []

  const contentLength = content.length

  // 1. 경험 정보 (20점) - D.I.A. 핵심 차원
  categories.push(analyzeExperience(content, experienceHighlights, strengths, improvements))

  // 2. 정보 충실성 (15점)
  categories.push(analyzeInformationRichness(content, contentLength, strengths, improvements))

  // 3. 주제 적합도 (12점)
  categories.push(analyzeTopicRelevance(keyword, title, content, strengths, improvements))

  // 4. 문서 의도 (12점)
  categories.push(analyzeDocumentIntent(title, content, intentWarnings, strengths, improvements))

  // 5. 독창성 (12점)
  categories.push(analyzeOriginality(content, strengths, improvements))

  // 6. 구조적 일관성 (12점)
  categories.push(analyzeStructuralConsistency(title, content, contentLength, strengths, improvements))

  // 7. 가독성 & 체류시간 (10점)
  categories.push(analyzeEngagement(content, contentLength, strengths, improvements))

  // 8. 멀티미디어 활용 (7점)
  categories.push(analyzeMultimediaQuality(content, contentLength, strengths, improvements))

  const totalScore = Math.min(100, categories.reduce((sum, c) => sum + c.score, 0))
  const gradeInfo = calculateDiaGrade(totalScore)

  return {
    totalScore,
    grade: gradeInfo.grade,
    gradeInfo,
    categories,
    strengths,
    improvements,
    experienceHighlights,
    intentWarnings,
  }
}

// ===== 개별 분석 함수 =====

/**
 * 1. 경험 정보 분석 (20점) - D.I.A. 최핵심
 * "직접 체험한 내용, 독창적 시각, 원본 이미지 등 작성자의 고유한 경험 반영 여부"
 */
function analyzeExperience(
  content: string,
  highlights: string[],
  strengths: string[],
  improvements: string[],
): DiaCategory {
  let score = 0

  // 1인칭 경험 표현 감지
  const experiencePatterns = [
    /직접\s*(해보|가보|먹어보|써보|사용해|체험|방문|다녀|촬영|테스트)/g,
    /제가\s*(직접|실제로|개인적으로)/g,
    /(나는|저는|제가)\s*[^.]*?(해봤|다녀왔|먹어봤|써봤|경험|느꼈|체험)/g,
    /실제로\s*[^.]{5,30}/g,
    /실사용\s*[^.]{5,20}/g,
    /개인적으로\s*(추천|느낀|생각)/g,
    /솔직히\s*(말하|얘기하|말씀)/g,
  ]

  let experienceCount = 0
  const sentences = content.split(/[.!?]\s/)

  for (const pattern of experiencePatterns) {
    const matches = content.match(pattern)
    if (matches) {
      experienceCount += matches.length
      // 경험 문장 하이라이트 (최대 5개)
      for (const match of matches.slice(0, 2)) {
        const idx = content.indexOf(match)
        const start = Math.max(0, idx - 10)
        const end = Math.min(content.length, idx + match.length + 30)
        const snippet = content.substring(start, end).replace(/\n/g, ' ').trim()
        if (highlights.length < 5) {
          highlights.push(snippet)
        }
      }
    }
  }

  // 구체적 장소/시간/가격 (경험의 증거)
  const specificDetailPatterns = [
    /\d{1,3}(,\d{3})*\s*원/g,                          // 가격: 15,000원
    /\d{1,2}(시|시간|분)\s*(정도|쯤|걸|소요)/g,         // 시간: 30분 소요
    /\d{1,2}(층|번|호|번지|번출구)/g,                    // 장소: 3층, 5번 출구
    /(오전|오후|아침|점심|저녁)\s*\d{1,2}시/g,           // 시간대: 오후 2시
    /(월|화|수|목|금|토|일)요일/g,                       // 요일
    /[가-힣]+(역|점|지점|매장|센터|공원|카페|식당)\s/g,  // 구체적 장소명
  ]

  let detailCount = 0
  for (const pattern of specificDetailPatterns) {
    detailCount += (content.match(pattern) || []).length
  }

  // 감성적 체험 표현
  const sensoryPatterns = [
    /(맛있|맛이|풍미|식감|향이|향기|냄새|향긋)/g,
    /(분위기|느낌|인상|감동|감성|아늑|편안|쾌적)/g,
    /(아쉬운|아쉽|단점|불편|개선)/g,
    /(추천|강추|비추|별로)/g,
  ]

  let sensoryCount = 0
  for (const pattern of sensoryPatterns) {
    sensoryCount += (content.match(pattern) || []).length
  }

  // 시행착오/팁 패턴
  const tipPatterns = [
    /(주의할\s*점|참고로|팁|꿀팁|노하우|비법|포인트)/g,
    /(처음에는|나중에|결국|시행착오|실패|성공)/g,
    /(알고\s*보니|몰랐는데|깨달|배운)/g,
  ]

  let tipCount = 0
  for (const pattern of tipPatterns) {
    tipCount += (content.match(pattern) || []).length
  }

  // 점수 산출
  // 경험 표현 (0~8점)
  if (experienceCount >= 5) score += 8
  else if (experienceCount >= 3) score += 6
  else if (experienceCount >= 1) score += 3
  else improvements.push('직접 경험한 내용을 "직접 해봤는데", "실제로 사용해보니" 등으로 표현하세요')

  // 구체적 디테일 (0~5점)
  if (detailCount >= 5) score += 5
  else if (detailCount >= 3) score += 3
  else if (detailCount >= 1) score += 1
  else improvements.push('구체적인 가격, 시간, 장소 등을 포함하면 DIA 점수가 올라갑니다')

  // 감성/체험 (0~4점)
  if (sensoryCount >= 4) score += 4
  else if (sensoryCount >= 2) score += 2
  else if (sensoryCount >= 1) score += 1

  // 팁/노하우 (0~3점)
  if (tipCount >= 3) score += 3
  else if (tipCount >= 1) score += 2

  if (score >= 16) {
    strengths.push(`경험 기반 콘텐츠 우수 (경험 표현 ${experienceCount}회, 구체적 정보 ${detailCount}개)`)
  }

  const details = `경험 표현 ${experienceCount}회 / 구체적 정보 ${detailCount}개 / 감성 표현 ${sensoryCount}회 / 팁 ${tipCount}개`

  return {
    id: 'experience',
    name: '경험 정보',
    score,
    maxScore: 20,
    details,
    tip: 'DIA 로직은 직접 경험을 가장 높이 평가합니다. "~해봤다", "직접 ~했다" 표현과 구체적 수치를 포함하세요.',
  }
}

/**
 * 2. 정보 충실성 분석 (15점)
 * "사용자 의도를 충족시킬 수 있는 충분한 정보량, 구체적인 수치 및 데이터 포함 여부"
 */
function analyzeInformationRichness(
  content: string,
  contentLength: number,
  strengths: string[],
  improvements: string[],
): DiaCategory {
  let score = 0

  // 구체적 수치 데이터 (숫자+단위)
  const dataPatterns = [
    /\d+(\.\d+)?\s*(원|만원|억|kg|g|ml|L|cm|m|km|%|개|번|회|건|점|명|인|시간|분|초|일|개월|년)/g,
  ]
  let dataCount = 0
  for (const p of dataPatterns) {
    dataCount += (content.match(p) || []).length
  }

  // 단계별/순서 구조
  const hasSteps = /(?:^\d+[.)]\s|^(?:첫째|둘째|셋째|넷째|step|STEP)\s)/gm.test(content)
  const hasNumberedList = (content.match(/^\d+[.)]\s/gm) || []).length >= 3

  // 명확한 결론/요약
  const hasConclusion = /(결론|정리|요약|마무리|총평|마치며|마지막으로)/i.test(content)

  // 비교 정보 (표, 대안 제시)
  const hasComparison = /(비교|대안|장단점|장점|단점|vs|차이점)/g.test(content)

  // [2025-2026] 권위 있는 출처 인용 품질 (AuthGR 가산점 요소)
  // 통계, 정부 기관, 학술 논문, 공신력 있는 언론사 인용 감지
  const citationPatterns = [
    /(통계청|국가통계|정부\s*발표|공식\s*발표|공식\s*데이터)/g,
    /(연구\s*결과|논문|학술|연구에\s*따르면|조사에\s*따르면)/g,
    /(보도에\s*따르면|기사에\s*따르면|보도자료|언론\s*보도)/g,
    /(식약처|교육부|보건복지부|환경부|국토교통부|과학기술|산업통상)/g,
    /(한국\s*소비자원|소비자\s*보호원|한국\s*은행|금융\s*감독원)/g,
    /(\d{4}년\s*(기준|조사|발표|통계))/g,
    /(출처|참고자료|참고문헌|인용)\s*[:：]/g,
  ]
  let citationCount = 0
  for (const p of citationPatterns) {
    citationCount += (content.match(p) || []).length
  }

  // [2025-2026] 정보 밀도 (양보다 질: 문서 길이 대비 실질 정보량)
  const words = content.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  const infoDensity = wordCount > 0 ? (dataCount + citationCount) / (wordCount / 100) : 0

  // 점수 산출
  // 수치 데이터 (0~4점)
  if (dataCount >= 8) score += 4
  else if (dataCount >= 5) score += 3
  else if (dataCount >= 3) score += 2
  else if (dataCount >= 1) score += 1
  else improvements.push('구체적인 수치(가격, 시간, 크기 등)를 포함하면 정보 가치가 높아집니다')

  // 충분한 정보량 (0~3점)
  if (contentLength >= 2500) score += 3
  else if (contentLength >= 1800) score += 2
  else if (contentLength >= 1200) score += 1
  else improvements.push('콘텐츠 분량을 1,500자 이상으로 늘리세요')

  // 구조화된 정보 (0~2점)
  if (hasSteps || hasNumberedList) score += 1
  if (hasComparison) score += 1

  // 결론 존재 (0~3점)
  if (hasConclusion) {
    score += 3
  } else {
    improvements.push('"결론" 또는 "정리" 섹션을 추가하여 핵심 내용을 요약하세요')
  }

  // [2025-2026] 출처 인용 (0~3점) - AuthGR 가산점
  if (citationCount >= 3) {
    score += 3
    strengths.push(`권위 있는 출처 인용 ${citationCount}회: AuthGR 신뢰도 가산점`)
  } else if (citationCount >= 1) {
    score += 1
  } else {
    improvements.push('통계, 정부 발표, 연구 결과 등 권위 있는 출처를 인용하면 AuthGR 가산점을 받습니다')
  }

  if (score >= 12) {
    strengths.push(`정보 충실성 우수 (수치 ${dataCount}개, 인용 ${citationCount}회, ${contentLength.toLocaleString()}자)`)
  }

  return {
    id: 'information_richness',
    name: '정보 충실성',
    score,
    maxScore: 15,
    details: `수치 ${dataCount}개 / 인용 ${citationCount}회 / ${contentLength.toLocaleString()}자 / 밀도 ${infoDensity.toFixed(1)} / 결론(${hasConclusion ? 'O' : 'X'})`,
    tip: '2026 AuthGR은 권위 있는 출처 인용을 높이 평가합니다. 통계, 연구 결과, 공식 발표를 인용하세요.',
  }
}

/**
 * 3. 주제 적합도 분석 (12점)
 * "검색어와 제목, 본문 내용 간의 논리적 연관성 및 주제의 일관성"
 */
function analyzeTopicRelevance(
  keyword: string,
  title: string,
  content: string,
  strengths: string[],
  improvements: string[],
): DiaCategory {
  let score = 0

  // 제목-키워드 일치
  const titleHasKeyword = title.includes(keyword)

  // 본문 초반 200자에 키워드 포함
  const intro = content.substring(0, 200)
  const introHasKeyword = intro.includes(keyword)

  // 소제목에 키워드/관련어 포함
  const headings = content.match(/^#{1,3}\s+.+$/gm) || []
  const headingsWithKeyword = headings.filter(h => h.includes(keyword)).length

  // 본문 전체 키워드 등장 횟수
  const keywordCount = content.split(keyword).length - 1

  // 3등분 분포
  const third = Math.floor(content.length / 3)
  const inFirst = content.substring(0, third).includes(keyword)
  const inMiddle = content.substring(third, third * 2).includes(keyword)
  const inLast = content.substring(third * 2).includes(keyword)
  const coverage = [inFirst, inMiddle, inLast].filter(Boolean).length

  // 점수 산출
  // 제목 키워드 (0~4점)
  if (titleHasKeyword) {
    score += 4
  } else {
    score += 0
    improvements.push('제목에 핵심 키워드를 자연스럽게 포함하세요')
  }

  // 초반 키워드 (0~3점)
  if (introHasKeyword) {
    score += 3
  } else {
    score += 1
    improvements.push('도입부(첫 200자)에 키워드를 자연스럽게 언급하세요')
  }

  // 키워드 분포 (0~3점)
  if (coverage === 3) score += 3
  else if (coverage === 2) score += 2
  else score += 1

  // 소제목 키워드 (0~2점)
  if (headingsWithKeyword >= 2) score += 2
  else if (headingsWithKeyword >= 1) score += 1

  // 키워드 스터핑 감지 → 감점 적용
  let stuffingNote = ''
  if (keywordCount >= 2) {
    const stuffing = detectStuffingPatterns(keyword, content)
    const stuffRatio = stuffing.totalCount > 0 ? stuffing.stuffedCount / stuffing.totalCount : 0

    if (stuffRatio >= 0.5) {
      // 절반 이상이 부자연스러운 배치 → 큰 감점
      score = Math.max(0, score - 5)
      stuffingNote = ` / 스터핑 감지(${stuffing.patterns.join(', ')})`
      improvements.push(`키워드 스터핑 감지 (${stuffing.patterns.join(', ')}). 자연스러운 문장 속에 키워드를 녹여주세요`)
    } else if (stuffRatio >= 0.3) {
      // 30% 이상 부자연스러운 배치 → 소폭 감점
      score = Math.max(0, score - 3)
      stuffingNote = ` / 부자연스러운 배치(${stuffing.patterns.join(', ')})`
      improvements.push(`부자연스러운 키워드 배치 감지 (${stuffing.patterns.join(', ')}). 자연스럽게 문장에 포함하세요`)
    }
  }

  if (score >= 10) {
    strengths.push('주제 적합도 우수: 키워드가 자연스럽게 전반에 분포')
  }

  return {
    id: 'topic_relevance',
    name: '주제 적합도',
    score,
    maxScore: 12,
    details: `제목(${titleHasKeyword ? 'O' : 'X'}) / 도입부(${introHasKeyword ? 'O' : 'X'}) / 소제목 ${headingsWithKeyword}개 / 분포 ${coverage}/3 / 총 ${keywordCount}회${stuffingNote}`,
    tip: '제목, 도입부, 소제목에 키워드를 자연스럽게 녹여 주제 적합도를 높이세요.',
  }
}

/**
 * 4. 문서 의도 분석 (12점)
 * "정보 제공이라는 본연의 목적 준수 여부 및 낚시성/광고성 의도 배제 정도"
 */
function analyzeDocumentIntent(
  title: string,
  content: string,
  warnings: string[],
  strengths: string[],
  improvements: string[],
): DiaCategory {
  let score = 12 // 감점 방식

  // 낚시성 제목 패턴 감지 (-3점)
  const clickbaitPatterns = [
    /(충격|경악|대박|필독|클릭|놀라운|미쳤|헐|ㄷㄷ|실화)/i,
    /\?{2,}/,              // 물음표 연속
    /!{3,}/,               // 느낌표 과다
    /\.\.\./,              // 말줄임 낚시
  ]
  let clickbaitCount = 0
  for (const p of clickbaitPatterns) {
    if (p.test(title)) clickbaitCount++
  }
  if (clickbaitCount >= 2) {
    score -= 3
    warnings.push('낚시성 제목 패턴이 감지되었습니다. DIA는 이를 감점 요소로 봅니다.')
  } else if (clickbaitCount >= 1) {
    score -= 1
    warnings.push('자극적인 제목 표현이 있습니다. 정보 중심 제목이 DIA에 유리합니다.')
  }

  // 광고성 표현 밀도 (-4점)
  const adPatterns = [
    /(최저가|할인|세일|특가|이벤트|무료\s*배송|구매\s*링크|바로\s*가기)/g,
    /(협찬|제공받|광고|홍보|소정의\s*원고료)/g,
    /(지금\s*바로|서두르|한정|마감|품절\s*임박)/g,
  ]
  let adCount = 0
  for (const p of adPatterns) {
    adCount += (content.match(p) || []).length
  }

  const adDensity = content.length > 0 ? (adCount / (content.length / 1000)) : 0

  if (adDensity > 3) {
    score -= 4
    warnings.push('광고성 표현이 과도합니다. DIA는 정보 제공 목적의 문서를 우대합니다.')
  } else if (adDensity > 1.5) {
    score -= 2
    warnings.push('광고성 표현이 다소 많습니다. 정보 중심으로 작성하세요.')
  } else if (adCount === 0) {
    strengths.push('광고성 표현 없음: 순수 정보 제공 문서')
  }

  // 키워드 반복 스터핑 (-3점)
  const lines = content.split('\n')
  const lastLines = lines.slice(-5).join('\n')
  const tagSpam = (lastLines.match(/#[가-힣a-zA-Z0-9_]+/g) || []).length
  if (tagSpam > 15) {
    score -= 3
    warnings.push('태그 스터핑이 감지되었습니다. 태그는 5~10개가 적절합니다.')
  } else if (tagSpam > 10) {
    score -= 1
  }

  // CTA 위치 (-2점: 본문 중간에 상업 CTA가 있으면 감점)
  const firstHalf = content.substring(0, Math.floor(content.length / 2))
  const earlyCommercialCta = /(구매|주문|결제|신청|예약).*(하세요|해보세요|하러\s*가기|클릭)/.test(firstHalf)
  if (earlyCommercialCta) {
    score -= 2
    warnings.push('본문 초반에 상업적 유도 문구가 있습니다. 정보 제공 후 마지막에 배치하세요.')
  }

  score = Math.max(0, score)

  if (score >= 10) {
    strengths.push('문서 의도 양호: 정보 제공 중심의 신뢰할 수 있는 콘텐츠')
  }

  return {
    id: 'document_intent',
    name: '문서 의도',
    score,
    maxScore: 12,
    details: `낚시성(${clickbaitCount}건) / 광고성(${adCount}건, 밀도 ${adDensity.toFixed(1)}) / 태그(${tagSpam}개)`,
    tip: 'DIA는 "정보 제공"이 목적인 문서를 우대합니다. 광고/낚시 표현을 최소화하세요.',
  }
}

/**
 * 5. 독창성 분석 (12점)
 * "기존 문서들과의 유사성 배제, 새로운 정보나 해석의 포함 여부"
 */
function analyzeOriginality(
  content: string,
  strengths: string[],
  improvements: string[],
): DiaCategory {
  let score = 0

  // 제네릭(뻔한) 표현 감지
  const genericPatterns = [
    /(모두가\s*알다시피|잘\s*알려진|유명한|다들\s*아시|말할\s*것도\s*없이)/g,
    /(요즘\s*핫한|대세인|트렌드인|인기\s*만점|인기\s*폭발)/g,
    /(두말\s*하면\s*잔소리|말이\s*필요\s*없|최고\s*중의\s*최고)/g,
    /(오늘은\s*[^.]*소개|오늘은\s*[^.]*알아보|이번에는\s*[^.]*알아보)/g,
  ]
  let genericCount = 0
  for (const p of genericPatterns) {
    genericCount += (content.match(p) || []).length
  }

  // 문장 길이 다양성 (표준편차 기반)
  const sentences = content.split(/[.!?]\s/).filter(s => s.trim().length > 5)
  const lengths = sentences.map(s => s.length)
  const avgLen = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1)
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / (lengths.length || 1)
  const stdDev = Math.sqrt(variance)
  const lengthDiversity = avgLen > 0 ? stdDev / avgLen : 0 // 변이계수

  // 고유 표현 감지 (개인 의견/해석)
  const uniqueExpressionPatterns = [
    /(제\s*생각에는|개인적인\s*의견|솔직한\s*평가|느낀\s*점)/g,
    /(다른\s*곳에서는|여기서만|특별히|독특하게)/g,
    /(의외로|예상과\s*달리|놀랍게도|생각보다)/g,
  ]
  let uniqueCount = 0
  for (const p of uniqueExpressionPatterns) {
    uniqueCount += (content.match(p) || []).length
  }

  // 반복 문장 구조 감지 (템플릿 패턴)
  const sentenceStarts = sentences.map(s => s.trim().substring(0, 10))
  const startFreq: Record<string, number> = {}
  for (const start of sentenceStarts) {
    startFreq[start] = (startFreq[start] || 0) + 1
  }
  const repetitiveStarts = Object.values(startFreq).filter(v => v >= 3).length

  // [2025-2026] AuthGR 기계적 접속사 패턴 감지
  // AI 자동 생성 또는 짜깁기 콘텐츠의 특징: 접속사가 기계적으로 반복
  const mechanicalConjunctions = [
    /그러나\s/g, /따라서\s/g, /그러므로\s/g, /한편\s/g,
    /더불어\s/g, /아울러\s/g, /이에\s/g, /이러한\s/g,
    /또한\s/g, /뿐만\s*아니라/g, /결과적으로\s/g,
  ]
  let conjunctionCount = 0
  for (const p of mechanicalConjunctions) {
    conjunctionCount += (content.match(p) || []).length
  }
  // 접속사 밀도 (1000자당 접속사 수)
  const conjunctionDensity = content.length > 0 ? (conjunctionCount / (content.length / 1000)) : 0
  // 밀도가 높으면 기계적 패턴 의심
  const isConjunctionMechanical = conjunctionDensity > 4

  // 점수 산출
  // 제네릭 표현 적음 (0~3점)
  if (genericCount === 0) {
    score += 3
  } else if (genericCount <= 2) {
    score += 2
  } else {
    score += 0
    improvements.push('"잘 알려진", "유명한" 같은 뻔한 표현 대신 구체적 묘사를 사용하세요')
  }

  // 문장 다양성 (0~3점)
  if (lengthDiversity >= 0.4) {
    score += 3
  } else if (lengthDiversity >= 0.25) {
    score += 2
  } else {
    score += 1
    improvements.push('문장 길이를 다양하게 하면 읽기 흐름이 좋아집니다')
  }

  // 고유 표현 (0~2점)
  if (uniqueCount >= 3) {
    score += 2
  } else if (uniqueCount >= 1) {
    score += 1
  }

  // 템플릿 감지 (0~2점)
  if (repetitiveStarts === 0) {
    score += 2
  } else if (repetitiveStarts <= 1) {
    score += 1
  } else {
    improvements.push('같은 문장 패턴이 반복됩니다. 다양한 시작 표현을 사용하세요')
  }

  // [2025-2026] AuthGR 접속사 패턴 (0~2점)
  if (!isConjunctionMechanical && conjunctionCount <= 5) {
    score += 2
  } else if (!isConjunctionMechanical) {
    score += 1
  } else {
    score += 0
    improvements.push('접속사("따라서", "그러나", "또한" 등)가 기계적으로 반복됩니다. AuthGR이 스팸으로 판별할 수 있습니다')
  }

  if (score >= 10) {
    strengths.push('독창성 우수: 고유한 표현과 다양한 문장 구성')
  }

  return {
    id: 'originality',
    name: '독창성',
    score,
    maxScore: 12,
    details: `뻔한 표현 ${genericCount}회 / 문장 다양성 ${(lengthDiversity * 100).toFixed(0)}% / 고유 표현 ${uniqueCount}회 / 반복 패턴 ${repetitiveStarts}개 / 접속사 밀도 ${conjunctionDensity.toFixed(1)}`,
    tip: '2026 AuthGR은 기계적 접속사 패턴을 스팸으로 판별합니다. 자연스러운 문장 연결과 독창적 시각을 녹이세요.',
  }
}

/**
 * 6. 구조적 일관성 분석 (12점)
 * "제목-본문-이미지가 하나의 일관된 주제를 향해 정렬되어 있는지"
 */
function analyzeStructuralConsistency(
  title: string,
  content: string,
  contentLength: number,
  strengths: string[],
  improvements: string[],
): DiaCategory {
  let score = 0

  // 3단 구조 (도입-본문-결론)
  const hasIntro = contentLength >= 200 // 최소 도입부
  const headings = content.match(/^#{1,3}\s+.+$/gm) || []
  const h2Count = (content.match(/^## /gm) || []).length
  const hasConclusion = /(## .*(결론|정리|마무리|요약|마치며))/m.test(content)

  // 소제목 계층 구조
  const h3Count = (content.match(/^### /gm) || []).length
  const hasHierarchy = h2Count >= 2 && h3Count >= 1

  // 이미지 배치 균등성
  const imagePositions: number[] = []
  const imageRegex = /\[이미지[:\s]/g
  let match
  while ((match = imageRegex.exec(content)) !== null) {
    imagePositions.push(match.index / contentLength)
  }
  const imageCount = imagePositions.length

  let imageDistribution = 'none'
  if (imageCount >= 2) {
    // 이미지가 상단 30%에 몰려있는지 체크
    const topHeavy = imagePositions.filter(p => p < 0.3).length / imageCount
    if (topHeavy > 0.7) {
      imageDistribution = 'top_heavy'
    } else {
      imageDistribution = 'balanced'
    }
  }

  // 소제목 논리적 흐름 (소제목들이 제목 주제와 관련있는지)
  const titleWords = title.split(/\s+/).filter(w => w.length >= 2)
  const headingsRelated = headings.filter(h => {
    return titleWords.some(tw => h.includes(tw))
  }).length

  // [2025-2026] 질문형 소제목 감지 (AI 브리핑 최적화)
  // 2026년 AI 브리핑은 "질문 → 답변" 구조의 문서를 고품질로 인식
  const questionHeadings = headings.filter(h => /\?/.test(h))
  const questionHeadingCount = questionHeadings.length

  // 점수 산출
  // 3단 구조 (0~3점)
  if (hasIntro && h2Count >= 3 && hasConclusion) {
    score += 3
    strengths.push('도입-본문-결론 3단 구조 완비')
  } else if (hasIntro && h2Count >= 2) {
    score += 2
  } else if (h2Count >= 1) {
    score += 1
    improvements.push('도입부 → 소제목별 본문 → 결론/정리 구조를 갖추세요')
  }

  // 계층 구조 (0~3점)
  if (hasHierarchy) {
    score += 3
  } else if (h2Count >= 2) {
    score += 2
  } else {
    score += 0
    improvements.push('H2, H3 소제목을 계층적으로 사용하면 구조적 일관성이 높아집니다')
  }

  // 이미지 분포 (0~2점)
  if (imageDistribution === 'balanced') {
    score += 2
  } else if (imageDistribution === 'top_heavy') {
    score += 1
    improvements.push('이미지가 상단에 몰려있습니다. 본문 전반에 걸쳐 배치하세요')
  } else {
    score += 0
  }

  // 소제목-제목 연관성 (0~2점)
  if (headings.length > 0 && headingsRelated >= headings.length * 0.5) {
    score += 2
  } else if (headingsRelated >= 1) {
    score += 1
  }

  // [2025-2026] 질문형 소제목 (0~2점) - AI 브리핑 최적화
  if (questionHeadingCount >= 2) {
    score += 2
    strengths.push(`질문형 소제목 ${questionHeadingCount}개: AI 브리핑 최적화 구조`)
  } else if (questionHeadingCount >= 1) {
    score += 1
  } else if (headings.length >= 2) {
    improvements.push('소제목을 질문형("~할까요?", "~인가요?")으로 작성하면 2026 AI 브리핑에 최적화됩니다')
  }

  return {
    id: 'structural_consistency',
    name: '구조적 일관성',
    score,
    maxScore: 12,
    details: `H2 ${h2Count}개 / H3 ${h3Count}개 / 결론(${hasConclusion ? 'O' : 'X'}) / 질문형 소제목 ${questionHeadingCount}개 / 이미지(${imageDistribution})`,
    tip: '2026 AI 브리핑은 "질문형 소제목 → 답변" 구조를 고품질로 인식합니다. 소제목에 ?를 활용하세요.',
  }
}

/**
 * 7. 가독성 & 체류시간 예측 (10점)
 * "체류시간은 DIA가 문서의 질을 판단하는 가장 강력한 척도"
 */
function analyzeEngagement(
  content: string,
  contentLength: number,
  strengths: string[],
  improvements: string[],
): DiaCategory {
  let score = 0

  // 도입부 매력도 (Hook: 첫 200자)
  const intro = content.substring(0, 200)
  const hasQuestion = /\?/.test(intro)
  const hasEmphasis = /\*\*/.test(intro)
  const hookQuality = (hasQuestion ? 1 : 0) + (hasEmphasis ? 1 : 0) + (intro.length >= 100 ? 1 : 0)

  // [2025-2026] VLM 문단 최적화: 모바일 환경에서 2~3문장 단위 짧은 문단
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0)
  const longParagraphs = paragraphs.filter(p => p.length > 500).length
  const avgParagraphLen = paragraphs.reduce((sum, p) => sum + p.length, 0) / (paragraphs.length || 1)

  // VLM: 문단별 문장 수 (2~3문장이 모바일 최적)
  const paragraphSentenceCounts = paragraphs.map(p => {
    return p.split(/[.!?]\s/).filter(s => s.trim().length > 3).length
  })
  const mobileOptimalParagraphs = paragraphSentenceCounts.filter(c => c >= 1 && c <= 4).length
  const mobileOptimalRatio = paragraphs.length > 0 ? mobileOptimalParagraphs / paragraphs.length : 0

  // 시각적 휴식 (이미지/리스트 사이 텍스트)
  const hasImages = /\[이미지/.test(content)
  const hasBold = /\*\*/.test(content)
  const hasList = /^[-•]\s/m.test(content)
  const hasNumberedList = /^\d+[.)]\s/m.test(content)
  const visualBreaks = (hasImages ? 1 : 0) + (hasBold ? 1 : 0) + (hasList || hasNumberedList ? 1 : 0)

  // 질문/대화체 사용
  const questionCount = (content.match(/\?/g) || []).length
  const conversationalPatterns = (content.match(/(~인데요|~거든요|~더라고요|~했어요|~이에요|~세요)/g) || []).length

  // 점수 산출
  // 도입부 Hook (0~3점)
  if (hookQuality >= 2) {
    score += 3
    strengths.push('도입부에 질문/강조를 활용하여 독자 시선을 끌고 있습니다')
  } else if (hookQuality >= 1) {
    score += 2
  } else {
    score += 1
    improvements.push('도입부에 질문이나 강조(**볼드**)를 넣으면 체류시간이 늘어납니다')
  }

  // [2025-2026] VLM 모바일 문단 최적화 (0~3점)
  // 2~3문장 단위 짧은 문단이 VLM 평가에서 유리
  if (mobileOptimalRatio >= 0.8 && longParagraphs === 0 && paragraphs.length >= 5) {
    score += 3
    strengths.push('VLM 최적화: 모바일 친화적 짧은 문단 구성')
  } else if (mobileOptimalRatio >= 0.5 && longParagraphs <= 1) {
    score += 2
  } else if (longParagraphs <= 2) {
    score += 1
    improvements.push('문단을 2~3문장 단위로 짧게 나누면 VLM(시각 언어 모델) 평가에 유리합니다')
  } else {
    improvements.push('긴 문단이 많습니다. 모바일 가독성을 위해 2~3문장 단위로 분리하세요')
  }

  // 시각적 휴식 (0~2점)
  if (visualBreaks >= 3) {
    score += 2
  } else if (visualBreaks >= 1) {
    score += 1
  } else {
    improvements.push('이미지, 볼드, 리스트를 활용하여 시각적 리듬감을 만드세요')
  }

  // 대화체/질문 (0~2점)
  if (conversationalPatterns >= 3 || questionCount >= 3) {
    score += 2
  } else if (conversationalPatterns >= 1 || questionCount >= 1) {
    score += 1
  }

  return {
    id: 'engagement',
    name: '가독성 & 체류시간',
    score,
    maxScore: 10,
    details: `Hook(${hookQuality}/3) / 모바일 최적 문단 ${Math.round(mobileOptimalRatio * 100)}% / 긴 문단 ${longParagraphs}개 / 시각 요소(${visualBreaks}/3)`,
    tip: '2026 VLM은 렌더링된 화면의 레이아웃을 평가합니다. 2~3문장 문단, 시각적 일관성이 핵심입니다.',
  }
}

/**
 * 8. 멀티미디어 활용 (7점)
 * "이미지, 동영상 등 다양한 멀티미디어 요소와 본문 내용의 정합성"
 */
function analyzeMultimediaQuality(
  content: string,
  contentLength: number,
  strengths: string[],
  improvements: string[],
): DiaCategory {
  let score = 0

  // 이미지 수
  const imageMatches = content.match(/\[이미지[:\s][^\]]*\]/g) || []
  const imageCount = imageMatches.length

  // 이미지 설명 품질 (설명이 있는지)
  const descriptiveImages = imageMatches.filter(m => m.length > 10).length

  // 이미지 대비 본문 비율 (1000자당 1개 정도가 적절)
  const idealImageCount = Math.floor(contentLength / 1000)
  const imageRatio = idealImageCount > 0 ? imageCount / idealImageCount : 0

  // 이미지 배치 분포
  const imagePositions: number[] = []
  const regex = /\[이미지[:\s]/g
  let m
  while ((m = regex.exec(content)) !== null) {
    imagePositions.push(m.index)
  }

  let distributionScore = 0
  if (imageCount >= 2 && contentLength > 0) {
    // 이미지 간 간격의 일관성 체크
    const gaps: number[] = []
    for (let i = 1; i < imagePositions.length; i++) {
      gaps.push(imagePositions[i] - imagePositions[i - 1])
    }
    if (gaps.length > 0) {
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
      const minGap = Math.min(...gaps)
      // 최소 간격이 평균의 30% 이상이면 균등 배치
      if (minGap >= avgGap * 0.3) distributionScore = 1
    }
  }

  // 동영상 포함 여부
  const hasVideo = /\[동영상|동영상|영상|유튜브|youtube|video/i.test(content)

  // 점수 산출
  // 이미지 수 (0~3점)
  if (imageCount >= 4) {
    score += 3
    strengths.push(`이미지 ${imageCount}개 포함: 시각적 정보 풍부`)
  } else if (imageCount >= 2) {
    score += 2
  } else if (imageCount >= 1) {
    score += 1
    improvements.push('이미지를 3~5개 이상 추가하면 DIA 점수가 올라갑니다')
  } else {
    improvements.push('이미지가 없습니다. 직접 촬영한 사진을 포함하세요')
  }

  // 분포 (0~2점)
  score += distributionScore
  if (imageCount >= 2 && distributionScore === 0) {
    score += 1 // 있긴 함
  }

  // 동영상 보너스 (0~1점)
  if (hasVideo) score += 1

  // 이미지 설명 품질 (0~1점)
  if (descriptiveImages >= imageCount * 0.5 && imageCount > 0) {
    score += 1
  }

  return {
    id: 'multimedia',
    name: '멀티미디어 활용',
    score: Math.min(7, score),
    maxScore: 7,
    details: `이미지 ${imageCount}개 (설명 있는 ${descriptiveImages}개) / 분포(${distributionScore ? '균등' : imageCount < 2 ? '-' : '편중'}) / 동영상(${hasVideo ? 'O' : 'X'})`,
    tip: 'DIA+는 이미지-본문 정합성을 중시합니다. 직접 촬영한 관련 이미지를 본문 곳곳에 배치하세요.',
  }
}
