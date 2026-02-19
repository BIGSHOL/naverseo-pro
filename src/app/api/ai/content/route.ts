import { NextRequest, NextResponse } from 'next/server'
import { callGemini, parseGeminiJson } from '@/lib/ai/gemini'
import {
  buildSystemPrompt,
  buildUserPrompt,
  detectContentType,
  generateDemoContent,
  postProcessContent,
  analyzeSeo,
  type ContentGenerationRequest,
} from '@/lib/content/engine'

// 간단한 SEO 점수 계산 (DB 저장용, 100점 만점)
function calculateBasicSeoScore(keyword: string, title: string, content: string): number {
  const result = analyzeSeo(keyword, title, content)
  return result.totalScore
}

// Supabase에 생성된 콘텐츠 저장 + 사용량 증가
async function saveGeneratedContent(keyword: string, title: string, content: string) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const seoScore = calculateBasicSeoScore(keyword, title, content)

    // 콘텐츠 저장 (SEO 점수 포함)
    const { data } = await supabase.from('generated_content').insert({
      user_id: user.id,
      target_keyword: keyword,
      title,
      content,
      status: 'draft',
      seo_score: seoScore,
    }).select('id').single()

    // 사용량 증가
    await supabase.rpc('increment_content_usage', { uid: user.id }).maybeSingle()

    return { id: data?.id || null, seoScore }
  } catch {
    console.error('[Content] DB 저장 실패')
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, tone = '친근하고 정보적인', additionalKeywords = [], contentType: requestedType, targetLength, includeFaq } = await request.json()

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '타겟 키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 콘텐츠 생성 요청 구성
    const contentRequest: ContentGenerationRequest = {
      keyword: keyword.trim(),
      tone,
      additionalKeywords: additionalKeywords.length > 0 ? additionalKeywords : undefined,
      contentType: requestedType || detectContentType(keyword.trim()),
      targetLength: targetLength || 'medium',
      includeFaq: includeFaq !== false,
    }

    // API 키가 없으면 데모 콘텐츠 (엔진 활용)
    if (!process.env.GEMINI_API_KEY) {
      const demo = generateDemoContent(contentRequest)
      const saved = await saveGeneratedContent(keyword.trim(), demo.title, demo.content)
      return NextResponse.json({
        ...demo,
        contentId: saved?.id,
        seoScore: saved?.seoScore,
      })
    }

    // AI 프롬프트 생성 (엔진에서 최적화된 프롬프트 빌드)
    const systemPrompt = buildSystemPrompt(contentRequest)
    const userMessage = buildUserPrompt(contentRequest)

    const response = await callGemini(systemPrompt, userMessage, 4096)

    const parsed = parseGeminiJson<{
      title: string
      content: string
      tags: string[]
      metaDescription?: string
    }>(response)

    // 엔진으로 후처리 (SEO 분석 + 가독성 분석 + 태그/메타 보강)
    const processedResult = postProcessContent(contentRequest, parsed)

    // DB에 저장
    const saved = await saveGeneratedContent(keyword.trim(), processedResult.title, processedResult.content)

    return NextResponse.json({
      ...processedResult,
      contentId: saved?.id,
      seoScore: saved?.seoScore,
    })
  } catch (error) {
    console.error('[AI Content] 오류:', error)
    return NextResponse.json(
      { error: 'AI 콘텐츠 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
