import { NextRequest, NextResponse } from 'next/server'
import { validateExtractedText } from '@/lib/content/validators'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_TEXT_LENGTH = 5000

const SUPPORTED_EXTENSIONS = ['.txt', '.pdf', '.docx', '.pptx']

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

    const name = file.name.toLowerCase()
    const ext = '.' + name.split('.').pop()

    // 구형 Office 형식
    if (ext === '.doc' || ext === '.ppt') {
      return NextResponse.json(
        { error: `${ext.toUpperCase()} 파일은 지원하지 않습니다. '다른 이름으로 저장' → ${ext}x 형식으로 변환해주세요.` },
        { status: 400 }
      )
    }

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `지원하지 않는 파일 형식입니다. (${SUPPORTED_EXTENSIONS.join(', ')})` },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일은 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB 이하만 가능합니다.` },
        { status: 400 }
      )
    }

    let rawText = ''

    switch (ext) {
      case '.txt':
        rawText = await parseTxt(file)
        break
      case '.pdf':
        rawText = await parsePdf(file)
        break
      case '.docx':
        rawText = await parseDocx(file)
        break
      case '.pptx':
        rawText = await parsePptx(file)
        break
    }

    // 추출 텍스트 검증
    const validation = validateExtractedText(rawText, file.name)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

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
    console.error('[Document Parse] 오류:', error)
    const message = error instanceof Error ? error.message : ''
    if (message.includes('Invalid PDF') || message.includes('structure')) {
      return NextResponse.json({ error: '유효하지 않은 PDF 파일입니다.' }, { status: 400 })
    }
    if (message.includes('password') || message.includes('Password')) {
      return NextResponse.json({ error: '암호가 설정된 문서는 지원하지 않습니다.' }, { status: 400 })
    }
    if (message.includes('End of Central Directory')) {
      return NextResponse.json({ error: '손상된 파일입니다. 다른 파일을 시도해주세요.' }, { status: 400 })
    }
    return NextResponse.json(
      { error: '문서 파싱 중 오류가 발생했습니다. 다른 파일을 시도해주세요.' },
      { status: 500 }
    )
  }
}

// === TXT 파싱 ===
async function parseTxt(file: File): Promise<string> {
  return (await file.text()).trim()
}

// === PDF 파싱 (pdf-parse v2) ===
async function parsePdf(file: File): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const buffer = Buffer.from(await file.arrayBuffer())
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const textResult = await parser.getText()
    return textResult.pages
      .map((page: { text: string }) => page.text)
      .join('\n')
      .trim()
  } finally {
    await parser.destroy()
  }
}

// === DOCX 파싱 (mammoth) ===
async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim()
}

// === PPTX 파싱 (JSZip → XML 텍스트 추출) ===
async function parsePptx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  // ppt/slides/slide1.xml, slide2.xml, ... 순서대로 읽기
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0')
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0')
      return numA - numB
    })

  const texts: string[] = []
  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async('text')
    // XML에서 <a:t>텍스트</a:t> 추출
    const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g)
    if (matches) {
      const slideTexts = matches
        .map(m => m.replace(/<\/?a:t>/g, '').trim())
        .filter(Boolean)
      if (slideTexts.length > 0) {
        texts.push(slideTexts.join(' '))
      }
    }
  }

  return texts.join('\n').trim()
}
