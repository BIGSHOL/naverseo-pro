/**
 * Blog Content Learning - 구조 패턴 추출기
 *
 * HTML 또는 기존 스크래핑 결과에서 저작권-안전한 구조 패턴만 추출
 * 본문 텍스트는 저장하지 않고 구조적 수치만 추출
 */

import type { ScrapedPostData } from '@/lib/naver/blog-scraper'
import type { NaverBlogSearchItem } from '@/lib/naver/blog-search'
import { scorePost } from '@/lib/blog-index/scoring'
import { detectContentType, detectDomainCategory, type ContentType } from '@/lib/content/engine'
import { stripHtml, countImageMarkers } from '@/lib/utils/text'
import type { AnalyzedPostPattern, CollectionSource, ImagePosition, WritingTone } from './types'

/**
 * 스크래핑된 포스트 데이터 → 구조 패턴 (풀 데이터)
 *
 * 콘텐츠 생성/블로그 지수에서 이미 스크래핑한 데이터를 재활용
 */
export function extractPatternFromScrapedData(
  keyword: string,
  searchItem: NaverBlogSearchItem,
  searchRank: number,
  scrapedData: ScrapedPostData,
  rawHtml: string | null,
  source: CollectionSource
): AnalyzedPostPattern {
  const cleanTitle = stripHtml(searchItem.title)
  const category = detectContentType(keyword)
  const domain = detectDomainCategory(keyword)

  // HTML 기반 구조 분석
  const headingCount = rawHtml ? extractHeadingCount(rawHtml) : 0
  const paragraphCount = rawHtml ? extractParagraphCount(rawHtml) : 0
  const hasListFormat = rawHtml ? detectListFormat(rawHtml) : false
  const hasTable = rawHtml ? /<table[\s>]/i.test(rawHtml) : false
  const hasBoldEmphasis = rawHtml ? /<(?:b|strong)[\s>]/i.test(rawHtml) : false
  const hasNumberedItems = rawHtml ? detectNumberedItems(rawHtml) : false
  const writingTone = rawHtml ? detectWritingTone(rawHtml) : null
  const imagePositions = rawHtml ? extractImagePositions(rawHtml) : []
  const imageTypes = rawHtml ? extractImageTypes(rawHtml) : []

  // 메타 데이터
  const meta = scrapedData.meta
  const tags = meta?.tags || []
  const postCategory = meta?.category || null
  const internalLinkCount = meta?.linkAnalysis?.internalCount || 0
  const externalLinkCount = meta?.linkAnalysis?.externalCount || 0
  const hasNaverMap = meta?.linkAnalysis?.hasNaverMap || false
  const hasNaverShopping = meta?.linkAnalysis?.hasNaverShopping || false
  const hasYoutube = meta?.linkAnalysis?.hasYoutubeEmbed || false

  // 품질 점수
  const quality = scorePost(
    cleanTitle,
    searchItem.description,
    scrapedData.charCount,
    scrapedData.imageCount,
    true // isScrapped
  )

  // 키워드 포함 여부
  const keywordLower = keyword.toLowerCase().replace(/\s+/g, '')
  const titleLower = cleanTitle.toLowerCase().replace(/\s+/g, '')
  const hasKeywordInTitle = titleLower.includes(keywordLower)

  return {
    keyword,
    keyword_category: category,
    domain_category: domain,
    search_rank: searchRank,
    post_url: searchItem.link,
    blogger_name: searchItem.bloggername || null,
    post_date: searchItem.postdate || null,
    char_count: scrapedData.charCount,
    image_count: scrapedData.imageCount,
    heading_count: headingCount,
    paragraph_count: paragraphCount,
    internal_link_count: internalLinkCount,
    external_link_count: externalLinkCount,
    has_naver_map: hasNaverMap,
    has_naver_shopping: hasNaverShopping,
    has_youtube: hasYoutube,
    title_length: cleanTitle.length,
    has_keyword_in_title: hasKeywordInTitle,
    tags,
    category: postCategory,
    has_list_format: hasListFormat,
    has_table: hasTable,
    has_bold_emphasis: hasBoldEmphasis,
    has_numbered_items: hasNumberedItems,
    writing_tone: writingTone,
    image_positions: imagePositions,
    image_types: imageTypes,
    quality_score: quality.score,
    quality_tier: quality.category,
    collected_from: source,
  }
}

/**
 * 검색 결과 아이템 → 경량 패턴 (스크래핑 없이)
 *
 * 키워드 리서치/순위 트래킹에서 추가 API 호출 없이 사용
 */
export function extractPatternFromSearchItem(
  keyword: string,
  searchItem: NaverBlogSearchItem,
  searchRank: number,
  source: CollectionSource
): AnalyzedPostPattern {
  const cleanTitle = stripHtml(searchItem.title)
  const cleanDesc = stripHtml(searchItem.description)
  const category = detectContentType(keyword)
  const domain = detectDomainCategory(keyword)

  // description에서 추출 가능한 정보
  const imageCount = countImageMarkers(searchItem.description)
  const hasStructure = /[①②③④⑤]|[1-9]\.\s|•|▶|<b>|<strong>/.test(searchItem.description)
  const hasConcreteData = /\d+[만천백]?\s*원|₩\d|가격|\d+분|\d+km/.test(searchItem.description)

  // 품질 점수
  const quality = scorePost(
    cleanTitle,
    searchItem.description,
    cleanDesc.length,
    imageCount,
    false // description 기반
  )

  const keywordLower = keyword.toLowerCase().replace(/\s+/g, '')
  const titleLower = cleanTitle.toLowerCase().replace(/\s+/g, '')
  const hasKeywordInTitle = titleLower.includes(keywordLower)

  return {
    keyword,
    keyword_category: category,
    domain_category: domain,
    search_rank: searchRank,
    post_url: searchItem.link,
    blogger_name: searchItem.bloggername || null,
    post_date: searchItem.postdate || null,
    char_count: cleanDesc.length,
    image_count: imageCount,
    heading_count: 0,
    paragraph_count: 0,
    internal_link_count: 0,
    external_link_count: 0,
    has_naver_map: false,
    has_naver_shopping: false,
    has_youtube: false,
    title_length: cleanTitle.length,
    has_keyword_in_title: hasKeywordInTitle,
    tags: [],
    category: null,
    has_list_format: hasStructure,
    has_table: false,
    has_bold_emphasis: /<(?:b|strong)[\s>]/i.test(searchItem.description),
    has_numbered_items: hasConcreteData,
    writing_tone: null,
    image_positions: [],
    image_types: [],
    quality_score: quality.score,
    quality_tier: quality.category,
    collected_from: source,
  }
}

// ===== 내부 헬퍼 함수 =====

/** H2/H3 소제목 개수 추출 */
function extractHeadingCount(html: string): number {
  const headings = html.match(/<h[23][^>]*>/gi)
  return headings ? headings.length : 0
}

/** 문단 개수 추출 */
function extractParagraphCount(html: string): number {
  // SmartEditor 3: se-text-paragraph
  const seParagraphs = html.match(/class="[^"]*se-text-paragraph[^"]*"/gi)
  if (seParagraphs && seParagraphs.length > 2) {
    return seParagraphs.length
  }
  // 일반 <p> 태그
  const pTags = html.match(/<p[\s>]/gi)
  return pTags ? pTags.length : 0
}

/** 목록 형식 사용 감지 */
function detectListFormat(html: string): boolean {
  return /<(?:ul|ol)[\s>]/i.test(html) ||
    /[①②③④⑤⑥⑦⑧⑨⑩]/.test(html) ||
    /•|▶|■|★|✔|✅/.test(html)
}

/** 번호 매기기 형식 감지 */
function detectNumberedItems(html: string): boolean {
  return /<ol[\s>]/i.test(html) ||
    /[①②③④⑤]/.test(html) ||
    /\b[1-9]\.\s/.test(stripHtml(html).substring(0, 3000))
}

/**
 * 이미지 배치 위치 추출
 *
 * HTML에서 이미지 태그의 위치를 분석하여
 * 도입부/H2직후/중간/마무리 등 배치 패턴을 추출
 */
function extractImagePositions(html: string): ImagePosition[] {
  const positions: ImagePosition[] = []
  const totalLen = html.length
  if (totalLen < 200) return positions

  // 이미지 태그/SmartEditor 이미지 위치 찾기
  const imgRegex = /<img[\s][^>]*>|class="[^"]*se-image[^"]*"/gi
  let match: RegExpExecArray | null
  const imgIndices: number[] = []

  while ((match = imgRegex.exec(html)) !== null) {
    imgIndices.push(match.index)
  }

  if (imgIndices.length === 0) return positions

  // H2/H3 태그 위치
  const headingRegex = /<h[23][^>]*>/gi
  const headingIndices: number[] = []
  while ((match = headingRegex.exec(html)) !== null) {
    headingIndices.push(match.index)
  }

  const positionSet = new Set<ImagePosition>()

  for (const idx of imgIndices) {
    const relativePos = idx / totalLen

    // 도입부 (상위 15%)
    if (relativePos < 0.15) {
      positionSet.add('intro')
    }
    // 마무리 (하위 15%)
    else if (relativePos > 0.85) {
      positionSet.add('conclusion')
    }
    // 마무리 직전 (70~85%)
    else if (relativePos > 0.7) {
      positionSet.add('before_conclusion')
    }
    // 중간부
    else {
      positionSet.add('mid_content')
    }

    // H2/H3 직후 여부 (heading 뒤 500자 이내에 이미지)
    for (const hIdx of headingIndices) {
      if (idx > hIdx && idx - hIdx < 500) {
        positionSet.add('after_heading')
        break
      }
    }
  }

  return Array.from(positionSet)
}

/**
 * 이미지 유형 추정 (휴리스틱)
 *
 * img 태그의 alt/src/class 속성과 주변 텍스트를 분석하여
 * 제품사진/인포그래픽/음식/풍경 등 유형을 추정
 */
function extractImageTypes(html: string): string[] {
  const types = new Set<string>()

  // alt 속성 + 주변 텍스트에서 유형 추정
  const imgWithAlt = html.matchAll(/<img[^>]*alt="([^"]*)"[^>]*>/gi)
  const altTexts: string[] = []
  for (const m of imgWithAlt) {
    if (m[1]) altTexts.push(m[1])
  }

  const combined = altTexts.join(' ') + ' ' + html.substring(0, 5000)

  // 유형별 패턴 매칭
  const typePatterns: Array<[string, RegExp]> = [
    ['제품사진', /제품|상품|패키지|구성품|박스|언박싱/],
    ['음식사진', /음식|맛집|메뉴|요리|레시피|맛있|먹방/],
    ['인포그래픽', /infographic|인포그래픽|차트|그래프|도표|통계/i],
    ['비교표', /비교|vs|대결|장단점|스펙/],
    ['과정사진', /과정|단계|순서|만들기|조립|설치/],
    ['풍경사진', /풍경|전망|야경|뷰|경치|자연|바다|산|하늘/],
    ['인테리어', /인테리어|리모델링|꾸미기|데코|가구|수납/],
    ['일러스트', /일러스트|illustration|그림|아이콘|벡터/i],
    ['스크린샷', /스크린샷|캡처|화면|앱|사이트|웹/],
  ]

  for (const [typeName, pattern] of typePatterns) {
    if (pattern.test(combined)) {
      types.add(typeName)
    }
  }

  // 최대 5개 유형
  return Array.from(types).slice(0, 5)
}

/**
 * 글쓰기 톤 감지 (휴리스틱)
 *
 * 경험/후기형, 격식체, 친근체, 정보형 판별
 */
export function detectWritingTone(html: string): WritingTone | null {
  const text = stripHtml(html).substring(0, 3000)
  if (!text || text.length < 100) return null

  // 경험/후기 마커
  const reviewMarkers = ['써봤', '다녀왔', '다녀온', '직접', '사용해', '먹어봤', '해봤', '가봤', '체험', '후기', '솔직']
  const reviewCount = reviewMarkers.filter(m => text.includes(m)).length

  // 격식체 마커 (합니다/입니다)
  const formalEndings = (text.match(/(?:합니다|입니다|됩니다|있습니다|없습니다)/g) || []).length

  // 친근체 마커 (해요/요)
  const casualEndings = (text.match(/(?:해요|세요|에요|인데요|거든요|잖아요|네요|군요)/g) || []).length

  // 수치/데이터 밀도
  const dataMarkers = (text.match(/\d+[%만천백원개월일시분km]/g) || []).length

  // 판별
  if (reviewCount >= 3) return 'review'
  if (formalEndings > casualEndings * 2 && formalEndings >= 5) return 'formal'
  if (casualEndings > formalEndings * 2 && casualEndings >= 5) return 'casual'
  if (dataMarkers >= 8) return 'informational'
  if (casualEndings >= 3) return 'casual'
  if (formalEndings >= 3) return 'formal'

  return null
}
