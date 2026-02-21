import type { IntentCategory, RawKeywordData } from './types'

/** 유효한 경쟁도 값만 허용 (나머지는 추정 로직으로 전달) */
const VALID_COMP = new Set(['HIGH', 'MEDIUM', 'LOW'])

/**
 * 경쟁도 추정: compIdx가 유효하면 그대로, 아니면 plAvgDepth + 검색량으로 추정
 * 네이버 API가 예상외 값('-', 한국어, 빈 문자열 등)을 반환하는 경우 자동 추정
 */
export function estimateCompetition(stat: RawKeywordData): string {
  if (VALID_COMP.has(stat.compIdx)) return stat.compIdx

  const totalSearch = stat.monthlyPcQcCnt + stat.monthlyMobileQcCnt
  const depth = stat.plAvgDepth || 0

  // plAvgDepth(평균 광고 노출 수)와 검색량으로 경쟁 수준 추정
  if (depth >= 7) return 'HIGH'
  if (depth >= 3 || totalSearch >= 10000) return 'MEDIUM'
  if (totalSearch >= 500 || depth >= 1) return 'LOW'

  // 극소 검색량이지만 depth=0이면 "경쟁 없음" = 실질적 LOW
  if (totalSearch > 0 && depth === 0) return 'LOW'

  return '-'
}

/** 키워드 텍스트 패턴으로 검색 의도 카테고리 자동 추론 */
export function inferCategory(keyword: string): IntentCategory {
  // 구매형: 추천, 가격, 할인, 가성비, 순위, TOP, 베스트, 어디서
  if (/추천|가격|할인|가성비|순위|베스트|TOP|어디서|구매|구입|최저가|싼곳/.test(keyword)) return '구매형'
  // 비교형: 비교, 차이, vs, 장단점
  if (/비교|차이|vs|VS|장단점|다른점|뭐가/.test(keyword)) return '비교형'
  // 경험형: 후기, 리뷰, 경험, 솔직, 사용기, 체험, 1개월, 한달
  if (/후기|리뷰|경험|솔직|사용기|체험|\d+개월|\d+주|한달|반년|일년/.test(keyword)) return '경험형'
  // 정보형: 기본값 (방법, 하는법, 종류, 효과, 원인 등)
  return '정보형'
}

/** 네이버 데이터 기반으로 추천 이유 자동 생성 */
export function generateReason(stat: RawKeywordData): string {
  const totalSearch = stat.monthlyPcQcCnt + stat.monthlyMobileQcCnt
  const estimated = estimateCompetition(stat)
  const parts: string[] = []

  // 검색량 평가
  if (totalSearch >= 5000) parts.push('월간 검색량이 풍부하고')
  else if (totalSearch >= 1000) parts.push('월간 검색량이 충분하고')
  else if (totalSearch >= 100) parts.push('적정 검색량이 있고')
  else parts.push('니치 키워드로')

  // 경쟁도 평가 (추정 경쟁도 활용)
  if (estimated === 'LOW') parts.push('경쟁이 낮아')
  else if (estimated === 'MEDIUM') parts.push('적당한 경쟁 수준으로')
  else if (estimated === 'HIGH') parts.push('경쟁이 높지만 검색량이 많아')
  else parts.push('경쟁 데이터가 부족하지만')

  // 모바일 비중
  const mobileRatio = totalSearch > 0 ? stat.monthlyMobileQcCnt / totalSearch : 0
  if (mobileRatio >= 0.7) parts.push('모바일 검색 비중이 높아 블로그에 유리합니다.')
  else parts.push('상위 노출 가능성이 있는 키워드입니다.')

  return parts.join(' ')
}
