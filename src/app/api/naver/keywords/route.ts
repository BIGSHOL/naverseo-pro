import { NextRequest, NextResponse } from 'next/server'
import {
  getKeywordStats,
  calculateKeywordScore,
  type NaverKeywordResult,
} from '@/lib/naver/search-ad'
import { checkKeywordLimit } from '@/lib/plan-check'

// 데모 데이터 (API 키 없을 때 사용) - 30개 다양한 롱테일 키워드 생성
function generateDemoData(keyword: string): NaverKeywordResult[] {
  const suffixes = [
    '', ' 추천', ' 방법', ' 후기', ' 비교', ' 가격',
    ' 순위', ' 블로그', ' 팁', ' 정보', ' 하는법',
    ' 종류', ' 장단점', ' 총정리', ' 2026', ' 리뷰',
    ' 초보', ' 가이드', ' 효과', ' 주의사항',
    ' TOP5', ' 선택법', ' 꿀팁', ' 실제', ' 경험',
    ' 정리', ' 차이', ' 맛집', ' 솔직후기', ' BEST',
  ]

  return suffixes.map((suffix, i) => {
    const kw = `${keyword}${suffix}`
    // 시드 키워드는 높은 검색량, 롱테일로 갈수록 낮은 검색량 + 낮은 경쟁도
    const isSeed = i === 0
    const tier = i < 5 ? 'high' : i < 15 ? 'mid' : 'low'

    const pcBase = isSeed ? 3000 : tier === 'high' ? 800 : tier === 'mid' ? 200 : 50
    const mobileBase = isSeed ? 8000 : tier === 'high' ? 2500 : tier === 'mid' ? 600 : 150

    return {
      relKeyword: kw,
      monthlyPcQcCnt: pcBase + Math.floor(Math.random() * pcBase * 0.5),
      monthlyMobileQcCnt: mobileBase + Math.floor(Math.random() * mobileBase * 0.5),
      monthlyAvePcClkCnt: Math.floor(Math.random() * 200) + 10,
      monthlyAveMobileClkCnt: Math.floor(Math.random() * 500) + 30,
      monthlyAvePcCtr: Math.random() * 5 + 0.5,
      monthlyAveMobileCtr: Math.random() * 8 + 1,
      plAvgDepth: Math.floor(Math.random() * 15) + 1,
      compIdx: tier === 'low' ? 'LOW' : tier === 'mid'
        ? (['MEDIUM', 'LOW'] as const)[Math.floor(Math.random() * 2)]
        : (['HIGH', 'MEDIUM'] as const)[Math.floor(Math.random() * 2)],
    }
  })
}

// Supabase에 키워드 검색 결과 저장 + 사용량 증가
async function saveKeywordResearch(seedKeyword: string, results: unknown[]) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // 키워드 리서치 결과 저장
    await supabase.from('keyword_research').insert({
      user_id: user.id,
      seed_keyword: seedKeyword,
      results: { keywords: results },
    })

    // 사용량 증가
    await supabase.rpc('increment_keyword_usage', { uid: user.id }).maybeSingle()
  } catch {
    // DB 저장 실패해도 API 응답은 정상 반환
    console.error('[Keywords] DB 저장 실패')
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')

  if (!keyword || keyword.trim().length === 0) {
    return NextResponse.json(
      { error: '키워드를 입력해주세요.' },
      { status: 400 }
    )
  }

  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 플랜 사용량 체크
    const planCheck = await checkKeywordLimit(supabase, user.id)
    if (!planCheck.allowed) {
      return NextResponse.json(
        { error: planCheck.message, planLimit: true, plan: planCheck.plan, limit: planCheck.limit, used: planCheck.used },
        { status: 403 }
      )
    }

    let resultsWithScore

    // 네이버 API 키가 없으면 데모 데이터 반환
    if (
      !process.env.NAVER_AD_API_KEY ||
      !process.env.NAVER_AD_SECRET_KEY ||
      !process.env.NAVER_AD_CUSTOMER_ID
    ) {
      const demoResults = generateDemoData(keyword.trim())
      resultsWithScore = demoResults.map((kw) => ({
        ...kw,
        totalSearch: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
        score: calculateKeywordScore(kw),
      }))
      resultsWithScore.sort((a, b) => b.score - a.score)

      // 데모라도 DB에 저장 시도
      await saveKeywordResearch(keyword.trim(), resultsWithScore)

      return NextResponse.json({
        keywords: resultsWithScore,
        isDemo: true,
        message: '데모 데이터입니다. 실제 데이터는 네이버 API 키 설정 후 사용 가능합니다.',
      })
    }

    const trimmed = keyword.trim()
    const hasSpaces = /\s/.test(trimmed)
    const results = await getKeywordStats(trimmed)
    resultsWithScore = results.map((kw) => ({
      ...kw,
      totalSearch: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
      score: calculateKeywordScore(kw),
    }))
    resultsWithScore.sort((a, b) => b.score - a.score)

    // DB에 저장
    await saveKeywordResearch(trimmed, resultsWithScore)

    return NextResponse.json({
      keywords: resultsWithScore,
      isDemo: false,
      // 공백이 포함된 키워드는 네이버 API 제한으로 공백 제거 후 검색됨
      ...(hasSpaces && {
        searchedAs: trimmed.replace(/\s+/g, ''),
        spaceNotice: `네이버 API 제한으로 "${trimmed.replace(/\s+/g, '')}"(으)로 검색되었습니다.`,
      }),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Keywords API] 오류:', errorMessage)
    return NextResponse.json(
      { error: `키워드 조회 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
