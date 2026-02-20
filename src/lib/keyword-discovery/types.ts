/** 키워드 발굴 엔진 타입 정의 */

/** AI가 생성하는 시드 키워드 */
export interface SeedKeyword {
  keyword: string
  direction: string // 전략 방향 설명
}

/** 네이버 API에서 반환되는 원시 키워드 데이터 */
export interface RawKeywordData {
  relKeyword: string
  monthlyPcQcCnt: number
  monthlyMobileQcCnt: number
  monthlyAvePcClkCnt: number
  monthlyAveMobileClkCnt: number
  monthlyAvePcCtr: number
  monthlyAveMobileCtr: number
  plAvgDepth: number
  compIdx: string
}

/** 키워드 출처 */
export type KeywordSource = 'ai' | 'naver'

/** 검색 의도 카테고리 */
export type IntentCategory = '정보형' | '비교형' | '구매형' | '경험형'

/** 최종 발굴 키워드 결과 */
export interface DiscoveredKeyword {
  keyword: string
  monthlySearch: number
  monthlyPc: number
  monthlyMobile: number
  compIdx: string
  score: number
  category: IntentCategory
  reason: string
  source: KeywordSource
}

/** 키워드 발굴 엔진 결과 */
export interface DiscoveryResult {
  topic: string
  opportunities: DiscoveredKeyword[]
  summary: string
  seedCount: number
  naverExpandedCount: number
  filteredCount: number
}
