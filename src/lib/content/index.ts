/**
 * 콘텐츠 생성 엔진 - barrel export
 */

// 콘텐츠 생성 함수
export {
  detectContentType,
  buildSystemPrompt,
  buildUserPrompt,
  generateOutline,
  generateAutoTags,
  generateMetaDescription,
  generateDemoContent,
  postProcessContent,
} from './engine'

// 타입
export type {
  ContentType,
  ContentGenerationRequest,
  ContentGenerationResult,
  ContentOutline,
  OutlineSection,
} from './engine'

// SEO 함수 re-export
export { analyzeSeo, analyzeReadability } from './engine'
export type { SeoAnalysisResult, SeoCategory, ReadabilityResult } from './engine'
