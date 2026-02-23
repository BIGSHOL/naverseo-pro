import { NextRequest, NextResponse } from 'next/server'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { scheduleCollection, collectFromSearchResults } from '@/lib/blog-learning'

// 트래킹 키워드 목록 조회
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크 (잔액 확인만, GET이므로 차감하지 않음)
    const creditCheck = await checkCredits(supabase, user.id, 'tracking_per_keyword')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    // 트래킹 중인 키워드별 최신 순위 조회
    // keyword + blog_url 조합별로 최신 checked_at 레코드를 가져옴
    const { data: trackingData, error } = await supabase
      .from('rank_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('checked_at', { ascending: false })

    if (error) {
      console.error('[Tracking] 조회 오류:', error)
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
    }

    // keyword+blog_url 조합별로 그룹핑하여 최신 순위와 이력 반환
    const grouped: Record<string, {
      keyword: string
      blog_url: string
      latest: {
        rank_position: number | null
        section: string | null
        checked_at: string
      }
      history: Array<{
        id: string
        rank_position: number | null
        section: string | null
        checked_at: string
      }>
    }> = {}

    for (const row of trackingData || []) {
      const key = `${row.keyword}||${row.blog_url}`
      if (!grouped[key]) {
        grouped[key] = {
          keyword: row.keyword,
          blog_url: row.blog_url,
          latest: {
            rank_position: row.rank_position,
            section: row.section,
            checked_at: row.checked_at,
          },
          history: [],
        }
      }
      grouped[key].history.push({
        id: row.id,
        rank_position: row.rank_position,
        section: row.section,
        checked_at: row.checked_at,
      })
    }

    const keywords = Object.values(grouped)

    return NextResponse.json({ keywords })
  } catch (error) {
    console.error('[Tracking] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// 새 키워드 트래킹 등록 + 즉시 순위 체크
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { keyword, blogUrl } = await request.json()

    if (!keyword?.trim() || !blogUrl?.trim()) {
      return NextResponse.json(
        { error: '키워드와 블로그 URL을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    // 이미 등록된 키워드인지 확인
    const { data: existing } = await supabase
      .from('rank_tracking')
      .select('id')
      .eq('user_id', user.id)
      .eq('keyword', keyword.trim())
      .eq('blog_url', blogUrl.trim())
      .limit(1)

    // 크레딧 체크
    const isNew = !existing || existing.length === 0
    const creditCheck = await checkCredits(supabase, user.id, 'tracking_per_keyword')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    // 즉시 순위 체크
    let rankResult: { rank: number | null; section: string | null }

    if (
      !process.env.NAVER_CLIENT_ID ||
      !process.env.NAVER_CLIENT_SECRET
    ) {
      // 데모 데이터
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

    // DB에 순위 기록 저장
    const { error: insertError } = await supabase.from('rank_tracking').insert({
      user_id: user.id,
      keyword: keyword.trim(),
      blog_url: blogUrl.trim(),
      rank_position: rankResult.rank,
      section: rankResult.section,
    })

    if (insertError) {
      console.error('[Tracking] 저장 오류:', insertError)
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
    }

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'tracking_per_keyword', { keyword: keyword.trim(), blogUrl: blogUrl.trim() })

    return NextResponse.json({
      keyword: keyword.trim(),
      blogUrl: blogUrl.trim(),
      rank: rankResult.rank,
      section: rankResult.section,
      isNew,
      isDemo: !process.env.NAVER_CLIENT_ID,
    })
  } catch (error) {
    console.error('[Tracking] POST 오류:', error)
    return NextResponse.json({ error: '순위 확인 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
