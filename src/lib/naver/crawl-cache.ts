/**
 * 네이버 블로그 크롤링 캐시
 *
 * 동일 블로그 포스트의 반복 크롤링을 방지하기 위한 메모리 캐시.
 * - TTL: 24시간 (같은 포스트를 24시간 안에 다시 분석할 때 네이버 재요청 안 함)
 * - 서버 재시작 시 초기화됨 (영구 저장이 필요하면 Supabase 테이블로 전환)
 *
 * 향후 확장: Supabase crawl_cache 테이블로 전환 가능
 */

import type { ScrapedPostData } from './blog-scraper'

/** 캐시 항목 */
interface CacheEntry {
    data: ScrapedPostData
    cachedAt: number  // Date.now() timestamp
}

/** 캐시 TTL: 24시간 (ms) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** 최대 캐시 항목 수 (메모리 제한) */
const MAX_CACHE_SIZE = 500

/** 인메모리 캐시 (post URL → ScrapedPostData) */
const cache = new Map<string, CacheEntry>()

/**
 * 캐시에서 크롤링 결과 조회
 * @param postUrl 블로그 포스트 URL
 * @returns 캐시된 데이터 또는 null (만료/미존재)
 */
export function getCrawlCache(postUrl: string): ScrapedPostData | null {
    const entry = cache.get(postUrl)
    if (!entry) return null

    // TTL 체크
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
        cache.delete(postUrl)
        return null
    }

    return entry.data
}

/**
 * 크롤링 결과를 캐시에 저장
 * @param postUrl 블로그 포스트 URL
 * @param data 스크래핑 결과
 */
export function setCrawlCache(postUrl: string, data: ScrapedPostData): void {
    // 캐시 크기 초과 시 가장 오래된 항목 정리
    if (cache.size >= MAX_CACHE_SIZE) {
        evictOldest()
    }

    cache.set(postUrl, {
        data,
        cachedAt: Date.now(),
    })
}

/**
 * 여러 URL에 대해 캐시 조회 → 캐시 미스 목록 반환
 * @param postUrls 조회할 URL 목록
 * @returns { cached: 캐시 히트 맵, uncached: 캐시 미스 URL 목록 }
 */
export function checkCrawlCacheBatch(
    postUrls: string[]
): { cached: Map<string, ScrapedPostData>; uncached: string[] } {
    const cached = new Map<string, ScrapedPostData>()
    const uncached: string[] = []

    for (const url of postUrls) {
        const data = getCrawlCache(url)
        if (data) {
            cached.set(url, data)
        } else {
            uncached.push(url)
        }
    }

    return { cached, uncached }
}

/**
 * 캐시 통계 (디버그/로그용)
 */
export function getCrawlCacheStats(): { size: number; maxSize: number; ttlHours: number } {
    return {
        size: cache.size,
        maxSize: MAX_CACHE_SIZE,
        ttlHours: CACHE_TTL_MS / (60 * 60 * 1000),
    }
}

/**
 * 가장 오래된 캐시 항목 제거 (LRU 간이 구현)
 * Map은 삽입 순서를 유지하므로 첫 번째 항목이 가장 오래됨
 */
function evictOldest(): void {
    const deleteCount = Math.ceil(MAX_CACHE_SIZE * 0.1) // 10% 정리
    const keys = Array.from(cache.keys())
    for (let i = 0; i < deleteCount && i < keys.length; i++) {
        cache.delete(keys[i])
    }
}
