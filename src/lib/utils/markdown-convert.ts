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
 * 네이버 블로그 클립보드용 HTML 변환
 * 시맨틱 태그(h1~h3)를 인라인 스타일로 변환하여
 * 네이버 스마트에디터 붙여넣기 시 서식이 유지되도록 함
 */
export function htmlForNaverClipboard(html: string): string {
  return html
    // h1 → 볼드 + 28px
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '<p><b><span style="font-size: 28px;">$1</span></b></p>')
    // h2 → 볼드 + 22px
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '<p><b><span style="font-size: 22px;">$1</span></b></p>')
    // h3 → 볼드 + 18px
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<p><b><span style="font-size: 18px;">$1</span></b></p>')
    // blockquote → 좌측 테두리 스타일
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '<div style="border-left: 3px solid #ccc; padding-left: 12px; color: #666;">$1</div>')
    // hr → 구분선
    .replace(/<hr\s*\/?>/gi, '<p style="text-align: center; color: #ccc;">━━━━━━━━━━━━━━━━</p>')
    // mark (형광펜) → background-color 인라인 스타일
    .replace(/<mark(?:\s+style="([^"]*)")?>(.*?)<\/mark>/gi, (_m, style, content) => {
      const bg = style?.match(/background-color:\s*([^;]+)/)?.[1] || '#fef08a'
      return `<span style="background-color: ${bg};">${content}</span>`
    })
}
