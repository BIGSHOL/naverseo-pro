/**
 * Blog Content Learning - 수집기
 *
 * 기존 API 호출에서 이미 가져온 데이터를 활용하여
 * 분석된 포스트 패턴을 DB에 백그라운드 저장
 *
 * 모든 수집은 fire-and-forget 패턴으로 메인 응답을 절대 지연시키지 않음
 */

import type { NaverBlogSearchItem } from '@/lib/naver/blog-search'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'
import { extractPatternFromSearchItem, extractPatternFromScrapedData } from './extractor'
import { updateAggregatePatterns } from './aggregator'
import type { AnalyzedPostPattern, CollectionSource } from './types'

/**
 * Fire-and-forget 래퍼
 * 메인 API 응답을 절대 지연시키지 않음
 */
export function scheduleCollection(fn: () => Promise<void>): void {
  fn().catch(err => {
    console.warn('[BlogLearning] 수집 오류:', err instanceof Error ? err.message : err)
  })
}

/**
 * 검색 결과에서 수집 (경량 패턴)
 *
 * 사용처: 키워드 리서치, 경쟁사 분석, 순위 트래킹
 */
export async function collectFromSearchResults(
  keyword: string,
  searchItems: NaverBlogSearchItem[],
  source: CollectionSource
): Promise<void> {
  if (!searchItems || searchItems.length === 0) return

  const patterns: AnalyzedPostPattern[] = []
  for (let i = 0; i < Math.min(searchItems.length, 10); i++) {
    const item = searchItems[i]
    if (!item.link) continue
    patterns.push(extractPatternFromSearchItem(keyword, item, i + 1, source))
  }

  await savePatterns(patterns)
  await updateAggregatePatterns(keyword, patterns[0]?.keyword_category || null, patterns[0]?.domain_category || null)
}

/**
 * 스크래핑된 데이터에서 수집 (풀 패턴)
 *
 * 사용처: 콘텐츠 생성, 블로그 지수 (이미 스크래핑된 데이터 재활용)
 */
export async function collectFromScrapedPosts(
  keyword: string,
  scrapedMap: Map<string, ScrapedPostData>,
  searchItems: NaverBlogSearchItem[],
  rawHtmlMap: Map<string, string> | null,
  source: CollectionSource
): Promise<void> {
  if (!searchItems || searchItems.length === 0) return

  const patterns: AnalyzedPostPattern[] = []

  for (let i = 0; i < searchItems.length; i++) {
    const item = searchItems[i]
    if (!item.link) continue

    const scraped = scrapedMap.get(item.link)
    if (scraped) {
      // 스크래핑 데이터가 있으면 풀 패턴 추출
      const rawHtml = rawHtmlMap?.get(item.link) || null
      patterns.push(extractPatternFromScrapedData(keyword, item, i + 1, scraped, rawHtml, source))
    } else {
      // 없으면 경량 패턴
      patterns.push(extractPatternFromSearchItem(keyword, item, i + 1, source))
    }
  }

  await savePatterns(patterns)
  await updateAggregatePatterns(keyword, patterns[0]?.keyword_category || null, patterns[0]?.domain_category || null)
}

/**
 * DB에 패턴 배치 저장 (upsert)
 *
 * ON CONFLICT (post_url) DO UPDATE: 더 풍부한 데이터로 갱신
 */
async function savePatterns(patterns: AnalyzedPostPattern[]): Promise<void> {
  if (patterns.length === 0) return

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    // 배치 upsert (post_url 기준 중복 시 업데이트)
    const rows = patterns.map(p => ({
      keyword: p.keyword,
      keyword_category: p.keyword_category,
      domain_category: p.domain_category,
      search_rank: p.search_rank,
      post_url: p.post_url,
      blogger_name: p.blogger_name,
      post_date: p.post_date,
      char_count: p.char_count,
      image_count: p.image_count,
      heading_count: p.heading_count,
      paragraph_count: p.paragraph_count,
      internal_link_count: p.internal_link_count,
      external_link_count: p.external_link_count,
      has_naver_map: p.has_naver_map,
      has_naver_shopping: p.has_naver_shopping,
      has_youtube: p.has_youtube,
      title_length: p.title_length,
      has_keyword_in_title: p.has_keyword_in_title,
      tags: p.tags,
      category: p.category,
      has_list_format: p.has_list_format,
      has_table: p.has_table,
      has_bold_emphasis: p.has_bold_emphasis,
      has_numbered_items: p.has_numbered_items,
      writing_tone: p.writing_tone,
      quality_score: p.quality_score,
      quality_tier: p.quality_tier,
      collected_from: p.collected_from,
      collected_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('analyzed_posts')
      .upsert(rows, {
        onConflict: 'post_url',
        // 더 풍부한 데이터로 업데이트 (char_count가 더 크면 스크래핑 데이터)
        ignoreDuplicates: false,
      })

    if (error) {
      console.warn('[BlogLearning] DB 저장 오류:', error.message)
    }
  } catch (err) {
    console.warn('[BlogLearning] DB 저장 실패:', err instanceof Error ? err.message : err)
  }
}
