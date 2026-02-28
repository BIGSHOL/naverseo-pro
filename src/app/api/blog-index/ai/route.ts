import { NextRequest, NextResponse } from 'next/server'
import { analyzeWithAi } from '@/lib/blog-index/ai-analyzer'
import { type BlogPost } from '@/lib/blog-index/engine'
import { getUserAiProvider, hasAiApiKey } from '@/lib/ai/gemini'
import { extractBlogId } from '@/lib/utils/text'
import { fetchBlogPosts } from '@/lib/naver/blog-crawler'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 플랜 확인: Free 제외 전부 허용
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    const plan = profile?.plan || 'free'
    if (plan === 'free') {
      return NextResponse.json(
        { error: 'AI 심층 분석은 Starter 플랜 이상에서 사용할 수 있습니다.' },
        { status: 403 }
      )
    }

    const { blogUrl } = await request.json()

    if (!blogUrl?.trim()) {
      return NextResponse.json(
        { error: '블로그 URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    const hasNaverApi = process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET
    if (!hasNaverApi) {
      return NextResponse.json(
        { error: 'AI 심층 분석은 데모 모드에서 사용할 수 없습니다.' },
        { status: 400 }
      )
    }

    const provider = await getUserAiProvider(supabase, user.id)

    if (!hasAiApiKey(provider)) {
      return NextResponse.json(
        { error: 'AI API 키가 설정되지 않았습니다.' },
        { status: 400 }
      )
    }

    const blogId = extractBlogId(blogUrl.trim())

    // 블로그 포스트 가져오기
    let posts: BlogPost[] = []
    if (blogId) {
      const crawlResult = await fetchBlogPosts(blogId, 50)
      posts = crawlResult.posts
    }

    if (posts.length === 0) {
      return NextResponse.json(
        { error: '분석할 포스트를 찾을 수 없습니다.' },
        { status: 400 }
      )
    }

    // NDJSON 스트리밍으로 프로그레스 + AI 분석 결과 전송
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        try {
          const aiAnalysis = await analyzeWithAi(posts, false, {
            onProgress: (message) => send({ type: 'progress', message }),
            onChunk: (delta) => send({ type: 'stream', delta }),
          }, provider)

          if (!aiAnalysis) {
            send({ type: 'error', error: 'AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.' })
          } else {
            send({
              type: 'result',
              aiAnalysis,
              scoreAdjustment: aiAnalysis.scoreAdjustment,
              adjustmentReason: aiAnalysis.adjustmentReason,
            })
          }
        } catch (error) {
          console.error('[BlogIndex AI] 스트리밍 오류:', error)
          send({ type: 'error', error: 'AI 심층 분석 중 오류가 발생했습니다.' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('[BlogIndex AI] 오류:', error)
    return NextResponse.json(
      { error: 'AI 심층 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
