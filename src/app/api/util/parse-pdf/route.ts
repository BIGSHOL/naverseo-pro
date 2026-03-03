import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { validatePdfText } from '@/lib/content/validators'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const MAX_PDF_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_TEXT_LENGTH = 5000

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'PDF 파일만 지원합니다.' }, { status: 400 })
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: `PDF 파일은 ${Math.round(MAX_PDF_SIZE / 1024 / 1024)}MB 이하만 가능합니다.` },
        { status: 400 }
      )
    }

    // pdf-parse v2: 클래스 기반 API
    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const textResult = await parser.getText()

    // 전체 페이지 텍스트 합치기
    const rawText = textResult.pages
      .map(page => page.text)
      .join('\n')
      .trim()

    await parser.destroy()

    // OCR 미처리 / 깨진 문자 검증
    const validation = validatePdfText(rawText)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 최대 글자수 제한
    const text = rawText.length > MAX_TEXT_LENGTH
      ? rawText.substring(0, MAX_TEXT_LENGTH)
      : rawText

    return NextResponse.json({
      text,
      charCount: text.length,
      truncated: rawText.length > MAX_TEXT_LENGTH,
      originalLength: rawText.length,
      fileName: file.name,
    })
  } catch (error) {
    console.error('[PDF Parse] 오류:', error)
    return NextResponse.json(
      { error: 'PDF 파싱 중 오류가 발생했습니다. 다른 파일을 시도해주세요.' },
      { status: 500 }
    )
  }
}
