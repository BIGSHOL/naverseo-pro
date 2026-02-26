/**
 * 블로그 지수 엔진 - 타입 정의
 */

export interface BlogPost {
  title: string
  link: string
  description: string
  postdate: string // YYYYMMDD
}

/** 블로그 프로필 크롤링 데이터 (v4 신규, v7 buddyCount/subscriberCount 추가) */
export interface BlogProfileData {
  totalPostCount: number | null
  blogStartDate: string | null
  blogAgeDays: number | null
  dayVisitorCount?: number | null   // 프로필 페이지에서 추출한 오늘 방문자 수
  buddyCount?: number | null        // 이웃 수 (__INITIAL_STATE__에서 추출)
  subscriberCount?: number | null   // 구독자 수
}

/** 인기도 데이터 집계 (v4 신규) */
export interface EngagementData {
  avgCommentCount: number | null
  avgSympathyCount: number | null
  isAvailable: boolean
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

/** 키워드 경쟁도 데이터 (검색광고 API에서 가져온 compIdx) */
export interface KeywordCompetitionData {
  keyword: string
  compIdx: string         // 'HIGH' | 'MEDIUM' | 'LOW' | '-'
  searchVolume: number    // 월간 총 검색량 (PC + 모바일)
}

/** 방문자 데이터 (NVisitorgp4Ajax XML API) */
export interface VisitorData {
  dailyVisitors: number[]
  avgDailyVisitors: number
  isAvailable: boolean
}

export interface BlogLevelInfo {
  tier: number           // 1~16 (v6: 16등급)
  category: string       // 일반 / 준최적화 / 최적화 / 최적화+ / 파워
  label: string          // Lv.1 일반 ~ Lv.16 파워
  shortLabel: string     // 짧은 라벨 (배지용): 일반, 준최적화1~7, 최적화1~3, 최적화1+~4+, 파워
  description: string    // 상세 설명
  color: string          // UI 색상 키 (slate/violet/indigo/sky/blue/lime/green/teal/emerald/amber 등)
  badgeColor: string     // Tailwind 배지 색상 클래스
  nextTierScore: number | null  // 다음 등급까지 필요한 점수 (최고 등급이면 null)
}

export interface PostQuality {
  score: number          // 0~15 (v4: 인기도 3점 추가)
  tier: number           // 1~5 (v6: 포스트 품질 등급)
  label: string          // "준최적화", "최적화", "일반" 등
  category: string       // 일반/준최적화/최적화/파워
}

export interface PostDetail {
  title: string
  link: string
  daysAgo: number
  date: string           // YYYY.MM.DD
  charCount: number      // 실제 본문 글자수 (스크래핑) or 미리보기 추정치
  hasImage: boolean      // 이미지 포함 여부
  imageCount: number     // 이미지 개수 (v2 추가)
  titleLength: number
  quality: PostQuality   // 개별 포스트 품질 지수
  isScrapped?: boolean   // true면 실제 본문 데이터, false/undefined면 description 추정
  commentCount?: number | null   // v4: 댓글 수
  sympathyCount?: number | null  // v4: 공감 수
  estimatedReadTimeSec?: number  // v8: 예상 체류 시간 (초)
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
  blogAgeEstimated?: boolean    // true면 추정값 (개설일 추출 실패)
  postsPerWeek: number | null   // 주간 포스팅 수
  totalPostCount?: number | null  // v4: 프로필에서 추출한 전체 포스트 수
  blogCreatedDate?: string | null // v4: 프로필에서 추출한 블로그 개설일
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
  // v4 신규
  avgCommentCount?: { mine: number; recommended: number }      // 평균 댓글 수
  avgSympathyCount?: { mine: number; recommended: number }     // 평균 공감 수
  dailyVisitors?: { mine: number; recommended: number; topBlogger: number }  // 일평균 방문자
  blogAge?: { mine: number; recommended: number }              // 블로그 연차 (일수, 표시용)
  totalPostCount?: { mine: number; recommended: number }       // 총 포스팅 수
  buddyCount?: { mine: number; recommended: number }           // 이웃 수 (v7 추가)
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
  searchBonus: {                   // v5 추가: 검색 보너스 (등급 미반영)
    score: number      // 0~25
    maxScore: number   // 25
    grade: string
    details: string[]
  }
  keywordResults: KeywordRankResult[]
  postAnalysis: {
    totalFound: number
    avgTitleLength: number
    avgDescLength: number
    avgImageCount: number          // v2 추가
    topicKeywords: string[]
    postingFrequency: string
    recentPostDays: number | null
    avgCommentCount?: number | null  // v4 추가
    avgSympathyCount?: number | null // v4 추가
    avgEstimatedReadTimeSec?: number // v8: 평균 예상 체류 시간 (초)
  }
  recentPosts: PostDetail[]
  blogProfile: BlogProfile
  benchmark: BenchmarkData
  recommendations: string[]
  isDemo: boolean
  checkedAt: string
  // v6 추가: 카테고리별 벤치마크
  blogCategory?: string              // 감지된 블로그 카테고리 (food, it_tech 등)
  benchmarkSource?: 'accumulated' | 'static'  // 벤치마크 데이터 출처
  benchmarkSampleCount?: number      // 축적 데이터 샘플 수
}
