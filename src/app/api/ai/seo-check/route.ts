import { NextRequest, NextResponse } from 'next/server'
import { callGemini, parseGeminiJson, SEO_ANALYSIS_PROMPT } from '@/lib/ai/gemini'

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

// 데모 SEO 분석 (100점 만점, 각 항목 20점)
function getDemoSeoResult(title: string, content: string): SeoResult {
  const hasHeadings = content.includes('##')
  const hasH3 = content.includes('###')
  const hasImages = content.includes('[이미지')
  const hasList = content.includes('- ') || content.includes('1. ')
  const length = content.length

  // 제목 (20점): 길이 10점 + 존재여부 10점
  const titleScore = !title ? 4 :
    (title.length >= 15 && title.length <= 40 ? 18 :
     title.length >= 10 ? 14 : 10)

  // 구조 (20점): H2 8점 + H3 6점 + 단락 6점
  const headingCount = (content.match(/^#{2,3}\s/gm) || []).length
  const structureScore = Math.min(20,
    (hasHeadings ? 8 : 0) +
    (hasH3 ? 6 : 0) +
    (headingCount >= 3 ? 6 : headingCount >= 1 ? 3 : 0))

  // 키워드 배치 (20점)
  const keywordScore = 14

  // 콘텐츠 품질 (20점): 길이 12점 + 이미지 4점 + 리스트 4점
  const qualityScore = Math.min(20,
    (length >= 2500 ? 12 : length >= 1500 ? 9 : length >= 800 ? 6 : 3) +
    (hasImages ? 4 : 0) +
    (hasList ? 4 : 0))

  // 가독성 (20점): 단락 10점 + 강조 5점 + 적절한 길이 5점
  const paragraphs = content.split('\n\n').filter(p => p.trim()).length
  const readabilityScore = Math.min(20,
    (paragraphs >= 5 ? 10 : paragraphs >= 3 ? 6 : 3) +
    (content.includes('**') ? 5 : 0) +
    (length >= 500 && length <= 5000 ? 5 : 3))

  const totalScore = titleScore + structureScore + keywordScore + qualityScore + readabilityScore

  return {
    totalScore,
    categories: [
      { name: '제목 최적화', score: titleScore, maxScore: 20, feedback: title.length >= 15 ? '제목 길이가 적절합니다.' : '제목이 너무 짧습니다. 15-40자가 적당합니다.' },
      { name: '구조', score: structureScore, maxScore: 20, feedback: hasHeadings ? '소제목을 잘 활용하고 있습니다.' : '소제목(H2, H3)을 추가해 구조화하세요.' },
      { name: '키워드 배치', score: keywordScore, maxScore: 20, feedback: '키워드가 본문에 적절히 분포되어 있습니다.' },
      { name: '콘텐츠 품질', score: qualityScore, maxScore: 20, feedback: length >= 2500 ? '네이버 권장 분량(2,500자 이상)에 맞습니다.' : '글 길이를 2,500자 이상으로 늘리세요.' },
      { name: '가독성', score: readabilityScore, maxScore: 20, feedback: paragraphs >= 5 ? '단락이 잘 구분되어 읽기 쉽습니다.' : '단락을 더 나눠서 가독성을 높이세요.' },
    ],
    improvements: [
      ...(!hasImages ? ['이미지를 3-5개 추가하면 체류 시간이 증가합니다'] : []),
      ...(length < 2500 ? ['본문을 2,500~3,500자로 늘려주세요 (네이버 상위 노출 최적 길이)'] : []),
      ...(!hasHeadings ? ['소제목(##)을 활용해 구조화하세요'] : []),
      ...(!hasList ? ['리스트(-, 1.)를 활용하면 가독성이 높아집니다'] : []),
      '관련 키워드를 2-3개 더 자연스럽게 배치해보세요',
    ],
    strengths: [
      ...(hasHeadings ? ['소제목을 활용한 체계적 구조'] : []),
      ...(hasImages ? ['이미지 삽입 위치 표시됨'] : []),
      ...(length >= 2500 ? ['충분한 글 분량 (2,500자 이상)'] : []),
      ...(hasList ? ['리스트를 활용한 정보 정리'] : []),
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
    {"name": "키워드 배치", "score": 0~20, "maxScore": 20, "feedback": "피드백"},
    {"name": "콘텐츠 품질", "score": 0~20, "maxScore": 20, "feedback": "피드백"},
    {"name": "가독성", "score": 0~20, "maxScore": 20, "feedback": "피드백"}
  ],
  "improvements": ["개선 사항 1", "개선 사항 2"],
  "strengths": ["강점 1", "강점 2"]
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
