/**
 * 콘텐츠 첨부 자료 사전 검증 유틸
 *
 * 목적: 유효하지 않은 입력을 AI API 호출 전에 차단하여 비용 절감
 */

// ===== 상수 =====

export const REF_MATERIAL_MAX_CHARS = 5000
export const REF_MATERIAL_MIN_CHARS = 50
export const PDF_MAX_SIZE = 5 * 1024 * 1024 // 5MB
export const TXT_MAX_SIZE = 500 * 1024 // 500KB
export const IMAGE_MAX_SIZE = 5 * 1024 * 1024 // 5MB
export const IMAGE_MIN_SIZE = 1024 // 1KB
export const MAX_ATTACHED_IMAGES = 5
export const IMAGE_DESC_MIN_LENGTH = 2
export const MAX_ATTACHED_DOCS = 5
export const DOC_MAX_SIZE = 10 * 1024 * 1024 // 10MB
export const SUPPORTED_DOC_EXTENSIONS = ['.txt', '.pdf', '.docx', '.pptx'] as const
export const SUPPORTED_DOC_ACCEPT = '.txt,.pdf,.docx,.pptx'

// ===== 타입 =====

export interface ValidationResult {
  valid: boolean
  error?: string // 에러 메시지 (차단 시)
  warning?: string // 경고 메시지 (허용하되 알림)
}

// ===== 공용 헬퍼 =====

/** 이모지 비율 계산 */
function getEmojiRatio(text: string): number {
  if (!text) return 0
  // 이모지 범위: 이모지 표현, 기호, 변형 셀렉터 등
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu
  const emojis = text.match(emojiRegex) || []
  const nonSpace = text.replace(/\s/g, '')
  if (nonSpace.length === 0) return 1
  return emojis.length / nonSpace.length
}

/** 한국어/영어/숫자 비율 계산 */
function getReadableRatio(text: string): number {
  if (!text) return 0
  const nonSpace = text.replace(/\s/g, '')
  if (nonSpace.length === 0) return 0
  // 한국어 (가-힣, ㄱ-ㅎ, ㅏ-ㅣ) + 영어 (a-zA-Z) + 숫자 (0-9) + 기본 문장부호
  const readable = nonSpace.match(/[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9.,!?;:'"()\-/]/g) || []
  return readable.length / nonSpace.length
}

/** 반복 문자 감지 (같은 문자 N회 이상 연속) */
function hasExcessiveRepetition(text: string, threshold = 10): boolean {
  const regex = new RegExp(`(.)\\1{${threshold - 1},}`)
  return regex.test(text)
}

// ===== 참고 자료 텍스트 검증 =====

export function validateReferenceText(text: string): ValidationResult {
  const trimmed = text.trim()

  // 빈 문자열
  if (!trimmed) {
    return { valid: false, error: '내용을 입력해주세요.' }
  }

  // 이모티콘만
  if (getEmojiRatio(trimmed) > 0.5) {
    return { valid: false, error: '의미 있는 텍스트를 입력해주세요. 이모티콘만으로는 참고 자료로 사용할 수 없습니다.' }
  }

  // 알 수 없는 언어
  if (getReadableRatio(trimmed) < 0.3) {
    return { valid: false, error: '인식할 수 없는 텍스트입니다. 한국어 또는 영어로 작성된 참고 자료를 입력해주세요.' }
  }

  // 반복 문자열
  if (hasExcessiveRepetition(trimmed)) {
    return { valid: false, error: '의미 있는 내용을 입력해주세요. 반복된 문자열은 참고 자료로 사용할 수 없습니다.' }
  }

  // 너무 짧음
  if (trimmed.length < REF_MATERIAL_MIN_CHARS) {
    return { valid: false, error: `참고 자료가 너무 짧습니다. 최소 ${REF_MATERIAL_MIN_CHARS}자 이상 입력해주세요.` }
  }

  // 글자수 초과 (자동 잘림이므로 warning)
  if (trimmed.length > REF_MATERIAL_MAX_CHARS) {
    return { valid: true, warning: `${REF_MATERIAL_MAX_CHARS.toLocaleString()}자까지만 사용됩니다. (현재 ${trimmed.length.toLocaleString()}자)` }
  }

  return { valid: true }
}

// ===== PDF 텍스트 검증 =====

export function validatePdfText(text: string): ValidationResult {
  const trimmed = text.trim()

  // OCR 미처리 (텍스트 없음)
  if (!trimmed) {
    return { valid: false, error: '이미지 기반 PDF입니다. OCR 처리된 PDF를 첨부해주세요.' }
  }

  // OCR 미처리 (텍스트 너무 적음)
  if (trimmed.length < REF_MATERIAL_MIN_CHARS) {
    return { valid: false, error: `PDF에서 추출된 텍스트가 너무 적습니다 (${trimmed.length}자). 이미지 기반 PDF일 수 있습니다. OCR 처리된 PDF를 첨부해주세요.` }
  }

  // 깨진 문자
  if (getReadableRatio(trimmed) < 0.3) {
    return { valid: false, error: 'PDF 텍스트를 인식할 수 없습니다. 다른 PDF 파일을 시도하거나 텍스트를 직접 붙여넣어주세요.' }
  }

  // 이모티콘만
  if (getEmojiRatio(trimmed) > 0.5) {
    return { valid: false, error: 'PDF에서 유효한 텍스트를 추출할 수 없습니다.' }
  }

  return { valid: true }
}

// ===== 이미지 설명 검증 =====

export function validateImageDescription(description: string): ValidationResult {
  const trimmed = description.trim()

  if (!trimmed) {
    return { valid: false, error: '설명을 입력해야 AI가 이미지를 배치할 수 있습니다.' }
  }

  if (trimmed.length < IMAGE_DESC_MIN_LENGTH) {
    return { valid: false, error: '설명이 너무 짧습니다. 2자 이상 입력해주세요.' }
  }

  if (getEmojiRatio(trimmed) > 0.5) {
    return { valid: false, error: '의미 있는 설명을 입력해주세요. 이모티콘만으로는 배치할 수 없습니다.' }
  }

  if (getReadableRatio(trimmed) < 0.3) {
    return { valid: false, error: '인식할 수 없는 설명입니다. 한국어 또는 영어로 입력해주세요.' }
  }

  return { valid: true }
}

// ===== 이미지 파일 검증 =====

export function validateImageFile(file: File): ValidationResult {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: '이미지 파일만 첨부할 수 있습니다.' }
  }

  if (file.size > IMAGE_MAX_SIZE) {
    return { valid: false, error: `이미지는 ${Math.round(IMAGE_MAX_SIZE / 1024 / 1024)}MB 이하만 가능합니다. (${file.name})` }
  }

  if (file.size < IMAGE_MIN_SIZE) {
    return { valid: false, error: `유효하지 않은 이미지 파일입니다. (${file.name})` }
  }

  return { valid: true }
}

// ===== TXT 파일 검증 =====

export function validateTxtFile(file: File): ValidationResult {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    return { valid: false, error: 'TXT 파일만 지원합니다.' }
  }

  if (file.size > TXT_MAX_SIZE) {
    return { valid: false, error: `TXT 파일은 ${Math.round(TXT_MAX_SIZE / 1024)}KB 이하만 가능합니다.` }
  }

  return { valid: true }
}

// ===== PDF 파일 검증 =====

export function validatePdfFile(file: File): ValidationResult {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'PDF 파일만 지원합니다.' }
  }

  if (file.size > PDF_MAX_SIZE) {
    return { valid: false, error: `PDF 파일은 ${Math.round(PDF_MAX_SIZE / 1024 / 1024)}MB 이하만 가능합니다.` }
  }

  return { valid: true }
}

// ===== 문서 파일 검증 (통합) =====

export function validateDocFile(file: File): ValidationResult {
  const name = file.name.toLowerCase()
  const ext = '.' + name.split('.').pop()

  // 구형 Office 형식 안내
  if (ext === '.doc' || ext === '.ppt') {
    return { valid: false, error: `${ext.toUpperCase()} 파일은 지원하지 않습니다. Microsoft Office에서 '다른 이름으로 저장' → ${ext}x 형식으로 변환 후 다시 시도해주세요.` }
  }

  if (!SUPPORTED_DOC_EXTENSIONS.includes(ext as typeof SUPPORTED_DOC_EXTENSIONS[number])) {
    return { valid: false, error: `지원하지 않는 파일 형식입니다. (${SUPPORTED_DOC_EXTENSIONS.join(', ')})` }
  }

  if (file.size > DOC_MAX_SIZE) {
    return { valid: false, error: `문서 파일은 ${Math.round(DOC_MAX_SIZE / 1024 / 1024)}MB 이하만 가능합니다.` }
  }

  if (file.size < 10) {
    return { valid: false, error: '빈 파일입니다.' }
  }

  return { valid: true }
}

// ===== 추출 텍스트 검증 (PDF/DOCX/PPTX 공통) =====

export function validateExtractedText(text: string, fileName: string): ValidationResult {
  const trimmed = text.trim()

  if (!trimmed) {
    return { valid: false, error: `${fileName}에서 텍스트를 추출할 수 없습니다. 이미지 기반 문서일 수 있습니다.` }
  }

  if (trimmed.length < REF_MATERIAL_MIN_CHARS) {
    return { valid: false, error: `${fileName}에서 추출된 텍스트가 너무 적습니다 (${trimmed.length}자). 이미지 기반 문서일 수 있습니다.` }
  }

  if (getReadableRatio(trimmed) < 0.3) {
    return { valid: false, error: `${fileName}의 텍스트를 인식할 수 없습니다. 다른 파일을 시도해주세요.` }
  }

  return { valid: true }
}
