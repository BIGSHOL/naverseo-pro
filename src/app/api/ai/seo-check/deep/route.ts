import { NextRequest, NextResponse } from 'next/server'
import { getGradeByScore } from '@/lib/seo/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/seo/ai-analyzer'
import type { AiSeoAnalysis, ScrapedMeta } from '@/lib/seo/ai-analyzer'
import { getUserAiProvider, hasAiApiKey } from '@/lib/ai/gemini'
import { checkCredits, deductCredits } from '@/lib/credit-check'

export const dynamic = 'force-dynamic'

// AI 분석 전용 — 별도 60초 예산
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const fnStart = Date.now()

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크 (기본 분석은 무료, AI 심층 분석에서 크레딧 차감)
    const creditCheck = await checkCredits(supabase, user.id, 'seo_check')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    const { title, content, keyword, scrapedMeta, baseScore } = await request.json() as {
      title?: string; content?: string; keyword?: string
      scrapedMeta?: ScrapedMeta
      baseScore?: number
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: '콘텐츠가 없습니다.' }, { status: 400 })
    }

    const provider = await getUserAiProvider(supabase, user.id)

    if (!hasAiApiKey(provider)) {
      return NextResponse.json({
        aiAnalysis: generateDemoAiAnalysis(),
        isDemo: true,
        demoReason: `${provider.toUpperCase()} API 키가 설정되지 않았습니다.`,
      })
    }

    // 동적 AI 타임아웃: 실제 경과 시간 기반으로 maxDuration(60초) 안에 반드시 완료
    // 콜드스타트가 길어도 자동 보정됨
    const elapsed = Date.now() - fnStart
    const SAFETY_BUFFER_MS = 8000  // Vercel 킬 전 8초 여유
    const AI_TIMEOUT_MS = Math.max(10000, (maxDuration * 1000) - elapsed - SAFETY_BUFFER_MS)
    console.log(`[SEO Deep] 콜드스타트+인증: ${elapsed}ms, AI 타임아웃: ${AI_TIMEOUT_MS}ms`)

    let aiAnalysis: AiSeoAnalysis | null = null

    try {
      aiAnalysis = await Promise.race([
        analyzeWithAi(keyword || '', title || '', content, scrapedMeta, provider),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS)
        ),
      ])
    } catch (aiError) {
      const msg = aiError instanceof Error ? aiError.message : String(aiError)
      if (msg === 'AI_TIMEOUT') {
        console.warn(`[SEO Deep] AI 분석 타임아웃 (${Math.round(AI_TIMEOUT_MS / 1000)}초, 총 경과 ${Date.now() - fnStart}ms)`)
      } else {
        console.error('[SEO Deep] AI 심층 분석 실패:', aiError)
      }
    }

    if (aiAnalysis) {
      // AI 분석 성공 시 크레딧 차감
      await deductCredits(supabase, user.id, 'seo_check', { keyword: keyword || '' })

      let finalScore = baseScore ?? 0
      let finalGrade = ''
      if (aiAnalysis.scoreAdjustment && baseScore != null) {
        finalScore = Math.max(0, Math.min(100, baseScore + aiAnalysis.scoreAdjustment))
        finalGrade = getGradeByScore(finalScore).grade
      }
      return NextResponse.json({
        aiAnalysis,
        ...(finalGrade ? { totalScore: finalScore, grade: finalGrade } : {}),
      })
    }

    // AI 실패/타임아웃 → null 반환 (기본 분석만 표시, 데모 표시 안 함)
    return NextResponse.json({
      aiAnalysis: null,
      aiError: 'AI 심층 분석에 실패했습니다. 기본 분석 결과를 확인하세요.',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[SEO Deep] 오류:', errorMessage)
    return NextResponse.json(
      { error: `AI 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
