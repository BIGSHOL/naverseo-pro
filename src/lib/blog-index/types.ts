/**
 * 블로그 지수 엔진 - 타입 정의
 */

export interface BlogPost {
  title: string
  link: string
  description: string
  postdate: string // YYYYMMDD
}

/** 블로그 프로필 크롤링 데이터 (v4 신규, v7 buddyCount/subscriberCount 추가, v9 firstPostDate 추가) */
export interface BlogProfileData {
  totalPostCount: number | null
  blogStartDate: string | null      // 블로그 개설일 (프로필 스크래핑)
  blogAgeDays: number | null
  firstPostDate?: string | null     // v9: 실제 최초 포스팅 날짜 (YYYYMMDD, 검색 API로 조회)
  firstPostDateAccurate?: boolean   // v9: true면 정확한 최초 포스팅, false면 근사값
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

export interface ScoreItem {
  label: string
  points: number  // +N (가점) 또는 -N (감점)
}

export interface AnalysisCategory {
  name: string
  score: number
  maxScore: number
  grade: string
  details: string[]
  items?: ScoreItem[]  // 항목별 ±점수 내역
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
  source?: 'api' | 'today' | 'history'  // 데이터 출처
  historyDays?: number                   // history 소스일 때 누적 일수
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
  readCount?: number | null      // v10: 조회수
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
  // 나의 수치 vs 평균 vs 상위블로거
  postingFrequency: { mine: number; recommended: number; topBlogger: number }
  avgTitleLength: { mine: number; optimal: number; topBlogger: number }
  avgContentLength: { mine: number; recommended: number; topBlogger: number }
  imageRate: { mine: number; recommended: number; topBlogger: number }
  topicFocus: { mine: number; recommended: number; topBlogger: number }
  keywordDensity: { mine: number; optimal: [number, number] }
  avgImageCount: { mine: number; recommended: number; topBlogger: number }
  optimizationPct: number
  categoryPercentile: number
  avgCommentCount?: { mine: number; recommended: number; topBlogger: number }
  avgSympathyCount?: { mine: number; recommended: number; topBlogger: number }
  dailyVisitors?: { mine: number; recommended: number; topBlogger: number; source?: string; historyDays?: number }
  blogAge?: { mine: number; recommended: number }
  totalPostCount?: { mine: number; recommended: number }
  buddyCount?: { mine: number; recommended: number }
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
  searchBonus: {                   // v10: 검색 성과 (5대축 전용)
    score: number      // 0~25
    maxScore: number   // 25
    grade: string
    details: string[]
    items?: ScoreItem[]
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
  // v9.1: 네이버 알고리즘 추정 점수
  diaScore?: NaverAlgorithmScore
  crankScore?: NaverAlgorithmScore
}

/** v9.1: 네이버 알고리즘(D.I.A., C-Rank) 추정 점수 */
export interface NaverAlgorithmScore {
  score: number         // 0~100
  grade: string         // S, A+, A, B+, B, C, D, F
  label: string         // "D.I.A." or "C-Rank"
  summary: string       // 한 줄 요약
  factors: NaverScoreFactor[]  // 기여 요소 목록
}

export interface NaverScoreFactor {
  name: string          // 요소 이름
  weight: number        // 가중치 (0~1)
  score: number         // 원점수 (0~25)
  contribution: number  // 가중 기여점 (score * weight * 4)
}
