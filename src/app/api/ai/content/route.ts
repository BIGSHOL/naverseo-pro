import { NextRequest, NextResponse } from 'next/server'
import { callGemini, parseGeminiJson, CONTENT_SYSTEM_PROMPT } from '@/lib/ai/gemini'

// 데모 콘텐츠 생성
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateDemoContent(keyword: string, tone: string) {
  return {
    title: `${keyword} 완벽 가이드: 초보자도 쉽게 따라하는 방법`,
    content: `## ${keyword}란 무엇인가요?

안녕하세요! 오늘은 많은 분들이 궁금해하시는 **${keyword}**에 대해 자세히 알아보려고 합니다.

[이미지: ${keyword} 관련 대표 이미지]

최근 ${keyword}에 대한 관심이 높아지면서 관련 정보를 찾는 분들이 많아졌는데요, 이 글에서 핵심 내용을 꼼꼼하게 정리해드리겠습니다.

## ${keyword} 시작하기

${keyword}를 처음 접하시는 분들을 위해 기본적인 내용부터 설명드리겠습니다.

### 1. 기본 개념 이해하기

${keyword}의 핵심은 **꾸준함**과 **올바른 방법**에 있습니다. 무작정 시작하기보다는 기본 개념을 먼저 이해하는 것이 중요해요.

[이미지: 기본 개념 설명 인포그래픽]

### 2. 준비물 체크리스트

시작하기 전에 필요한 것들을 미리 준비해두면 훨씬 효율적입니다:

- 기본 도구 및 자료 준비
- 목표 설정하기
- 일정 계획 세우기

### 3. 단계별 실행 방법

**Step 1**: 목표를 명확하게 설정합니다.
**Step 2**: 필요한 자료를 수집합니다.
**Step 3**: 계획에 따라 꾸준히 실행합니다.

[이미지: 단계별 실행 과정]

## ${keyword} 주의사항

${keyword}를 진행할 때 주의해야 할 점들이 있습니다:

1. **무리하지 않기** - 처음부터 너무 많은 것을 하려고 하면 지치기 쉽습니다
2. **꾸준히 기록하기** - 진행 상황을 기록하면 동기부여에 도움이 됩니다
3. **전문가 조언 참고하기** - 혼자 고민하지 말고 전문가의 도움을 받는 것도 좋습니다

## 마무리

오늘은 **${keyword}**에 대해 알아보았습니다. 이 글이 도움이 되셨다면 좋겠네요! 궁금한 점은 댓글로 남겨주세요.

#${keyword} #${keyword}추천 #${keyword}방법 #${keyword}후기 #${keyword}가이드 #초보자가이드`,
    tags: [keyword, `${keyword}추천`, `${keyword}방법`, `${keyword}후기`, `${keyword}가이드`, '초보자가이드'],
    isDemo: true,
  }
}

// 간단한 SEO 점수 자동 계산 (AI 호출 없이 로컬 계산, 100점 만점)
function calculateBasicSeoScore(keyword: string, title: string, content: string): number {
  let score = 0
  const contentLength = content.length

  // 1. 제목 최적화 (20점)
  const titleHasKeyword = title.includes(keyword)
  const titleStartsWithKeyword = title.startsWith(keyword) || title.indexOf(keyword) <= 5
  if (titleHasKeyword) score += titleStartsWithKeyword ? 12 : 8 // 제목 앞쪽 키워드 가산
  if (title.length >= 15 && title.length <= 50) score += 8
  else if (title.length >= 10) score += 4

  // 2. 구조 (20점) - 중복 가산 제거
  const headingCount = (content.match(/^#{2,3}\s/gm) || []).length
  const hasH2 = content.includes('## ')
  const hasH3 = content.includes('### ')
  if (hasH2 && hasH3) score += 12       // H2 + H3 모두 사용
  else if (hasH2) score += 8            // H2만 사용
  if (headingCount >= 4) score += 8     // 소제목 4개 이상
  else if (headingCount >= 2) score += 5

  // 3. 키워드 배치 (20점) - 밀도 비율 기반
  const keywordCount = content.split(keyword).length - 1
  const words = content.length / 2 // 한국어 평균 단어 길이 추정
  const density = words > 0 ? (keywordCount / words) * 100 : 0
  // 적정 밀도: 0.5%~2.5% (100자당 0.5~2.5회)
  if (density >= 0.5 && density <= 2.5) score += 15
  else if (density > 0 && density < 0.5) score += 8  // 키워드 부족
  else if (density > 2.5 && density <= 5) score += 8  // 약간 과다
  else if (density > 5) score += 3                     // 키워드 스터핑
  else if (keywordCount >= 1) score += 5               // 최소 포함
  // 키워드가 본문 전반에 분포되어 있는지 (앞/중/뒤)
  const third = Math.floor(contentLength / 3)
  const inFirst = content.substring(0, third).includes(keyword)
  const inLast = content.substring(third * 2).includes(keyword)
  if (inFirst && inLast) score += 5

  // 4. 콘텐츠 품질 (20점)
  if (contentLength >= 2500) score += 12
  else if (contentLength >= 1500) score += 8
  else if (contentLength >= 800) score += 4
  const hasImages = content.includes('[이미지')
  if (hasImages) score += 4
  const hasList = content.includes('- ') || content.includes('1. ')
  if (hasList) score += 4

  // 5. 가독성 (20점)
  const paragraphs = content.split('\n\n').filter(p => p.trim()).length
  if (paragraphs >= 6) score += 10
  else if (paragraphs >= 3) score += 6
  const hasBold = content.includes('**')
  if (hasBold) score += 5
  // 평균 문장 길이 체크 (짧은 문장이 가독성 높음)
  const sentences = content.split(/[.!?。]\s/).length
  const avgSentenceLen = sentences > 0 ? contentLength / sentences : contentLength
  if (avgSentenceLen <= 80) score += 5
  else if (avgSentenceLen <= 120) score += 3

  return Math.min(100, score)
}

// Supabase에 생성된 콘텐츠 저장 + 사용량 증가
async function saveGeneratedContent(keyword: string, title: string, content: string) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const seoScore = calculateBasicSeoScore(keyword, title, content)

    // 콘텐츠 저장 (SEO 점수 포함)
    const { data } = await supabase.from('generated_content').insert({
      user_id: user.id,
      target_keyword: keyword,
      title,
      content,
      status: 'draft',
      seo_score: seoScore,
    }).select('id').single()

    // 사용량 증가
    await supabase.rpc('increment_content_usage', { uid: user.id }).maybeSingle()

    return { id: data?.id || null, seoScore }
  } catch {
    console.error('[Content] DB 저장 실패')
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, tone = '친근하고 정보적인', additionalKeywords = [] } = await request.json()

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '타겟 키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // API 키가 없으면 데모 콘텐츠
    if (!process.env.GEMINI_API_KEY) {
      const demo = generateDemoContent(keyword.trim(), tone)
      const saved = await saveGeneratedContent(keyword.trim(), demo.title, demo.content)
      return NextResponse.json({ ...demo, contentId: saved?.id, seoScore: saved?.seoScore })
    }

    const relatedKeywords = additionalKeywords.length > 0
      ? `\n관련 키워드: ${additionalKeywords.join(', ')}`
      : ''

    const userMessage = `타겟 키워드: "${keyword.trim()}"
톤앤매너: ${tone}${relatedKeywords}

위 키워드로 네이버 블로그 SEO에 최적화된 글을 작성해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "title": "블로그 제목",
  "content": "블로그 본문 (마크다운 형식)",
  "tags": ["태그1", "태그2", ...]
}`

    const response = await callGemini(CONTENT_SYSTEM_PROMPT, userMessage, 4096)

    const parsed = parseGeminiJson<{ title: string; content: string; tags: string[] }>(response)

    // DB에 저장
    const saved = await saveGeneratedContent(keyword.trim(), parsed.title, parsed.content)

    return NextResponse.json({ ...parsed, isDemo: false, contentId: saved?.id, seoScore: saved?.seoScore })
  } catch (error) {
    console.error('[AI Content] 오류:', error)
    return NextResponse.json(
      { error: 'AI 콘텐츠 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
