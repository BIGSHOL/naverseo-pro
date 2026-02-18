import { NextRequest, NextResponse } from 'next/server'
import { callGemini, KEYWORD_SYSTEM_PROMPT } from '@/lib/ai/gemini'

// 데모 키워드 추천 (API 키 없을 때)
function getDemoRecommendations(keyword: string) {
  return {
    recommendations: [
      {
        keyword: `${keyword} 초보 가이드`,
        intent: '정보형',
        reason: '초보자 대상 콘텐츠는 검색량이 높고 경쟁이 낮아 상위 노출 가능성이 높습니다.',
      },
      {
        keyword: `${keyword} 후기 2024`,
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
    ],
    isDemo: true,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json()

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // API 키가 없으면 데모 데이터
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(getDemoRecommendations(keyword.trim()))
    }

    const userMessage = `시드 키워드: "${keyword.trim()}"

이 키워드와 관련된 네이버 블로그 상위 노출용 키워드를 5~8개 추천해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "recommendations": [
    {
      "keyword": "추천 키워드",
      "intent": "정보형|비교형|구매형|경험형",
      "reason": "추천 이유"
    }
  ]
}`

    const response = await callGemini(KEYWORD_SYSTEM_PROMPT, userMessage, 2048)

    // JSON 파싱 (마크다운 코드블록 제거)
    const jsonStr = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json({ ...parsed, isDemo: false })
  } catch (error) {
    console.error('[AI Keywords] 오류:', error)
    return NextResponse.json(
      { error: 'AI 키워드 추천 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
