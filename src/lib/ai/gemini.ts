// Gemini AI 유틸리티 (Google Generative AI)

import { GoogleGenerativeAI } from '@google/generative-ai'

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,
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

// Gemini 응답에서 JSON을 안전하게 파싱
// 마크다운 코드블록, 앞뒤 텍스트 등을 제거하고 순수 JSON만 추출
export function parseGeminiJson<T>(response: string): T {
  // 1. 마크다운 코드블록 제거
  let cleaned = response.replace(/```(?:json)?\s*\n?/g, '').trim()

  // 2. JSON 시작/끝 위치 찾기 (앞뒤에 불필요한 텍스트가 있을 수 있음)
  const firstBrace = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')
  let startIdx = -1

  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error('JSON을 찾을 수 없습니다.')
  } else if (firstBrace === -1) {
    startIdx = firstBracket
  } else if (firstBracket === -1) {
    startIdx = firstBrace
  } else {
    startIdx = Math.min(firstBrace, firstBracket)
  }

  const isArray = cleaned[startIdx] === '['
  const closingChar = isArray ? ']' : '}'
  const lastClose = cleaned.lastIndexOf(closingChar)

  if (lastClose === -1 || lastClose < startIdx) {
    throw new Error('JSON 형식이 올바르지 않습니다.')
  }

  cleaned = cleaned.substring(startIdx, lastClose + 1)
  return JSON.parse(cleaned)
}

// 키워드 추천용 시스템 프롬프트
export const KEYWORD_SYSTEM_PROMPT = `당신은 네이버 블로그 SEO 키워드 전문가입니다.
주어진 시드 키워드를 바탕으로 네이버 블로그에서 상위 노출 가능성이 높은 관련 키워드를 추천합니다.

규칙:
1. 네이버 블로그 특성에 맞는 롱테일 키워드 위주로 추천 (월 검색량 100~5,000 구간이 블로그 상위 노출에 유리)
2. 검색 의도를 다양하게 포함: 정보형(~방법, ~하는법), 비교형(~추천, ~비교, ~순위), 구매형(~가격, ~할인, ~후기), 경험형(~후기, ~솔직리뷰)
3. 반드시 유효한 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON만)
4. 각 키워드에 대해 추천 이유와 예상 검색 의도를 포함
5. 네이버 C-Rank 알고리즘을 고려하여 전문성을 보여줄 수 있는 세부 키워드 포함`

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

// SEO 분석용 시스템 프롬프트 (10개 항목, 각 10점)
export const SEO_ANALYSIS_PROMPT = `당신은 네이버 블로그 SEO 분석 전문가입니다.
주어진 블로그 글을 네이버 C-Rank와 D.I.A. 알고리즘 관점에서 분석하고 점수를 매깁니다.

네이버 SEO 핵심 요소:
- C-Rank: 특정 주제에 대한 블로그 전문성 (주제 일관성, 경험 기반 콘텐츠)
- D.I.A.: 개별 문서의 품질 (독창성, 정보 깊이, 체류 시간 유도)

분석 항목 (총 100점, 각 항목 10점 만점):
1. 제목 키워드 (10점) - 제목에 핵심 키워드 포함 여부, 앞쪽(10자 이내) 배치 시 가산
2. 제목 길이 (10점) - 20~40자 최적, 15~50자 양호
3. 소제목 구조 (10점) - H2 3개 이상 + H3 활용으로 체계적 구조화
4. 키워드 밀도 (10점) - 키워드 반복 빈도 0.5~2.5%가 최적, 과다(4%+) 시 스팸 위험
5. 키워드 분포 (10점) - 도입/중간/마무리 3구간에 고르게 분포
6. 콘텐츠 길이 (10점) - 2,500자 이상 우수, 1,800자 이상 양호
7. 멀티미디어 (10점) - 이미지 4개 이상 우수, 체류 시간 증가 효과
8. 가독성 요소 (10점) - **볼드** 강조, 리스트(-, 1.) 활용, 문단 8개 이상 분리
9. 관련 키워드 (10점) - 동의어, 유사어, 관련 키워드 자연스러운 활용
10. 태그 & CTA (10점) - 해시태그(#) 5~10개, 댓글/공감 유도 문구 포함

반드시 유효한 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만).`

// 상위노출 분석용 시스템 프롬프트
export const COMPETITOR_ANALYSIS_PROMPT = `당신은 네이버 블로그 SEO 경쟁 분석 전문가입니다.
네이버 블로그 검색 상위 노출 결과를 분석하여, 새로운 블로그 글이 상위에 노출되기 위한 전략을 수립합니다.

분석 관점:
1. 네이버 C-Rank 알고리즘: 블로그의 주제 전문성, 꾸준한 포스팅
2. 네이버 D.I.A. 알고리즘: 개별 문서의 품질, 독창성, 체류 시간
3. 제목 패턴: 상위 노출 글들의 제목 구조와 키워드 배치
4. 콘텐츠 전략: 기존 상위 글들이 다루지 않는 각도나 정보

반드시 유효한 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만).`

// 키워드 발굴용 시스템 프롬프트
export const OPPORTUNITY_DISCOVERY_PROMPT = `당신은 네이버 블로그 SEO 키워드 전략가입니다.
주어진 주제에서 블로그 상위 노출 가능성이 높은 "블루오션 키워드"를 발굴합니다.

블루오션 키워드 기준:
1. 월 검색량 100~5,000 구간 (너무 적으면 트래픽 부족, 너무 많으면 경쟁 치열)
2. 롱테일 키워드 (3~6어절로 구체적인 검색 의도)
3. 다양한 검색 의도 포함: 정보형(~방법, ~하는법), 비교형(~추천, ~비교), 구매형(~가격, ~후기), 경험형(~후기, ~솔직리뷰)
4. 네이버 C-Rank 알고리즘에서 전문성을 보여줄 수 있는 세부 주제
5. 시즌성/트렌드 키워드도 포함 (현재 시기에 맞는 키워드)

반드시 유효한 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만).`
