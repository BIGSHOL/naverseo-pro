/**
 * NaverSEO Pro - 네이버 검색 결과 데이터 강화
 *
 * 콘텐츠 생성 시 실제 검색 결과를 참고하여 구체성을 높임
 * (local 타입에서 실제 업체명, comparison 타입에서 실제 제품명 등)
 */

import { searchNaverBlog, type NaverBlogSearchItem } from './blog-search'

/** 검색 결과 강화 데이터 */
export interface SearchEnrichmentData {
  realBusinessNames?: string[]  // 지역 업종: 실제 업체명 리스트
  realProductNames?: string[]   // 비교형: 실제 제품명 리스트
  topTitles?: string[]          // 상위 블로그 제목들 (패턴 참고용)
  commonKeywords?: string[]     // 검색 결과에서 자주 나오는 키워드
}

/**
 * 네이버 블로그 검색 결과에서 지역 업체명 추출
 *
 * @param keyword 검색 키워드 (예: "침산동 초등수학학원")
 * @returns 실제 업체명 리스트 (최대 5개)
 */
export async function extractBusinessNamesFromSearch(
  keyword: string
): Promise<string[]> {
  try {
    const results = await searchNaverBlog(keyword, 10)
    const businessNames: string[] = []

    for (const item of results.items) {
      // 제목에서 업체명 추출 시도
      // 패턴: "OO학원", "OO카페", "OO병원" 등
      const businessPatterns = [
        /([가-힣a-zA-Z0-9\s]{2,15})(학원|카페|병원|헬스장|식당|맛집|미용실)/g,
        /["'「]([가-힣a-zA-Z0-9\s]{2,15})["'」]/g,  // 따옴표로 감싼 업체명
      ]

      for (const pattern of businessPatterns) {
        const matches = Array.from(item.title.matchAll(pattern))
        for (const match of matches) {
          const name = match[1].trim()
          // 너무 긴 것, 중복, 일반명사 제외
          if (
            name.length >= 2 &&
            name.length <= 15 &&
            !businessNames.includes(name) &&
            !isGenericPhrase(name)
          ) {
            businessNames.push(name)
          }
        }
      }

      // 최대 5개까지만
      if (businessNames.length >= 5) break
    }

    return businessNames
  } catch (error) {
    console.error('[Search Enrichment] 업체명 추출 실패:', error)
    return []
  }
}

/**
 * 네이버 블로그 검색 결과에서 제품명 추출 (비교형용)
 *
 * @param keyword 검색 키워드 (예: "무선청소기 추천")
 * @returns 실제 제품명 리스트 (최대 7개)
 */
export async function extractProductNamesFromSearch(
  keyword: string
): Promise<string[]> {
  try {
    const results = await searchNaverBlog(keyword, 10)
    const productNames: string[] = []

    for (const item of results.items) {
      // 제목에서 제품명 추출 시도
      // 패턴: "다이슨 V15", "삼성 비스포크", "LG 코드제로" 등
      const productPatterns = [
        /([가-힣a-zA-Z]+)\s+([a-zA-Z0-9\s]+)/g,  // "브랜드 모델명"
        /["'「]([가-힣a-zA-Z0-9\s]{3,20})["'」]/g,  // 따옴표로 감싼 제품명
      ]

      for (const pattern of productPatterns) {
        const matches = Array.from(item.title.matchAll(pattern))
        for (const match of matches) {
          const name = match[0].trim()
          if (
            name.length >= 3 &&
            name.length <= 20 &&
            !productNames.includes(name) &&
            !isGenericPhrase(name)
          ) {
            productNames.push(name)
          }
        }
      }

      if (productNames.length >= 7) break
    }

    return productNames
  } catch (error) {
    console.error('[Search Enrichment] 제품명 추출 실패:', error)
    return []
  }
}

/**
 * 네이버 블로그 검색 결과에서 전체 강화 데이터 추출
 *
 * @param keyword 검색 키워드
 * @param contentType 콘텐츠 유형 ('local', 'comparison' 등)
 * @returns 강화 데이터
 */
export async function getSearchEnrichmentData(
  keyword: string,
  contentType: 'local' | 'comparison' | 'other'
): Promise<SearchEnrichmentData> {
  try {
    const results = await searchNaverBlog(keyword, 10)

    const enrichmentData: SearchEnrichmentData = {
      topTitles: results.items.slice(0, 5).map(item => stripHtmlTags(item.title)),
      commonKeywords: extractCommonKeywords(results.items),
    }

    // 콘텐츠 타입별 추가 데이터
    if (contentType === 'local') {
      enrichmentData.realBusinessNames = await extractBusinessNamesFromSearch(keyword)
    } else if (contentType === 'comparison') {
      enrichmentData.realProductNames = await extractProductNamesFromSearch(keyword)
    }

    return enrichmentData
  } catch (error) {
    console.error('[Search Enrichment] 데이터 추출 실패:', error)
    return {
      topTitles: [],
      commonKeywords: [],
    }
  }
}

// ===== 헬퍼 함수 =====

/** HTML 태그 제거 */
function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, '')
}

/** 일반 명사/부사 제외 (업체명/제품명이 아닌 것) */
function isGenericPhrase(text: string): boolean {
  const genericWords = [
    '추천', '비교', '후기', '리뷰', '순위', 'BEST', 'TOP',
    '방법', '가이드', '정리', '총정리', '완벽', '꿀팁',
    '장점', '단점', '특징', '정보', '소개', '안내',
    '최고', '대박', '진짜', '엄청', '완전',
  ]
  return genericWords.some(word => text.includes(word))
}

/** 검색 결과에서 자주 나오는 키워드 추출 */
function extractCommonKeywords(items: NaverBlogSearchItem[]): string[] {
  const allText = items.map(item => stripHtmlTags(item.title + ' ' + item.description)).join(' ')
  const words = allText.match(/[가-힣]{2,}/g) || []

  // 빈도수 계산
  const frequency: Record<string, number> = {}
  for (const word of words) {
    if (!isGenericPhrase(word)) {
      frequency[word] = (frequency[word] || 0) + 1
    }
  }

  // 빈도순 정렬 후 상위 10개
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}
