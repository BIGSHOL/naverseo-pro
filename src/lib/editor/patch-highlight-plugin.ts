import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'

// --- ProseMirror Plugin ---

export const patchHighlightKey = new PluginKey('patchHighlight')

export function createPatchHighlightPlugin(): Plugin {
  return new Plugin({
    key: patchHighlightKey,
    state: {
      init() {
        return { decorations: DecorationSet.empty }
      },
      apply(tr, state) {
        const meta = tr.getMeta(patchHighlightKey)
        if (meta?.type === 'set') {
          return { decorations: meta.decorations }
        }
        if (meta?.type === 'clear') {
          return { decorations: DecorationSet.empty }
        }
        // 문서 변경 시 데코레이션 위치를 자동 매핑
        return {
          decorations: state.decorations.map(tr.mapping, tr.doc),
        }
      },
    },
    props: {
      decorations(state) {
        return patchHighlightKey.getState(state)?.decorations ?? DecorationSet.empty
      },
    },
  })
}

// --- 하이라이트 데코레이션 제어 ---

export function setHighlightDecorations(
  editor: Editor,
  ranges: Array<{ from: number; to: number; className: string }>
): void {
  const { doc, tr } = editor.state
  const decorations = ranges.map(({ from, to, className }) =>
    Decoration.inline(from, to, { class: className })
  )
  const decorationSet = DecorationSet.create(doc, decorations)
  editor.view.dispatch(
    tr.setMeta(patchHighlightKey, { type: 'set', decorations: decorationSet })
  )
}

export function clearHighlightDecorations(editor: Editor): void {
  const { tr } = editor.state
  editor.view.dispatch(
    tr.setMeta(patchHighlightKey, { type: 'clear' })
  )
}

// --- 텍스트 검색 ---

/**
 * 마크다운 서식을 제거하고 검색 가능한 순수 텍스트를 반환
 */
export function stripMarkdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')              // 헤딩
    .replace(/\*\*(.+?)\*\*/g, '$1')           // 볼드
    .replace(/\*(.+?)\*/g, '$1')               // 이탤릭
    .replace(/<u>(.+?)<\/u>/gi, '$1')          // 밑줄
    .replace(/<mark[^>]*>(.+?)<\/mark>/gi, '$1') // 하이라이트
    .replace(/<span[^>]*>(.+?)<\/span>/gi, '$1') // 스타일 span
    .replace(/\[이미지[:\s][^\]]*\]/g, '')     // 이미지 마커
    .replace(/^\s*[-*+]\s+/gm, '')             // 비순서 리스트
    .replace(/^\s*\d+\.\s+/gm, '')             // 순서 리스트
    .replace(/>\s?/g, '')                       // 인용문
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // 링크
    .replace(/\n{2,}/g, '\n')                  // 다중 줄바꿈 축약
    .trim()
}

/**
 * ProseMirror 문서에서 텍스트를 검색하여 {from, to} 위치를 반환.
 * 공백을 정규화하여 유연하게 매칭.
 */
export function findTextInDoc(
  doc: PmNode,
  searchText: string
): { from: number; to: number } | null {
  // 검색할 텍스트 정규화
  const normalizedSearch = searchText.replace(/\s+/g, ' ').trim()
  if (normalizedSearch.length < 3) return null

  // 문서에서 텍스트와 위치 매핑을 동시에 구축
  const textSegments: Array<{ text: string; pos: number }> = []
  let prevWasBlock = false

  doc.descendants((node, pos) => {
    if (node.isBlock && textSegments.length > 0 && !prevWasBlock) {
      // 블록 경계에 공백 삽입 (검색 시 \n 대신 공백으로 통일)
      textSegments.push({ text: ' ', pos: -1 })
      prevWasBlock = true
    }
    if (node.isText && node.text) {
      textSegments.push({ text: node.text, pos })
      prevWasBlock = false
    }
    return true
  })

  // 연결된 전체 텍스트 구성
  const fullText = textSegments.map(s => s.text).join('')
  const normalizedFull = fullText.replace(/\s+/g, ' ')

  // 검색 (처음 60자로 축약하여 매칭 확률 향상)
  const shortSearch = normalizedSearch.length > 60
    ? normalizedSearch.substring(0, 60)
    : normalizedSearch
  const matchIndex = normalizedFull.indexOf(shortSearch)
  if (matchIndex === -1) return null

  // 정규화된 인덱스를 원본 텍스트 인덱스로 역매핑
  let normalizedIdx = 0
  let originalIdx = 0
  let fromOriginal = -1
  const endNormalized = matchIndex + shortSearch.length

  for (let i = 0; i < fullText.length && normalizedIdx <= endNormalized; i++) {
    // 공백 정규화: 연속 공백을 하나로 취급
    const isSpace = /\s/.test(fullText[i])
    const prevIsSpace = i > 0 && /\s/.test(fullText[i - 1])

    if (isSpace && prevIsSpace) {
      originalIdx++
      continue // 정규화에서 생략된 공백
    }

    if (normalizedIdx === matchIndex && fromOriginal === -1) {
      fromOriginal = originalIdx
    }
    if (normalizedIdx === endNormalized) {
      break
    }
    normalizedIdx++
    originalIdx++
  }

  if (fromOriginal === -1) return null

  const toOriginal = originalIdx

  // 원본 텍스트 인덱스를 문서 위치로 변환
  let charCount = 0
  let from: number | null = null
  let to: number | null = null

  for (const seg of textSegments) {
    if (seg.pos === -1) {
      // 블록 경계 (가상 공백)
      if (charCount === fromOriginal && from === null) from = seg.pos
      charCount += seg.text.length
      if (charCount >= toOriginal && to === null) to = seg.pos
      continue
    }
    const segEnd = charCount + seg.text.length
    if (from === null && fromOriginal >= charCount && fromOriginal < segEnd) {
      from = seg.pos + (fromOriginal - charCount)
    }
    if (to === null && toOriginal >= charCount && toOriginal <= segEnd) {
      to = seg.pos + (toOriginal - charCount)
    }
    charCount += seg.text.length
    if (from !== null && to !== null) break
  }

  if (from !== null && to !== null && from >= 0 && to > from) {
    return { from, to }
  }
  return null
}
