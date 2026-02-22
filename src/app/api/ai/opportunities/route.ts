import { NextRequest, NextResponse } from 'next/server'
import { discoverKeywords, getDemoDiscoveryResult } from '@/lib/keyword-discovery'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { extractBlogId } from '@/lib/utils/text'
import { fetchBlogPosts, extractKeywordsFromPosts } from '@/lib/naver/blog-crawler'

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'keyword_discovery')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    const { topic, blogUrl } = await request.json()

    if ((!topic || topic.trim().length === 0) && (!blogUrl || blogUrl.trim().length === 0)) {
      return NextResponse.json(
        { error: '주제 키워드 또는 블로그 URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 블로그 URL이 제공된 경우 블로그 분석
    let cleanTopic = ''
    let blogName = ''

    if (blogUrl && blogUrl.trim().length > 0) {
      const blogId = extractBlogId(blogUrl.trim())
      if (!blogId) {
        return NextResponse.json(
          { error: '유효한 네이버 블로그 URL을 입력해주세요.' },
          { status: 400 }
        )
      }

      // 통합 블로그 크롤러 사용 (RSS → 검색 API → 페이지 크롤링)
      const crawlResult = await fetchBlogPosts(blogId, 20)

      if (crawlResult.posts.length === 0) {
        return NextResponse.json(
          { error: '블로그 글을 찾을 수 없습니다. 공개 글이 있는지 확인해주세요.' },
          { status: 400 }
        )
      }

      blogName = crawlResult.blogName || blogId

      // 포스트에서 한국어 키워드 자동 추출
      const extractedKeywords = extractKeywordsFromPosts(crawlResult.posts, 5)
      cleanTopic = extractedKeywords.join(', ') || blogId
      console.log(`[Opportunities] 블로그 분석: ${crawlResult.posts.length}개 포스트 (${crawlResult.source}), 키워드: ${cleanTopic}`)
    } else {
      cleanTopic = topic.trim()
    }

    // API 키 확인 — 키워드 발굴은 항상 Gemini
    const hasGeminiKey = !!process.env.GEMINI_API_KEY
    const hasNaverAdKey = !!process.env.NAVER_AD_API_KEY && !!process.env.NAVER_AD_SECRET_KEY && !!process.env.NAVER_AD_CUSTOMER_ID

    if (!hasGeminiKey || !hasNaverAdKey) {
      const demoResult = getDemoDiscoveryResult(cleanTopic)
      await deductCredits(supabase, user.id, 'keyword_discovery', { keyword: cleanTopic })
      return NextResponse.json({ ...demoResult, isDemo: true, blogName: blogName || undefined })
    }

    // 키워드 발굴 엔진 실행
    const result = await discoverKeywords(cleanTopic)

    await deductCredits(supabase, user.id, 'keyword_discovery', { keyword: cleanTopic })
    return NextResponse.json({ ...result, isDemo: false, blogName: blogName || undefined })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Opportunities] 오류:', errorMessage)
    return NextResponse.json(
      { error: `키워드 발굴 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
