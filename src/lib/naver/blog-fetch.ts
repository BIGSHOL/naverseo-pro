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
 * 모바일 PostView URL 생성 (SSR 콘텐츠가 더 잘 포함됨)
 */
export function buildMobilePostViewUrl(blogId: string, postNo: string): string {
  return `https://m.blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${postNo}`
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
  // 전략 1: Smart Editor ONE - se-text-paragraph 태그에서 직접 텍스트 추출
  // 본문 영역만 스코핑 (관련 글/추천 글/하단 글 목록 제외)
  const scopedHtml = scopeToMainContent(html)
  const paragraphs = extractSeTextParagraphs(scopedHtml)
  if (paragraphs.length > 0) {
    // 이미지는 extractSeTextParagraphs에서 위치별 [이미지] 마커로 삽입됨
    return paragraphs.join('\n\n')
  }

  // 전략 2: Smart Editor ONE (se-main-container) - 전체 블록 추출
  let match = findContainerContent(html, /class=["'][^"']*se-main-container[^"']*["']/i)

  // 전략 3: SE3 (postViewArea)
  if (!match) {
    match = findContainerContent(html, /id=["']postViewArea["']/i)
  }

  // 전략 4: 모바일 본문 영역 (post_ct, post-view, __se_component_area)
  if (!match) {
    match = findContainerContent(html, /class=["'][^"']*(?:post_ct|post-view|__se_component_area)[^"']*["']/i)
  }

  // 전략 5: viewTypeSelector (모바일 뷰)
  if (!match) {
    match = findContainerContent(html, /id=["']viewTypeSelector["']/i)
  }

  // 전략 6: og:description 폴백
  if (!match) {
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i)
    if (ogDesc) {
      return decodeHtmlEntities(ogDesc[1])
    }
  }

  if (!match) return ''

  return match
}

/**
 * Smart Editor ONE의 se-text-paragraph 태그에서 텍스트 직접 추출
 * - 링크(<a>)를 Markdown [text](url) 형태로 보존
 * - 소제목(se-l-heading_N 클래스)을 ## / ### Markdown 접두사로 변환
 */
function extractSeTextParagraphs(html: string): string[] {
  const results: string[] = []

  // se-text-paragraph 안의 텍스트 추출
  const paragraphRegex = /<p[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi
  let m
  let prevEnd = 0
  while ((m = paragraphRegex.exec(html)) !== null) {
    // 이전 문단과 현재 문단 사이의 HTML에서 소제목/이미지 감지
    const betweenHtml = html.substring(prevEnd, m.index)
    const headingMatch = betweenHtml.match(/se-l-heading_(\d+)/)
    const headingPrefix = headingMatch
      ? (headingMatch[1] === '1' ? '## ' : '### ')
      : ''

    // 문단 사이 이미지 모듈 감지 → 위치에 [이미지] 마커 삽입
    const imgModules = betweenHtml.match(/se-module\s+se-module-image/g)
      || betweenHtml.match(/<img[^>]*class=["'][^"']*se-image-resource/gi)
    if (imgModules) {
      for (let i = 0; i < imgModules.length; i++) {
        results.push('[이미지]')
      }
    }

    // 링크를 Markdown으로 변환한 후 나머지 태그 제거
    const text = m[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_, url, linkText) => `[${linkText.replace(/<[^>]*>/g, '').trim()}](${url})`)
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim()
    if (text.length > 0) {
      results.push(headingPrefix + text)
    }
    prevEnd = m.index + m[0].length
  }

  // 마지막 문단 이후의 이미지도 감지
  if (prevEnd > 0 && prevEnd < html.length) {
    const afterLastHtml = html.substring(prevEnd)
    const trailingImgs = afterLastHtml.match(/se-module\s+se-module-image/g)
      || afterLastHtml.match(/<img[^>]*class=["'][^"']*se-image-resource/gi)
    if (trailingImgs) {
      for (let i = 0; i < trailingImgs.length; i++) {
        results.push('[이미지]')
      }
    }
  }

  // 추가 SE 컴포넌트: 인용문(se-quote), 캡션(se-caption), 링크 요약(se-oglink-summary)
  const quoteRegex = /<[^>]*class=["'][^"']*se-quote-text[^"']*["'][^>]*>([\s\S]*?)<\/[^>]*>/gi
  while ((m = quoteRegex.exec(html)) !== null) {
    const text = m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
    if (text.length > 0) results.push(`> ${text}`)
  }

  const captionRegex = /<[^>]*class=["'][^"']*se-caption[^"']*["'][^>]*>([\s\S]*?)<\/[^>]*>/gi
  while ((m = captionRegex.exec(html)) !== null) {
    const text = m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
    if (text.length > 0) results.push(text)
  }

  const oglinkRegex = /<[^>]*class=["'][^"']*se-oglink-summary[^"']*["'][^>]*>([\s\S]*?)<\/[^>]*>/gi
  while ((m = oglinkRegex.exec(html)) !== null) {
    const text = m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
    if (text.length > 0) results.push(text)
  }

  // se-text-paragraph가 없으면 se-module-text 내부의 span.se-text-content 시도
  if (results.length === 0) {
    prevEnd = 0
    const spanRegex = /<span[^>]*class=["'][^"']*se-text-content[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi
    while ((m = spanRegex.exec(html)) !== null) {
      const betweenHtml = html.substring(prevEnd, m.index)
      const headingMatch = betweenHtml.match(/se-l-heading_(\d+)/)
      const headingPrefix = headingMatch
        ? (headingMatch[1] === '1' ? '## ' : '### ')
        : ''

      // 문단 사이 이미지 모듈 감지
      const imgModules = betweenHtml.match(/se-module\s+se-module-image/g)
        || betweenHtml.match(/<img[^>]*class=["'][^"']*se-image-resource/gi)
      if (imgModules) {
        for (let i = 0; i < imgModules.length; i++) {
          results.push('[이미지]')
        }
      }

      const text = m[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
          (_, url, linkText) => `[${linkText.replace(/<[^>]*>/g, '').trim()}](${url})`)
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim()
      if (text.length > 0) {
        results.push(headingPrefix + text)
      }
      prevEnd = m.index + m[0].length
    }
  }

  return results
}

/**
 * HTML을 본문 영역으로 스코핑 (관련 글/추천 글/하단 글 목록 제외)
 * - se-main-container 시작점 ~ 본문 끝 경계 마커까지만 반환
 * - se-main-container가 없으면 원본 HTML 그대로 반환
 */
function scopeToMainContent(html: string): string {
  const containerMatch = html.match(/<div[^>]*class=["'][^"']*se-main-container[^"']*["'][^>]*>/i)
  if (!containerMatch || containerMatch.index === undefined) return html

  const startIdx = containerMatch.index
  const rest = html.substring(startIdx)

  // 본문 끝 경계 마커 (관련 글, 추천, 태그, 댓글, 페이징, 공감 등)
  const endMarkers = [
    /<div[^>]*class=["'][^"']*(?:_recommend|post_footer|comment_area|wrap_comment|post_tag|post__tag|se-viewer-footer|blog-paging|_related_contents|post_relate|wrap_blog_paging|area_sympathy|btn_post|postBottomTitleList|_postTag)/i,
    /<div[^>]*id=["'](?:comment|footer|postTagArea|naverBlogPagingContainer)/i,
    /<section[^>]*class=["'][^"']*(?:_recommend|post_relate|_related)/i,
  ]

  let endIdx = rest.length
  for (const pattern of endMarkers) {
    const m = rest.match(pattern)
    if (m && m.index !== undefined && m.index < endIdx) {
      endIdx = m.index
    }
  }

  return rest.substring(0, endIdx)
}

/**
 * 주어진 패턴의 div 컨테이너 내부 HTML을 추출
 */
function findContainerContent(html: string, pattern: RegExp): string | null {
  // 패턴이 포함된 div 태그 찾기
  const divRegex = new RegExp(`<div[^>]*${pattern.source}[^>]*>`, pattern.flags.replace('g', '') + 'i')
  const divMatch = divRegex.exec(html)
  if (!divMatch || divMatch.index === undefined) return null

  const startIdx = divMatch.index + divMatch[0].length
  const rest = html.substring(startIdx)

  // 적절한 종료 지점 찾기
  const endIdx = findContentEndIndex(rest)
  const content = rest.substring(0, endIdx)

  // 내용이 너무 짧으면 null 반환 (og:description 폴백으로 넘김)
  if (content.replace(/<[^>]*>/g, '').trim().length < 30) return null

  return content
}

/**
 * 본문 HTML 내에서 적절한 종료 지점 찾기
 */
function findContentEndIndex(html: string): number {
  // 댓글 영역, 푸터, 관련 글, 추천 글, 스크립트 등의 시작점 찾기
  const endPatterns = [
    /<div[^>]*class=["'][^"']*(?:post_footer|comment_area|post-btn|wrap_comment|post_tag|post__tag|se-viewer-footer|blog-paging|_related_contents|_postTag|postBottomTitleList)/i,
    /<div[^>]*id=["'](?:comment|footer|postTagArea|naverBlogPagingContainer)/i,
    /<div[^>]*class=["'][^"']*(?:area_sympathy|btn_post|post_relate|wrap_blog_paging|_recommend)/i,
    /<section[^>]*class=["'][^"']*(?:_recommend|post_relate|_related)/i,
    /<script[^>]*>(?![\s\S]*?<\/script>\s*<div)/i, // script 다음에 div가 없는 경우만
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
  let text = html
    // 이미지 태그를 위치별 [이미지] 마커로 변환 (단순 개수가 아닌 위치 보존)
    .replace(/<img[^>]*>/gi, '\n[이미지]\n')
    // Smart Editor ONE 소제목 전처리: se-l-heading_N 클래스 → 표준 <h2>/<h3> 태그로 변환
    // (전략 2-5에서 raw HTML이 전달될 때 필요)
    .replace(/<[^>]*class=["'][^"']*se-l-heading_(\d+)[^"']*["'][^>]*>[\s\S]{0,500}?<p[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi,
      (_, level, content) => {
        const tag = level === '1' ? 'h2' : 'h3'
        return `<${tag}>${content}</${tag}>`
      })
    // HTML 헤딩을 Markdown으로 변환 (SEO 엔진이 ## / ### 패턴을 감지)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => `\n\n## ${inner.replace(/<[^>]*>/g, '').trim()}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `\n\n### ${inner.replace(/<[^>]*>/g, '').trim()}\n\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, inner) => `\n\n#### ${inner.replace(/<[^>]*>/g, '').trim()}\n\n`)
    // HTML 링크를 Markdown으로 변환 (SEO 엔진이 [text](url) 패턴을 감지)
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, linkText) => `[${linkText.replace(/<[^>]*>/g, '').trim()}](${url})`)
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
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&bull;/g, '\u2022')
    .replace(/&middot;/g, '\u00B7')
    .replace(/&copy;/g, '\u00A9')
    .replace(/&reg;/g, '\u00AE')
    .replace(/&trade;/g, '\u2122')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
    // 연속 줄바꿈 정리 (최대 2개)
    .replace(/\n{3,}/g, '\n\n')
    // 줄 앞뒤 공백 정리
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()

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
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&bull;/g, '\u2022')
    .replace(/&middot;/g, '\u00B7')
    .replace(/&copy;/g, '\u00A9')
    .replace(/&reg;/g, '\u00AE')
    .replace(/&trade;/g, '\u2122')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
}
