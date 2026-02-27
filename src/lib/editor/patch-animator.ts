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

export interface SequentialPatchOptions {
  /** 첫 패치까지 대기 (ms) */
  initialDelay?: number
  /** 수정 전(find) 하이라이트 유지 시간 (ms) */
  findDuration?: number
  /** 수정 후(replace) 하이라이트 유지 시간 (ms) */
  replaceDuration?: number
  /** 패치 사이 간격 (ms) */
  interPatchDelay?: number
  /** 단일 패치 적용 콜백 - content를 교체하고 에디터 반영 대기 후 resolve */
  onApplyPatch: (patch: PatchItem, index: number) => Promise<boolean>
  /** 진행 상태 콜백 */
  onProgress?: (current: number, total: number, phase: 'find' | 'replace') => void
  /** 완료 콜백 */
  onComplete?: (applied: number, skipped: number) => void
}

const FIND_CLASS = 'patch-highlight-find'
const REPLACE_CLASS = 'patch-highlight-active'
const FADE_CLASS = 'patch-highlight-fade'

/**
 * 패치를 하나씩 순차 적용하면서 시각적 애니메이션을 보여줌.
 *
 * 각 패치 흐름:
 * 1. find 텍스트를 빨간색으로 하이라이트 + 스크롤 (수정 전)
 * 2. onApplyPatch 콜백으로 콘텐츠 교체 (setEditContent)
 * 3. replace 텍스트를 초록색으로 하이라이트 (수정 후)
 * 4. 페이드 → 다음 패치
 *
 * @returns 애니메이션 중단 함수
 */
export function animatePatchesSequential(
  editor: Editor,
  patches: PatchItem[],
  options: SequentialPatchOptions
): () => void {
  const {
    initialDelay = 300,
    findDuration = 900,
    replaceDuration = 1400,
    interPatchDelay = 400,
    onApplyPatch,
    onProgress,
    onComplete,
  } = options

  let aborted = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const cleanup = () => {
    aborted = true
    if (timeoutId) clearTimeout(timeoutId)
    if (editor && !editor.isDestroyed) {
      clearHighlightDecorations(editor)
    }
  }

  /** aborted이면 false 반환 */
  const wait = (ms: number): Promise<boolean> =>
    new Promise(resolve => {
      timeoutId = setTimeout(() => resolve(!aborted), ms)
    })

  const run = async () => {
    if (!await wait(initialDelay)) return

    let applied = 0
    let skipped = 0

    for (let i = 0; i < patches.length; i++) {
      if (aborted || editor.isDestroyed) break

      const patch = patches[i]

      // --- Step 1: find 텍스트 빨간색 하이라이트 (수정 전) ---
      const findPlain = stripMarkdownToPlainText(patch.find)
      if (findPlain.length >= 3) {
        const findPos = findTextInDoc(editor.state.doc, findPlain)
        if (findPos) {
          setHighlightDecorations(editor, [
            { from: findPos.from, to: findPos.to, className: FIND_CLASS },
          ])
          scrollToHighlight(FIND_CLASS)
          onProgress?.(i + 1, patches.length, 'find')

          if (!await wait(findDuration)) break
        }
      }

      // --- Step 2: 패치 적용 (콘텐츠 교체) ---
      clearHighlightDecorations(editor)
      const success = await onApplyPatch(patch, i)
      if (aborted || editor.isDestroyed) break

      if (!success) {
        skipped++
        continue
      }
      applied++

      // --- Step 3: replace 텍스트 초록색 하이라이트 (수정 후) ---
      const replacePlain = stripMarkdownToPlainText(patch.replace)
      if (replacePlain.length >= 3) {
        const replacePos = findTextInDoc(editor.state.doc, replacePlain)
        if (replacePos) {
          setHighlightDecorations(editor, [
            { from: replacePos.from, to: replacePos.to, className: REPLACE_CLASS },
          ])
          scrollToHighlight(REPLACE_CLASS)
          onProgress?.(i + 1, patches.length, 'replace')

          if (!await wait(replaceDuration)) break

          // 페이드
          setHighlightDecorations(editor, [
            { from: replacePos.from, to: replacePos.to, className: FADE_CLASS },
          ])
          if (!await wait(interPatchDelay)) break
        }
      }

      clearHighlightDecorations(editor)
    }

    // 정리
    if (editor && !editor.isDestroyed) {
      clearHighlightDecorations(editor)
    }
    if (!aborted) {
      onComplete?.(applied, skipped)
    }
  }

  run()
  return cleanup
}

/**
 * 특정 클래스의 하이라이트 요소로 부드럽게 스크롤
 */
function scrollToHighlight(className: string): void {
  requestAnimationFrame(() => {
    const el = document.querySelector(`.${className}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}
