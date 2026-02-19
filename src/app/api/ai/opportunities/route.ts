import { NextRequest, NextResponse } from 'next/server'
import { callGemini, parseGeminiJson, OPPORTUNITY_DISCOVERY_PROMPT } from '@/lib/ai/gemini'
import { getKeywordStats, calculateKeywordScore } from '@/lib/naver/search-ad'
import { checkAnalysisLimit, incrementAnalysisUsage } from '@/lib/plan-check'

// === 타입 ===

interface AiKeywordSuggestion {
  keyword: string
  category: string
  reason: string
}

interface OpportunityItem {
  keyword: string
  monthlySearch: number
  monthlyPc: number
  monthlyMobile: number
  compIdx: string
  score: number
  category: string
  reason: string
}

// === 데모 데이터 ===

function getDemoOpportunities(topic: string): OpportunityItem[] {
  const demos = [
    { keyword: `${topic} 초보 가이드`, category: '정보형', reason: '초보 대상 콘텐츠는 검색량이 높고 경쟁이 낮아 상위 노출 가능성이 높습니다' },
    { keyword: `${topic} 비용 비교`, category: '비교형', reason: '가격/비용 비교 콘텐츠는 구매 의도가 높은 사용자를 유입시킵니다' },
    { keyword: `${topic} 추천 순위 TOP5`, category: '구매형', reason: '리스트형 콘텐츠는 클릭률이 높고 체류 시간이 깁니다' },
    { keyword: `${topic} 실패 경험담`, category: '경험형', reason: '실패 사례는 경쟁 글이 적으면서 신뢰도가 높은 콘텐츠입니다' },
    { keyword: `${topic} 주의사항 총정리`, category: '정보형', reason: '주의사항/팁 정리 콘텐츠는 검색 의도가 명확하여 전환율이 높습니다' },
    { keyword: `2026 ${topic} 트렌드`, category: '정보형', reason: '연도 포함 키워드는 최신성을 인정받아 네이버 노출에 유리합니다' },
    { keyword: `${topic} vs 대안 비교`, category: '비교형', reason: 'vs 비교 콘텐츠는 체류 시간이 길어 D.I.A. 점수가 높아집니다' },
    { keyword: `${topic} 1개월 후기`, category: '경험형', reason: '구체적 기간 명시 후기는 롱테일 키워드로 경쟁이 낮습니다' },
    { keyword: `${topic} 가성비 추천`, category: '구매형', reason: '가성비 키워드는 구매 전환율이 높은 핵심 키워드입니다' },
    { keyword: `${topic} 하는 방법 단계별`, category: '정보형', reason: '단계별 가이드는 소제목 구조화에 유리하고 SEO 점수가 높습니다' },
    { keyword: `${topic} 장단점 솔직 정리`, category: '비교형', reason: '장단점 키워드는 검색 의도가 명확하고 클릭률이 높습니다' },
    { keyword: `${topic} 입문자 필수템`, category: '구매형', reason: '입문자 대상 추천은 구매 전환율이 높고 경쟁이 낮습니다' },
    { keyword: `${topic} 3개월 변화 과정`, category: '경험형', reason: '장기 후기는 희소성이 높아 블루오션 키워드입니다' },
    { keyword: `${topic} 자주 하는 실수`, category: '정보형', reason: '실수/주의 콘텐츠는 검색량이 꾸준하고 경쟁이 낮습니다' },
    { keyword: `${topic} 혼자서 시작하기`, category: '정보형', reason: '독학/혼자 키워드는 검색 의도가 높고 콘텐츠 경쟁이 적습니다' },
    { keyword: `${topic} 효과 없는 이유`, category: '경험형', reason: '부정적 경험 키워드는 공감도가 높아 체류 시간이 깁니다' },
    { keyword: `${topic} 무료 vs 유료`, category: '비교형', reason: '무료/유료 비교는 구매 결정 단계 사용자를 유입시킵니다' },
    { keyword: `${topic} 나이별 추천`, category: '구매형', reason: '세분화된 추천 키워드는 경쟁이 매우 낮은 틈새 시장입니다' },
    { keyword: `${topic} 꿀팁 모음`, category: '정보형', reason: '꿀팁/모음 키워드는 저장·공유율이 높아 노출에 유리합니다' },
    { keyword: `${topic} 현실 비용 공개`, category: '경험형', reason: '구체적 비용 공개 콘텐츠는 신뢰도와 체류 시간이 매우 높습니다' },
  ]

  return demos.map((d, i) => {
    // 다양한 검색량 분포 생성 (고/중/저 tier)
    const tier = i < 5 ? 'high' : i < 12 ? 'mid' : 'low'
    const monthlyPc = tier === 'high' ? Math.floor(Math.random() * 1500) + 500
      : tier === 'mid' ? Math.floor(Math.random() * 600) + 100
      : Math.floor(Math.random() * 200) + 30
    const monthlyMobile = tier === 'high' ? Math.floor(Math.random() * 4000) + 1000
      : tier === 'mid' ? Math.floor(Math.random() * 2000) + 300
      : Math.floor(Math.random() * 800) + 100

    return {
      ...d,
      monthlySearch: monthlyPc + monthlyMobile,
      monthlyPc,
      monthlyMobile,
      compIdx: i < 8 ? 'LOW' : i < 15 ? 'MEDIUM' : 'HIGH',
      score: Math.floor(Math.random() * 35) + (i < 8 ? 60 : i < 15 ? 40 : 25),
    }
  }).sort((a, b) => b.score - a.score)
}

// === API 핸들러 ===

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 일간 분석 제한 체크
    const limitCheck = await checkAnalysisLimit(supabase, user.id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.message, limit: limitCheck.limit, used: limitCheck.used },
        { status: 429 }
      )
    }

    const { topic } = await request.json()

    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: '주제 키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    const cleanTopic = topic.trim()

    // API 키가 없으면 데모 데이터
    const hasGeminiKey = !!process.env.GEMINI_API_KEY
    const hasNaverAdKey = !!process.env.NAVER_AD_API_KEY && !!process.env.NAVER_AD_SECRET_KEY && !!process.env.NAVER_AD_CUSTOMER_ID

    if (!hasGeminiKey || !hasNaverAdKey) {
      const demoOpps = getDemoOpportunities(cleanTopic)
      await incrementAnalysisUsage(supabase, user.id)
      return NextResponse.json({
        topic: cleanTopic,
        opportunities: demoOpps,
        summary: `"${cleanTopic}" 주제에서 ${demoOpps.length}개의 블루오션 키워드를 발견했습니다. 경쟁이 낮으면서 검색량이 충분한 키워드들로, 블로그 상위 노출 가능성이 높습니다.`,
        isDemo: true,
      })
    }

    // 1. Gemini에게 롱테일 키워드 생성 요청
    const userMessage = `주제: "${cleanTopic}"

이 주제와 관련된 네이버 블로그 상위 노출용 블루오션 키워드를 15~20개 생성해주세요.
경쟁이 낮으면서 월간 검색량이 100~5,000 정도 되는 롱테일 키워드를 추천해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "keywords": [
    {
      "keyword": "추천 키워드",
      "category": "정보형|비교형|구매형|경험형",
      "reason": "이 키워드가 블루오션인 이유 (1문장)"
    }
  ],
  "summary": "${cleanTopic} 주제 전체 기회 분석 요약 (2~3문장)"
}`

    const aiResponse = await callGemini(OPPORTUNITY_DISCOVERY_PROMPT, userMessage, 2048)
    const aiResult = parseGeminiJson<{
      keywords: AiKeywordSuggestion[]
      summary: string
    }>(aiResponse)

    // 2. 생성된 키워드들을 Naver API로 검색량 조회
    const keywordList = aiResult.keywords.map(k => k.keyword)
    // Naver API는 한번에 5개씩 조회 가능하므로 배치 처리
    const batchSize = 5
    const allResults: OpportunityItem[] = []

    for (let i = 0; i < keywordList.length; i += batchSize) {
      const batch = keywordList.slice(i, i + batchSize)
      try {
        const stats = await getKeywordStats(batch.join(','))

        for (const stat of stats) {
          const aiInfo = aiResult.keywords.find(
            k => k.keyword.replace(/\s+/g, '') === stat.relKeyword.replace(/\s+/g, '')
          )
          const totalSearch = (stat.monthlyPcQcCnt || 0) + (stat.monthlyMobileQcCnt || 0)

          allResults.push({
            keyword: stat.relKeyword,
            monthlySearch: totalSearch,
            monthlyPc: stat.monthlyPcQcCnt || 0,
            monthlyMobile: stat.monthlyMobileQcCnt || 0,
            compIdx: stat.compIdx || 'LOW',
            score: calculateKeywordScore(stat),
            category: aiInfo?.category || '정보형',
            reason: aiInfo?.reason || '검색량 대비 경쟁이 낮은 키워드입니다',
          })
        }
      } catch (batchError) {
        console.error(`[Opportunities] 배치 조회 실패 (${batch.join(', ')}):`, batchError)
      }
    }

    // 3. 기회 점수 높은 순 정렬 + 상위 20개
    allResults.sort((a, b) => b.score - a.score)
    const topOpportunities = allResults.slice(0, 20)

    await incrementAnalysisUsage(supabase, user.id)
    return NextResponse.json({
      topic: cleanTopic,
      opportunities: topOpportunities,
      summary: aiResult.summary || `"${cleanTopic}" 주제에서 ${topOpportunities.length}개의 블루오션 키워드를 발굴했습니다.`,
      isDemo: false,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Opportunities] 오류:', errorMessage)
    return NextResponse.json(
      { error: `키워드 발굴 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
