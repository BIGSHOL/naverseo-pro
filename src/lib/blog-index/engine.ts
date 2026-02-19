/**
 * NaverSEO Pro - 블로그 지수 측정 엔진 v2
 *
 * 기술 문서 기반 개선 (네이버_블로그_지수_산출_기술_분석.md 참조)
 *
 * 가중치 모델: S_total = α(C_rank) + β(D_dia) + γ(Activity) + δ(Search) - P(Abuse)
 * 문서 제안: C_rank(0.4) + D_dia(0.4) + Activity(0.2)
 * 현실 적용: 콘텐츠(0.30) + 주제(0.25) + 검색(0.20) + 활동(0.15) + 영향력(0.10) - 어뷰징
 *
 * 5대 분석 축 + 어뷰징 페널티:
 * 1. 콘텐츠 품질 (D.I.A. proxy) - 30점: 글 구조, 이미지 분석, 텍스트 품질, 키워드 밀도
 * 2. 주제 전문성 (C-Rank proxy) - 25점: 주제 집중도, 키워드 일관성, 연관어 분석
 * 3. 검색 파워 - 20점: 키워드 노출률, 평균 순위
 * 4. 활동성 - 15점: 포스팅 빈도, 규칙성, 최근성
 * 5. 영향력 - 10점: 키워드 커버리지, 상위 노출 강도
 * P. 어뷰징 감점 - 최대 -20점: 키워드 과다 반복, 제목 유사도, 패턴 의심
 */

// ===== 타입 정의 =====

export interface BlogPost {
  title: string
  link: string
  description: string
  postdate: string // YYYYMMDD
}

export interface KeywordRankResult {
  keyword: string
  rank: number | null
  totalResults: number
}

export interface AnalysisCategory {
  name: string
  score: number
  maxScore: number
  grade: string
  details: string[]
}

export interface BlogLevelInfo {
  tier: number           // 1~10
  category: string       // 저품질 / 일반 / 준최적화 / 최적화
  label: string          // Lv.1 저품질 위험 ~ Lv.10 최적3/파워
  shortLabel: string     // 짧은 라벨 (배지용): 저품질, 일반+, 최적2 등
  description: string    // 상세 설명
  color: string          // UI 색상 키 (red/orange/yellow/green 등)
  badgeColor: string     // Tailwind 배지 색상 클래스
  nextTierScore: number | null  // 다음 등급까지 필요한 점수 (최고 등급이면 null)
}

export interface PostQuality {
  score: number          // 0~12
  tier: number           // 1~10 (전체 블로그 지수 등급 체계와 동일)
  label: string          // "준최4", "최적1", "일반2" 등
  category: string       // 저품질/일반/준최적화/최적화
}

export interface PostDetail {
  title: string
  link: string
  daysAgo: number
  date: string           // YYYY.MM.DD
  charCount: number      // 설명문 기준 추정 글자수
  hasImage: boolean      // 이미지 태그 포함 여부
  imageCount: number     // 이미지 개수 (v2 추가)
  titleLength: number
  quality: PostQuality   // 개별 포스트 품질 지수
}

export interface BlogProfile {
  blogId: string | null
  blogName: string | null
  blogUrl: string
  totalPosts: number
  categoryKeywords: string[]
  estimatedStartDate: string | null
  isActive: boolean
  blogAgeDays: number | null    // 블로그 운영 일수 (분석 기간 기준)
  postsPerWeek: number | null   // 주간 포스팅 수
}

export interface BenchmarkData {
  // 나의 수치 vs 권장 수치
  postingFrequency: { mine: number; recommended: number; topBlogger: number }  // 주간 포스팅 횟수
  avgTitleLength: { mine: number; optimal: number }
  avgContentLength: { mine: number; recommended: number }
  imageRate: { mine: number; recommended: number }           // 이미지 포함률 %
  topicFocus: { mine: number; recommended: number }          // 주제 집중도 %
  keywordDensity: { mine: number; optimal: [number, number] }  // 키워드 밀도 (v2 추가)
  avgImageCount: { mine: number; recommended: number }         // 이미지 개수 (v2 추가)
  optimizationPct: number                                     // 최적화 수치 (0~100)
  categoryPercentile: number                                  // 전체 상위 X%
}

/** 어뷰징 페널티 결과 (v2 추가) */
export interface AbusePenalty {
  score: number           // 0 ~ -20 (0이면 페널티 없음)
  details: string[]       // 감지된 어뷰징 설명
  flags: string[]         // 감지된 어뷰징 유형 코드 (UI 아이콘 표시용)
}

/** AI 심층 분석 결과 (v2.5 추가) */
export interface AiAnalysis {
  experienceScore: number    // 1~10 경험 정보 점수
  experienceDetails: string  // 경험 정보 설명
  qualityScore: number       // 1~10 콘텐츠 품질 심층 평가
  qualityDetails: string     // 품질 평가 설명
  abuseRisk: number          // 0~10 어뷰징 위험도
  abuseDetails: string       // 어뷰징 분석 설명
  strengths: string[]        // 블로그 강점
  weaknesses: string[]       // 블로그 약점
  recommendations: string[]  // AI 맞춤 추천
  analyzedPosts: number      // 분석한 포스트 수
  // AI 점수 보정값 (알고리즘 점수에 가산/감산)
  scoreAdjustment: number    // -10 ~ +10
  adjustmentReason: string   // 보정 이유
}

export interface BlogIndexResult {
  blogUrl: string
  blogId: string | null
  totalScore: number
  level: BlogLevelInfo
  categories: AnalysisCategory[]
  abusePenalty: AbusePenalty       // v2 추가
  aiAnalysis?: AiAnalysis          // v2.5 추가 (AI 심층 분석)
  keywordResults: KeywordRankResult[]
  postAnalysis: {
    totalFound: number
    avgTitleLength: number
    avgDescLength: number
    avgImageCount: number          // v2 추가
    topicKeywords: string[]
    postingFrequency: string
    recentPostDays: number | null
  }
  recentPosts: PostDetail[]
  blogProfile: BlogProfile
  benchmark: BenchmarkData
  recommendations: string[]
  isDemo: boolean
  checkedAt: string
}

// ===== 유틸리티 =====

function extractBlogId(url: string): string | null {
  const match = url.match(
    /(?:blog\.naver\.com|m\.blog\.naver\.com)\/([a-zA-Z0-9_-]+)/
  )
  return match ? match[1] : null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim()
}

function daysBetween(date1: Date, date2: Date): number {
  return Math.floor(Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
}

function parsePostDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.substring(0, 4))
  const m = parseInt(yyyymmdd.substring(4, 6)) - 1
  const d = parseInt(yyyymmdd.substring(6, 8))
  return new Date(y, m, d)
}

/** 이미지 개수 추출 (설명문 HTML에서 <img 태그 카운트) */
function countImages(descHtml: string): number {
  const imgMatches = descHtml.match(/<img[\s>]/gi)
  return imgMatches ? imgMatches.length : 0
}

/**
 * 한국어 불용어 세트
 * 형태소 분석기 없이도 기본적인 조사/접미사를 걸러내기 위한 목록
 */
const STOPWORDS = new Set([
  '그리고', '하지만', '그래서', '때문에', '입니다', '합니다', '있습니다', '됩니다',
  '것입니다', '블로그', '포스팅', '오늘은', '안녕하세요', '이번에', '정말', '진짜',
  '같은', '통해', '대한', '위한', '하는', '있는', '되는', '만들기', '사용', '방법',
  '추천', '후기', '리뷰', '정보', '이야기', '소개', '관련', '대해', '가지',
  'the', 'and', 'for', 'with', 'this', 'that', 'from',
])

/**
 * 텍스트에서 의미 있는 키워드 추출
 * 한글 2글자 이상, 영문 3글자 이상 단어 + 불용어 제외
 */
function extractKeywords(text: string): string[] {
  const words = text.match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || []
  return words.map(w => w.toLowerCase()).filter(w => !STOPWORDS.has(w))
}

/** 두 배열의 Jaccard 유사도 계산 (0~1) */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = Array.from(setA).filter(x => setB.has(x)).length
  const union = new Set(a.concat(b)).size
  return union === 0 ? 0 : intersection / union
}

// ===== 1. 콘텐츠 품질 분석 (D.I.A. proxy) — 30점 =====
//
// 기술 문서 3절 근거:
// - 문서 구조화 지수 (S_structure = w₁H + w₂Quotes + w₃Sep + w₄Caption)
// - 텍스트-이미지 교차 비율 (이미지 1장당 300~500자 권장)
// - 키워드 밀도 (TF-IDF 기반, 0.5%~3% 자연스러운 분포)
// - 정보 충실성 (구체적 수치, 리스트, 가격 정보 포함 여부)

function analyzeContentQuality(posts: BlogPost[]): AnalysisCategory {
  const maxScore = 30
  const details: string[] = []
  let score = 0

  if (posts.length === 0) {
    return { name: '콘텐츠 품질', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] }
  }

  // === 제목 품질 (6점) ===
  const avgTitleLen = posts.reduce((sum, p) => sum + stripHtml(p.title).length, 0) / posts.length
  if (avgTitleLen >= 15 && avgTitleLen <= 40) {
    score += 6
    details.push(`제목 길이 최적 (평균 ${Math.round(avgTitleLen)}자)`)
  } else if (avgTitleLen >= 10 && avgTitleLen <= 50) {
    score += 4
    details.push(`제목 길이 양호 (평균 ${Math.round(avgTitleLen)}자)`)
  } else {
    score += 1
    details.push(`제목 길이 개선 필요 (평균 ${Math.round(avgTitleLen)}자, 권장: 15~40자)`)
  }

  // === 콘텐츠 깊이 - 설명문 길이 (6점) ===
  const avgDescLen = posts.reduce((sum, p) => sum + stripHtml(p.description).length, 0) / posts.length
  if (avgDescLen >= 150) {
    score += 6
    details.push(`콘텐츠 깊이 우수 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else if (avgDescLen >= 100) {
    score += 4
    details.push(`콘텐츠 깊이 양호 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else if (avgDescLen >= 50) {
    score += 2
    details.push(`콘텐츠 깊이 보통 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else {
    score += 1
    details.push(`콘텐츠가 너무 짧습니다 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  }

  // === 이미지 분석 (6점) — v2 신규 ===
  // 기술 문서 3.2절: 텍스트-이미지 교차 비율, 이미지 독창성
  const imageCounts = posts.map(p => countImages(p.description))
  const avgImageCount = imageCounts.reduce((s, c) => s + c, 0) / posts.length
  const postsWithImages = imageCounts.filter(c => c > 0).length
  const imageRate = postsWithImages / posts.length

  if (imageRate >= 0.8 && avgImageCount >= 2) {
    score += 6
    details.push(`이미지 활용 우수 (${Math.round(imageRate * 100)}% 포스트에 평균 ${avgImageCount.toFixed(1)}장)`)
  } else if (imageRate >= 0.6 && avgImageCount >= 1) {
    score += 4
    details.push(`이미지 활용 양호 (${Math.round(imageRate * 100)}% 포스트에 이미지 포함)`)
  } else if (imageRate >= 0.3) {
    score += 2
    details.push(`이미지 활용 부족 (${Math.round(imageRate * 100)}% 포스트에만 이미지 포함)`)
  } else {
    score += 0
    details.push('이미지가 거의 없습니다 - 직접 촬영한 원본 이미지를 추가하세요')
  }

  // 텍스트-이미지 교차 비율 체크 (이미지가 있는 포스트 대상)
  // 기술 문서: 이미지 1장당 텍스트 300~500자가 이상적
  if (avgImageCount > 0) {
    const textPerImage = avgDescLen / avgImageCount
    if (textPerImage >= 200 && textPerImage <= 600) {
      details.push(`텍스트-이미지 비율 적정 (이미지당 ${Math.round(textPerImage)}자)`)
    } else if (textPerImage < 200) {
      details.push('이미지 대비 텍스트가 부족합니다 - 이미지당 300~500자를 권장합니다')
    }
  }

  // === 구조/서식 패턴 감지 (6점) — v2 신규 ===
  // 기술 문서 3.1.3절: S_structure = w₁(H_tags) + w₂(Quotes) + w₃(Separators) + w₄(Img_caption)
  let structureScore = 0
  const structureDetails: string[] = []

  // 리스트/번호 패턴 (구조화된 정보)
  const hasListPattern = posts.filter(p =>
    /[①②③④⑤⑥⑦⑧⑨⑩]|[1-9]\.\s|•|▶|■|★|✔|✅/.test(p.description)
  ).length
  if (hasListPattern >= posts.length * 0.5) {
    structureScore += 2
    structureDetails.push('리스트/번호 활용 우수')
  } else if (hasListPattern >= posts.length * 0.2) {
    structureScore += 1
    structureDetails.push('리스트/번호 활용 보통')
  }

  // 구체적 수치/데이터 포함 (가격, 시간, 거리 등)
  const hasConcreteData = posts.filter(p =>
    /\d+[만천백]?\s*원|₩\d|가격|비용|\d+분|\d+km|\d+[%퍼센트]/.test(p.description)
  ).length
  if (hasConcreteData >= posts.length * 0.4) {
    structureScore += 2
    structureDetails.push('구체적 수치/데이터 활용 우수')
  } else if (hasConcreteData >= posts.length * 0.15) {
    structureScore += 1
    structureDetails.push('구체적 수치/데이터 활용 보통')
  }

  // 서식 활용 (볼드, 링크 등)
  const hasFormatting = posts.filter(p =>
    /<b>|<strong>|<a\s|<em>|<mark>/.test(p.description)
  ).length
  if (hasFormatting >= posts.length * 0.3) {
    structureScore += 2
    structureDetails.push('서식 활용 우수')
  } else if (hasFormatting >= posts.length * 0.1) {
    structureScore += 1
  }

  score += structureScore
  if (structureDetails.length > 0) {
    details.push(structureDetails.join(', '))
  } else {
    details.push('콘텐츠 구조화가 부족합니다 - 리스트, 소제목, 구체적 수치를 활용하세요')
  }

  // === 제목 다양성 & 키워드 활용 (3점) ===
  const titleWords = new Set<string>()
  posts.forEach((p) => {
    const words = stripHtml(p.title).split(/\s+/)
    words.forEach((w) => { if (w.length >= 2) titleWords.add(w) })
  })
  const diversity = titleWords.size / posts.length
  if (diversity >= 3) {
    score += 3
    details.push('제목 키워드 다양성 우수')
  } else if (diversity >= 2) {
    score += 2
    details.push('제목 키워드 다양성 양호')
  } else {
    score += 1
    details.push('제목 키워드 다양성 부족 - 더 다양한 키워드를 활용하세요')
  }

  // === 정보 충실성 (3점) ===
  const hasNumbers = posts.filter((p) => /\d+/.test(p.description)).length
  if (hasNumbers >= posts.length * 0.5) {
    score += 3
    details.push('콘텐츠에 구체적 수치 활용 우수')
  } else if (hasNumbers >= posts.length * 0.2) {
    score += 1
    details.push('콘텐츠에 수치 활용 보통')
  }

  const grade = score >= 24 ? 'S' : score >= 18 ? 'A' : score >= 12 ? 'B' : score >= 6 ? 'C' : 'D'

  return { name: '콘텐츠 품질', score: Math.min(maxScore, score), maxScore, grade, details }
}

// ===== 2. 주제 전문성 분석 (C-Rank proxy) — 25점 =====
//
// 기술 문서 1.1절 근거:
// - Context(맥락): 카테고리 일관성 비율 → 주제 집중도
// - Content(내용): 전체 글 대비 상위 노출 비율 → 키워드 일관성
// - Chain(연결): 이웃의 질적 수준 → 현재 API로 측정 불가, Co-occurrence로 대체
//
// 기술 문서 3.1.2절:
// - Co-occurrence Analysis: 타겟 키워드와 함께 등장하는 연관 단어 분석

function analyzeTopicAuthority(posts: BlogPost[]): { category: AnalysisCategory; topicKeywords: string[] } {
  const maxScore = 25
  const details: string[] = []
  let score = 0
  const topicKeywords: string[] = []

  if (posts.length === 0) {
    return {
      category: { name: '주제 전문성', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      topicKeywords,
    }
  }

  // 모든 제목+설명에서 키워드 추출 (불용어 제거)
  const wordFreq: Record<string, number> = {}
  // 포스트별 키워드 셋 (co-occurrence 분석용)
  const postKeywordSets: string[][] = []

  posts.forEach((p) => {
    const text = stripHtml(p.title) + ' ' + stripHtml(p.description)
    const words = extractKeywords(text)
    const uniqueWords = Array.from(new Set(words))
    postKeywordSets.push(uniqueWords)
    uniqueWords.forEach((w) => {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })
  })

  // 상위 빈출 키워드 추출
  const sorted = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  sorted.slice(0, 5).forEach(([word]) => topicKeywords.push(word))

  // === 주제 집중도 (12점) ===
  // 기술 문서 1.1.1: Concentration Ratio — 특정 주제에 집중하는가?
  if (sorted.length > 0) {
    const topKeyword = sorted[0]
    const topKeywordRate = topKeyword[1] / posts.length

    if (topKeywordRate >= 0.7) {
      score += 12
      details.push(`주제 집중도 우수: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.5) {
      score += 9
      details.push(`주제 집중도 양호: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.3) {
      score += 6
      details.push(`주제 집중도 보통: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else {
      score += 3
      details.push('주제가 분산되어 있습니다 - 하나의 주제에 집중하면 C-Rank 향상에 도움됩니다')
    }
  }

  // === 키워드 일관성 (8점) ===
  if (sorted.length >= 3) {
    const top3Coverage = sorted.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / (posts.length * 3)
    if (top3Coverage >= 0.5) {
      score += 8
      details.push(`핵심 키워드 일관성 우수 (${sorted.slice(0, 3).map(([w]) => w).join(', ')})`)
    } else if (top3Coverage >= 0.3) {
      score += 5
      details.push('핵심 키워드 일관성 양호')
    } else {
      score += 2
      details.push('핵심 키워드 일관성 부족 - 관련 키워드를 반복 활용하세요')
    }
  }

  // === Co-occurrence 연관어 분석 (5점) — v2 신규 ===
  // 기술 문서 3.1.2절: 타겟 키워드와 함께 등장하는 연관 단어 분석
  // 상위 키워드와 자주 함께 등장하는 연관 키워드가 있으면 문맥 점수 높음
  if (sorted.length >= 2 && postKeywordSets.length >= 3) {
    const topWord = sorted[0][0]
    const coOccurrence: Record<string, number> = {}

    // 상위 키워드가 등장하는 포스트에서 함께 등장하는 단어 카운트
    postKeywordSets.forEach((kwSet) => {
      if (kwSet.includes(topWord)) {
        kwSet.forEach((w) => {
          if (w !== topWord) {
            coOccurrence[w] = (coOccurrence[w] || 0) + 1
          }
        })
      }
    })

    // 연관 키워드 빈도 분석: 상위 키워드와 50% 이상 동반 등장하는 단어 수
    const topWordCount = sorted[0][1]
    const strongCoWords = Object.entries(coOccurrence)
      .filter(([, count]) => count >= topWordCount * 0.4)
      .length

    if (strongCoWords >= 5) {
      score += 5
      details.push(`연관 키워드 체계 우수 (${strongCoWords}개 키워드가 주제와 강하게 연결)`)
    } else if (strongCoWords >= 3) {
      score += 3
      details.push(`연관 키워드 체계 양호 (${strongCoWords}개 키워드 연결)`)
    } else if (strongCoWords >= 1) {
      score += 1
      details.push('연관 키워드가 부족합니다 - 주제와 관련된 다양한 세부 키워드를 활용하세요')
    } else {
      details.push('연관 키워드 체계 없음 - 하나의 주제를 다양한 각도로 다뤄보세요')
    }
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return {
    category: { name: '주제 전문성', score: Math.min(maxScore, score), maxScore, grade, details },
    topicKeywords,
  }
}

// ===== 3. 검색 파워 분석 — 20점 (기존 25점에서 축소) =====

function analyzeSearchPower(keywordResults: KeywordRankResult[]): AnalysisCategory {
  const maxScore = 20
  const details: string[] = []
  let score = 0

  if (keywordResults.length === 0) {
    return { name: '검색 파워', score: 0, maxScore, grade: 'F', details: ['분석할 키워드 결과가 없습니다'] }
  }

  const ranked = keywordResults.filter((r) => r.rank !== null)
  const rankedCount = ranked.length
  const total = keywordResults.length
  const exposureRate = rankedCount / total

  // 노출률 (8점)
  const exposureScore = Math.round(exposureRate * 8)
  score += exposureScore
  details.push(`검색 노출률: ${rankedCount}/${total} (${Math.round(exposureRate * 100)}%)`)

  // 평균 순위 (7점)
  if (rankedCount > 0) {
    const avgRank = ranked.reduce((sum, r) => sum + (r.rank || 0), 0) / rankedCount
    if (avgRank <= 5) score += 7
    else if (avgRank <= 10) score += 6
    else if (avgRank <= 20) score += 4
    else if (avgRank <= 30) score += 3
    else if (avgRank <= 50) score += 2
    else score += 1
    details.push(`평균 순위: ${Math.round(avgRank)}위`)
  }

  // TOP 10 비율 (5점)
  const top10 = ranked.filter((r) => r.rank! <= 10).length
  const top10Rate = top10 / total
  score += Math.round(top10Rate * 5)
  if (top10 > 0) {
    details.push(`TOP 10 키워드: ${top10}개`)
  }

  const grade = score >= 16 ? 'S' : score >= 12 ? 'A' : score >= 8 ? 'B' : score >= 4 ? 'C' : 'D'

  return { name: '검색 파워', score: Math.min(maxScore, score), maxScore, grade, details }
}

// ===== 4. 활동성 분석 — 15점 (변동 없음) =====

function analyzeActivity(posts: BlogPost[]): { category: AnalysisCategory; frequency: string; recentPostDays: number | null } {
  const maxScore = 15
  const details: string[] = []
  let score = 0
  let frequency = '분석 불가'
  let recentPostDays: number | null = null

  if (posts.length === 0) {
    return {
      category: { name: '활동성', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  const now = new Date()

  // 포스트 날짜 파싱 및 정렬
  const dates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  if (dates.length === 0) {
    return {
      category: { name: '활동성', score: 2, maxScore, grade: 'D', details: ['포스트 날짜를 파싱할 수 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  // 최근 포스팅 (5점)
  recentPostDays = daysBetween(now, dates[0])
  if (recentPostDays <= 3) {
    score += 5
    details.push(`최근 포스팅: ${recentPostDays}일 전 (매우 활발)`)
  } else if (recentPostDays <= 7) {
    score += 4
    details.push(`최근 포스팅: ${recentPostDays}일 전 (활발)`)
  } else if (recentPostDays <= 14) {
    score += 3
    details.push(`최근 포스팅: ${recentPostDays}일 전 (양호)`)
  } else if (recentPostDays <= 30) {
    score += 2
    details.push(`최근 포스팅: ${recentPostDays}일 전 (보통)`)
  } else {
    score += 0
    details.push(`최근 포스팅: ${recentPostDays}일 전 (비활성)`)
  }

  // 포스팅 빈도 (6점)
  if (dates.length >= 2) {
    const totalDays = daysBetween(dates[0], dates[dates.length - 1]) || 1
    const postsPerWeek = (dates.length / totalDays) * 7

    if (postsPerWeek >= 5) {
      score += 6
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (매일)`
      details.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 3) {
      score += 5
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (격일)`
      details.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 1) {
      score += 3
      frequency = `주 ${postsPerWeek.toFixed(1)}회`
      details.push(`포스팅 빈도: ${frequency}`)
    } else {
      score += 1
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (부족)`
      details.push(`포스팅 빈도: ${frequency} - 주 3회 이상을 권장합니다`)
    }
  }

  // 꾸준함 - 날짜 간격의 변동계수 (4점)
  if (dates.length >= 3) {
    const gaps: number[] = []
    for (let i = 0; i < dates.length - 1; i++) {
      gaps.push(daysBetween(dates[i], dates[i + 1]))
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length
    const stdDev = Math.sqrt(variance)
    const cv = avgGap > 0 ? stdDev / avgGap : 0

    if (cv < 0.5) {
      score += 4
      details.push('포스팅 주기 매우 규칙적')
    } else if (cv < 1.0) {
      score += 3
      details.push('포스팅 주기 비교적 규칙적')
    } else if (cv < 2.0) {
      score += 1
      details.push('포스팅 주기 불규칙 - 꾸준한 발행이 C-Rank에 도움됩니다')
    } else {
      details.push('포스팅 주기 매우 불규칙')
    }
  }

  const grade = score >= 12 ? 'S' : score >= 9 ? 'A' : score >= 6 ? 'B' : score >= 3 ? 'C' : 'D'

  return {
    category: { name: '활동성', score: Math.min(maxScore, score), maxScore, grade, details },
    frequency,
    recentPostDays,
  }
}

// ===== 5. 영향력 분석 — 10점 (기존 15점에서 축소) =====

function analyzeInfluence(
  posts: BlogPost[],
  keywordResults: KeywordRankResult[]
): AnalysisCategory {
  const maxScore = 10
  const details: string[] = []
  let score = 0

  // 키워드 커버리지 (5점)
  if (keywordResults.length > 0) {
    const ranked = keywordResults.filter((r) => r.rank !== null)
    const coverage = ranked.length / keywordResults.length

    if (coverage >= 0.7) {
      score += 5
      details.push(`키워드 커버리지 우수: ${Math.round(coverage * 100)}% 키워드에서 노출`)
    } else if (coverage >= 0.5) {
      score += 4
      details.push(`키워드 커버리지 양호: ${Math.round(coverage * 100)}% 키워드에서 노출`)
    } else if (coverage >= 0.3) {
      score += 2
      details.push(`키워드 커버리지 보통: ${Math.round(coverage * 100)}% 키워드에서 노출`)
    } else {
      score += 1
      details.push(`키워드 커버리지 부족: ${Math.round(coverage * 100)}%`)
    }
  }

  // 상위 노출 강도 (3점)
  if (keywordResults.length > 0) {
    const top10Count = keywordResults.filter((r) => r.rank !== null && r.rank <= 10).length
    if (top10Count >= 3) {
      score += 3
      details.push(`상위 노출 강도 우수: ${top10Count}개 키워드 TOP10`)
    } else if (top10Count >= 2) {
      score += 2
      details.push(`상위 노출 강도 양호: ${top10Count}개 키워드 TOP10`)
    } else if (top10Count >= 1) {
      score += 1
      details.push(`상위 노출 강도 보통: ${top10Count}개 키워드 TOP10`)
    } else {
      details.push('TOP10 노출 키워드 없음 - 경쟁이 낮은 키워드부터 공략하세요')
    }
  }

  // 검색 결과 콘텐츠 다양성 (2점)
  if (posts.length >= 10) {
    score += 2
    details.push(`검색 결과 콘텐츠 풍부 (${posts.length}개 발견)`)
  } else if (posts.length >= 5) {
    score += 1
    details.push(`검색 결과 콘텐츠 양호 (${posts.length}개 발견)`)
  } else if (posts.length > 0) {
    details.push(`검색 결과 콘텐츠 부족 (${posts.length}개 발견)`)
  }

  const grade = score >= 8 ? 'S' : score >= 6 ? 'A' : score >= 4 ? 'B' : score >= 2 ? 'C' : 'D'

  return { name: '영향력', score: Math.min(maxScore, score), maxScore, grade, details }
}

// ===== P. 어뷰징 감점 분석 — 최대 -20점 (v2 신규) =====
//
// 기술 문서 1.2.1절 & 4.2절 근거:
// - 어뷰징 척도: 기계적 패턴, 숨겨진 텍스트, 무의미한 키워드 반복 감지
// - P(Abuse): 키워드 과다 반복시 점수를 0으로 수렴시키는 강력한 감점 요인
//
// 3가지 어뷰징 유형 감지:
// 1. 키워드 스터핑: 제목에 동일 키워드 과다 반복
// 2. 제목 유사도: 템플릿처럼 찍어내는 제목 패턴
// 3. 설명문 반복 패턴: 동일한 문구/구조 반복

function analyzeAbuse(posts: BlogPost[]): AbusePenalty {
  let score = 0  // 0 ~ -20
  const details: string[] = []
  const flags: string[] = []

  if (posts.length < 3) {
    return { score: 0, details: ['포스트가 적어 어뷰징 분석 생략'], flags: [] }
  }

  // === 1. 키워드 스터핑 감지 (-7점 max) ===
  // 기술 문서 3.1.2: 0.5%~3% 키워드 밀도가 자연스러운 분포
  // 동일 단어가 전체 제목의 80% 이상에 등장하면 과다 반복
  const titleKeywordFreq: Record<string, number> = {}
  posts.forEach((p) => {
    const words = extractKeywords(stripHtml(p.title))
    const unique = new Set(words)
    unique.forEach((w) => {
      titleKeywordFreq[w] = (titleKeywordFreq[w] || 0) + 1
    })
  })

  const titleSorted = Object.entries(titleKeywordFreq).sort((a, b) => b[1] - a[1])
  if (titleSorted.length > 0) {
    const topRate = titleSorted[0][1] / posts.length
    if (topRate >= 0.9) {
      score -= 7
      details.push(`키워드 과다 반복 심각: "${titleSorted[0][0]}" 키워드가 제목의 ${Math.round(topRate * 100)}%에 등장`)
      flags.push('keyword_stuffing')
    } else if (topRate >= 0.8) {
      score -= 4
      details.push(`키워드 반복 주의: "${titleSorted[0][0]}" 키워드가 제목의 ${Math.round(topRate * 100)}%에 등장`)
      flags.push('keyword_stuffing')
    }
  }

  // 설명문에서의 키워드 밀도 체크
  if (titleSorted.length > 0) {
    const topWord = titleSorted[0][0]
    const allDescText = posts.map(p => stripHtml(p.description)).join(' ')
    const allWords = extractKeywords(allDescText)
    const topWordInDesc = allWords.filter(w => w === topWord).length
    const density = allWords.length > 0 ? topWordInDesc / allWords.length : 0

    if (density > 0.05) {  // 5% 초과
      score -= 3
      details.push(`본문 키워드 밀도 과다: "${topWord}" ${(density * 100).toFixed(1)}% (권장: 0.5~3%)`)
      if (!flags.includes('keyword_stuffing')) flags.push('keyword_stuffing')
    }
  }

  // === 2. 제목 유사도 감지 (-7점 max) ===
  // 템플릿 형태로 찍어내는 제목 감지 (Jaccard 유사도)
  const titleWordSets = posts.map(p => extractKeywords(stripHtml(p.title)))
  let highSimilarityCount = 0
  let totalPairs = 0

  for (let i = 0; i < titleWordSets.length; i++) {
    for (let j = i + 1; j < titleWordSets.length; j++) {
      const sim = jaccardSimilarity(titleWordSets[i], titleWordSets[j])
      if (sim >= 0.7) highSimilarityCount++
      totalPairs++
    }
  }

  if (totalPairs > 0) {
    const similarRate = highSimilarityCount / totalPairs
    if (similarRate >= 0.5) {
      score -= 7
      details.push(`제목 유사도 매우 높음: ${Math.round(similarRate * 100)}%의 제목 쌍이 유사 (템플릿 의심)`)
      flags.push('title_template')
    } else if (similarRate >= 0.3) {
      score -= 4
      details.push(`제목 유사도 높음: ${Math.round(similarRate * 100)}%의 제목 쌍이 유사`)
      flags.push('title_template')
    } else if (similarRate >= 0.15) {
      score -= 2
      details.push(`일부 제목이 유사합니다 - 더 다양한 제목 패턴을 사용하세요`)
    }
  }

  // === 3. 설명문 반복 패턴 감지 (-6점 max) ===
  // 동일한 문구가 여러 포스트에서 반복되면 복사-붙여넣기 의심
  const descSnippets = posts.map(p => {
    const clean = stripHtml(p.description)
    return clean.substring(0, 50) // 첫 50자로 비교
  })

  const snippetFreq: Record<string, number> = {}
  descSnippets.forEach(s => {
    if (s.length >= 20) {
      snippetFreq[s] = (snippetFreq[s] || 0) + 1
    }
  })

  const duplicateSnippets = Object.values(snippetFreq).filter(c => c >= 2)
  const duplicateCount = duplicateSnippets.reduce((s, c) => s + c, 0)

  if (duplicateCount >= posts.length * 0.5) {
    score -= 6
    details.push(`설명문 반복 패턴 심각: ${duplicateCount}개 포스트가 유사한 시작 문구 사용`)
    flags.push('content_duplication')
  } else if (duplicateCount >= posts.length * 0.3) {
    score -= 3
    details.push(`설명문 반복 패턴 주의: ${duplicateCount}개 포스트가 유사한 시작 문구 사용`)
    flags.push('content_duplication')
  }

  // 감점이 없으면 긍정적 메시지
  if (score === 0) {
    details.push('어뷰징 패턴이 감지되지 않았습니다')
  }

  // 최소값 -20으로 제한
  return { score: Math.max(-20, score), details, flags }
}

// ===== 등급 체계 및 추천 =====

/**
 * 10등급 블로그 지수 체계 (v2)
 *
 * 어뷰징 페널티로 인해 총점이 음수가 될 수 있으므로 0 하한 처리
 *
 * [저품질] 0~24점
 *   Lv.1  저품질 위험 (0~12)
 *   Lv.2  저품질 주의 (13~24)
 * [일반] 25~54점
 *   Lv.3  입문 (25~34)
 *   Lv.4  일반 (35~44)
 *   Lv.5  성장 중 (45~54)
 * [준최적화] 55~74점
 *   Lv.6  준최적화 (55~62)
 *   Lv.7  양호 (63~69)
 *   Lv.8  우수 (70~74)
 * [최적화] 75~100점
 *   Lv.9  최적화 (75~87)
 *   Lv.10 파워블로그 (88~100)
 */
export function determineLevelInfo(totalScore: number): BlogLevelInfo {
  if (totalScore >= 88) return {
    tier: 10, category: '최적화', label: 'Lv.10 최적3/파워', shortLabel: '최적3',
    description: '최상위 검색 노출력을 가진 파워 블로그입니다. 현재 전략을 유지하세요.',
    color: 'emerald', badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300', nextTierScore: null,
  }
  if (totalScore >= 75) return {
    tier: 9, category: '최적화', label: 'Lv.9 최적2', shortLabel: '최적2',
    description: '네이버 검색에 최적화된 블로그입니다. 경쟁 키워드도 도전해보세요.',
    color: 'green', badgeColor: 'bg-green-100 text-green-700 border-green-300', nextTierScore: 88,
  }
  if (totalScore >= 70) return {
    tier: 8, category: '최적화', label: 'Lv.8 최적1', shortLabel: '최적1',
    description: '안정적인 검색 노출력을 보유하고 있습니다. 파워블로그까지 거의 다 왔습니다.',
    color: 'teal', badgeColor: 'bg-teal-100 text-teal-700 border-teal-300', nextTierScore: 75,
  }
  if (totalScore >= 63) return {
    tier: 7, category: '준최적화', label: 'Lv.7 준최적화+', shortLabel: '준최적화+',
    description: '키워드에 따라 상위 노출이 가능합니다. 콘텐츠 품질을 더 높여보세요.',
    color: 'blue', badgeColor: 'bg-blue-100 text-blue-700 border-blue-300', nextTierScore: 70,
  }
  if (totalScore >= 55) return {
    tier: 6, category: '준최적화', label: 'Lv.6 준최적화', shortLabel: '준최적화',
    description: '검색 노출이 시작되는 단계입니다. 주제 전문성과 활동성을 강화하세요.',
    color: 'blue', badgeColor: 'bg-blue-100 text-blue-700 border-blue-300', nextTierScore: 63,
  }
  if (totalScore >= 45) return {
    tier: 5, category: '일반', label: 'Lv.5 일반++', shortLabel: '일반++',
    description: 'SEO 기본기가 갖춰지고 있습니다. 키워드 전략을 세워보세요.',
    color: 'yellow', badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-300', nextTierScore: 55,
  }
  if (totalScore >= 35) return {
    tier: 4, category: '일반', label: 'Lv.4 일반+', shortLabel: '일반+',
    description: '기본적인 활동은 하고 있으나 SEO 최적화가 부족합니다.',
    color: 'amber', badgeColor: 'bg-amber-100 text-amber-700 border-amber-300', nextTierScore: 45,
  }
  if (totalScore >= 25) return {
    tier: 3, category: '일반', label: 'Lv.3 일반', shortLabel: '일반',
    description: '블로그를 시작한 단계입니다. 꾸준한 포스팅이 가장 중요합니다.',
    color: 'amber', badgeColor: 'bg-amber-100 text-amber-700 border-amber-300', nextTierScore: 35,
  }
  if (totalScore >= 13) return {
    tier: 2, category: '저품질', label: 'Lv.2 저품질 의심', shortLabel: '저품질 의심',
    description: '블로그 활동이 매우 부족합니다. 주 3회 이상 양질의 글을 발행하세요.',
    color: 'rose', badgeColor: 'bg-rose-100 text-rose-700 border-rose-300', nextTierScore: 25,
  }
  return {
    tier: 1, category: '저품질', label: 'Lv.1 저품질 위험', shortLabel: '저품질 위험',
    description: '저품질 블로그로 분류될 위험이 높습니다. 콘텐츠 품질부터 개선하세요.',
    color: 'red', badgeColor: 'bg-red-100 text-red-700 border-red-300', nextTierScore: 13,
  }
}

function generateRecommendations(categories: AnalysisCategory[], abusePenalty: AbusePenalty): string[] {
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
        case '영향력':
          recommendations.push('이웃과의 소통(댓글, 공감)을 적극적으로 늘리세요')
          recommendations.push('공유하고 싶은 실용적 정보를 제공하여 자연스러운 확산을 유도하세요')
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

// ===== 개별 포스트 품질 지수 (v2 개선) =====
//
// 기존: 0~10점 (제목 3 + 콘텐츠 4 + 이미지 2 + 키워드 1)
// v2:   0~12점 (제목 3 + 콘텐츠 3 + 이미지 3 + 구조 2 + 키워드 1)

function scorePost(title: string, descHtml: string, descLength: number, imageCount: number): PostQuality {
  let score = 0

  // 제목 길이 (0~3점) - 15~40자가 최적
  const titleLen = title.length
  if (titleLen >= 15 && titleLen <= 40) score += 3
  else if (titleLen >= 10 && titleLen <= 50) score += 2
  else if (titleLen >= 5) score += 1

  // 콘텐츠 길이 (0~3점) - 설명문 기준
  if (descLength >= 200) score += 3
  else if (descLength >= 150) score += 2
  else if (descLength >= 50) score += 1

  // 이미지 (0~3점) - 개수 기반 (v2 개선)
  if (imageCount >= 3) score += 3
  else if (imageCount >= 2) score += 2
  else if (imageCount >= 1) score += 1

  // 구조/서식 (0~2점) - v2 신규
  const hasStructure = /[①②③④⑤]|[1-9]\.\s|•|▶|<b>|<strong>/.test(descHtml)
  const hasConcreteData = /\d+[만천백]?\s*원|₩\d|가격|\d+분|\d+km/.test(descHtml)
  if (hasStructure && hasConcreteData) score += 2
  else if (hasStructure || hasConcreteData) score += 1

  // 제목 키워드 포함 여부 (0~1점) - 숫자나 구체적 키워드
  if (/\d+/.test(title) || /추천|후기|방법|비교|정리|가이드|리뷰|TOP/i.test(title)) {
    score += 1
  }

  // score 0~12 → 등급 매핑
  let tier: number
  let category: string
  let label: string

  if (score >= 11) { tier = 10; category = '최적화'; label = '최적3' }
  else if (score >= 10) { tier = 9; category = '최적화'; label = '최적2' }
  else if (score >= 9) { tier = 8; category = '최적화'; label = '최적1' }
  else if (score >= 8) { tier = 7; category = '준최적화'; label = '준최적화+' }
  else if (score >= 6) { tier = 6; category = '준최적화'; label = '준최적화' }
  else if (score >= 5) { tier = 5; category = '일반'; label = '일반++' }
  else if (score >= 4) { tier = 4; category = '일반'; label = '일반+' }
  else if (score >= 3) { tier = 3; category = '일반'; label = '일반' }
  else if (score >= 1) { tier = 2; category = '저품질'; label = '저품질 의심' }
  else { tier = 1; category = '저품질'; label = '저품질 위험' }

  return { score, tier, label, category }
}

// ===== 메인 분석 함수 =====

export function analyzeBlogIndex(
  blogUrl: string,
  posts: BlogPost[],
  keywordResults: KeywordRankResult[],
  isDemo: boolean,
  blogName?: string | null
): BlogIndexResult {
  const blogId = extractBlogId(blogUrl)
  const now = new Date()

  // 5대 분석 축 + 어뷰징 페널티 실행
  const contentQuality = analyzeContentQuality(posts)        // 30점
  const { category: topicAuthority, topicKeywords } = analyzeTopicAuthority(posts)  // 25점
  const searchPower = analyzeSearchPower(keywordResults)     // 20점
  const { category: activity, frequency, recentPostDays } = analyzeActivity(posts)  // 15점
  const influence = analyzeInfluence(posts, keywordResults)  // 10점
  const abusePenalty = analyzeAbuse(posts)                   // -20점 max

  const categories = [contentQuality, topicAuthority, searchPower, activity, influence]
  const rawScore = categories.reduce((sum, c) => sum + c.score, 0)
  const totalScore = Math.max(0, Math.min(100, rawScore + abusePenalty.score))  // 0~100 범위
  const level = determineLevelInfo(totalScore)
  const recommendations = generateRecommendations(categories, abusePenalty)

  // 포스트 분석 요약
  const avgTitleLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.title).length, 0) / posts.length)
    : 0
  const avgDescLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.description).length, 0) / posts.length)
    : 0
  const avgImageCount = posts.length > 0
    ? Math.round((posts.reduce((s, p) => s + countImages(p.description), 0) / posts.length) * 10) / 10
    : 0

  // 개별 포스트 상세 데이터 생성 (v2: 이미지 개수 + 개선된 scorePost)
  const recentPosts: PostDetail[] = posts
    .map((p) => {
      const cleanTitle = stripHtml(p.title)
      const cleanDesc = stripHtml(p.description)
      const postDate = parsePostDate(p.postdate)
      const daysAgo = !isNaN(postDate.getTime()) ? daysBetween(now, postDate) : -1
      const dateStr = !isNaN(postDate.getTime())
        ? `${postDate.getFullYear()}.${String(postDate.getMonth() + 1).padStart(2, '0')}.${String(postDate.getDate()).padStart(2, '0')}`
        : '날짜 없음'
      const imgCount = countImages(p.description)
      const hasImage = imgCount > 0
      const quality = scorePost(cleanTitle, p.description, cleanDesc.length, imgCount)
      return {
        title: cleanTitle,
        link: p.link,
        daysAgo,
        date: dateStr,
        charCount: cleanDesc.length,
        hasImage,
        imageCount: imgCount,
        titleLength: cleanTitle.length,
        quality,
      }
    })
    .filter((p) => p.daysAgo >= 0)
    .sort((a, b) => a.daysAgo - b.daysAgo)
    .slice(0, 20)

  // 블로그 프로필 생성
  const sortedDates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  const estimatedStartDate = sortedDates.length > 0
    ? `${sortedDates[0].getFullYear()}.${String(sortedDates[0].getMonth() + 1).padStart(2, '0')}.${String(sortedDates[0].getDate()).padStart(2, '0')}`
    : null

  const blogAgeDays = sortedDates.length > 0 ? daysBetween(now, sortedDates[0]) : null

  let postsPerWeek: number | null = null
  if (sortedDates.length >= 2) {
    const spanDays = daysBetween(sortedDates[sortedDates.length - 1], sortedDates[0]) || 1
    postsPerWeek = Math.round((sortedDates.length / spanDays) * 7 * 10) / 10
  }

  const blogProfile: BlogProfile = {
    blogId,
    blogName: blogName || null,
    blogUrl,
    totalPosts: posts.length,
    categoryKeywords: topicKeywords.slice(0, 5),
    estimatedStartDate,
    isActive: recentPostDays !== null && recentPostDays <= 30,
    blogAgeDays,
    postsPerWeek,
  }

  // 벤치마크 데이터 생성
  const imageRate = recentPosts.length > 0
    ? Math.round((recentPosts.filter(p => p.hasImage).length / recentPosts.length) * 100)
    : 0

  // 주제 집중도 계산
  const wordFreqAll: Record<string, number> = {}
  posts.forEach((p) => {
    const words = extractKeywords(stripHtml(p.title) + ' ' + stripHtml(p.description))
    const unique = new Set(words)
    unique.forEach((w) => { wordFreqAll[w] = (wordFreqAll[w] || 0) + 1 })
  })
  const topWordCount = Object.values(wordFreqAll).sort((a, b) => b - a)[0] || 0
  const topicFocusPct = posts.length > 0 ? Math.min(100, Math.round((topWordCount / posts.length) * 100)) : 0

  // 키워드 밀도 계산 (v2 추가)
  const allDescWords = posts.flatMap(p => extractKeywords(stripHtml(p.description)))
  const topWordInAll = Object.entries(wordFreqAll).sort((a, b) => b[1] - a[1])[0]
  const keywordDensity = topWordInAll && allDescWords.length > 0
    ? Math.round((allDescWords.filter(w => w === topWordInAll[0]).length / allDescWords.length) * 1000) / 10
    : 0

  const optimizationPct = Math.round(totalScore * 1.0)

  // 전체 상위 X% 추정
  let categoryPercentile: number
  if (totalScore >= 95) categoryPercentile = 3
  else if (totalScore >= 85) categoryPercentile = 10
  else if (totalScore >= 75) categoryPercentile = 20
  else if (totalScore >= 65) categoryPercentile = 30
  else if (totalScore >= 55) categoryPercentile = 40
  else if (totalScore >= 45) categoryPercentile = 50
  else if (totalScore >= 35) categoryPercentile = 65
  else if (totalScore >= 25) categoryPercentile = 80
  else categoryPercentile = 95

  const benchmark: BenchmarkData = {
    postingFrequency: {
      mine: postsPerWeek || 0,
      recommended: 3,
      topBlogger: 5,
    },
    avgTitleLength: { mine: avgTitleLength, optimal: 25 },
    avgContentLength: { mine: avgDescLength, recommended: 150 },
    imageRate: { mine: imageRate, recommended: 80 },
    topicFocus: { mine: topicFocusPct, recommended: 60 },
    keywordDensity: { mine: keywordDensity, optimal: [0.5, 3.0] },
    avgImageCount: { mine: avgImageCount, recommended: 3 },
    optimizationPct,
    categoryPercentile,
  }

  return {
    blogUrl,
    blogId,
    totalScore,
    level,
    categories,
    abusePenalty,
    keywordResults,
    postAnalysis: {
      totalFound: posts.length,
      avgTitleLength,
      avgDescLength,
      avgImageCount,
      topicKeywords,
      postingFrequency: frequency,
      recentPostDays,
    },
    recentPosts,
    blogProfile,
    benchmark,
    recommendations,
    isDemo,
    checkedAt: new Date().toISOString(),
  }
}

// ===== 데모 데이터 생성 =====

export function generateDemoPosts(blogId: string): BlogPost[] {
  const topics = ['맛집', '여행', '카페', '다이어트', '인테리어', '독서', '자기계발', '헬스']
  const mainTopic = topics[Math.floor(Math.random() * 3)] // 주제 집중도를 위해 상위 3개에서 주로 선택
  const now = new Date()

  return Array.from({ length: 15 }, (_, i) => {
    const daysAgo = Math.floor(Math.random() * 60) + i * 3
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    const topic = Math.random() > 0.3 ? mainTopic : topics[Math.floor(Math.random() * topics.length)]
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const imgCount = Math.floor(Math.random() * 4) + 1
    const imgTags = Array.from({ length: imgCount }, () => '<img src="demo.jpg" />').join(' ')

    return {
      title: `${topic} ${['추천', '후기', '리뷰', '정보', '가이드'][Math.floor(Math.random() * 5)]} - ${['초보자용', '실전', '최신', '2025년'][Math.floor(Math.random() * 4)]} ${['완벽 정리', '총정리', 'BEST', '꿀팁'][Math.floor(Math.random() * 4)]}`,
      link: `https://blog.naver.com/${blogId}/${100000000 + i}`,
      description: `${topic}에 대한 상세한 정보를 정리했습니다. ${imgTags} ${Math.random() > 0.5 ? '가격 비교와 ' : ''}${Math.random() > 0.5 ? '실제 후기를 포함하여 ' : ''}꼼꼼하게 분석한 글입니다. ${topic} 관련 핵심 정보 ${Math.floor(Math.random() * 10) + 3}가지를 소개합니다. 실제 경험을 바탕으로 작성했으며, 초보자도 쉽게 따라할 수 있도록 단계별로 설명합니다.${Math.random() > 0.5 ? ` 평균 가격은 ${Math.floor(Math.random() * 50 + 10) * 1000}원입니다.` : ''}`,
      postdate: dateStr,
    }
  })
}

export function generateDemoKeywordResults(keywords: string[]): KeywordRankResult[] {
  return keywords.map((keyword) => {
    const rand = Math.random()
    let rank: number | null
    if (rand < 0.25) rank = null
    else if (rand < 0.45) rank = Math.floor(Math.random() * 50) + 51
    else if (rand < 0.7) rank = Math.floor(Math.random() * 40) + 11
    else rank = Math.floor(Math.random() * 10) + 1
    return { keyword, rank, totalResults: Math.floor(Math.random() * 100000) + 10000 }
  })
}
