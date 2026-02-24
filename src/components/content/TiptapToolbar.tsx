'use client'

import type { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import {
  Bold, Italic, Underline, Strikethrough,
  Heading2, Heading3, List, ListOrdered,
  Quote, Link2, ImagePlus, Minus,
  Undo, Redo,
  AlignLeft, AlignCenter, AlignRight,
  Highlighter, Palette, Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCallback, useRef, useState } from 'react'

interface TiptapToolbarProps {
  editor: Editor | null
}

// 네이버 블로그 호환 색상 팔레트
const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#E03131', '#E8590C', '#F59F00', '#2F9E44',
  '#1971C2', '#6741D9', '#C2255C', '#862E9C',
]

const HIGHLIGHT_COLORS = [
  '#FFF3BF', '#FFE8CC', '#FFD8D8', '#D8F5A2',
  '#BAE3FF', '#E8D5FF', '#FFD6E8', '#D5F4E6',
]

const FONT_SIZES = [
  { label: '작게', value: '13px' },
  { label: '본문', value: '16px' },
  { label: '크게', value: '19px' },
  { label: '아주 크게', value: '24px' },
]

function ToolbarButton({ onClick, isActive, disabled, icon: Icon, title }: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-8 w-8 p-0', isActive && 'bg-muted text-foreground')}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}

function Separator() {
  return <div className="mx-0.5 h-6 w-px self-center bg-border" />
}

function ColorPicker({ colors, onSelect, currentColor, icon: Icon, title }: {
  colors: string[]
  onSelect: (color: string) => void
  currentColor?: string
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 닫기
  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (ref.current && !ref.current.contains(e.relatedTarget)) {
      setOpen(false)
    }
  }, [])

  return (
    <div className="relative" ref={ref} onBlur={handleBlur}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-8 w-8 p-0', currentColor && 'ring-1 ring-inset ring-border')}
        onClick={() => setOpen(!open)}
        title={title}
      >
        <Icon className="h-4 w-4" />
        {currentColor && (
          <span
            className="absolute bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full"
            style={{ backgroundColor: currentColor }}
          />
        )}
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border bg-popover p-2 shadow-md">
          <div className="grid grid-cols-4 gap-1">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  'h-6 w-6 rounded border border-border transition-transform hover:scale-110',
                  currentColor === color && 'ring-2 ring-primary ring-offset-1'
                )}
                style={{ backgroundColor: color }}
                onClick={() => { onSelect(color); setOpen(false) }}
                title={color}
              />
            ))}
          </div>
          <button
            type="button"
            className="mt-1.5 w-full rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => { onSelect(''); setOpen(false) }}
          >
            초기화
          </button>
        </div>
      )}
    </div>
  )
}

function FontSizeSelect({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (ref.current && !ref.current.contains(e.relatedTarget)) {
      setOpen(false)
    }
  }, [])

  const currentSize = editor.getAttributes('textStyle').fontSize

  return (
    <div className="relative" ref={ref} onBlur={handleBlur}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setOpen(!open)}
        title="글씨 크기"
      >
        <Type className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border bg-popover py-1 shadow-md">
          {FONT_SIZES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={cn(
                'block w-full whitespace-nowrap px-3 py-1 text-left text-sm hover:bg-muted',
                currentSize === value && 'bg-muted font-medium'
              )}
              style={{ fontSize: value }}
              onClick={() => {
                if (value === '16px') {
                  editor.chain().focus().unsetFontSize().run()
                } else {
                  editor.chain().focus().setFontSize(value).run()
                }
                setOpen(false)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TiptapToolbar({ editor }: TiptapToolbarProps) {
  if (!editor) return null

  const insertImageMarker = () => {
    const desc = window.prompt('이미지 설명을 입력하세요')
    if (desc) {
      editor.chain().focus().setImage({ src: '', alt: `이미지: ${desc}` }).run()
    }
  }

  const insertLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL을 입력하세요', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border bg-muted/30 px-1.5 py-1">
      {/* 텍스트 서식 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        icon={Bold} title="굵게"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        icon={Italic} title="기울임"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        icon={Underline} title="밑줄"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        icon={Strikethrough} title="취소선"
      />

      <Separator />

      {/* 글씨 크기 */}
      <FontSizeSelect editor={editor} />

      {/* 글씨 색상 */}
      <ColorPicker
        colors={TEXT_COLORS}
        currentColor={editor.getAttributes('textStyle').color}
        onSelect={(color) => {
          if (!color) {
            editor.chain().focus().unsetColor().run()
          } else {
            editor.chain().focus().setColor(color).run()
          }
        }}
        icon={Palette}
        title="글씨 색상"
      />

      {/* 형광펜 */}
      <ColorPicker
        colors={HIGHLIGHT_COLORS}
        currentColor={editor.getAttributes('highlight').color}
        onSelect={(color) => {
          if (!color) {
            editor.chain().focus().unsetHighlight().run()
          } else {
            editor.chain().focus().toggleHighlight({ color }).run()
          }
        }}
        icon={Highlighter}
        title="형광펜"
      />

      <Separator />

      {/* 헤딩 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        icon={Heading2} title="소제목 (H2)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        icon={Heading3} title="소소제목 (H3)"
      />

      <Separator />

      {/* 리스트 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        icon={List} title="불릿 리스트"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        icon={ListOrdered} title="번호 리스트"
      />

      <Separator />

      {/* 정렬 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        icon={AlignLeft} title="왼쪽 정렬"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        icon={AlignCenter} title="가운데 정렬"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        icon={AlignRight} title="오른쪽 정렬"
      />

      <Separator />

      {/* 블록 요소 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        icon={Quote} title="인용"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        icon={Minus} title="구분선"
      />

      <Separator />

      {/* 삽입 */}
      <ToolbarButton
        onClick={insertLink}
        isActive={editor.isActive('link')}
        icon={Link2} title="링크"
      />
      <ToolbarButton onClick={insertImageMarker} icon={ImagePlus} title="이미지 위치 표시" />

      <Separator />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        icon={Undo} title="실행 취소"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        icon={Redo} title="다시 실행"
      />
    </div>
  )
}
