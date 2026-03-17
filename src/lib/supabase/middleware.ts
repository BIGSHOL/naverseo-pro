import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 인증이 필요한 페이지 보호
  const protectedPaths = ['/dashboard', '/keywords', '/content', '/seo-check', '/tracking', '/report', '/settings', '/admin', '/competitors', '/blog-index', '/opportunities', '/credits', '/billing', '/post-check', '/instagram', '/keywords-bulk', '/learning', '/banned']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 보호 경로 접근 시 프로필 조회 (차단 확인 + 관리자 체크 통합)
  if (isProtectedPath && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, account_status')
      .eq('id', user.id)
      .single()

    // 차단 사용자: /banned 페이지로 리다이렉트 (admin 제외)
    if (profile?.account_status === 'banned' && profile?.role !== 'admin' && !request.nextUrl.pathname.startsWith('/banned')) {
      const url = request.nextUrl.clone()
      url.pathname = '/banned'
      return NextResponse.redirect(url)
    }

    // 차단되지 않은 사용자가 /banned에 접근하면 대시보드로
    if (profile?.account_status !== 'banned' && request.nextUrl.pathname.startsWith('/banned')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // 관리자 전용 페이지 보호: admin이 아니면 대시보드로 리다이렉트
    if (request.nextUrl.pathname.startsWith('/admin') && profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // 이미 로그인한 사용자가 인증 페이지 접근 시 대시보드로 리다이렉트
  const authPaths = ['/login', '/signup', '/forgot-password']
  const isAuthPath = authPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
