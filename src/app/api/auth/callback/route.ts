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
        const user = sessionData.user
        const userEmail = user.email || user.user_metadata?.email || ''

        // 프로필 존재 확인 + 없으면 생성 (소셜 로그인 시 트리거 실패 대비)
        try {
          const { createAdminClient } = await import('@/lib/supabase/admin')
          const adminDb = createAdminClient()

          const { data: existingProfile } = await adminDb
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single()

          if (!existingProfile) {
            await adminDb.from('profiles').upsert({
              id: user.id,
              email: userEmail,
              plan: 'free',
              credits_balance: 30,
              credits_monthly_quota: 30,
            }, { onConflict: 'id' })
            console.log('[Auth Callback] 누락된 프로필 생성:', userEmail)
          }

          // 추천인 코드 처리 (가입 시 입력한 경우)
          const referralCodeUsed = user.user_metadata?.referral_code_used
          if (referralCodeUsed) {
            try {
              const { processReferral } = await import('@/lib/referral')
              await processReferral(adminDb, user.id, referralCodeUsed)
            } catch (refError) {
              console.error('[Auth Callback] 추천인 처리 오류:', refError)
            }
          }
        } catch (profileError) {
          // 프로필 처리 실패해도 로그인은 차단하지 않음
          console.error('[Auth Callback] 프로필 확인/생성 오류:', profileError)
        }

        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (error) {
      console.error('[Auth Callback] 오류:', error)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
