// Claude API 유틸리티

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeResponse {
  content: { type: string; text: string }[]
}

export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = 4096
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Claude API] 오류:', response.status, errorText)
    throw new Error(`Claude API 오류: ${response.status}`)
  }

  const data: ClaudeResponse = await response.json()
  return data.content[0]?.text || ''
}

// 키워드 추천용 시스템 프롬프트
export const KEYWORD_SYSTEM_PROMPT = `당신은 네이버 블로그 SEO 키워드 전문가입니다.
주어진 시드 키워드를 바탕으로 네이버 블로그에서 상위 노출 가능성이 높은 관련 키워드를 추천합니다.

규칙:
1. 네이버 블로그 특성에 맞는 롱테일 키워드 위주로 추천
2. 검색 의도(정보형, 비교형, 구매형)를 다양하게 포함
3. JSON 형식으로만 응답
4. 각 키워드에 대해 추천 이유와 예상 검색 의도를 포함`

// 콘텐츠 생성용 시스템 프롬프트
export const CONTENT_SYSTEM_PROMPT = `당신은 네이버 블로그 SEO 전문가입니다.
네이버의 C-Rank와 D.I.A. 알고리즘에 최적화된 블로그 글을 작성합니다.

작성 규칙:
1. 제목에 핵심 키워드를 자연스럽게 포함
2. 소제목(H2, H3)을 활용한 체계적 구조
3. 본문 2,000~3,000자 분량 (네이버 최적 길이)
4. 이미지 삽입 위치를 [이미지: 설명] 형태로 표시
5. 경험과 정보가 결합된 자연스러운 톤
6. 핵심 키워드와 관련 키워드를 본문에 자연스럽게 배치
7. 도입-본문-정리 3단 구조
8. 네이버 블로그 특유의 친근하고 읽기 쉬운 문체
9. 마지막에 관련 태그 5~10개 추천`

// SEO 분석용 시스템 프롬프트
export const SEO_ANALYSIS_PROMPT = `당신은 네이버 블로그 SEO 분석 전문가입니다.
주어진 블로그 글을 네이버 SEO 관점에서 분석하고 점수를 매깁니다.

분석 항목:
1. 제목 최적화 (키워드 포함, 길이, 매력도) - 20점
2. 구조 (소제목 활용, 단락 구분) - 20점
3. 키워드 밀도 (적절한 키워드 배치) - 20점
4. 콘텐츠 품질 (길이, 깊이, 유용성) - 20점
5. 가독성 (문장 길이, 톤) - 20점

반드시 JSON 형식으로만 응답하세요.`
