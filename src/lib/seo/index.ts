/**
 * NaverSEO Pro - SEO 분석 모듈 통합 Export
 *
 * 사용 예시:
 *   import { analyzeSeo, analyzeReadability } from '@/lib/seo'
 *   import { analyzeWithAi } from '@/lib/seo'
 *   import type { SeoAnalysisResult, AiSeoAnalysis } from '@/lib/seo'
 */

// 핵심 엔진
export {
  analyzeSeo,
  analyzeReadability,
  getGradeInfo,
} from './engine'

// AI 분석
export {
  analyzeWithAi,
  generateDemoAiAnalysis,
} from './ai-analyzer'

// 타입 - 엔진
export type {
  SeoAnalysisResult,
  SeoCategory,
  SeoGradeInfo,
  SeoAnalysisDetails,
  SeoScrapedMeta,
  ReadabilityResult,
} from './engine'

// 타입 - AI
export type {
  AiSeoAnalysis,
} from './ai-analyzer'
