import { NextRequest, NextResponse } from 'next/server'
import { analyzeSeo, analyzeReadability, type ReadabilityResult } from '@/lib/seo/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/seo/ai-analyzer'
import type { AiSeoAnalysis, ScrapedMeta } from '@/lib/seo/ai-analyzer'
import { checkCredits, deductCredits } from '@/lib/credit-check'

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
  demoReason?: string
  aiAnalysis?: AiSeoAnalysis | null
  readabilityAnalysis?: ReadabilityResult
}

// Vercel 서버리스 함수 타임아웃 (기본 10초 → 60초)
export const maxDuration = 60

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

    const creditCheck = await checkCredits(supabase, user.id, 'seo_check')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    const { title, content, keyword, scrapedMeta } = await request.json() as {
      title?: string; content?: string; keyword?: string
      scrapedMeta?: ScrapedMeta
    }

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

    // 2) AI 심층 분석 (항상 Gemini 사용 — 분석은 Gemini로 충분, 비용 최적화)
    if (!process.env.GEMINI_API_KEY?.trim()) {
      const response: SeoCheckResponse = {
        ...baseResult,
        isDemo: true,
        demoReason: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.',
        aiAnalysis: generateDemoAiAnalysis(),
      }
      return NextResponse.json(response)
    }

    // API 키가 있으면 실제 AI 심층 분석 실행 (실패해도 기본 결과 반환)
    let aiAnalysis: AiSeoAnalysis | null = null
    let aiFailReason = ''
    try {
      aiAnalysis = await analyzeWithAi(keyword || '', title || '', content, scrapedMeta)
      if (!aiAnalysis) {
        aiFailReason = 'AI 분석이 null을 반환했습니다 (콘텐츠 길이 부족 또는 API 키 문제).'
      }
    } catch (aiError) {
      aiFailReason = aiError instanceof Error ? aiError.message : String(aiError)
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
      demoReason: aiAnalysis ? undefined : `AI 분석 실패: ${aiFailReason}`,
      aiAnalysis: aiAnalysis || generateDemoAiAnalysis(),
    }

    await deductCredits(supabase, user.id, 'seo_check', { keyword: keyword || '' })

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
