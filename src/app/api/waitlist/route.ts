import { NextResponse } from 'next/server'

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// 메모리 기반 임시 저장소 (Supabase 미설정 시 fallback)
const waitlistEmails: Set<string> = new Set()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: '유효한 이메일 주소를 입력해주세요.' },
        { status: 400 }
      )
    }

    // Supabase가 설정되어 있으면 DB에 저장
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )

      const { error } = await supabase
        .from('waitlist')
        .insert({ email })

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: '이미 등록된 이메일입니다.' },
            { status: 409 }
          )
        }
        throw error
      }
    } else {
      // Supabase 미설정 시 메모리에 저장
      if (waitlistEmails.has(email)) {
        return NextResponse.json(
          { error: '이미 등록된 이메일입니다.' },
          { status: 409 }
        )
      }
      waitlistEmails.add(email)
      console.log('[Waitlist] 새 이메일 등록:', email)
    }

    return NextResponse.json(
      { message: '사전 등록이 완료되었습니다!' },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Waitlist] 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
