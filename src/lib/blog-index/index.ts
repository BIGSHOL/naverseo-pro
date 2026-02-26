/**
 * 블로그 지수 모듈 - barrel export
 */

// 메인 엔진
export { analyzeBlogIndex } from './engine'

// 등급 체계
export { determineLevelInfo } from './grading'

// 데모 데이터
export {
  generateDemoPosts,
  generateDemoKeywordResults,
  generateDemoKeywordCompetition,
  generateDemoVisitorData,
} from './demo'

// AI 분석
export { analyzeWithAi, generateDemoAiAnalysis } from './ai-analyzer'

// 카테고리
export { detectBlogCategory, BLOG_CATEGORY_LABELS } from './categories'
export type { BlogCategory, CategoryBenchmarkValues } from './categories'

// 벤치마크
export { getCategoryBenchmark } from './benchmark-provider'
export { accumulateBenchmarkData } from './benchmark-accumulator'

// 타입
export type {
  BlogPost,
  KeywordRankResult,
  AnalysisCategory,
  KeywordCompetitionData,
  VisitorData,
  BlogLevelInfo,
  PostQuality,
  PostDetail,
  BlogProfile,
  BenchmarkData,
  AbusePenalty,
  AiAnalysis,
  BlogIndexResult,
} from './types'
