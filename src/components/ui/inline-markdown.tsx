'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * 인라인 마크다운 렌더링 컴포넌트
 * <li> 안에서 사용해도 block 요소(p, div) 없이 렌더링
 * **bold**, *italic*, `code` 등 인라인 서식만 처리
 */
export function InlineMarkdown({ children }: { children: string }) {
  // ~ 이스케이프 (GFM ~~취소선~~ 방지)
  const escaped = children.replace(/~/g, '\\~')
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <span>{children}</span>,
        // block 요소를 인라인으로 변환
        h1: ({ children }) => <strong>{children}</strong>,
        h2: ({ children }) => <strong>{children}</strong>,
        h3: ({ children }) => <strong>{children}</strong>,
        ul: ({ children }) => <span>{children}</span>,
        ol: ({ children }) => <span>{children}</span>,
        li: ({ children }) => <span>{children} </span>,
        blockquote: ({ children }) => <span>{children}</span>,
      }}
    >
      {escaped}
    </ReactMarkdown>
  )
}
