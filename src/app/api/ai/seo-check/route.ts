import { NextRequest, NextResponse } from 'next/server'
import { callGemini, parseGeminiJson, SEO_ANALYSIS_PROMPT } from '@/lib/ai/gemini'
import { analyzeSeo } from '@/lib/content/engine'

interface SeoResult {
  totalScore: number
  categories: {
    name: string
    score: number
    maxScore: number
    feedback: string
  }[]
  improvements: string[]
  strengths: string[]
}

// 데모 SEO 분석 - 콘텐츠 엔진의 10항목 분석 재활용
function getDemoSeoResult(keyword: string, title: string, content: string): SeoResult {
  const engineResult = analyzeSeo(keyword || '', title || '', content)
  return {
    totalScore: engineResult.totalScore,
    categories: engineResult.categories.map(cat => ({
      name: cat.name,
      score: cat.score,
      maxScore: cat.maxScore,
      feedback: cat.details,
    })),
    improvements: engineResult.improvements,
    strengths: engineResult.strengths,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, keyword } = await request.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: '분석할 콘텐츠를 입력해주세요.' },
        { status: 400 }
      )
    }

    // API 키가 없으면 콘텐츠 엔진으로 로컬 분석
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        ...getDemoSeoResult(keyword || '', title || '', content),
        isDemo: true,
      })
    }

    const userMessage = `다음 네이버 블로그 글을 SEO 관점에서 분석해주세요.

${keyword ? `타겟 키워드: "${keyword}"` : ''}
제목: ${title || '(제목 없음)'}

본문:
${content.substring(0, 3000)}

다음 JSON 형식으로 응답해주세요 (10개 항목, 각 10점 만점, 총 100점):
{
  "totalScore": 0~100 사이 총점,
  "categories": [
    {"name": "제목 키워드", "score": 0~10, "maxScore": 10, "feedback": "제목에 키워드 포함 여부 및 위치 분석"},
    {"name": "제목 길이", "score": 0~10, "maxScore": 10, "feedback": "제목 길이 적절성 (권장 20~40자)"},
    {"name": "소제목 구조", "score": 0~10, "maxScore": 10, "feedback": "H2, H3 소제목 활용도"},
    {"name": "키워드 밀도", "score": 0~10, "maxScore": 10, "feedback": "키워드 사용 빈도 (권장 0.5~2.5%)"},
    {"name": "키워드 분포", "score": 0~10, "maxScore": 10, "feedback": "키워드가 본문 전반에 고르게 분포되었는지"},
    {"name": "콘텐츠 길이", "score": 0~10, "maxScore": 10, "feedback": "본문 분량 (권장 2,000~3,000자)"},
    {"name": "멀티미디어", "score": 0~10, "maxScore": 10, "feedback": "이미지 삽입 여부 및 개수"},
    {"name": "가독성 요소", "score": 0~10, "maxScore": 10, "feedback": "볼드, 리스트, 문단 분리 등"},
    {"name": "관련 키워드", "score": 0~10, "maxScore": 10, "feedback": "동의어/관련 키워드 활용도"},
    {"name": "태그 & CTA", "score": 0~10, "maxScore": 10, "feedback": "태그 포함 여부, 독자 참여 유도 문구"}
  ],
  "improvements": ["개선 사항 1", "개선 사항 2", ...],
  "strengths": ["강점 1", "강점 2", ...]
}`

    const response = await callGemini(SEO_ANALYSIS_PROMPT, userMessage, 2048)

    const parsed = parseGeminiJson<SeoResult>(response)

    return NextResponse.json({ ...parsed, isDemo: false })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[SEO Check] 오류:', errorMessage)
    return NextResponse.json(
      { error: `SEO 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
