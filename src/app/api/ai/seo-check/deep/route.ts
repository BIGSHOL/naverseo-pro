import { NextRequest, NextResponse } from 'next/server'
import { getGradeByScore } from '@/lib/seo/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/seo/ai-analyzer'
import type { AiSeoAnalysis, ScrapedMeta } from '@/lib/seo/ai-analyzer'
import { getUserAiProvider, hasAiApiKey } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'

// AI 분석 전용 — 별도 60초 예산
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
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

    // AI 심층 분석 (최대 50초 — 안전 마진 10초)
    let aiAnalysis: AiSeoAnalysis | null = null
    const AI_TIMEOUT_MS = 50000

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
        console.warn('[SEO Deep] AI 분석 타임아웃 (50초)')
      } else {
        console.error('[SEO Deep] AI 심층 분석 실패:', aiError)
      }
    }

    if (aiAnalysis) {
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

    // AI 실패/타임아웃 → 데모 분석 반환
    return NextResponse.json({
      aiAnalysis: generateDemoAiAnalysis(),
      isDemo: true,
      demoReason: 'AI 분석 시간이 초과되었습니다. 기본 분석 결과를 표시합니다.',
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
