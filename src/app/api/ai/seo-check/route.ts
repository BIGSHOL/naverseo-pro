import { NextRequest, NextResponse } from 'next/server'
import { analyzeSeo, analyzeReadability, type ReadabilityResult } from '@/lib/seo/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/seo/ai-analyzer'
import type { AiSeoAnalysis } from '@/lib/seo/ai-analyzer'
import { getUserAiProvider, hasAiApiKey } from '@/lib/ai/gemini'
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
  readabilityAnalysis?: ReadabilityResult
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

    // 사용자의 AI 제공자 조회
    const provider = await getUserAiProvider(supabase, user.id)

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

    // 가독성 분석
    const readability = analyzeReadability(content)

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
      readabilityAnalysis: readability,
    }

    // 2) AI 심층 분석
    if (!hasAiApiKey(provider)) {
      // API 키 없으면 데모 AI 결과 포함
      const response: SeoCheckResponse = {
        ...baseResult,
        isDemo: true,
        aiAnalysis: generateDemoAiAnalysis(),
      }
      return NextResponse.json(response)
    }

    // API 키가 있으면 실제 AI 심층 분석 실행 (실패해도 기본 결과 반환)
    let aiAnalysis: AiSeoAnalysis | null = null
    try {
      aiAnalysis = await analyzeWithAi(keyword || '', title || '', content, provider)
    } catch (aiError) {
      console.error('[SEO Check] AI 심층 분석 실패 (기본 결과로 대체):', aiError)
    }

    // AI 점수 보정 적용 + 등급 재계산
    let finalScore = baseResult.totalScore
    let finalGrade = baseResult.grade
    if (aiAnalysis?.scoreAdjustment) {
      finalScore = Math.max(0, Math.min(100, finalScore + aiAnalysis.scoreAdjustment))
      // 보정된 점수로 등급 재계산 (SEO_GRADE_TABLE과 동일 기준)
      if (finalScore >= 90) finalGrade = 'S'
      else if (finalScore >= 80) finalGrade = 'A+'
      else if (finalScore >= 70) finalGrade = 'A'
      else if (finalScore >= 60) finalGrade = 'B+'
      else if (finalScore >= 50) finalGrade = 'B'
      else if (finalScore >= 40) finalGrade = 'C'
      else finalGrade = 'D'
    }

    const response: SeoCheckResponse = {
      ...baseResult,
      totalScore: finalScore,
      grade: finalGrade,
      isDemo: !aiAnalysis,
      aiAnalysis: aiAnalysis || generateDemoAiAnalysis(),
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
