import { NextRequest, NextResponse } from 'next/server'
import { analyzeSeo, analyzeReadability, getGradeByScore, type ReadabilityResult } from '@/lib/seo/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/seo/ai-analyzer'
import type { AiSeoAnalysis, ScrapedMeta } from '@/lib/seo/ai-analyzer'
import { getUserAiProvider, hasAiApiKey } from '@/lib/ai/gemini'
import { checkCredits, deductCredits } from '@/lib/credit-check'

// API Route는 항상 동적으로 실행 (cookies 사용으로 인한 정적 빌드 방지)
export const dynamic = 'force-dynamic'

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
  aiAnalysis?: AiSeoAnalysis | null
  readabilityAnalysis?: ReadabilityResult
}

// Vercel 서버리스 함수 타임아웃 (기본 10초 → 60초)
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // --- 스트림 시작 전: 인증 + 크레딧 체크 (실패 시 일반 JSON 응답) ---
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

    // --- NDJSON 스트리밍 시작 ---
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        }

        try {
          // Step 1: SEO 엔진 분석 (스크래핑 데이터 있으면 태그/서식 정보 전달)
          send({ type: 'progress', step: 1, total: 3, label: 'SEO 엔진 분석 중...', percent: 15 })
          const seoScrapedMeta = scrapedMeta ? {
            tags: scrapedMeta.tags,
            formatting: scrapedMeta.formatting,
          } : undefined
          const engineResult = analyzeSeo(keyword || '', title || '', content, undefined, seoScrapedMeta)

          // Step 2: 가독성 분석
          send({ type: 'progress', step: 2, total: 3, label: '가독성 분석 중...', percent: 40 })
          const readability = analyzeReadability(content)

          const baseResult = {
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
            readabilityAnalysis: readability,
          }

          // Step 3: 기본 결과 즉시 전송 + 크레딧 차감
          send({ type: 'progress', step: 3, total: 3, label: '결과 정리 중...', percent: 80 })

          await deductCredits(supabase, user.id, 'seo_check', { keyword: keyword || '' })

          const baseResponse: SeoCheckResponse = {
            ...baseResult,
            isDemo: false,
            aiAnalysis: null,
          }
          send({ type: 'result', ...baseResponse })

          // === AI 심층 분석 (후속 업데이트 — 기본 결과와 독립) ===
          const provider = await getUserAiProvider(supabase, user.id)

          if (!hasAiApiKey(provider)) {
            send({ type: 'ai_update', aiAnalysis: generateDemoAiAnalysis(), isDemo: true, demoReason: `${provider.toUpperCase()} API 키가 설정되지 않았습니다.` })
            controller.close()
            return
          }

          send({ type: 'ai_progress', label: 'AI 심층 분석 시작...' })

          let aiAnalysis: AiSeoAnalysis | null = null
          const AI_TIMEOUT_MS = 45000 // 45초 (Vercel 60초 내 완료)
          let aiDone = false
          const subLabels = [
            'AI 심층 분석 중...', '콘텐츠 구조 분석 중...', '키워드 전략 평가 중...',
            '경험 정보 분석 중...', '참여도 평가 중...', '종합 피드백 생성 중...',
          ]
          let hbIdx = 0
          const heartbeat = setInterval(() => {
            if (aiDone) return
            hbIdx++
            const label = subLabels[Math.min(hbIdx, subLabels.length - 1)]
            send({ type: 'ai_progress', label })
          }, 3000)

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
              console.warn('[SEO Check] AI 분석 타임아웃 (45초)')
            } else {
              console.error('[SEO Check] AI 심층 분석 실패:', aiError)
            }
          } finally {
            aiDone = true
            clearInterval(heartbeat)
          }

          // AI 결과 후속 전송 (점수 보정 포함)
          if (aiAnalysis) {
            let finalScore = baseResult.totalScore
            let finalGrade = baseResult.grade
            if (aiAnalysis.scoreAdjustment) {
              finalScore = Math.max(0, Math.min(100, finalScore + aiAnalysis.scoreAdjustment))
              finalGrade = getGradeByScore(finalScore).grade
            }
            send({ type: 'ai_update', aiAnalysis, totalScore: finalScore, grade: finalGrade })
          } else {
            send({ type: 'ai_update', aiAnalysis: generateDemoAiAnalysis(), isDemo: true, demoReason: 'AI 분석 시간이 초과되었습니다. 기본 분석 결과를 표시합니다.' })
          }

          controller.close()
        } catch (streamError) {
          const msg = streamError instanceof Error ? streamError.message : String(streamError)
          console.error('[SEO Check] 스트림 오류:', msg)
          send({ type: 'error', error: `SEO 분석 중 오류가 발생했습니다: ${msg}` })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[SEO Check] 오류:', errorMessage)
    return NextResponse.json(
      { error: `SEO 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
