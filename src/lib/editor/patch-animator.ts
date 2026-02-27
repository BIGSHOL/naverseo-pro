import type { Editor } from '@tiptap/core'
import {
  stripMarkdownToPlainText,
  findTextInDoc,
  setHighlightDecorations,
  clearHighlightDecorations,
} from './patch-highlight-plugin'

export interface PatchItem {
  find: string
  replace: string
}

export interface AnimationOptions {
  /** 첫 하이라이트까지 대기 (ms) */
  initialDelay?: number
  /** 각 패치 하이라이트 유지 시간 (ms) */
  highlightDuration?: number
  /** 패치 사이 간격 (ms) */
  interPatchDelay?: number
  /** 완료 콜백 */
  onComplete?: () => void
  /** 각 패치 표시 콜백 */
  onPatchShown?: (current: number, total: number) => void
}

const ACTIVE_CLASS = 'patch-highlight-active'
const FADE_CLASS = 'patch-highlight-fade'

/**
 * 패치 하이라이트 순차 애니메이션 실행.
 *
 * 전제: setEditContent()로 이미 콘텐츠가 업데이트된 상태.
 * 에디터에서 replace 텍스트를 찾아 순서대로 하이라이트 + 스크롤.
 *
 * @returns 애니메이션 중단 함수
 */
export function animatePatches(
  editor: Editor,
  appliedPatches: PatchItem[],
  options: AnimationOptions = {}
): () => void {
  const {
    initialDelay = 300,
    highlightDuration = 1800,
    interPatchDelay = 500,
    onComplete,
    onPatchShown,
  } = options

  let aborted = false
  const timeouts: ReturnType<typeof setTimeout>[] = []

  const schedule = (fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      if (!aborted) fn()
    }, delay)
    timeouts.push(id)
  }

  const cleanup = () => {
    aborted = true
    timeouts.forEach(clearTimeout)
    if (editor && !editor.isDestroyed) {
      clearHighlightDecorations(editor)
    }
  }

  // 문서에서 각 패치의 replace 텍스트 위치를 검색
  const resolvePositions = (): Array<{ from: number; to: number; index: number }> => {
    const doc = editor.state.doc
    const results: Array<{ from: number; to: number; index: number }> = []

    for (let i = 0; i < appliedPatches.length; i++) {
      const plainText = stripMarkdownToPlainText(appliedPatches[i].replace)
      if (!plainText || plainText.length < 3) continue

      const pos = findTextInDoc(doc, plainText)
      if (pos) {
        results.push({ ...pos, index: i })
      }
    }

    // 문서 위치 순서로 정렬 (위에서 아래로)
    results.sort((a, b) => a.from - b.from)
    return results
  }

  // initialDelay 후 애니메이션 시작
  schedule(() => {
    if (aborted || editor.isDestroyed) return

    const positions = resolvePositions()
    if (positions.length === 0) {
      onComplete?.()
      return
    }

    let currentDelay = 0

    positions.forEach((pos, seqIndex) => {
      // 하이라이트 표시
      schedule(() => {
        if (aborted || editor.isDestroyed) return

        setHighlightDecorations(editor, [
          { from: pos.from, to: pos.to, className: ACTIVE_CLASS },
        ])

        // 해당 위치로 스크롤
        scrollToHighlight()
        onPatchShown?.(seqIndex + 1, positions.length)
      }, currentDelay)

      // 페이드 전환
      schedule(() => {
        if (aborted || editor.isDestroyed) return
        setHighlightDecorations(editor, [
          { from: pos.from, to: pos.to, className: FADE_CLASS },
        ])
      }, currentDelay + highlightDuration)

      currentDelay += highlightDuration + interPatchDelay
    })

    // 전체 정리
    schedule(() => {
      if (!editor.isDestroyed) {
        clearHighlightDecorations(editor)
      }
      onComplete?.()
    }, currentDelay + 500)
  }, initialDelay)

  return cleanup
}

/**
 * 하이라이트된 요소로 부드럽게 스크롤.
 * DOM에서 .patch-highlight-active 요소를 찾아 scrollIntoView 사용.
 */
function scrollToHighlight(): void {
  // 데코레이션이 렌더링된 후 DOM에서 찾기
  requestAnimationFrame(() => {
    const el = document.querySelector('.patch-highlight-active')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}
