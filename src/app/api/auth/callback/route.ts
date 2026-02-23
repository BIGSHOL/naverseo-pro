import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = createClient()
      const { error, data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

      if (!error && sessionData?.user) {
        // 추천인 코드 처리 (가입 시 입력한 경우)
        const referralCodeUsed = sessionData.user.user_metadata?.referral_code_used
        if (referralCodeUsed) {
          try {
            const { createAdminClient } = await import('@/lib/supabase/admin')
            const { processReferral } = await import('@/lib/referral')
            const adminDb = createAdminClient()
            await processReferral(adminDb, sessionData.user.id, referralCodeUsed)
          } catch (refError) {
            // 추천 처리 실패해도 로그인은 차단하지 않음
            console.error('[Auth Callback] 추천인 처리 오류:', refError)
          }
        }
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (error) {
      console.error('[Auth Callback] 오류:', error)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
