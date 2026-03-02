/**
 * 게시글 SEO 점수 캐싱 시스템
 *
 * - URL별로 SEO 점수를 캐싱하여 중복 스크래핑 방지
 * - 캐시 유효기간: 7일
 * - 경량 점수 계산 (AI 없이 규칙 기반)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { stripHtml, countImageMarkers } from '@/lib/utils/text'

export interface PostScoreCache {
  url: string
  seo_score: number
  metadata: {
    title?: string
    charCount?: number
    imageCount?: number
  }
  analyzed_at: string
}

/**
 * 캐시에서 게시글 점수 조회 (7일 이내 데이터만)
 */
export async function getCachedScore(
  supabase: SupabaseClient,
  url: string
): Promise<number | null> {
  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data, error } = await supabase
      .from('post_seo_scores')
      .select('seo_score, analyzed_at')
      .eq('url', url)
      .gte('analyzed_at', sevenDaysAgo.toISOString())
      .single()

    if (error || !data) return null
    return data.seo_score
  } catch {
    return null
  }
}

/**
 * 게시글 점수를 캐시에 저장 (upsert)
 */
export async function setCachedScore(
  supabase: SupabaseClient,
  url: string,
  score: number,
  metadata: { title?: string; charCount?: number; imageCount?: number } = {}
): Promise<void> {
  try {
    await supabase
      .from('post_seo_scores')
      .upsert({
        url,
        seo_score: score,
        metadata,
        analyzed_at: new Date().toISOString(),
      }, { onConflict: 'url' })
  } catch (err) {
    console.error('[PostScoreCache] 저장 실패:', err)
  }
}

/**
 * 경량 SEO 점수 계산 (AI 없이 규칙 기반)
 *
 * blog-index/scoring.ts의 단순화 버전:
 * - 본문 깊이 (30점)
 * - 이미지 활용 (30점)
 * - 제목 최적화 (40점)
 */
export function calculateLightweightScore(
  title: string,
  content: string,
  imageCount: number
): number {
  let score = 0

  // 1. 본문 깊이 (30점)
  const charCount = stripHtml(content).length
  if (charCount >= 2500) score += 30
  else if (charCount >= 2000) score += 26
  else if (charCount >= 1500) score += 22
  else if (charCount >= 1000) score += 16
  else if (charCount >= 500) score += 10
  else if (charCount >= 200) score += 4

  // 2. 이미지 활용 (30점)
  const totalImages = imageCount + countImageMarkers(content)
  if (totalImages >= 8) score += 30
  else if (totalImages >= 6) score += 25
  else if (totalImages >= 4) score += 20
  else if (totalImages >= 2) score += 12
  else if (totalImages >= 1) score += 6

  // 3. 제목 최적화 (40점)
  const titleLen = title.length

  // 제목 길이 (0~20)
  if (titleLen >= 25 && titleLen <= 45) score += 20
  else if (titleLen >= 20 && titleLen <= 50) score += 15
  else if (titleLen >= 15 && titleLen <= 55) score += 10
  else if (titleLen >= 10) score += 5

  // 제목 패턴 (0~20)
  const titlePatterns = [
    /20\d{2}/, // 연도
    /TOP|추천|비교|후기|정리|방법|가이드/, // 클릭 유도어
    /\d+[가지선종개]/, // 숫자 리스트
    /[?!]$/, // 물음표/느낌표
  ]
  let patternScore = 0
  titlePatterns.forEach(pattern => {
    if (pattern.test(title)) patternScore += 5
  })
  score += Math.min(patternScore, 20)

  return Math.min(Math.max(score, 0), 100)
}

/**
 * 여러 URL의 점수를 일괄 조회 (캐시 우선, 없으면 null)
 */
export async function batchGetCachedScores(
  supabase: SupabaseClient,
  urls: string[]
): Promise<Map<string, number>> {
  if (urls.length === 0) return new Map()

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data, error } = await supabase
      .from('post_seo_scores')
      .select('url, seo_score')
      .in('url', urls)
      .gte('analyzed_at', sevenDaysAgo.toISOString())

    if (error || !data) return new Map()

    return new Map(data.map(row => [row.url, row.seo_score]))
  } catch {
    return new Map()
  }
}
