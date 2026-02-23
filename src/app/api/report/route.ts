import { NextResponse } from 'next/server'
import { checkCredits, deductCredits } from '@/lib/credit-check'

export const dynamic = 'force-dynamic'

// SEO 리포트 데이터 조회 (PDF 생성용)
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'seo_report')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    // 프로필
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // 최근 키워드 리서치 (최대 20개)
    const { data: keywords } = await supabase
      .from('keyword_research')
      .select('id, seed_keyword, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // 생성된 콘텐츠 (최대 20개)
    const { data: contents } = await supabase
      .from('generated_content')
      .select('id, target_keyword, title, status, seo_score, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // 순위 트래킹 (키워드별 최신)
    const { data: tracking } = await supabase
      .from('rank_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('checked_at', { ascending: false })
      .limit(50)

    // 키워드별 최신 순위만 추출
    const trackingList = tracking || []
    const latestRanks: Record<string, (typeof trackingList)[number]> = {}
    for (const t of trackingList) {
      const key = `${t.keyword}||${t.blog_url}`
      if (!latestRanks[key]) latestRanks[key] = t
    }

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'seo_report')

    return NextResponse.json({
      profile: profile || { plan: 'free', email: user.email },
      keywords: keywords || [],
      contents: contents || [],
      tracking: Object.values(latestRanks),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Report] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
