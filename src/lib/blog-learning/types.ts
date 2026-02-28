/**
 * Blog Content Learning Pipeline - 타입 정의
 *
 * 상위 노출 블로그 포스트의 구조 패턴을 수집·분석하여
 * AI 콘텐츠 생성 프롬프트에 데이터 기반 인사이트를 주입
 */

import type { ContentType, DomainCategory } from '@/lib/content/engine'

/** 수집 출처 */
export type CollectionSource =
  | 'keyword_research'
  | 'keyword_bulk'
  | 'content_generation'
  | 'competitor_analysis'
  | 'blog_index'
  | 'rank_tracking'

/** 분석된 포스트 패턴 (DB 행 매핑) */
export interface AnalyzedPostPattern {
  keyword: string
  keyword_category: ContentType | null
  domain_category: DomainCategory | null
  search_rank: number | null

  post_url: string
  blogger_name: string | null
  post_date: string | null

  char_count: number
  image_count: number
  heading_count: number
  paragraph_count: number

  internal_link_count: number
  external_link_count: number
  has_naver_map: boolean
  has_naver_shopping: boolean
  has_youtube: boolean

  title_length: number
  has_keyword_in_title: boolean
  tags: string[]
  category: string | null

  has_list_format: boolean
  has_table: boolean
  has_bold_emphasis: boolean
  has_numbered_items: boolean

  writing_tone: WritingTone | null

  /** 이미지 배치 패턴 (H2 직후 / 도입부 / 마무리 등) */
  image_positions: ImagePosition[]
  /** 이미지 유형 분포 (제품사진 / 인포그래픽 / 일러스트 등) */
  image_types: string[]

  quality_score: number
  quality_tier: string

  collected_from: CollectionSource
}

export type WritingTone = 'formal' | 'casual' | 'review' | 'informational'

/** 이미지 위치 정보 */
export type ImagePosition = 'intro' | 'after_heading' | 'mid_content' | 'before_conclusion' | 'conclusion'

/** 집계된 키워드 패턴 */
export interface AggregatedPattern {
  keyword: string | null
  keyword_category: string
  sample_count: number

  avg_char_count: number
  avg_image_count: number
  avg_heading_count: number
  avg_paragraph_count: number
  avg_internal_links: number
  avg_external_links: number
  avg_title_length: number

  keyword_in_title_rate: number
  list_format_rate: number
  table_usage_rate: number
  naver_map_rate: number
  youtube_rate: number

  tone_distribution: Record<string, number>
  top_tags: Array<{ tag: string; count: number }>
  success_patterns: Record<string, number>

  optimal_char_range: { min: number; max: number }
  optimal_image_range: { min: number; max: number }
  optimal_heading_range: { min: number; max: number }

  /** 이미지 배치 패턴 빈도 (intro=60%, after_heading=80% 등) */
  image_position_rates: Record<string, number>
  /** 이미지 유형 빈도 Top5 */
  top_image_types: Array<{ type: string; rate: number }>
}

/** 프롬프트 주입용 데이터 */
export interface PromptPatternData {
  text: string
  sampleCount: number
  matchType: 'exact_keyword' | 'category' | 'domain' | 'none'
}
