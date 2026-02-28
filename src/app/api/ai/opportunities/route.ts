import { NextRequest, NextResponse } from 'next/server'
import { discoverKeywords, getDemoDiscoveryResult } from '@/lib/keyword-discovery'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { extractBlogId } from '@/lib/utils/text'
import { fetchBlogPosts, extractKeywordsFromPosts } from '@/lib/naver/blog-crawler'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // 인증 + 크레딧 체크 (에러 시 즉시 JSON 반환)
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const creditCheck = await checkCredits(supabase, user.id, 'keyword_discovery')
  if (!creditCheck.allowed) {
    return NextResponse.json(
      { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
      { status: 403 }
    )
  }

  let body: { topic?: string; blogUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { topic, blogUrl } = body

  if ((!topic || topic.trim().length === 0) && (!blogUrl || blogUrl.trim().length === 0)) {
    return NextResponse.json(
      { error: '주제 키워드 또는 블로그 URL을 입력해주세요.' },
      { status: 400 }
    )
  }

  // API 키 확인
  const hasGeminiKey = !!process.env.GEMINI_API_KEY
  const hasNaverAdKey = !!process.env.NAVER_AD_API_KEY && !!process.env.NAVER_AD_SECRET_KEY && !!process.env.NAVER_AD_CUSTOMER_ID

  // NDJSON 스트리밍 응답
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        } catch { /* controller closed */ }
      }

      try {
        const totalSteps = blogUrl?.trim() ? 4 : 3

        let cleanTopic = ''
        let blogName = ''

        // Step 1 (optional): 블로그 분석
        if (blogUrl && blogUrl.trim().length > 0) {
          send({ type: 'progress', step: 1, totalSteps, message: '블로그 포스트 분석 중...' })

          const blogId = extractBlogId(blogUrl.trim())
          if (!blogId) {
            send({ type: 'error', error: '유효한 네이버 블로그 URL을 입력해주세요.' })
            controller.close()
            return
          }

          const crawlResult = await fetchBlogPosts(blogId, 20)

          if (crawlResult.posts.length === 0) {
            send({ type: 'error', error: '블로그 글을 찾을 수 없습니다. 공개 글이 있는지 확인해주세요.' })
            controller.close()
            return
          }

          blogName = crawlResult.blogName || blogId
          const extractedKeywords = extractKeywordsFromPosts(crawlResult.posts, 5)
          cleanTopic = extractedKeywords.join(', ') || blogId
          console.log(`[Opportunities] 블로그 분석: ${crawlResult.posts.length}개 포스트 (${crawlResult.source}), 키워드: ${cleanTopic}`)

          send({ type: 'progress', step: 1, totalSteps, message: `${crawlResult.posts.length}개 포스트에서 키워드 추출 완료` })
        } else {
          cleanTopic = topic!.trim()
        }

        if (!hasGeminiKey || !hasNaverAdKey) {
          // 데모 모드
          const demoResult = getDemoDiscoveryResult(cleanTopic)
          await deductCredits(supabase, user.id, 'keyword_discovery', { keyword: cleanTopic })
          send({ type: 'result', ...demoResult, isDemo: true, blogName: blogName || undefined })
          controller.close()
          return
        }

        // 키워드 발굴 엔진 실행 (프로그레스 콜백 포함)
        const stepOffset = blogUrl?.trim() ? 1 : 0
        const result = await discoverKeywords(cleanTopic, (step, _totalEngineSteps, message) => {
          send({ type: 'progress', step: step + stepOffset, totalSteps, message })
        })

        // 크레딧 차감
        send({ type: 'progress', step: totalSteps, totalSteps, message: '결과 정리 중...' })
        await deductCredits(supabase, user.id, 'keyword_discovery', { keyword: cleanTopic })

        send({ type: 'result', ...result, isDemo: false, blogName: blogName || undefined })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[Opportunities] 오류:', errorMessage)
        send({ type: 'error', error: `키워드 발굴 분석 중 오류가 발생했습니다: ${errorMessage}` })
      } finally {
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
}
