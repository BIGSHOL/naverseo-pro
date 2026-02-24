import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

interface NaverTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  error?: string
  error_description?: string
}

interface NaverProfileResponse {
  resultcode: string
  message: string
  response: {
    id: string
    email?: string
    name?: string
    nickname?: string
    profile_image?: string
  }
}

/**
 * 네이버 OAuth 콜백 처리
 * 1. state 검증 (CSRF 방지)
 * 2. authorization code → access_token 교환
 * 3. 네이버 사용자 정보 조회
 * 4. Supabase 사용자 생성/조회 + 세션 발급
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // 에러 처리
  if (error) {
    console.error('[Naver OAuth] 인증 오류:', error, searchParams.get('error_description'))
    return NextResponse.redirect(`${origin}/login?error=naver_auth_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=naver_missing_params`)
  }

  // state 검증
  const cookieStore = await cookies()
  const savedState = cookieStore.get('naver_oauth_state')?.value
  cookieStore.delete('naver_oauth_state')

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${origin}/login?error=naver_invalid_state`)
  }

  const clientId = process.env.NAVER_LOGIN_CLIENT_ID
  const clientSecret = process.env.NAVER_LOGIN_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?error=naver_not_configured`)
  }

  try {
    // 1. code → access_token 교환
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      state,
    })

    const tokenRes = await fetch(
      `https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`,
      { method: 'GET' }
    )
    const tokenData: NaverTokenResponse = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      console.error('[Naver OAuth] 토큰 교환 실패:', tokenData.error_description)
      return NextResponse.redirect(`${origin}/login?error=naver_token_failed`)
    }

    // 2. 사용자 정보 조회
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profileData: NaverProfileResponse = await profileRes.json()

    if (profileData.resultcode !== '00' || !profileData.response) {
      console.error('[Naver OAuth] 프로필 조회 실패:', profileData.message)
      return NextResponse.redirect(`${origin}/login?error=naver_profile_failed`)
    }

    const naverUser = profileData.response
    const email = naverUser.email

    if (!email) {
      return NextResponse.redirect(`${origin}/login?error=naver_no_email`)
    }

    // 3. Supabase 사용자 생성/조회 + 매직링크 발급
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()

    // 사용자가 없으면 생성 (이미 있으면 에러 무시)
    await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: naverUser.name || naverUser.nickname || '',
        avatar_url: naverUser.profile_image || '',
        provider: 'naver',
        naver_id: naverUser.id,
      },
    })

    // 매직링크 생성 (기존/신규 모두 동작)
    const redirectTo = `${origin}/api/auth/callback?next=/dashboard`
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })

    if (linkError || !linkData) {
      console.error('[Naver OAuth] 매직링크 생성 실패:', linkError)
      return NextResponse.redirect(`${origin}/login?error=naver_link_failed`)
    }

    // 4. Supabase verify 엔드포인트로 리다이렉트 → 세션 생성 → /api/auth/callback → /dashboard
    const actionLink = linkData.properties?.action_link
    if (!actionLink) {
      console.error('[Naver OAuth] action_link 없음')
      return NextResponse.redirect(`${origin}/login?error=naver_link_failed`)
    }

    return NextResponse.redirect(actionLink)
  } catch (err) {
    console.error('[Naver OAuth] 예외:', err)
    return NextResponse.redirect(`${origin}/login?error=naver_unexpected`)
  }
}
