/**
 * 네이버 블로그 크롤링 통합 유틸리티
 *
 * 3단계 크롤링 전략:
 * 1. RSS 피드 우선 (가장 정확하고 빠름)
 * 2. 네이버 블로그 검색 API 폴백 (RSS 실패 시)
 * 3. 블로그 페이지 직접 크롤링 보충 (검색 결과 부족 시)
 *
 * 사용처: opportunities, profile/blog/verify, blog-index
 */

import { STOPWORDS, stripHtml, extractKoreanKeywords } from '@/lib/utils/text'

/**
 * 네이버 블로그 포스트 URL 정규화
 * PostView.nhn/naver 쿼리 파라미터 형식 → 클린 URL 변환
 * 예: PostView.nhn?blogId=xxx&logNo=123 → https://blog.naver.com/xxx/123
 */
export function normalizePostLink(link: string): string {
  const pvMatch = link.match(/blogId=([a-zA-Z0-9_-]+)/)
  const logMatch = link.match(/logNo=(\d+)/)
  if (pvMatch && logMatch) {
    return `https://blog.naver.com/${pvMatch[1]}/${logMatch[1]}`
  }
  let normalized = link.replace('://m.blog.naver.com/', '://blog.naver.com/')
  // 프로토콜이 없으면 https:// 추가 (상대 경로 404 방지)
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = normalized.startsWith('//') ? `https:${normalized}` : `https://${normalized}`
  }
  return normalized
}

export interface BlogPost {
  title: string
  link: string
  description: string
  postdate: string
}

export interface BlogCrawlResult {
  posts: BlogPost[]
  blogName: string | null
  source: 'rss' | 'search' | 'crawl' | 'mixed'
}

/**
 * RSS XML에서 블로그 이름(title) 추출
 */
function extractBlogNameFromRss(xml: string): string | null {
  // <channel> 내의 <title> (첫 번째 title이 블로그 이름)
  const channelMatch = xml.match(/<channel>([\s\S]*?)<item>/)
  if (channelMatch) {
    const channelXml = channelMatch[1]
    const titleMatch = channelXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
      || channelXml.match(/<title>([\s\S]*?)<\/title>/)
    if (titleMatch) return titleMatch[1].trim()
  }
  return null
}

/**
 * RSS XML을 파싱하여 BlogPost 배열로 변환
 */
function parseRssXml(xml: string, blogId: string): BlogPost[] {
  const posts: BlogPost[] = []

  // <item> 블록 추출
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let itemMatch: RegExpExecArray | null

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1]

    // 제목 추출
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
      || itemXml.match(/<title>([\s\S]*?)<\/title>/)
    const title = titleMatch ? titleMatch[1].trim() : ''

    // 링크 추출 + CDATA 제거 + 정규화
    const linkMatch = itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/)
      || itemXml.match(/<link>([\s\S]*?)<\/link>/)
    let rawLink = linkMatch ? linkMatch[1].trim() : `https://blog.naver.com/${blogId}`
    // CDATA가 중첩되어 남아있을 경우 한번 더 제거
    rawLink = rawLink.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
    // RSS 트래킹 파라미터 제거 (?fromRss=true&trackingCode=rss)
    rawLink = rawLink.replace(/\?fromRss.*$/, '')
    const link = normalizePostLink(rawLink)

    // 설명 추출 (HTML 원본 보존 - 이미지 태그 감지에 필요)
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)
      || itemXml.match(/<description>([\s\S]*?)<\/description>/)
    const description = descMatch ? descMatch[1].trim() : ''

    // 날짜 추출 (pubDate)
    const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
    let postdate = ''
    if (dateMatch) {
      try {
        const d = new Date(dateMatch[1].trim())
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          postdate = `${y}${m}${day}`
        }
      } catch {
        // 날짜 파싱 실패 시 빈 문자열 유지
      }
    }

    if (title) {
      posts.push({ title, link, description, postdate })
    }
  }

  return posts
}

/**
 * 네이버 블로그 RSS 피드로 포스트 가져오기
 * RSS URL: https://rss.blog.naver.com/{blogId}.xml
 *
 * @param blogId 네이버 블로그 ID
 * @returns 포스트 배열 + 블로그 이름
 */
export async function fetchBlogPostsViaRss(blogId: string): Promise<{ posts: BlogPost[]; blogName: string | null }> {
  try {
    const rssUrl = `https://rss.blog.naver.com/${blogId}.xml`
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'NaverSEO-Pro/1.0' },
      cache: 'no-store' as RequestCache,
    })

    if (!res.ok) {
      console.warn(`[BlogCrawler] RSS 피드 오류: ${res.status}`)
      return { posts: [], blogName: null }
    }

    const xml = await res.text()
    const posts = parseRssXml(xml, blogId)
    const blogName = extractBlogNameFromRss(xml)
    console.log(`[BlogCrawler] RSS 성공: ${posts.length}개 포스트, 블로그명: ${blogName || '(없음)'}`)
    return { posts, blogName }
  } catch (error) {
    console.error('[BlogCrawler] RSS 피드 가져오기 실패:', error)
    return { posts: [], blogName: null }
  }
}

/**
 * 네이버 블로그 검색 API로 포스트 가져오기
 *
 * @param blogId 네이버 블로그 ID
 * @param maxDisplay 최대 검색 결과 수 (기본: 20, 최대: 100)
 * @returns 포스트 배열 (해당 블로그 포스트만 필터링)
 */
export async function fetchBlogPostsViaSearch(
  blogId: string,
  maxDisplay = 20
): Promise<{ posts: BlogPost[]; blogName: string | null }> {
  try {
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
      console.warn('[BlogCrawler] 네이버 API 키 미설정')
      return { posts: [], blogName: null }
    }

    const searchResponse = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(blogId)}&display=${Math.min(maxDisplay, 100)}&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
        },
      }
    )

    if (!searchResponse.ok) {
      console.warn(`[BlogCrawler] 검색 API 오류: ${searchResponse.status}`)
      return { posts: [], blogName: null }
    }

    const searchData = await searchResponse.json()
    const items = searchData.items || []

    // 해당 블로그의 글만 필터링
    const userPosts = items.filter((item: { link: string; blogerlink?: string }) =>
      item.link.includes(`blog.naver.com/${blogId}`) || item.blogerlink?.includes(blogId)
    )

    // 블로그 이름 추출 (blogerlink에서)
    const blogName = userPosts.length > 0 && userPosts[0]?.blogerlink
      ? userPosts[0].blogerlink.split('.com/')[1] || blogId
      : blogId

    const posts = userPosts.map((item: { title: string; link: string; description: string; postdate: string }) => ({
      title: item.title,
      link: normalizePostLink(item.link),
      description: item.description,
      postdate: item.postdate || '',
    }))

    console.log(`[BlogCrawler] 검색 API 성공: ${items.length}개 중 ${posts.length}개 필터링`)
    return { posts, blogName: posts.length > 0 ? blogName : null }
  } catch (error) {
    console.error('[BlogCrawler] 검색 API 실패:', error)
    return { posts: [], blogName: null }
  }
}

/**
 * 블로그 페이지 직접 크롤링으로 포스트 링크 추출
 * 검색 API에서 부족한 경우 보충용
 *
 * @param blogId 네이버 블로그 ID
 * @param existingPosts 이미 수집된 포스트 (중복 방지용)
 * @param maxNewPosts 추가로 수집할 최대 포스트 수
 * @returns 새로 발견된 포스트 링크 배열
 */
export async function fetchBlogPostsViaCrawl(
  blogId: string,
  existingPosts: BlogPost[] = [],
  maxNewPosts = 30
): Promise<BlogPost[]> {
  try {
    const blogPageUrl = `https://m.blog.naver.com/${blogId}`
    const blogRes = await fetch(blogPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      cache: 'no-store' as RequestCache,
    })

    if (!blogRes.ok) {
      console.warn(`[BlogCrawler] 블로그 페이지 크롤링 실패: ${blogRes.status}`)
      return []
    }

    const html = await blogRes.text()
    // 포스트 링크 패턴 추출: /blogId/숫자 형태
    const linkRegex = new RegExp(`/${blogId}/(\\d{12,15})`, 'g')
    const foundLinks = new Set<string>()
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      foundLinks.add(`https://blog.naver.com/${blogId}/${linkMatch[1]}`)
    }

    // 기존에 없는 링크만 추가
    const existingLinks = new Set(existingPosts.map(p => p.link))
    const newLinks = Array.from(foundLinks).filter(l => !existingLinks.has(l))

    const newPosts = newLinks.slice(0, maxNewPosts).map(link => ({
      title: '',  // 제목은 스크래핑에서 추출
      link,
      description: '',
      postdate: '',
    }))

    console.log(`[BlogCrawler] 페이지 크롤링 성공: ${newLinks.length}개 추가 발견 → ${newPosts.length}개 추가`)
    return newPosts
  } catch (error) {
    console.error('[BlogCrawler] 페이지 크롤링 실패:', error)
    return []
  }
}

/**
 * 통합 블로그 포스트 수집 (3단계 전략)
 *
 * 1. RSS 피드 우선 시도
 * 2. RSS 실패 시 검색 API 폴백
 * 3. 검색 결과 부족 시(<10개) 페이지 크롤링 보충
 *
 * @param blogId 네이버 블로그 ID
 * @param maxPosts 최대 수집 포스트 수 (기본: 20)
 * @returns 포스트 배열 + 블로그 이름 + 수집 방법
 */
export async function fetchBlogPosts(blogId: string, maxPosts = 20): Promise<BlogCrawlResult> {
  // 1단계: RSS 피드 우선
  const rssResult = await fetchBlogPostsViaRss(blogId)
  if (rssResult.posts.length > 0) {
    return {
      posts: rssResult.posts.slice(0, maxPosts),
      blogName: rssResult.blogName,
      source: 'rss',
    }
  }

  // 2단계: 검색 API 폴백
  const searchResult = await fetchBlogPostsViaSearch(blogId, maxPosts)
  let posts = searchResult.posts
  let blogName = searchResult.blogName
  let source: 'search' | 'mixed' = 'search'

  // 3단계: 검색 결과 부족 시 페이지 크롤링 보충
  if (posts.length < 10) {
    const crawledPosts = await fetchBlogPostsViaCrawl(blogId, posts, maxPosts - posts.length)
    if (crawledPosts.length > 0) {
      posts = [...posts, ...crawledPosts]
      source = 'mixed'
    }
  }

  return {
    posts: posts.slice(0, maxPosts),
    blogName,
    source,
  }
}

/**
 * 수집된 블로그 포스트 제목에서 검색용 키워드를 자동 추출
 * 빈출 바이그램(2단어 조합) 우선, 부족하면 단일 키워드로 보충
 *
 * @param posts 블로그 포스트 배열
 * @param maxKeywords 최대 키워드 수 (기본: 5)
 * @returns 추출된 키워드 배열
 */
export function extractKeywordsFromPosts(posts: BlogPost[], maxKeywords = 5): string[] {
  const wordFreq: Record<string, number> = {}
  const bigramFreq: Record<string, number> = {}

  posts.forEach((p) => {
    const title = stripHtml(p.title)
    const words = extractKoreanKeywords(title, STOPWORDS)

    words.forEach((w) => {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })

    // 인접 단어 바이그램 생성 (더 구체적인 검색 키워드)
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`
      bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1
    }
  })

  const keywords: string[] = []

  // 1단계: 빈도 2회 이상 바이그램 (구체적인 검색어)
  const topBigrams = Object.entries(bigramFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([phrase]) => phrase)
  keywords.push(...topBigrams)

  // 2단계: 바이그램에 포함되지 않은 단일 키워드로 보충
  const usedWords = new Set(topBigrams.flatMap((b) => b.split(' ')))
  const topWords = Object.entries(wordFreq)
    .filter(([word]) => !usedWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords - keywords.length)
    .map(([word]) => word)
  keywords.push(...topWords)

  return keywords.slice(0, maxKeywords)
}
