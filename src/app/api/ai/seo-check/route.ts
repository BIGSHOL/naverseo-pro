import { NextRequest, NextResponse } from 'next/server'
import { analyzeSeo } from '@/lib/seo/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/seo/ai-analyzer'
import type { AiSeoAnalysis } from '@/lib/seo/ai-analyzer'
import { checkAnalysisLimit, incrementAnalysisUsage } from '@/lib/plan-check'

interface SeoCheckResponse {
  totalScore: number
  grade: string
  categories: {
    name: string
    score: number
    maxScore: number
    feedback: string
  }[]
  improvements: string[]
  strengths: string[]
  isDemo: boolean
  aiAnalysis?: AiSeoAnalysis | null
}

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const limitCheck = await checkAnalysisLimit(supabase, user.id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.message, limit: limitCheck.limit, used: limitCheck.used },
        { status: 429 }
      )
    }

    const { title, content, keyword } = await request.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: '분석할 콘텐츠를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 1) 로컬 SEO 엔진 분석 (항상 실행, 13개 항목)
    const engineResult = analyzeSeo(keyword || '', title || '', content)

    const baseResult = {
      totalScore: engineResult.totalScore,
      grade: engineResult.grade,
      categories: engineResult.categories.map(cat => ({
        name: cat.name,
        score: cat.score,
        maxScore: cat.maxScore,
        feedback: cat.details,
      })),
      improvements: engineResult.improvements,
      strengths: engineResult.strengths,
    }

    // 2) AI 심층 분석
    const hasApiKey = !!process.env.GEMINI_API_KEY?.trim()

    if (!hasApiKey) {
      // API 키 없으면 데모 AI 결과 포함
      const response: SeoCheckResponse = {
        ...baseResult,
        isDemo: true,
        aiAnalysis: generateDemoAiAnalysis(),
      }
      return NextResponse.json(response)
    }

    // API 키가 있으면 실제 AI 심층 분석 실행
    const aiAnalysis = await analyzeWithAi(keyword || '', title || '', content)

    // AI 점수 보정 적용
    let finalScore = baseResult.totalScore
    if (aiAnalysis?.scoreAdjustment) {
      finalScore = Math.max(0, Math.min(100, finalScore + aiAnalysis.scoreAdjustment))
    }

    const response: SeoCheckResponse = {
      ...baseResult,
      totalScore: finalScore,
      isDemo: false,
      aiAnalysis,
    }

    await incrementAnalysisUsage(supabase, user.id)

    return NextResponse.json(response)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[SEO Check] 오류:', errorMessage)
    return NextResponse.json(
      { error: `SEO 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
