import { NextRequest, NextResponse } from 'next/server'
import { discoverKeywords, getDemoDiscoveryResult } from '@/lib/keyword-discovery'
import { checkAnalysisLimit, incrementAnalysisUsage } from '@/lib/plan-check'

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 일간 분석 제한 체크
    const limitCheck = await checkAnalysisLimit(supabase, user.id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.message, limit: limitCheck.limit, used: limitCheck.used },
        { status: 429 }
      )
    }

    const { topic } = await request.json()

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: '주제 키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    const cleanTopic = topic.trim()

    // API 키 확인 — 키워드 발굴은 항상 Gemini
    const hasGeminiKey = !!process.env.GEMINI_API_KEY
    const hasNaverAdKey = !!process.env.NAVER_AD_API_KEY && !!process.env.NAVER_AD_SECRET_KEY && !!process.env.NAVER_AD_CUSTOMER_ID

    if (!hasGeminiKey || !hasNaverAdKey) {
      const demoResult = getDemoDiscoveryResult(cleanTopic)
      await incrementAnalysisUsage(supabase, user.id)
      return NextResponse.json({ ...demoResult, isDemo: true })
    }

    // 키워드 발굴 엔진 실행
    const result = await discoverKeywords(cleanTopic)

    await incrementAnalysisUsage(supabase, user.id)
    return NextResponse.json({ ...result, isDemo: false })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Opportunities] 오류:', errorMessage)
    return NextResponse.json(
      { error: `키워드 발굴 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
