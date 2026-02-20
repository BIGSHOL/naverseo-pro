'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * Supabase DB 기반 키워드 검색 히스토리 훅
 * @param type - 히스토리 타입 ('keyword-research' | 'keyword-discovery')
 */
export function useKeywordHistory(type: string) {
  const [history, setHistory] = useState<string[]>([])

  // 마운트 시 DB에서 읽기
  useEffect(() => {
    fetch(`/api/search-history?type=${encodeURIComponent(type)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.history?.length) {
          setHistory(data.history)
        }
      })
      .catch(() => {
        // 조회 실패 무시
      })
  }, [type])

  // 히스토리에 키워드 추가 (낙관적 업데이트 + DB 저장)
  const addKeyword = useCallback((keyword: string) => {
    const trimmed = keyword.trim()
    if (!trimmed) return

    // 낙관적 UI 업데이트 (즉시 반영)
    setHistory((prev) => {
      const filtered = prev.filter((k) => k !== trimmed)
      return [trimmed, ...filtered].slice(0, 5)
    })

    // DB에 비동기 저장 (실패해도 UI는 이미 업데이트됨)
    fetch('/api/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: trimmed, type }),
    }).catch(() => {
      // 저장 실패 무시
    })
  }, [type])

  return { history, addKeyword }
}
