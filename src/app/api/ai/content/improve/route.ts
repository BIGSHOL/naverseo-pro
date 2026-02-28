import { NextRequest, NextResponse } from 'next/server'
import { callAI, callGeminiStream, callClaudeStream, getUserAiProvider, hasAiApiKey, parseGeminiJson } from '@/lib/ai/gemini'

export const maxDuration = 60
import { checkCredits, deductCredits } from '@/lib/credit-check'
import {
  buildImprovementSystemPrompt,
  buildImprovementUserPrompt,
  separateCategories,
  extractRelevantSections,
  buildGuidanceText,
  type WeakCategory,
} from '@/lib/content/engine'

interface PatchItem {
  find: string
  replace: string
}

interface PatchResponse {
  title: string | null
  patches: PatchItem[]
  append: string | null
}

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const provider = await getUserAiProvider(supabase, user.id)

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'content_improve')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message || '크레딧이 부족합니다.', creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    const { keyword, title, content, weakCategories } = await request.json()

    if (!keyword?.trim() || !title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: '키워드, 제목, 본문이 모두 필요합니다.' },
        { status: 400 }
      )
    }

    if (!weakCategories || !Array.isArray(weakCategories) || weakCategories.length === 0) {
      return NextResponse.json(
        { error: '개선할 약점 항목을 선택해주세요.' },
        { status: 400 }
      )
    }

    // 최대 5개 약점만 처리
    const categories: WeakCategory[] = weakCategories.slice(0, 5)

    // 카테고리 분리: 자동 패치 vs 가이드 전용
    const { patchable, guidanceOnly } = separateCategories(categories)
    const guidanceItems = buildGuidanceText(guidanceOnly)

    // 패치 가능한 카테고리가 없으면 AI 호출 없이 가이드만 반환
    if (patchable.length === 0) {
      return NextResponse.json({
        title: null,
        patches: [],
        append: null,
        guidance: guidanceItems,
        improvedCategories: categories.map(c => c.id),
      })
    }

    // API 키 체크 (AI 호출이 필요한 경우만)
    if (!hasAiApiKey(provider)) {
      return NextResponse.json(
        { error: 'AI API 키가 설정되지 않았습니다. 데모 모드에서는 약점 개선을 사용할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 섹션 기반 추출 (필요한 부분만 AI에 전달)
    const extraction = extractRelevantSections(content, keyword.trim(), patchable)

    console.log(`[Content Improve] ${patchable.length}개 패치 + ${guidanceOnly.length}개 가이드`)
    console.log(`[Content Improve] 섹션 추출: ${extraction.originalLength}자 → ${extraction.condensedLength}자 (${Math.round(extraction.condensedLength / extraction.originalLength * 100)}%)`)
    console.log(`[Content Improve] provider=${provider}, 카테고리: ${patchable.map(c => c.id).join(', ')}`)

    const systemPrompt = buildImprovementSystemPrompt(patchable)
    const userMessage = buildImprovementUserPrompt(keyword, title, content, patchable, extraction)

    // NDJSON 스트리밍 응답 (Gemini/Claude 공통)
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        try {
          const onDelta = (delta: string) => send({ type: 'stream', delta })
          const response = provider === 'gemini'
            ? await callGeminiStream(systemPrompt, userMessage, 8192, { jsonMode: true, thinkingBudget: 2048 }, onDelta)
            : await callClaudeStream(systemPrompt, userMessage, 8192, { jsonMode: true }, onDelta)

          console.log(`[Content Improve] AI 응답 길이: ${response?.length ?? 0}자`)
          if (!response || response.trim().length === 0) {
            send({ type: 'error', error: 'AI가 빈 응답을 반환했습니다. 다시 시도해주세요.' })
            return
          }

          let parsed: PatchResponse
          try {
            parsed = parseGeminiJson<PatchResponse>(response)
          } catch (parseError) {
            const parseMsg = parseError instanceof Error ? parseError.message : String(parseError)
            send({ type: 'error', error: `AI 응답 파싱 실패: ${parseMsg}. 다시 시도해주세요.` })
            return
          }

          if (!parsed.patches || !Array.isArray(parsed.patches)) {
            send({ type: 'error', error: 'AI 응답에 patches 배열이 없습니다. 다시 시도해주세요.' })
            return
          }

          const validPatches = parsed.patches.filter(
            (p): p is PatchItem => typeof p.find === 'string' && typeof p.replace === 'string' && p.find.length > 0
          )

          await deductCredits(supabase, user.id, 'content_improve', {
            keyword,
            categories: patchable.map(c => c.id).join(', '),
            patchCount: validPatches.length,
          })

          send({
            type: 'result',
            title: parsed.title || null,
            patches: validPatches,
            append: parsed.append || null,
            guidance: guidanceItems,
            improvedCategories: categories.map(c => c.id),
          })
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          console.error('[Content Improve] 스트리밍 오류:', msg)
          send({ type: 'error', error: `AI 약점 개선 중 오류: ${msg}` })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)

    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      return NextResponse.json(
        { error: 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    console.error('[Content Improve] 오류:', error)
    return NextResponse.json(
      { error: `AI 약점 개선 중 오류가 발생했습니다: ${msg}` },
      { status: 500 }
    )
  }
}
