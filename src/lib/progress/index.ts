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
} from '@/types/progress'

// 유틸리티 함수
export {
  getProgressPercent,
  getProgressMessage,
  getProgressDetail,
} from '@/types/progress'

// 컴포넌트
export { CardProgress } from '@/components/ui/card-progress'

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
