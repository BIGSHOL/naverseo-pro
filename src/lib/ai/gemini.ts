// Gemini AI 유틸리티 (Google Generative AI)

import { GoogleGenerativeAI } from '@google/generative-ai'

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  })

  try {
    const result = await model.generateContent(userMessage)
    const response = result.response
    return response.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      throw new Error('AI API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.')
    }
    throw err
  }
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
