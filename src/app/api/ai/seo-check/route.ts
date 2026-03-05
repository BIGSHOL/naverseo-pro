import { NextRequest, NextResponse } from 'next/server'
import { analyzeSeo, analyzeReadability, type ReadabilityResult } from '@/lib/seo/engine'
import type { ScrapedMeta } from '@/lib/seo/ai-analyzer'

// API Route는 항상 동적으로 실행 (cookies 사용으로 인한 정적 빌드 방지)
export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface SeoCheckResponse {
  totalScore: number
  grade: string
  categories: {
    id: string
    name: string
    score: number
    maxScore: number
    feedback: string
  }[]
  improvements: string[]
  strengths: string[]
  isDemo: boolean
  demoReason?: string
  aiAnalysis: null
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

    // 기본 SEO 분석은 크레딧 소모 없음 (AI 심층 분석은 /deep 라우트에서 차감)
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

    // SEO 엔진 분석 (로컬 — 빠름)
    const seoScrapedMeta = scrapedMeta ? {
      tags: scrapedMeta.tags,
      formatting: scrapedMeta.formatting,
    } : undefined
    const additionalKeywords = seoScrapedMeta?.tags && seoScrapedMeta.tags.length > 0 ? seoScrapedMeta.tags : undefined
    const engineResult = analyzeSeo(keyword || '', title || '', content, additionalKeywords, seoScrapedMeta)

    // 가독성 분석 (로컬 — 빠름)
    const readability = analyzeReadability(content)

    const response: SeoCheckResponse = {
      totalScore: engineResult.totalScore,
      grade: engineResult.grade,
      categories: engineResult.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        score: cat.score,
        maxScore: cat.maxScore,
        feedback: cat.details,
      })),
      improvements: engineResult.improvements,
      strengths: engineResult.strengths,
      isDemo: false,
      aiAnalysis: null,
      readabilityAnalysis: readability,
    }

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
