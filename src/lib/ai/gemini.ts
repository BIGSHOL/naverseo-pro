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
    model: 'gemini-2.5-flash',
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

  try {
    return JSON.parse(cleaned)
  } catch (firstError) {
    // Fallback: trailing comma 제거, unquoted key 보정
    const fixed = cleaned
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')

    try {
      return JSON.parse(fixed) as T
    } catch {
      throw new Error(`JSON 파싱 실패: ${(firstError as Error).message}`)
    }
  }
}

// 프롬프트 re-export (기존 import 경로 호환)
export {
  KEYWORD_SYSTEM_PROMPT,
  OPPORTUNITY_DISCOVERY_PROMPT,
  CONTENT_SYSTEM_PROMPT,
  SEO_ANALYSIS_PROMPT,
  SEO_DEEP_ANALYSIS_PROMPT,
  BLOG_INDEX_AI_PROMPT,
  COMPETITOR_ANALYSIS_PROMPT,
} from './prompts'
