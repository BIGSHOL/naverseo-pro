'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ProgressState } from '@/types/progress'

type UseSSEProgressOptions<T> = {
  /** 에러 발생 시 호출되는 콜백 */
  onError?: (error: string) => void
  /** 완료 시 호출되는 콜백 */
  onComplete?: (data: T) => void
  /** Progress 업데이트 시 호출되는 콜백 */
  onProgress?: (progress: ProgressState) => void
  /** 자동으로 재시도 여부 */
  autoRetry?: boolean
  /** 재시도 횟수 */
  maxRetries?: number
}

type UseSSEProgressResult<T> = {
  /** 현재 진행 상태 */
  progress: ProgressState
  /** 완료 데이터 */
  data: T | null
  /** 에러 메시지 */
  error: string | null
  /** 로딩 중 여부 */
  loading: boolean
  /** SSE 연결 시작 */
  start: (url: string, options?: RequestInit) => void
  /** SSE 연결 중단 */
  stop: () => void
  /** 상태 초기화 */
  reset: () => void
}

/**
 * SSE Progress 처리 훅
 *
 * Server-Sent Events를 사용하는 API의 진행률을 추적하고 관리합니다.
 *
 * @example
 * const { progress, data, loading, start } = useSSEProgress<AnalysisResult>({
 *   onComplete: (result) => console.log('완료:', result),
 *   onError: (error) => console.error('에러:', error),
 * })
 *
 * // API 호출
 * start('/api/analyze', {
 *   method: 'POST',
 *   body: JSON.stringify({ keyword: 'test' }),
 * })
 */
export function useSSEProgress<T = unknown>(
  options: UseSSEProgressOptions<T> = {}
): UseSSEProgressResult<T> {
  const {
    onError,
    onComplete,
    onProgress,
    autoRetry = false,
    maxRetries = 3,
  } = options

  const [progress, setProgress] = useState<ProgressState>(null)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const retriesRef = useRef(0)

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    setProgress(null)
    setData(null)
    setError(null)
    retriesRef.current = 0
  }, [stop])

  const start = useCallback(
    async (url: string, requestOptions?: RequestInit) => {
      // 이전 연결 종료
      stop()

      // 상태 초기화
      setProgress(null)
      setData(null)
      setError(null)
      setLoading(true)

      // AbortController 생성
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        const response = await fetch(url, {
          ...requestOptions,
          signal: abortController.signal,
          headers: {
            ...requestOptions?.headers,
            Accept: 'text/event-stream',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('Response body가 없습니다.')
        }

        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue

            try {
              const jsonStr = line.replace('data: ', '')
              const event = JSON.parse(jsonStr)

              if (event.type === 'progress') {
                const progressData = event.data as ProgressState
                setProgress(progressData)
                onProgress?.(progressData)
              } else if (event.type === 'complete') {
                const resultData = event.data as T
                setData(resultData)
                setProgress(null)
                setLoading(false)
                onComplete?.(resultData)
                retriesRef.current = 0
                return
              } else if (event.type === 'error') {
                throw new Error(event.error || '알 수 없는 오류')
              }
            } catch (parseError) {
              console.error('SSE 파싱 에러:', parseError)
            }
          }
        }

        setLoading(false)
      } catch (err) {
        // Abort된 경우는 무시
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }

        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
        setError(errorMessage)
        setLoading(false)
        onError?.(errorMessage)

        // 자동 재시도
        if (autoRetry && retriesRef.current < maxRetries) {
          retriesRef.current++
          console.log(`재시도 ${retriesRef.current}/${maxRetries}...`)
          setTimeout(() => {
            start(url, requestOptions)
          }, 1000 * retriesRef.current) // 점진적 백오프
        }
      }
    },
    [stop, onProgress, onComplete, onError, autoRetry, maxRetries]
  )

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    progress,
    data,
    error,
    loading,
    start,
    stop,
    reset,
  }
}
