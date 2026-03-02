/**
 * Progress 시스템 통합 Export
 *
 * 모든 Progress 관련 타입, 컴포넌트, 훅을 한 곳에서 import 가능
 */

// 타입
export type {
  StepProgress,
  CountProgress,
  PercentProgress,
  ProgressState,
  ProgressOptions,
  SSEProgressEvent,
  SSECompleteEvent,
  SSEErrorEvent,
  SSEEvent,
} from '@/types/progress'

// 유틸리티 함수
export {
  getProgressPercent,
  getProgressMessage,
  getProgressDetail,
  isProgressComplete,
} from '@/types/progress'

// 컴포넌트
export { InlineProgress } from '@/components/ui/inline-progress'
export { CardProgress } from '@/components/ui/card-progress'
export { FullPageProgress } from '@/components/ui/fullpage-progress'

// 훅
export { useSSEProgress } from '@/hooks/use-sse-progress'

// ============================================
// 헬퍼 함수
// ============================================

/**
 * StepProgress 생성 헬퍼
 */
export function createStepProgress(step: number, totalSteps: number, message: string) {
  return { step, totalSteps, message }
}

/**
 * CountProgress 생성 헬퍼
 */
export function createCountProgress(current: number, total: number, message: string) {
  return { current, total, message }
}

/**
 * PercentProgress 생성 헬퍼
 */
export function createPercentProgress(percent: number, message: string, detail?: string) {
  return { percent, message, detail }
}
