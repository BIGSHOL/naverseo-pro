/**
 * sessionStorage 기반 페이지 결과 캐시
 *
 * 크레딧을 소모하여 분석한 결과를 탭 내에서 유지합니다.
 * - 페이지 이동 후 돌아와도 결과가 남아있음
 * - 브라우저 탭을 닫으면 자동 삭제
 * - 각 기능별 독립 키 사용
 */

const PREFIX = 'naverseo-cache:'

/** 캐시 저장 */
export function savePageCache<T>(feature: string, data: T): void {
  try {
    sessionStorage.setItem(
      PREFIX + feature,
      JSON.stringify({ data, savedAt: Date.now() })
    )
  } catch {
    // sessionStorage 용량 초과 등 — 무시
  }
}

/** 캐시 불러오기 (maxAge: 밀리초, 기본 24시간) */
export function loadPageCache<T>(feature: string, maxAge = 24 * 60 * 60 * 1000): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + feature)
    if (!raw) return null
    const { data, savedAt } = JSON.parse(raw) as { data: T; savedAt: number }
    if (Date.now() - savedAt > maxAge) {
      sessionStorage.removeItem(PREFIX + feature)
      return null
    }
    return data
  } catch {
    return null
  }
}

/** 캐시 삭제 */
export function clearPageCache(feature: string): void {
  try {
    sessionStorage.removeItem(PREFIX + feature)
  } catch {
    // 무시
  }
}