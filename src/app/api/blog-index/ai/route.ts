import { NextRequest, NextResponse } from 'next/server'
import { analyzeWithAi } from '@/lib/blog-index/ai-analyzer'
import { determineLevelInfo, type BlogPost } from '@/lib/blog-index/engine'
import { getUserAiProvider } from '@/lib/ai/gemini'
import { extractBlogId } from '@/lib/utils/text'
import { fetchBlogPosts } from '@/lib/naver/blog-crawler'

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

    // AI 심층 분석 실행
    const aiAnalysis = await analyzeWithAi(posts, false, provider)

    if (!aiAnalysis) {
      return NextResponse.json(
        { error: 'AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    // 점수 보정값과 재계산된 등급 반환
    return NextResponse.json({
      aiAnalysis,
      scoreAdjustment: aiAnalysis.scoreAdjustment,
      adjustmentReason: aiAnalysis.adjustmentReason,
    })
  } catch (error) {
    console.error('[BlogIndex AI] 오류:', error)
    return NextResponse.json(
      { error: 'AI 심층 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
