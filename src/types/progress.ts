/**
 * Progress 시스템 통합 타입 정의
 *
 * 프로젝트 전체에서 사용하는 진행률 표시를 위한 통일된 타입
 */

// ============================================
// 기본 Progress 타입
// ============================================

/**
 * 단계 기반 진행률 (Step-based Progress)
 *
 * @example
 * { step: 2, totalSteps: 5, message: '분석 중...' }
 */
export type StepProgress = {
  /** 현재 단계 (1부터 시작) */
  step: number
  /** 전체 단계 수 */
  totalSteps: number
  /** 진행 상태 메시지 */
  message: string
  /** 선택적: 현재 단계 내 세부 진행 (0-100) */
  percent?: number
}

/**
 * 카운트 기반 진행률 (Count-based Progress)
 *
 * @example
 * { current: 15, total: 100, message: '키워드 분석 중...' }
 */
export type CountProgress = {
  /** 현재 완료 개수 */
  current: number
  /** 전체 개수 */
  total: number
  /** 진행 상태 메시지 */
  message: string
}

/**
 * 퍼센트 기반 진행률 (Percentage Progress)
 *
 * @example
 * { percent: 45, message: '콘텐츠 생성 중...' }
 */
export type PercentProgress = {
  /** 진행률 퍼센트 (0-100) */
  percent: number
  /** 진행 상태 메시지 */
  message: string
  /** 선택적: 세부 정보 */
  detail?: string
}

/**
 * 통합 Progress 타입 (Union Type)
 */
export type ProgressState = StepProgress | CountProgress | PercentProgress | null

// ============================================
// Progress 유틸리티 함수
// ============================================

/**
 * Progress의 퍼센트 값을 계산
 */
export function getProgressPercent(progress: ProgressState): number {
  if (!progress) return 0

  if ('percent' in progress && typeof progress.percent === 'number') {
    return progress.percent
  }

  if ('step' in progress && 'totalSteps' in progress) {
    return Math.round((progress.step / progress.totalSteps) * 100)
  }

  if ('current' in progress && 'total' in progress) {
    return Math.round((progress.current / progress.total) * 100)
  }

  return 0
}

/**
 * Progress 메시지 추출
 */
export function getProgressMessage(progress: ProgressState): string {
  return progress?.message || '처리 중...'
}

/**
 * Progress 세부 정보 생성
 */
export function getProgressDetail(progress: ProgressState): string {
  if (!progress) return ''

  if ('step' in progress && 'totalSteps' in progress) {
    return `${progress.step}/${progress.totalSteps}`
  }

  if ('current' in progress && 'total' in progress) {
    return `${progress.current}/${progress.total}`
  }

  if ('percent' in progress) {
    return `${progress.percent}%`
  }

  return ''
}

/**
 * Progress가 완료되었는지 확인
 */
export function isProgressComplete(progress: ProgressState): boolean {
  if (!progress) return false

  if ('step' in progress && 'totalSteps' in progress) {
    return progress.step >= progress.totalSteps
  }

  if ('current' in progress && 'total' in progress) {
    return progress.current >= progress.total
  }

  if ('percent' in progress) {
    return progress.percent >= 100
  }

  return false
}

// ============================================
// SSE Progress 타입
// ============================================

/**
 * Server-Sent Events (SSE) Progress 이벤트
 */
export type SSEProgressEvent = {
  type: 'progress'
  data: StepProgress | CountProgress | PercentProgress
}

/**
 * SSE 완료 이벤트
 */
export type SSECompleteEvent<T = unknown> = {
  type: 'complete'
  data: T
}

/**
 * SSE 에러 이벤트
 */
export type SSEErrorEvent = {
  type: 'error'
  error: string
}

/**
 * SSE 이벤트 통합 타입
 */
export type SSEEvent<T = unknown> =
  | SSEProgressEvent
  | SSECompleteEvent<T>
  | SSEErrorEvent

// ============================================
// Progress 옵션
// ============================================

/**
 * Progress 표시 옵션
 */
export type ProgressOptions = {
  /** 진행률 바 표시 여부 */
  showBar?: boolean
  /** 퍼센트 표시 여부 */
  showPercent?: boolean
  /** 세부 정보 표시 여부 (예: 2/5) */
  showDetail?: boolean
  /** 애니메이션 여부 */
  animated?: boolean
  /** 크기 */
  size?: 'sm' | 'md' | 'lg'
  /** 색상 테마 */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}
