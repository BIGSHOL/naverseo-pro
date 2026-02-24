import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * 네이버 OAuth 로그인 시작
 * Supabase에서 네이버를 네이티브 지원하지 않으므로 수동 OAuth 구현
 */
export async function GET(request: Request) {
  const clientId = process.env.NAVER_LOGIN_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: '네이버 로그인이 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  const { origin } = new URL(request.url)
  const redirectUri = `${origin}/api/auth/naver/callback`

  // CSRF 방지를 위한 state 생성
  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set('naver_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10분
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  })

  return NextResponse.redirect(
    `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`
  )
}
