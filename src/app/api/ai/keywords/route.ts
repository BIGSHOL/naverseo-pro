import { NextRequest, NextResponse } from 'next/server'
import { callGemini, parseGeminiJson, KEYWORD_SYSTEM_PROMPT } from '@/lib/ai/gemini'
import { getKeywordStats, calculateKeywordScore, type NaverKeywordResult } from '@/lib/naver/search-ad'
import { checkCredits, deductCredits } from '@/lib/credit-check'

interface AiRecommendation {
  keyword: string
  intent: string
  reason: string
  searchData?: {
    totalSearch: number
    monthlyPcQcCnt: number
    monthlyMobileQcCnt: number
    compIdx: string
    score: number
  }
}

// AI 추천 키워드의 검색량을 네이버 API에서 조회하여 병합
async function enrichWithSearchData(recommendations: AiRecommendation[]): Promise<AiRecommendation[]> {
  const hasNaverApi = process.env.NAVER_AD_API_KEY &&
    process.env.NAVER_AD_SECRET_KEY &&
    process.env.NAVER_AD_CUSTOMER_ID

  if (!hasNaverApi) {
    // 데모 검색량 데이터 추가
    return recommendations.map((rec, i) => ({
      ...rec,
      searchData: {
        totalSearch: [2800, 1500, 3200, 950, 1800, 620, 430, 1100, 780, 340][i] || 500,
        monthlyPcQcCnt: [800, 400, 900, 250, 500, 180, 120, 300, 220, 100][i] || 150,
        monthlyMobileQcCnt: [2000, 1100, 2300, 700, 1300, 440, 310, 800, 560, 240][i] || 350,
        compIdx: ['LOW', 'LOW', 'MEDIUM', 'LOW', 'LOW', 'LOW', 'LOW', 'MEDIUM', 'LOW', 'LOW'][i] || 'LOW',
        score: [85, 78, 62, 82, 75, 88, 90, 65, 80, 92][i] || 75,
      },
    }))
  }

  // 실제 네이버 API로 각 추천 키워드 검색량 조회
  try {
    const keywords = recommendations.map(r => r.keyword).join(',')
    const results = await getKeywordStats(keywords)

    // 추천 키워드와 검색 결과 매칭
    const resultMap = new Map<string, NaverKeywordResult>()
    for (const r of results) {
      resultMap.set(r.relKeyword, r)
    }

    return recommendations.map(rec => {
      // 공백 제거 후 매칭 시도 (네이버 API 공백 제한)
      const match = resultMap.get(rec.keyword) || resultMap.get(rec.keyword.replace(/\s+/g, ''))
      if (match) {
        const totalSearch = match.monthlyPcQcCnt + match.monthlyMobileQcCnt
        return {
          ...rec,
          searchData: {
            totalSearch,
            monthlyPcQcCnt: match.monthlyPcQcCnt,
            monthlyMobileQcCnt: match.monthlyMobileQcCnt,
            compIdx: match.compIdx,
            score: calculateKeywordScore(match),
          },
        }
      }
      return rec
    })
  } catch {
    // 네이버 API 실패 시 검색량 없이 반환
    return recommendations
  }
}

// 데모 키워드 추천 (API 키 없을 때)
function getDemoRecommendations(keyword: string) {
  const recommendations: AiRecommendation[] = [
    {
      keyword: `${keyword} 초보 가이드`,
      intent: '정보형',
      reason: '초보자 대상 콘텐츠는 검색량이 높고 경쟁이 낮아 상위 노출 가능성이 높습니다.',
    },
    {
      keyword: `${keyword} 후기 2026`,
      intent: '경험형',
      reason: '연도가 포함된 후기 키워드는 최신성을 인정받아 네이버 노출에 유리합니다.',
    },
    {
      keyword: `${keyword} 비교 분석`,
      intent: '비교형',
      reason: '비교 콘텐츠는 체류 시간이 길어 D.I.A. 알고리즘에서 높은 점수를 받습니다.',
    },
    {
      keyword: `${keyword} 추천 TOP5`,
      intent: '구매형',
      reason: '리스트형 콘텐츠는 클릭률이 높고 공유도 많이 됩니다.',
    },
    {
      keyword: `${keyword} 장단점 정리`,
      intent: '정보형',
      reason: '장단점 정리는 정보 밀도가 높아 검색 엔진에서 가치있는 콘텐츠로 평가됩니다.',
    },
    {
      keyword: `${keyword} 하는법 쉽게`,
      intent: '정보형',
      reason: '구체적인 롱테일 키워드로 경쟁이 매우 낮아 신규 블로그도 상위 노출 가능합니다.',
    },
    {
      keyword: `${keyword} 실제 경험담`,
      intent: '경험형',
      reason: '경험 기반 콘텐츠는 C-Rank에서 전문성을 인정받아 검색 노출에 유리합니다.',
    },
    {
      keyword: `${keyword} 가성비 추천`,
      intent: '구매형',
      reason: '가성비 키워드는 구매 의도가 높은 사용자를 유입시켜 블로그 체류 시간이 깁니다.',
    },
  ]

  return { recommendations, isDemo: true }
}

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

    const { keyword } = await request.json()

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // API 키가 없으면 데모 데이터 (검색량 포함) — 키워드는 항상 Gemini
    if (!process.env.GEMINI_API_KEY) {
      const demo = getDemoRecommendations(keyword.trim())
      const enriched = await enrichWithSearchData(demo.recommendations)
      await deductCredits(supabase, user.id, 'keyword_discovery', { keyword: keyword.trim() })
      return NextResponse.json({ recommendations: enriched, isDemo: true })
    }

    const userMessage = `시드 키워드: "${keyword.trim()}"

이 키워드와 관련된 네이버 블로그 상위 노출용 키워드를 8~10개 추천해주세요.
경쟁이 낮고 검색량이 적절한 롱테일 키워드 위주로 추천하세요.

다음 JSON 형식으로 응답해주세요:
{
  "recommendations": [
    {
      "keyword": "추천 키워드",
      "intent": "정보형|비교형|구매형|경험형",
      "reason": "추천 이유 (1~2문장)"
    }
  ]
}`

    const response = await callGemini(KEYWORD_SYSTEM_PROMPT, userMessage, 4096, { jsonMode: true })
    const parsed = parseGeminiJson<{ recommendations: AiRecommendation[] }>(response)

    // AI 추천 키워드의 실제 검색량 데이터 병합
    const enriched = await enrichWithSearchData(parsed.recommendations || [])

    await deductCredits(supabase, user.id, 'keyword_discovery', { keyword: keyword.trim() })
    return NextResponse.json({ recommendations: enriched, isDemo: false })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[AI Keywords] 오류:', errorMessage)
    return NextResponse.json(
      { error: `AI 키워드 추천 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
