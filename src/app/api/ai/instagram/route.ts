import { NextRequest, NextResponse } from 'next/server'
import { callGemini, hasAiApiKey, parseGeminiJson } from '@/lib/ai/gemini'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import {
  INSTAGRAM_CAPTION_PROMPT,
  INSTAGRAM_HASHTAGS_PROMPT,
  INSTAGRAM_CAROUSEL_PROMPT,
  INSTAGRAM_REELS_PROMPT,
} from '@/lib/ai/prompts/instagram'

type InstagramMode = 'caption' | 'hashtags' | 'carousel' | 'reels'

function getPromptAndMessage(
  mode: InstagramMode,
  content?: string,
  keyword?: string,
  duration?: '30s' | '60s'
): { systemPrompt: string; userMessage: string } {
  switch (mode) {
    case 'caption':
      return {
        systemPrompt: INSTAGRAM_CAPTION_PROMPT,
        userMessage: `다음 블로그 글을 인스타그램 캡션으로 변환해주세요:\n\n${content}`,
      }
    case 'hashtags':
      return {
        systemPrompt: INSTAGRAM_HASHTAGS_PROMPT,
        userMessage: `다음 키워드/주제에 맞는 인스타그램 해시태그 30개를 추천해주세요:\n\n키워드: ${keyword}`,
      }
    case 'carousel':
      return {
        systemPrompt: INSTAGRAM_CAROUSEL_PROMPT,
        userMessage: `다음 블로그 글을 인스타그램 캐러셀 10장 슬라이드로 변환해주세요:\n\n${content}`,
      }
    case 'reels':
      return {
        systemPrompt: INSTAGRAM_REELS_PROMPT,
        userMessage: `다음 블로그 글을 인스타그램 릴스 대본으로 변환해주세요.\n길이: ${duration === '60s' ? '60초' : '30초'}\n\n${content}`,
      }
  }
}

function validateInput(
  mode: InstagramMode,
  content?: string,
  keyword?: string
): string | null {
  switch (mode) {
    case 'caption':
    case 'carousel':
    case 'reels':
      if (!content?.trim() || content.trim().length < 200) {
        return '블로그 본문을 200자 이상 입력해주세요.'
      }
      return null
    case 'hashtags':
      if (!keyword?.trim()) {
        return '키워드를 입력해주세요.'
      }
      return null
  }
}

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'instagram_convert')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: creditCheck.message || '크레딧이 부족합니다.',
          creditLimit: true,
          balance: creditCheck.balance,
          cost: creditCheck.cost,
          planGate: creditCheck.planGate,
        },
        { status: 403 }
      )
    }

    const { mode, content, keyword, duration } = await request.json()

    // mode 검증
    const validModes: InstagramMode[] = ['caption', 'hashtags', 'carousel', 'reels']
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: '올바른 변환 모드를 선택해주세요. (caption, hashtags, carousel, reels)' },
        { status: 400 }
      )
    }

    // 입력 검증
    const validationError = validateInput(mode, content, keyword)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // API 키 체크
    if (!hasAiApiKey('gemini')) {
      return NextResponse.json(
        { error: 'AI API 키가 설정되지 않았습니다. 데모 모드에서는 인스타그램 변환을 사용할 수 없습니다.' },
        { status: 400 }
      )
    }

    const { systemPrompt, userMessage } = getPromptAndMessage(mode, content, keyword, duration)

    console.log(`[Instagram ${mode}] provider=gemini, content=${content?.length ?? 0}자, keyword=${keyword ?? '-'}`)

    const response = await callGemini(systemPrompt, userMessage, 4096, { jsonMode: true })

    if (!response || response.trim().length === 0) {
      console.error(`[Instagram ${mode}] AI가 빈 응답을 반환했습니다.`)
      return NextResponse.json(
        { error: 'AI가 빈 응답을 반환했습니다. 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any
    try {
      parsed = parseGeminiJson(response)
    } catch (parseError) {
      const parseMsg = parseError instanceof Error ? parseError.message : String(parseError)
      console.error(`[Instagram ${mode}] JSON 파싱 실패: ${parseMsg}`)
      return NextResponse.json(
        { error: `AI 응답 파싱 실패: ${parseMsg}. 다시 시도해주세요.` },
        { status: 500 }
      )
    }

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'instagram_convert', {
      mode,
      keyword: keyword ?? null,
      contentLength: content?.length ?? 0,
    })

    return NextResponse.json({ mode, ...parsed })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)

    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      return NextResponse.json(
        { error: 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    console.error('[Instagram] 오류:', error)
    return NextResponse.json(
      { error: `인스타그램 변환 중 오류가 발생했습니다: ${msg}` },
      { status: 500 }
    )
  }
}
