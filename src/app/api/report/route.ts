import { NextResponse } from 'next/server'
import { checkCredits, deductCredits } from '@/lib/credit-check'

export const dynamic = 'force-dynamic'

// ─── SEO 등급 판정 (경량 상수) ───

const GRADE_THRESHOLDS = [
  { minScore: 90, grade: 'S', label: '최적화 완료', color: '#22c55e' },
  { minScore: 80, grade: 'A+', label: '우수', color: '#16a34a' },
  { minScore: 70, grade: 'A', label: '양호', color: '#3b82f6' },
  { minScore: 60, grade: 'B+', label: '보통 상위', color: '#60a5fa' },
  { minScore: 50, grade: 'B', label: '보통', color: '#eab308' },
  { minScore: 40, grade: 'C', label: '개선 필요', color: '#f97316' },
  { minScore: 0, grade: 'D', label: '심각', color: '#ef4444' },
]

function getGrade(score: number) {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.minScore) return t
  }
  return GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1]
}

function avgScore(items: Array<{ seo_score: number | null }>): number | null {
  const scored = items.filter(c => c.seo_score !== null)
  if (scored.length === 0) return null
  return Math.round(scored.reduce((s, c) => s + (c.seo_score || 0), 0) / scored.length)
}

// ─── 인사이트 생성 (규칙 기반, AI 없음) ───

function generateInsights(ctx: {
  thisMonthAvg: number | null
  lastMonthAvg: number | null
  thisMonthContent: number
  lastMonthContent: number
  top10This: number
  top10Last: number
  gradeDistribution: Array<{ grade: string; count: number }>
  sectionDistribution: Array<{ section: string; count: number }>
}): string[] {
  const insights: string[] = []

  // 1. SEO 점수 트렌드
  if (ctx.thisMonthAvg !== null && ctx.lastMonthAvg !== null) {
    const diff = ctx.thisMonthAvg - ctx.lastMonthAvg
    if (diff > 0) {
      insights.push(`SEO 평균 점수가 ${ctx.lastMonthAvg}점에서 ${ctx.thisMonthAvg}점으로 ${diff}점 상승했습니다. 좋은 방향입니다!`)
    } else if (diff < 0) {
      insights.push(`SEO 평균 점수가 ${ctx.lastMonthAvg}점에서 ${ctx.thisMonthAvg}점으로 ${Math.abs(diff)}점 하락했습니다. 콘텐츠 품질에 더 집중해보세요.`)
    }
  }

  // 2. 70점 미만 개선 목표
  if (ctx.thisMonthAvg !== null && ctx.thisMonthAvg < 70) {
    insights.push(`현재 평균 SEO 점수는 ${ctx.thisMonthAvg}점입니다. 70점 이상을 목표로 제목 키워드 배치와 소제목 구조를 개선하세요.`)
  }

  // 3. C/D 등급 경고
  const lowGrades = ctx.gradeDistribution.filter(g => ['C', 'D'].includes(g.grade))
  const lowCount = lowGrades.reduce((s, g) => s + g.count, 0)
  if (lowCount > 0) {
    insights.push(`C/D 등급 콘텐츠가 ${lowCount}편 있습니다. SEO 점수 체커로 개선 포인트를 확인하고 수정하세요.`)
  }

  // 4. 섹션 분포 분석
  const smartblock = ctx.sectionDistribution.find(s => s.section === '스마트블록')
  const blogTab = ctx.sectionDistribution.find(s => s.section === '블로그탭')
  if (smartblock && blogTab && smartblock.count > blogTab.count) {
    insights.push(`스마트블록 노출(${smartblock.count}건)이 블로그탭(${blogTab.count}건)보다 많습니다. 블로그탭 노출을 높이려면 콘텐츠 길이와 전문성을 강화하세요.`)
  }

  // 5. 콘텐츠 생산량 트렌드
  if (ctx.thisMonthContent > ctx.lastMonthContent && ctx.lastMonthContent > 0) {
    insights.push(`이번 달 콘텐츠 생산량(${ctx.thisMonthContent}편)이 지난 달(${ctx.lastMonthContent}편)보다 증가했습니다. 꾸준한 발행이 블로그 지수에 도움됩니다.`)
  } else if (ctx.lastMonthContent > 0 && ctx.thisMonthContent < ctx.lastMonthContent) {
    insights.push(`이번 달 콘텐츠 생산량(${ctx.thisMonthContent}편)이 지난 달(${ctx.lastMonthContent}편)보다 감소했습니다. 정기적 발행을 유지하세요.`)
  }

  // 6. TOP10 변화
  if (ctx.top10This > ctx.top10Last && ctx.top10Last > 0) {
    insights.push(`TOP10 진입 키워드가 ${ctx.top10Last}개에서 ${ctx.top10This}개로 증가했습니다!`)
  }

  // 7. 폴백
  if (insights.length === 0) {
    insights.push('더 많은 콘텐츠를 생성하고 순위 트래킹을 설정하면 전략적 인사이트를 제공합니다.')
  }

  return insights.slice(0, 5)
}

// ─── GET /api/report ───

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

    // ─── 날짜 경계 ───
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const twoMonthsAgo = lastMonthStart.toISOString()

    // ─── 병렬 쿼리 ───
    const [
      { data: profile },
      { data: allContents },
      { data: recentTracking },
      { data: creditLogs },
      { data: keywords },
    ] = await Promise.all([
      supabase.from('profiles').select('email, plan, credits_balance, credits_monthly_quota, keywords_used_this_month, content_generated_this_month').eq('id', user.id).single(),
      supabase.from('generated_content').select('id, target_keyword, title, status, seo_score, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
      supabase.from('rank_tracking').select('keyword, blog_url, rank_position, section, checked_at').eq('user_id', user.id).gte('checked_at', twoMonthsAgo).order('checked_at', { ascending: false }),
      supabase.from('credit_usage_log').select('credits_spent, created_at').eq('user_id', user.id).gte('created_at', twoMonthsAgo),
      supabase.from('keyword_research').select('id, seed_keyword, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ])

    const contents = allContents || []
    const tracking = recentTracking || []
    const credits = creditLogs || []

    // ─── 이번달/지난달 콘텐츠 분리 ───
    const thisMonthContents = contents.filter(c => new Date(c.created_at) >= thisMonthStart)
    const lastMonthContents = contents.filter(c => {
      const d = new Date(c.created_at)
      return d >= lastMonthStart && d < thisMonthStart
    })

    // ─── 트래킹 중복 제거 (키워드+URL 기준 최신) ───
    const latestRanks: Record<string, (typeof tracking)[number]> = {}
    for (const t of tracking) {
      const key = `${t.keyword}||${t.blog_url}`
      if (!latestRanks[key] || new Date(t.checked_at) > new Date(latestRanks[key].checked_at)) {
        latestRanks[key] = t
      }
    }
    const uniqueTracking = Object.values(latestRanks)

    // 이번달/지난달 트래킹 분리
    const thisMonthTracking = tracking.filter(t => new Date(t.checked_at) >= thisMonthStart)
    const lastMonthTracking = tracking.filter(t => {
      const d = new Date(t.checked_at)
      return d >= lastMonthStart && d < thisMonthStart
    })

    // 이번달/지난달 TOP10 (중복 제거)
    function countTop10(items: typeof tracking) {
      const seen = new Set<string>()
      let count = 0
      for (const t of items) {
        const key = `${t.keyword}||${t.blog_url}`
        if (!seen.has(key) && t.rank_position !== null && t.rank_position <= 10) {
          count++
          seen.add(key)
        }
      }
      return count
    }
    const top10This = countTop10(thisMonthTracking)
    const top10Last = countTop10(lastMonthTracking)

    // ─── 크레딧 사용량 ───
    const thisMonthCredits = credits
      .filter(c => new Date(c.created_at) >= thisMonthStart)
      .reduce((s, c) => s + c.credits_spent, 0)
    const lastMonthCredits = credits
      .filter(c => {
        const d = new Date(c.created_at)
        return d >= lastMonthStart && d < thisMonthStart
      })
      .reduce((s, c) => s + c.credits_spent, 0)

    // ─── SEO 등급 분포 ───
    const gradeCounts: Record<string, number> = {}
    for (const t of GRADE_THRESHOLDS) gradeCounts[t.grade] = 0
    for (const c of contents.filter(c => c.seo_score !== null)) {
      const g = getGrade(c.seo_score!)
      gradeCounts[g.grade]++
    }
    const gradeDistribution = GRADE_THRESHOLDS
      .map(t => ({ grade: t.grade, label: t.label, color: t.color, count: gradeCounts[t.grade] }))
      .filter(g => g.count > 0)

    // ─── 주간 평균 SEO 점수 (8주) ───
    const weeklyAvg: Array<{ week: string; avg: number; count: number }> = []
    for (let i = 7; i >= 0; i--) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
      const weekContents = contents.filter(c => {
        const d = new Date(c.created_at)
        return d >= weekStart && d < weekEnd && c.seo_score !== null
      })
      const avg = weekContents.length > 0
        ? Math.round(weekContents.reduce((s, c) => s + (c.seo_score || 0), 0) / weekContents.length)
        : 0
      weeklyAvg.push({
        week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        avg,
        count: weekContents.length,
      })
    }

    // ─── 순위 분포 ───
    const rankBuckets = [
      { range: 'TOP 5', min: 1, max: 5 },
      { range: 'TOP 6-10', min: 6, max: 10 },
      { range: '11-20위', min: 11, max: 20 },
      { range: '21-50위', min: 21, max: 50 },
      { range: '100+', min: 51, max: Infinity },
    ]
    const rankDistribution = rankBuckets.map(b => ({
      range: b.range,
      count: uniqueTracking.filter(t => {
        if (t.rank_position === null) return b.range === '100+'
        return t.rank_position >= b.min && t.rank_position <= b.max
      }).length,
    }))

    // ─── 섹션 분포 ───
    const sectionCounts: Record<string, number> = { blog: 0, smartblock: 0, view: 0 }
    for (const t of uniqueTracking.filter(t => t.section)) {
      sectionCounts[t.section!] = (sectionCounts[t.section!] || 0) + 1
    }
    const sectionLabels: Record<string, string> = { blog: '블로그탭', smartblock: '스마트블록', view: 'VIEW탭' }
    const sectionDistribution = Object.entries(sectionCounts)
      .filter(([, c]) => c > 0)
      .map(([s, c]) => ({ section: sectionLabels[s] || s, count: c }))

    // ─── 인사이트 ───
    const thisMonthAvg = avgScore(thisMonthContents)
    const lastMonthAvg = avgScore(lastMonthContents)

    const insights = generateInsights({
      thisMonthAvg,
      lastMonthAvg,
      thisMonthContent: thisMonthContents.length,
      lastMonthContent: lastMonthContents.length,
      top10This,
      top10Last,
      gradeDistribution,
      sectionDistribution,
    })

    // ─── 크레딧 차감 ───
    await deductCredits(supabase, user.id, 'seo_report')

    // ─── 상세 테이블용 데이터 (최신 10건씩) ───
    const detailContents = contents.slice(0, 10)
    const detailTracking = uniqueTracking.slice(0, 10)

    return NextResponse.json({
      profile: profile || { plan: 'free', email: user.email, credits_balance: 0, credits_monthly_quota: 30 },
      generatedAt: new Date().toISOString(),

      summary: {
        thisMonth: {
          contentCount: thisMonthContents.length,
          avgSeoScore: thisMonthAvg,
          top10Count: top10This,
          creditsUsed: thisMonthCredits,
        },
        lastMonth: {
          contentCount: lastMonthContents.length,
          avgSeoScore: lastMonthAvg,
          top10Count: top10Last,
          creditsUsed: lastMonthCredits,
        },
      },

      seoPerformance: {
        gradeDistribution,
        weeklyAvg,
      },

      rankingPerformance: {
        distribution: rankDistribution,
        sectionDistribution,
      },

      insights,

      keywords: keywords || [],
      contents: detailContents,
      tracking: detailTracking,
    })
  } catch (error) {
    console.error('[Report] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
