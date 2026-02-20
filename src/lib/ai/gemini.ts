// AI 유틸리티 (Gemini + Claude 이중 지원)

import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'

export type AiProvider = 'gemini' | 'claude'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096,
  options?: { jsonMode?: boolean }
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
      ...(options?.jsonMode && { responseMimeType: 'application/json' }),
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

/**
 * Claude API 호출
 */
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096,
  options?: { jsonMode?: boolean }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.')
  }

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const block = message.content[0]
    if (block.type === 'text') {
      return block.text
    }
    throw new Error('Claude 응답에서 텍스트를 찾을 수 없습니다.')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || msg.includes('rate') || msg.includes('Too Many Requests')) {
      throw new Error('AI API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.')
    }
    throw err
  }
}

/**
 * 사용자의 AI 제공자 설정 조회
 * profiles.ai_provider 컬럼에서 'gemini' 또는 'claude' 반환
 * Free 플랜은 항상 gemini 사용 (비용 절감)
 */
export async function getUserAiProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<AiProvider> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('ai_provider, plan')
      .eq('id', userId)
      .single()

    // Free 플랜은 항상 Gemini 사용
    if (data?.plan === 'free') return 'gemini'

    return (data?.ai_provider as AiProvider) || 'gemini'
  } catch {
    return 'gemini'
  }
}

/**
 * AI 제공자에 따라 적절한 API 호출
 * provider가 'claude'면 callClaude, 아니면 callGemini 사용
 */
export async function callAI(
  provider: AiProvider,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096,
  options?: { jsonMode?: boolean }
): Promise<string> {
  if (provider === 'claude') {
    return callClaude(systemPrompt, userMessage, maxTokens, options)
  }
  return callGemini(systemPrompt, userMessage, maxTokens, options)
}

/**
 * 해당 AI 제공자의 API 키가 설정되어 있는지 확인
 */
export function hasAiApiKey(provider: AiProvider): boolean {
  if (provider === 'claude') return !!process.env.ANTHROPIC_API_KEY?.trim()
  return !!process.env.GEMINI_API_KEY?.trim()
}

/**
 * 잘린(truncated) JSON 복구
 * maxOutputTokens 초과로 응답이 중간에 잘린 경우,
 * 마지막 완성된 위치까지 자르고 미닫힌 [, { 를 닫아서 유효한 JSON으로 만듦
 */
function repairTruncatedJson(s: string): string {
  // 1) 열린/닫힌 구조를 추적하며 마지막 완성된 위치를 찾기
  const stack: string[] = []
  let inStr = false
  let lastClosedPos = 0

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\' && inStr) { i++; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (!inStr) {
      if (ch === '{') stack.push('}')
      else if (ch === '[') stack.push(']')
      else if (ch === '}' || ch === ']') {
        stack.pop()
        lastClosedPos = i + 1
      }
    }
  }

  // 스택이 비었으면 완전한 JSON → 그대로 반환
  if (stack.length === 0) return s

  // 2) 마지막 완성된 위치까지 자르고, 뒤의 trailing comma 제거
  let repaired = s.substring(0, lastClosedPos).replace(/,\s*$/, '')

  // 3) 잘린 후의 스택 다시 계산
  const stack2: string[] = []
  inStr = false
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i]
    if (ch === '\\' && inStr) { i++; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (!inStr) {
      if (ch === '{') stack2.push('}')
      else if (ch === '[') stack2.push(']')
      else if (ch === '}' || ch === ']') stack2.pop()
    }
  }

  // 4) 미닫힌 구조를 역순으로 닫기
  return repaired + stack2.reverse().join('')
}

/**
 * 문자열 내부의 이스케이프되지 않은 따옴표를 수정하는 상태 머신
 */
function fixUnescapedQuotes(s: string): string {
  const result: string[] = []
  let inString = false
  let i = 0

  while (i < s.length) {
    const ch = s[i]

    if (ch === '\\' && inString) {
      result.push(ch, s[i + 1] || '')
      i += 2
      continue
    }

    if (ch === '"') {
      if (!inString) {
        inString = true
        result.push(ch)
      } else {
        let j = i + 1
        while (j < s.length && s[j] === ' ') j++
        const next = s[j]
        if (next === ':' || next === ',' || next === '}' || next === ']' || j >= s.length) {
          inString = false
          result.push(ch)
        } else {
          result.push('\\"')
        }
      }
    } else {
      result.push(ch)
    }
    i++
  }

  return result.join('')
}

// 공통 전처리
const stripControl = (s: string) => s.replace(/[\x00-\x1F]+/g, ' ')
const removeTrailingCommas = (s: string) => s.replace(/,\s*([}\]])/g, '$1')

/**
 * Gemini 응답에서 JSON을 안전하게 파싱
 *
 * 주요 대응:
 * 1) 제어문자(탭/개행 등) 제거
 * 2) 이스케이프 안 된 따옴표/백슬래시 수정
 * 3) maxOutputTokens 초과로 잘린 응답 복구 (미닫힌 구조 닫기)
 */
export function parseGeminiJson<T>(response: string): T {
  // 마크다운 코드블록 제거
  const cleaned = response.replace(/```(?:json)?\s*\n?/g, '').trim()

  // JSON 시작 위치 찾기
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

  // JSON 끝 위치: 시작 문자에 대응하는 닫는 문자의 마지막 위치
  const isArray = cleaned[startIdx] === '['
  const closingChar = isArray ? ']' : '}'
  const lastClose = cleaned.lastIndexOf(closingChar)

  // 닫는 문자가 없으면 전체를 사용 (잘린 응답 → repairTruncatedJson이 처리)
  const endIdx = (lastClose === -1 || lastClose < startIdx) ? cleaned.length : lastClose + 1
  const json = cleaned.substring(startIdx, endIdx)

  // 단계적 파싱 시도
  const strategies: (() => string)[] = [
    // 1차: 원본
    () => json,
    // 2차: 제어문자 제거 + trailing comma 제거
    () => removeTrailingCommas(stripControl(json)),
    // 3차: 위 + 이스케이프 안 된 따옴표 수정
    () => fixUnescapedQuotes(removeTrailingCommas(stripControl(json))),
    // 4차: 위 + 이스케이프 안 된 백슬래시 수정
    () => fixUnescapedQuotes(
      removeTrailingCommas(stripControl(json))
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
    ),
    // 5차: 잘린 JSON 복구 (maxTokens 초과 시)
    () => repairTruncatedJson(removeTrailingCommas(stripControl(json))),
  ]

  let lastError: Error | null = null
  for (const strategy of strategies) {
    try {
      return JSON.parse(strategy()) as T
    } catch (e) {
      lastError = e as Error
    }
  }

  console.error('[parseGeminiJson] 모든 전략 실패. 원본 길이:', json.length, '앞 300자:', json.substring(0, 300))
  throw new Error(`JSON 파싱 실패: ${lastError?.message}`)
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
