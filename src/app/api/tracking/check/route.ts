import { NextRequest, NextResponse } from 'next/server'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { scheduleCollection, collectFromSearchResults } from '@/lib/blog-learning'

// 기존 키워드 순위 재확인
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'tracking_per_keyword')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    const { keyword, blogUrl } = await request.json()

    if (!keyword?.trim() || !blogUrl?.trim()) {
      return NextResponse.json(
        { error: '키워드와 블로그 URL이 필요합니다.' },
        { status: 400 }
      )
    }

    // 순위 체크
    let rankResult: { rank: number | null; section: string | null }

    if (
      !process.env.NAVER_CLIENT_ID ||
      !process.env.NAVER_CLIENT_SECRET
    ) {
      const { generateDemoRank } = await import('@/lib/naver/blog-search')
      rankResult = generateDemoRank()
    } else {
      const { checkBlogRank, searchNaverBlog } = await import('@/lib/naver/blog-search')
      rankResult = await checkBlogRank(keyword.trim(), blogUrl.trim())

      // 블로그 학습 파이프라인: 백그라운드 수집
      scheduleCollection(async () => {
        const blogResults = await searchNaverBlog(keyword.trim(), 5)
        await collectFromSearchResults(keyword.trim(), blogResults.items, 'rank_tracking')
      })
    }

    // 새 순위 기록 추가
    await supabase.from('rank_tracking').insert({
      user_id: user.id,
      keyword: keyword.trim(),
      blog_url: blogUrl.trim(),
      rank_position: rankResult.rank,
      section: rankResult.section,
    })

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'tracking_per_keyword', { keyword: keyword.trim(), blogUrl: blogUrl.trim() })

    return NextResponse.json({
      keyword: keyword.trim(),
      blogUrl: blogUrl.trim(),
      rank: rankResult.rank,
      section: rankResult.section,
      isDemo: !process.env.NAVER_CLIENT_ID,
    })
  } catch (error) {
    console.error('[Tracking Check] 오류:', error)
    return NextResponse.json(
      { error: '순위 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
