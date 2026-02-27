'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Extension } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { useEffect, useRef } from 'react'
import { markdownToHtml, htmlToMarkdown } from '@/lib/utils/markdown-convert'
import { createPatchHighlightPlugin } from '@/lib/editor/patch-highlight-plugin'
import { TiptapToolbar } from './TiptapToolbar'

// 커스텀 FontSize 확장 (TextStyle 기반)
const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) => {
            if (!attributes.fontSize) return {}
            return { style: `font-size: ${attributes.fontSize}` }
          },
        },
      },
    }]
  },

  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: { chain: any }) => {
        return chain().setMark('textStyle', { fontSize }).run()
      },
      unsetFontSize: () => ({ chain }: { chain: any }) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
      },
    } as any
  },
})

// TipTap 커맨드 타입 확장
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

// PatchHighlight 플러그인을 TipTap Extension으로 래핑
const PatchHighlightExtension = Extension.create({
  name: 'patchHighlight',
  addProseMirrorPlugins() {
    return [createPatchHighlightPlugin()]
  },
})

interface TiptapEditorProps {
  markdown: string
  onMarkdownChange: (md: string) => void
  onEditorReady?: (editor: Editor) => void
  placeholder?: string
  className?: string
}

export function TiptapEditor({ markdown, onMarkdownChange, onEditorReady, placeholder, className }: TiptapEditorProps) {
  const isExternalUpdate = useRef(false)
  const lastMarkdown = useRef(markdown)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,      // 별도 확장으로 추가
        underline: false,  // 별도 확장으로 추가
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || '글을 작성하세요...',
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      FontSize,
      PatchHighlightExtension,
    ],
    content: markdownToHtml(markdown),
    onCreate: ({ editor }) => {
      onEditorReady?.(editor)
    },
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return
      const html = editor.getHTML()
      const md = htmlToMarkdown(html)
      lastMarkdown.current = md
      onMarkdownChange(md)
    },
    editorProps: {
      attributes: {
        class: [
          'prose prose-sm max-w-none dark:prose-invert',
          'focus:outline-none min-h-[400px] px-4 py-3',
          'prose-headings:text-foreground prose-p:text-foreground/90',
          'prose-strong:text-foreground prose-li:text-foreground/90',
          'prose-a:text-primary prose-a:underline',
          'prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground',
        ].join(' '),
      },
    },
  })

  // 외부에서 markdown이 변경되면 에디터 동기화 (handleImprove 등)
  useEffect(() => {
    if (!editor) return
    // 자체 업데이트에서 온 것이면 무시
    if (markdown === lastMarkdown.current) return

    isExternalUpdate.current = true
    editor.commands.setContent(markdownToHtml(markdown))
    lastMarkdown.current = markdown
    isExternalUpdate.current = false
  }, [markdown, editor])

  return (
    <div className={className}>
      <TiptapToolbar editor={editor} />
      <div className="rounded-b-lg border border-t-0 bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

/**
 * 에디터에서 HTML 콘텐츠 추출 (복사용)
 * TiptapEditor 외부에서 사용
 */
export function getEditorHtml(markdown: string): string {
  return markdownToHtml(markdown)
}
