import { NextRequest, NextResponse } from 'next/server'
import { callGemini, SEO_ANALYSIS_PROMPT } from '@/lib/ai/gemini'

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

// 데모 SEO 분석
function getDemoSeoResult(title: string, content: string): SeoResult {
  const hasHeadings = content.includes('##')
  const hasImages = content.includes('[이미지')
  const length = content.length
  const titleScore = title.length >= 15 && title.length <= 40 ? 16 : 12
  const structureScore = hasHeadings ? 17 : 10
  const keywordScore = 14
  const qualityScore = length > 1500 ? 17 : length > 800 ? 13 : 8
  const readabilityScore = 15

  const totalScore = titleScore + structureScore + keywordScore + qualityScore + readabilityScore

  return {
    totalScore,
    categories: [
      { name: '제목 최적화', score: titleScore, maxScore: 20, feedback: title.length >= 15 ? '제목 길이가 적절합니다.' : '제목이 너무 짧습니다. 15-40자가 적당합니다.' },
      { name: '구조', score: structureScore, maxScore: 20, feedback: hasHeadings ? '소제목을 잘 활용하고 있습니다.' : '소제목(H2, H3)을 추가해 구조화하세요.' },
      { name: '키워드 밀도', score: keywordScore, maxScore: 20, feedback: '키워드가 본문에 적절히 분포되어 있습니다.' },
      { name: '콘텐츠 품질', score: qualityScore, maxScore: 20, feedback: length > 1500 ? '네이버 권장 분량에 맞습니다.' : '글 길이를 2,000자 이상으로 늘리세요.' },
      { name: '가독성', score: readabilityScore, maxScore: 20, feedback: '문장이 읽기 쉬운 길이입니다.' },
    ],
    improvements: [
      ...(!hasImages ? ['이미지를 3-5개 추가하면 체류 시간이 증가합니다'] : []),
      ...(length < 1500 ? ['본문을 2,000~3,000자로 늘려주세요'] : []),
      ...(!hasHeadings ? ['소제목(##)을 활용해 구조화하세요'] : []),
      '관련 키워드를 2-3개 더 추가해보세요',
    ],
    strengths: [
      ...(hasHeadings ? ['소제목을 활용한 체계적 구조'] : []),
      ...(hasImages ? ['이미지 삽입 위치 표시됨'] : []),
      ...(length > 1500 ? ['충분한 글 분량'] : []),
      '친근하고 읽기 쉬운 문체',
    ],
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

    // API 키가 없으면 데모 분석
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        ...getDemoSeoResult(title || '', content),
        isDemo: true,
      })
    }

    const userMessage = `다음 네이버 블로그 글을 SEO 관점에서 분석해주세요.

${keyword ? `타겟 키워드: "${keyword}"` : ''}
제목: ${title || '(제목 없음)'}

본문:
${content.substring(0, 3000)}

다음 JSON 형식으로 응답해주세요:
{
  "totalScore": 0~100 사이 총점,
  "categories": [
    {"name": "제목 최적화", "score": 0~20, "maxScore": 20, "feedback": "피드백"},
    {"name": "구조", "score": 0~20, "maxScore": 20, "feedback": "피드백"},
    {"name": "키워드 밀도", "score": 0~20, "maxScore": 20, "feedback": "피드백"},
    {"name": "콘텐츠 품질", "score": 0~20, "maxScore": 20, "feedback": "피드백"},
    {"name": "가독성", "score": 0~20, "maxScore": 20, "feedback": "피드백"}
  ],
  "improvements": ["개선 사항 1", "개선 사항 2"],
  "strengths": ["강점 1", "강점 2"]
}`

    const response = await callGemini(SEO_ANALYSIS_PROMPT, userMessage, 2048)

    const jsonStr = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json({ ...parsed, isDemo: false })
  } catch (error) {
    console.error('[SEO Check] 오류:', error)
    return NextResponse.json(
      { error: 'SEO 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
