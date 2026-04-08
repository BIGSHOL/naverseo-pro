import { marked } from 'marked'
import TurndownService from 'turndown'

// marked 설정: GFM (tables, strikethrough) + 줄바꿈 보존
marked.setOptions({ gfm: true, breaks: true })

// turndown 설정: SEO 엔진 regex 호환 포맷
const turndown = new TurndownService({
  headingStyle: 'atx',        // ## 스타일 (SEO 엔진: ^## )
  bulletListMarker: '-',      // - 스타일 (SEO 엔진: ^[-•]\s)
  codeBlockStyle: 'fenced',   // ``` 스타일
  emDelimiter: '*',           // *italic*
  strongDelimiter: '**',      // **bold**
})

// 커스텀 룰: <img alt="이미지: ..."> → [이미지: ...] 마커 복원
turndown.addRule('imageMarker', {
  filter: (node) => {
    return node.nodeName === 'IMG' &&
      (node.getAttribute('alt') || '').startsWith('이미지')
  },
  replacement: (_content, node) => {
    const alt = (node as HTMLElement).getAttribute('alt') || ''
    return `\n\n[${alt}]\n\n`
  },
})

// 일반 이미지 처리
turndown.addRule('regularImage', {
  filter: (node) => {
    return node.nodeName === 'IMG' &&
      !(node.getAttribute('alt') || '').startsWith('이미지')
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement
    const alt = el.getAttribute('alt') || ''
    const src = el.getAttribute('src') || ''
    return src ? `![${alt}](${src})` : ''
  },
})

// 밑줄 보존 (마크다운에 없지만 <u> 태그로 변환)
turndown.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`,
})

// 인라인 스타일 보존 (color, font-size, background-color 등)
turndown.addRule('styledSpan', {
  filter: (node) => {
    if (node.nodeName !== 'SPAN') return false
    const style = node.getAttribute('style') || ''
    return style.includes('color') || style.includes('font-size') || style.includes('background')
  },
  replacement: (content, node) => {
    const style = (node as HTMLElement).getAttribute('style') || ''
    return `<span style="${style}">${content}</span>`
  },
})

// mark (형광펜) 보존
turndown.addRule('highlight', {
  filter: ['mark'],
  replacement: (content, node) => {
    const style = (node as HTMLElement).getAttribute('style') || ''
    const dataColor = (node as HTMLElement).getAttribute('data-color') || ''
    if (style) return `<mark style="${style}">${content}</mark>`
    if (dataColor) return `<mark data-color="${dataColor}">${content}</mark>`
    return `<mark>${content}</mark>`
  },
})

// 정렬 보존 (text-align 스타일이 있는 p/div)
turndown.addRule('textAlign', {
  filter: (node) => {
    if (!['P', 'DIV', 'H1', 'H2', 'H3'].includes(node.nodeName)) return false
    const style = node.getAttribute('style') || ''
    return style.includes('text-align')
  },
  replacement: (content, node) => {
    const el = node as HTMLElement
    const style = el.getAttribute('style') || ''
    const tag = el.nodeName.toLowerCase()
    // 헤딩은 마크다운 형태로 유지하면서 정렬 래핑
    if (tag.startsWith('h')) {
      const level = tag.charAt(1)
      const prefix = '#'.repeat(Number(level)) + ' '
      return `\n\n${prefix}${content}\n\n`
    }
    if (style.includes('center')) return `\n\n<p style="text-align: center">${content}</p>\n\n`
    if (style.includes('right')) return `\n\n<p style="text-align: right">${content}</p>\n\n`
    return `\n\n${content}\n\n`
  },
})

/**
 * 마크다운 → HTML 변환
 * [이미지: 설명] 마커를 <img> 태그로 전처리
 */
export function markdownToHtml(md: string): string {
  // [이미지: desc] 또는 [이미지:desc] → <img> 태그로 변환
  const processed = md.replace(
    /\[이미지[:\s]([^\]]*)\]/g,
    '<img alt="이미지: $1" src="" />'
  )
  // ~ 이스케이프 (GFM ~~취소선~~ 방지 - 블로그 콘텐츠에서 ~무늬 등 사용 시 가로줄 방지)
  const escaped = processed.replace(/~/g, '\\~')
  return marked.parse(escaped, { async: false }) as string
}

/**
 * HTML → 마크다운 변환
 * TipTap 에디터 출력을 마크다운으로 역변환
 * (인라인 스타일은 HTML 태그로 보존됨)
 */
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html)
}

/**
 * 네이버 블로그 클립보드용 HTML 변환 (SmartEditor ONE 호환)
 * 시맨틱 태그를 인라인 스타일로 변환하여
 * 네이버 스마트에디터 붙여넣기 시 서식이 유지되도록 함
 *
 * 참고: mathlab 프로젝트의 prepareForNaver() 패턴을 이식
 */
export function htmlForNaverClipboard(html: string): string {
  let result = html

  // 1. text-align: left 제거 (기본값이므로 불필요)
  result = result.replace(/\s*text-align:\s*left\s*;?/gi, '')

  // 2. h1 → 볼드 + 28px
  result = result.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '<p><b><span style="font-size: 28px;">$1</span></b></p>')

  // 3. h2 → 볼드 + 24px + <hr> 구분선 (네이버 블로그 소제목 패턴, style 속성 보존)
  result = result.replace(/<h2(\s[^>]*)?>(([\s\S]*?))<\/h2>/gi, (_m, attrs, inner) => {
    const styleMatch = (attrs || '').match(/style="([^"]*)"/)
    const style = styleMatch ? ` style="${styleMatch[1]}"` : ''
    return `<p${style}><span style="font-size: 24px;"><b>${inner}</b></span></p><hr>`
  })

  // 4. h3 → 볼드 + 18px (style 속성 보존)
  result = result.replace(/<h3(\s[^>]*)?>(([\s\S]*?))<\/h3>/gi, (_m, attrs, inner) => {
    const styleMatch = (attrs || '').match(/style="([^"]*)"/)
    const style = styleMatch ? ` style="${styleMatch[1]}"` : ''
    return `<p${style}><span style="font-size: 18px;"><b>${inner}</b></span></p>`
  })

  // 5. 리스트 항목 → <p>로 변환 (네이버 리스트 렌더링 깨짐 방지)
  //    <li><p>내용</p></li> → <p>내용</p> (속성 보존)
  result = result.replace(/<li[^>]*>(<p\s[^>]*>[\s\S]*?<\/p>)<\/li>/gi, '$1')
  result = result.replace(/<li[^>]*><p>([\s\S]*?)<\/p><\/li>/gi, '<p>$1</p>')
  result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '<p>• $1</p>')

  // 6. ul/ol 래퍼 제거
  result = result.replace(/<\/?[uo]l[^>]*>/gi, '')

  // 7. blockquote의 배경색/border 인라인 스타일 제거 (네이버가 자체 스타일 적용)
  result = result.replace(/<blockquote([^>]*)>/gi, (_m, attrs) => {
    // style 속성에서 background 관련 제거
    const cleaned = (attrs || '').replace(/style="[^"]*"/gi, '')
    return `<blockquote${cleaned}>`
  })

  // 8. hr → 구분선
  result = result.replace(/<hr\s*\/?>/gi, '<p style="text-align: center; color: #ccc;">━━━━━━━━━━━━━━━━</p>')

  // 9. <strong> → <b> (네이버 SmartEditor 기본 태그)
  result = result.replace(/<strong([^>]*)>/gi, '<b$1>')
  result = result.replace(/<\/strong>/gi, '</b>')

  // 10. mark (형광펜) → background-color 인라인 스타일 보장
  //     data-color 속성이 있으면 style로 변환
  result = result.replace(/<mark(?=[^>]*data-color="([^"]*)")(?![^>]*style)[^>]*>/gi,
    '<mark style="background-color: $1">')
  result = result.replace(/<mark(?:\s+style="([^"]*)")?>(.*?)<\/mark>/gi, (_m, style, content) => {
    const bg = style?.match(/background-color:\s*([^;]+)/)?.[1] || '#fef08a'
    return `<span style="background-color: ${bg};">${content}</span>`
  })

  // 11. 빈 <p> 제거
  result = result.replace(/<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>/gi, '')

  return result
}

/**
 * 네이버 블로그 서식 복사 (3단계 폴백)
 *
 * 1차: DOM 렌더링 + execCommand('copy') — 서식 유지율 최고
 * 2차: ClipboardItem (HTML + 텍스트 Blob) — 최신 API
 * 3차: writeText (순수 텍스트) — 최후 수단
 *
 * 참고: mathlab 프로젝트의 handleCopyRichText() 패턴을 이식
 */
export async function copyForNaver(html: string, plainText: string): Promise<'rich' | 'html' | 'text'> {
  const prepared = htmlForNaverClipboard(html)

  // 1차: DOM 렌더링 + execCommand('copy') — 브라우저가 계산된 스타일을 복사하므로 서식 유지율 최고
  try {
    const container = document.createElement('div')
    container.innerHTML = prepared
    // 화면 밖에 렌더링 (display:none은 선택 불가)
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.opacity = '0'
    container.style.width = '600px'          // 네이버 블로그 본문 폭
    container.style.fontFamily = '"NanumGothic", "나눔고딕", sans-serif'
    container.style.fontSize = '15px'
    container.style.fontWeight = 'normal'
    container.style.lineHeight = '1.7'
    container.style.color = '#333'
    container.style.textAlign = 'left'
    document.body.appendChild(container)

    // 개별 블록에 text-align 강제 부여 (네이버가 컨테이너 스타일을 무시하므로 개별 지정)
    // + 블록 요소의 background 제거 (에디터 배경색이 네이버에 복사되는 것 방지)
    container.querySelectorAll('p, h2, h3, blockquote, li, div').forEach((el) => {
      const blockEl = el as HTMLElement
      if (!blockEl.style.textAlign) {
        blockEl.style.textAlign = 'left'
      }
      // blockquote 등의 배경색 제거 (형광펜 span은 건드리지 않음)
      if (blockEl.style.backgroundColor && blockEl.tagName !== 'SPAN') {
        blockEl.style.backgroundColor = 'transparent'
      }
    })

    // mark 배경색 강제 적용 (브라우저가 누락할 수 있음)
    container.querySelectorAll('mark, span[style*="background-color"]').forEach((el) => {
      const elem = el as HTMLElement
      if (!elem.style.backgroundColor) {
        elem.style.backgroundColor = elem.getAttribute('data-color') || '#fef08a'
      }
    })

    // Range + Selection API로 전체 선택 → 복사
    const range = document.createRange()
    range.selectNodeContents(container)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    document.execCommand('copy')

    selection?.removeAllRanges()
    document.body.removeChild(container)
    return 'rich'
  } catch {
    // 2차: ClipboardItem (HTML + 텍스트 Blob)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([prepared], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ])
      return 'html'
    } catch {
      // 3차: 순수 텍스트 (최후 수단)
      await navigator.clipboard.writeText(plainText)
      return 'text'
    }
  }
}
