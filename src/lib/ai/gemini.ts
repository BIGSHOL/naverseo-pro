// AI 유틸리티 (Gemini + Claude 이중 지원)

import Anthropic from '@anthropic-ai/sdk'

export type AiProvider = 'gemini' | 'claude'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Gemini REST API 직접 호출 (thinkingConfig 지원)
 *
 * thinkingBudget: Gemini 2.5 Flash의 내부 reasoning 토큰 제한
 *   - 0: thinking 완전 비활성 (가장 빠름, 10~15초)
 *   - 1024~2048: 짧은 thinking 허용 (15~30초)
 *   - 미지정/높은값: 모델이 자유롭게 thinking (1~3분+, 504 위험)
 */
export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096,
  options?: { jsonMode?: boolean; thinkingBudget?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const url = `${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`

  // thinkingBudget 기본값: 1024 (빠른 응답 보장, 504 방지)
  const thinkingBudget = options?.thinkingBudget ?? 1024

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
      ...(options?.jsonMode && { responseMimeType: 'application/json' }),
      thinkingConfig: {
        thinkingBudget: thinkingBudget,
      },
    },
  }

  try {
    // 45초 타임아웃 (Vercel 60초 maxDuration 내에서 여유 확보)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 45000)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errBody = await res.text()
      if (res.status === 429 || errBody.includes('quota') || errBody.includes('Too Many Requests')) {
        throw new Error('AI API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.')
      }
      throw new Error(`Gemini API 오류 (${res.status}): ${errBody.substring(0, 200)}`)
    }

    const data = await res.json()
    const candidate = data.candidates?.[0]
    if (!candidate?.content?.parts?.[0]?.text) {
      const reason = candidate?.finishReason || 'UNKNOWN'
      throw new Error(`Gemini 응답이 비어있습니다 (finishReason: ${reason})`)
    }

    return candidate.content.parts[0].text
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI 분석 시간이 초과되었습니다 (45초). 다시 시도해주세요.')
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      throw new Error('AI API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.')
    }
    throw err
  }
}

/**
 * Gemini REST API 스트리밍 호출 (SSE)
 *
 * streamGenerateContent?alt=sse 엔드포인트로 토큰 단위 스트리밍.
 * onChunk 콜백으로 각 텍스트 조각을 실시간 전달.
 * 반환값은 전체 누적 텍스트 (callGemini과 동일한 최종 결과).
 */
export async function callGeminiStream(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096,
  options?: { jsonMode?: boolean; thinkingBudget?: number },
  onChunk?: (delta: string) => void
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const url = `${GEMINI_API_BASE}/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`

  const thinkingBudget = options?.thinkingBudget ?? 1024

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
      ...(options?.jsonMode && { responseMimeType: 'application/json' }),
      thinkingConfig: {
        thinkingBudget: thinkingBudget,
      },
    },
  }

  try {
    const controller = new AbortController()
    // 스트리밍은 전체 완료까지 시간이 필요 (thinking + 긴 콘텐츠 출력)
    const timer = setTimeout(() => controller.abort(), 120000)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      clearTimeout(timer)
      const errBody = await res.text()
      if (res.status === 429 || errBody.includes('quota') || errBody.includes('Too Many Requests')) {
        throw new Error('AI API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.')
      }
      throw new Error(`Gemini API 오류 (${res.status}): ${errBody.substring(0, 200)}`)
    }

    if (!res.body) {
      clearTimeout(timer)
      throw new Error('Gemini 스트리밍 응답 body가 없습니다.')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE 이벤트는 빈 줄(\n\n)로 구분
        const events = buffer.split('\n')
        buffer = events.pop() || ''

        for (const line of events) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const jsonStr = trimmed.slice(6)
          if (jsonStr === '[DONE]') continue

          try {
            const data = JSON.parse(jsonStr)
            const parts = data.candidates?.[0]?.content?.parts || []
            for (const part of parts) {
              // thinking 토큰 건너뛰기
              if (part.thought) continue
              if (part.text) {
                fullText += part.text
                onChunk?.(part.text)
              }
            }
          } catch {
            // SSE 라인 파싱 실패 시 무시
          }
        }
      }
    } finally {
      clearTimeout(timer)
    }

    if (!fullText) {
      throw new Error('Gemini 스트리밍 응답이 비어있습니다.')
    }

    return fullText
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI 응답 시간이 초과되었습니다 (120초). 다시 시도해주세요.')
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      throw new Error('AI API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.')
    }
    throw err
  }
}

/**
 * Gemini Vision API: 이미지 URL 목록을 분석
 * 이미지를 fetch → base64 → Gemini에 전달
 *
 * @param imageUrls 분석할 이미지 URL 배열 (최대 10장)
 * @param prompt 분석 지시문
 * @returns AI 분석 텍스트
 */
export async function analyzeImagesWithGemini(
  imageUrls: string[],
  prompt: string,
  options?: { maxImages?: number; thinkingBudget?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')

  const maxImages = options?.maxImages ?? 10
  const urls = imageUrls.slice(0, maxImages)

  // 이미지 URL → base64 병렬 변환 (실패한 이미지는 건너뜀)
  const imageParts: { inline_data: { mime_type: string; data: string } }[] = []
  const fetchResults = await Promise.allSettled(
    urls.map(async (url) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Referer': 'https://m.blog.naver.com/' },
        })
        if (!res.ok) return null
        const contentType = res.headers.get('content-type') || 'image/jpeg'
        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        return { mime_type: contentType.split(';')[0], data: base64 }
      } finally {
        clearTimeout(timer)
      }
    })
  )

  for (const result of fetchResults) {
    if (result.status === 'fulfilled' && result.value) {
      imageParts.push({ inline_data: result.value })
    }
  }

  if (imageParts.length === 0) {
    return '이미지를 가져올 수 없어 분석을 건너뛰었습니다.'
  }

  const url = `${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`
  const body = {
    contents: [{
      role: 'user',
      parts: [
        ...imageParts,
        { text: prompt },
      ],
    }],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.3,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: options?.thinkingBudget ?? 0 },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error('[GeminiVision] API 오류:', res.status, errBody.substring(0, 200))
    throw new Error(`Gemini Vision API 오류 (${res.status})`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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

  const client = new Anthropic({ apiKey, timeout: 45000 })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    if (message.stop_reason === 'max_tokens') {
      console.warn(`[callClaude] 응답이 max_tokens(${maxTokens})에서 잘렸습니다.`)
    }

    const block = message.content[0]
    if (block.type === 'text') {
      return block.text
    }
    throw new Error('Claude 응답에서 텍스트를 찾을 수 없습니다.')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('AbortError')) {
      throw new Error('AI 분석 시간이 초과되었습니다 (45초). 다시 시도해주세요.')
    }
    if (msg.includes('429') || msg.includes('rate') || msg.includes('Too Many Requests')) {
      throw new Error('AI API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.')
    }
    throw err
  }
}

/**
 * Claude API 스트리밍 호출
 *
 * Anthropic SDK의 stream() 메서드로 토큰 단위 스트리밍.
 * onChunk 콜백으로 각 텍스트 조각을 실시간 전달.
 * 반환값은 전체 누적 텍스트 (callClaude와 동일한 최종 결과).
 */
export async function callClaudeStream(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096,
  options?: { jsonMode?: boolean },
  onChunk?: (delta: string) => void
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.')
  }

  const client = new Anthropic({ apiKey, timeout: 120000 })

  try {
    let fullText = ''

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text
        onChunk?.(event.delta.text)
      }
    }

    if (!fullText) {
      throw new Error('Claude 스트리밍 응답이 비어있습니다.')
    }

    return fullText
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('AbortError')) {
      throw new Error('AI 응답 시간이 초과되었습니다 (120초). 다시 시도해주세요.')
    }
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
  options?: { jsonMode?: boolean; thinkingBudget?: number }
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
