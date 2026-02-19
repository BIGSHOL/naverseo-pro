/**
 * 네이버 블로그 URL에서 제목/본문을 추출하는 유틸리티
 * - blog.naver.com/{blogId}/{postNo}
 * - m.blog.naver.com/{blogId}/{postNo}
 * - PostView.naver?blogId=xxx&logNo=yyy
 * 등 다양한 URL 형식 지원
 */

interface ParsedBlogUrl {
  blogId: string
  postNo: string
}

/**
 * 네이버 블로그 URL에서 blogId와 postNo를 추출
 */
export function parseNaverBlogUrl(url: string): ParsedBlogUrl | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // blog.naver.com 또는 m.blog.naver.com 확인
    if (!hostname.includes('blog.naver.com')) {
      return null
    }

    // PostView.naver?blogId=xxx&logNo=yyy 형식
    if (parsed.pathname.includes('PostView.naver') || parsed.pathname.includes('PostView.nhn')) {
      const blogId = parsed.searchParams.get('blogId')
      const logNo = parsed.searchParams.get('logNo')
      if (blogId && logNo) {
        return { blogId, postNo: logNo }
      }
      return null
    }

    // blog.naver.com/{blogId}/{postNo} 형식
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    if (pathParts.length >= 2) {
      const blogId = pathParts[0]
      const postNo = pathParts[1]
      // postNo가 숫자인지 확인
      if (/^\d+$/.test(postNo)) {
        return { blogId, postNo }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * iframe 없는 PostView URL 생성 (직접 접근 가능한 URL)
 */
export function buildPostViewUrl(blogId: string, postNo: string): string {
  return `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${postNo}&directAccess=false`
}

/**
 * HTML에서 og:title 메타태그 또는 <title>에서 제목 추출
 */
export function extractTitle(html: string): string {
  // og:title 우선
  const ogMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)
  if (ogMatch) {
    return decodeHtmlEntities(ogMatch[1]).replace(/\s*:\s*네이버\s*블로그$/, '').trim()
  }

  // <title> 폴백
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1]).replace(/\s*:\s*네이버\s*블로그$/, '').trim()
  }

  return ''
}

/**
 * HTML에서 블로그 본문 추출
 * Smart Editor ONE, SE3 등 다양한 에디터 형식 지원
 */
export function extractContent(html: string): string {
  // 전략 1: Smart Editor ONE (se-main-container)
  let match = html.match(/<div[^>]*class=["'][^"']*se-main-container[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*<(?:div[^>]*class=["'][^"']*(?:post_footer|comment)|script)/i)
  if (!match) {
    // 좀 더 느슨한 매칭
    match = html.match(/<div[^>]*class=["'][^"']*se-main-container[^"']*["'][^>]*>([\s\S]*?)$/i)
    if (match) {
      // se-main-container 찾았으면 적절한 종료 지점 찾기
      const content = match[1]
      const endIdx = findContentEndIndex(content)
      match[1] = content.substring(0, endIdx)
    }
  }

  // 전략 2: SE3 (postViewArea)
  if (!match) {
    match = html.match(/<div[^>]*id=["']postViewArea["'][^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*<(?:div[^>]*(?:post_footer|comment)|script)/i)
    if (!match) {
      match = html.match(/<div[^>]*id=["']postViewArea["'][^>]*>([\s\S]*?)$/i)
      if (match) {
        const content = match[1]
        const endIdx = findContentEndIndex(content)
        match[1] = content.substring(0, endIdx)
      }
    }
  }

  // 전략 3: post-view 영역
  if (!match) {
    match = html.match(/<div[^>]*class=["'][^"']*post-view[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*(?:post_footer|comment)/i)
  }

  // 전략 4: og:description 폴백
  if (!match) {
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i)
    if (ogDesc) {
      return decodeHtmlEntities(ogDesc[1])
    }
  }

  if (!match) return ''

  return match[1]
}

/**
 * 본문 HTML 내에서 적절한 종료 지점 찾기
 */
function findContentEndIndex(html: string): number {
  // 댓글 영역, 푸터, 스크립트 등의 시작점 찾기
  const endPatterns = [
    /<div[^>]*class=["'][^"']*(?:post_footer|comment_area|post-btn|wrap_comment)/i,
    /<div[^>]*id=["'](?:comment|footer)/i,
    /<script[^>]*>/i,
  ]

  let minIdx = html.length
  for (const pattern of endPatterns) {
    const m = html.match(pattern)
    if (m && m.index !== undefined && m.index < minIdx) {
      minIdx = m.index
    }
  }

  return minIdx
}

/**
 * HTML → 텍스트 변환
 * - 줄바꿈 보존
 * - 이미지 개수 표시
 */
export function htmlToPlainText(html: string): string {
  // 이미지 개수 세기
  const imgMatches = html.match(/<img[^>]*>/gi)
  const imgCount = imgMatches ? imgMatches.length : 0

  let text = html
    // <br>, <p>, <div> 등을 줄바꿈으로
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    // 나머지 HTML 태그 제거
    .replace(/<[^>]*>/g, '')
    // HTML 엔티티 디코딩
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
    // 연속 줄바꿈 정리 (최대 2개)
    .replace(/\n{3,}/g, '\n\n')
    // 줄 앞뒤 공백 정리
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()

  // 이미지 포함 표시
  if (imgCount > 0) {
    text += `\n\n[이미지 ${imgCount}개 포함]`
  }

  return text
}

/**
 * HTML 엔티티 디코딩
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
}
