import { NextRequest, NextResponse } from 'next/server'
import { callAI, getUserAiProvider, hasAiApiKey, parseGeminiJson } from '@/lib/ai/gemini'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import {
  buildImprovementSystemPrompt,
  buildImprovementUserPrompt,
  type WeakCategory,
} from '@/lib/content/engine'

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
        { error: creditCheck.message || '크레딧이 부족합니다.' },
        { status: 403 }
      )
    }

    // API 키 체크
    if (!hasAiApiKey(provider)) {
      return NextResponse.json(
        { error: 'AI API 키가 설정되지 않았습니다. 데모 모드에서는 약점 개선을 사용할 수 없습니다.' },
        { status: 400 }
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

    const systemPrompt = buildImprovementSystemPrompt(categories)
    const userMessage = buildImprovementUserPrompt(keyword, title, content, categories)

    console.log(`[Content Improve] ${categories.length}개 약점 개선 요청: ${categories.map(c => c.id).join(', ')}`)

    const response = await callAI(provider, systemPrompt, userMessage, 4096, { jsonMode: true })
    const parsed = parseGeminiJson<{ title: string; content: string }>(response)

    if (!parsed.title || !parsed.content) {
      return NextResponse.json(
        { error: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'content_improve', {
      keyword,
      categories: categories.map(c => c.id).join(', '),
    })

    return NextResponse.json({
      title: parsed.title,
      content: parsed.content,
      improvedCategories: categories.map(c => c.id),
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
