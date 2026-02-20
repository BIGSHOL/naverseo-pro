/**
 * 공유 텍스트 유틸리티
 *
 * HTML 처리, 키워드 추출, 불용어, 유사도 등
 * blog-index/engine, content/engine 등에서 중복되던 로직을 통합
 */

/** HTML 태그 및 엔티티 제거 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .trim()
}

/** 이미지 개수 추출 (HTML에서 <img 태그 카운트) */
export function countImageMarkers(content: string): number {
  const imgMatches = content.match(/<img[\s>]/gi)
  return imgMatches ? imgMatches.length : 0
}

/** 날짜 간 일수 차이 */
export function daysBetween(date1: Date, date2: Date): number {
  return Math.floor(Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
}

/** YYYYMMDD 문자열 → Date 변환 */
export function parsePostDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.substring(0, 4))
  const m = parseInt(yyyymmdd.substring(4, 6)) - 1
  const d = parseInt(yyyymmdd.substring(6, 8))
  return new Date(y, m, d)
}

/**
 * 한국어 불용어 세트 (통합)
 * blog-index/engine + content/engine의 불용어를 합친 목록
 */
export const STOPWORDS = new Set([
  // 접속사/조사
  '그리고', '하지만', '그래서', '때문에', '또한', '매우', '정말', '아주', '너무', '조금', '약간',
  // 서술어
  '입니다', '합니다', '있습니다', '됩니다', '것입니다',
  // 블로그 상투어
  '블로그', '포스팅', '오늘은', '안녕하세요', '여러분', '이번에', '진짜',
  // 관형사/부사
  '같은', '통해', '대한', '위한', '하는', '있는', '되는', '다양한', '중요한', '필요한',
  '어떤', '그런', '이런', '저런', '모든', '각각',
  // 기능어
  '대해서', '통해서', '위해서', '함께', '시작', '먼저', '다음', '마지막', '관련', '경우', '대해', '가지',
  // 일반 명사 (키워드로 무의미)
  '만들기', '사용', '방법', '추천', '후기', '리뷰', '정보', '이야기', '소개',
  // 영문 불용어
  'the', 'and', 'for', 'with', 'this', 'that', 'from',
])

/**
 * 텍스트에서 의미 있는 키워드 추출
 * 한글 2글자 이상, 영문 3글자 이상 단어 + 불용어 제외
 */
export function extractKoreanKeywords(text: string, customStopwords?: Set<string>): string[] {
  const stops = customStopwords || STOPWORDS
  const words = text.match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || []
  return words.map(w => w.toLowerCase()).filter(w => !stops.has(w))
}

/** 두 배열의 Jaccard 유사도 계산 (0~1) */
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = Array.from(setA).filter(x => setB.has(x)).length
  const union = new Set(a.concat(b)).size
  return union === 0 ? 0 : intersection / union
}

/** 블로그 URL에서 블로그 ID 추출 */
export function extractBlogId(url: string): string | null {
  const match = url.match(
    /(?:blog\.naver\.com|m\.blog\.naver\.com)\/([a-zA-Z0-9_-]+)/
  )
  return match ? match[1] : null
}
