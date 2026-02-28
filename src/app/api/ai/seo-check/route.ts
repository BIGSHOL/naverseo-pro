import { NextRequest, NextResponse } from 'next/server'
import { analyzeSeo, analyzeReadability, getGradeByScore, type ReadabilityResult } from '@/lib/seo/engine'
import { analyzeWithAi, generateDemoAiAnalysis } from '@/lib/seo/ai-analyzer'
import type { AiSeoAnalysis, ScrapedMeta } from '@/lib/seo/ai-analyzer'
import { getUserAiProvider, hasAiApiKey } from '@/lib/ai/gemini'
import { checkCredits, deductCredits } from '@/lib/credit-check'

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
          send({ type: 'progress', step: 1, total: 4, label: 'SEO 엔진 분석 중...', percent: 10 })
          const seoScrapedMeta = scrapedMeta ? {
            tags: scrapedMeta.tags,
            formatting: scrapedMeta.formatting,
          } : undefined
          const engineResult = analyzeSeo(keyword || '', title || '', content, undefined, seoScrapedMeta)

          // Step 2: 가독성 분석
          send({ type: 'progress', step: 2, total: 4, label: '가독성 분석 중...', percent: 20 })
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

          // Step 3: AI 심층 분석 (가장 오래 걸리는 단계 — heartbeat로 진행감 + 타임아웃 방지)
          send({ type: 'progress', step: 3, total: 4, label: 'AI 모델 연결 중...', percent: 25 })

          const provider = await getUserAiProvider(supabase, user.id)

          if (!hasAiApiKey(provider)) {
            send({ type: 'progress', step: 4, total: 4, label: '결과 정리 중...', percent: 90 })
            const response: SeoCheckResponse = {
              ...baseResult,
              isDemo: true,
              demoReason: `${provider.toUpperCase()} API 키가 설정되지 않았습니다.`,
              aiAnalysis: generateDemoAiAnalysis(),
            }
            send({ type: 'result', ...response })
            controller.close()
            return
          }

          let aiAnalysis: AiSeoAnalysis | null = null
          let aiFailReason = ''

          // AI 분석 + heartbeat 병렬 실행 (3초마다 진행 상태 전송 → 타임아웃 방지 + 진행감)
          const AI_TIMEOUT_MS = 50000 // 50초 (Vercel 60초 제한 내)
          let aiDone = false
          const subLabels = [
            'AI 심층 분석 중...', '콘텐츠 구조 분석 중...', '키워드 전략 평가 중...',
            '경험 정보 분석 중...', '참여도 평가 중...', '종합 피드백 생성 중...',
          ]
          let hbIdx = 0
          const heartbeat = setInterval(() => {
            if (aiDone) return
            hbIdx++
            const percent = Math.min(85, 30 + hbIdx * 7)
            const label = subLabels[Math.min(hbIdx, subLabels.length - 1)]
            send({ type: 'progress', step: 3, total: 4, label, percent })
          }, 3000)

          try {
            aiAnalysis = await Promise.race([
              analyzeWithAi(keyword || '', title || '', content, scrapedMeta, provider),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS)
              ),
            ])
            if (!aiAnalysis) {
              aiFailReason = 'AI 분석이 null을 반환했습니다 (콘텐츠 길이 부족 또는 API 키 문제).'
            }
          } catch (aiError) {
            const msg = aiError instanceof Error ? aiError.message : String(aiError)
            if (msg === 'AI_TIMEOUT') {
              aiFailReason = 'AI 분석 시간이 초과되었습니다 (50초). 기본 분석 결과를 표시합니다.'
              console.warn('[SEO Check] AI 분석 타임아웃 (50초)')
            } else {
              aiFailReason = msg
              console.error('[SEO Check] AI 심층 분석 실패 (기본 결과로 대체):', aiError)
            }
          } finally {
            aiDone = true
            clearInterval(heartbeat)
          }

          // Step 4: 점수 보정 + 등급 재계산 + 크레딧 차감
          send({ type: 'progress', step: 4, total: 4, label: '점수 보정 중...', percent: 90 })

          let finalScore = baseResult.totalScore
          let finalGrade = baseResult.grade
          if (aiAnalysis?.scoreAdjustment) {
            finalScore = Math.max(0, Math.min(100, finalScore + aiAnalysis.scoreAdjustment))
            finalGrade = getGradeByScore(finalScore).grade
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

          send({ type: 'result', ...response })
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
