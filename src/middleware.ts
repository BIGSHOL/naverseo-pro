import { type NextRequest, NextResponse } from 'next/server'

// === 봇 감지용 User-Agent 패턴 ===
const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
  /python-requests/i, /httpie/i, /postman/i, /insomnia/i,
  /axios/i, /node-fetch/i, /go-http-client/i,
  /GPTBot/i, /ChatGPT/i, /CCBot/i, /ClaudeBot/i,
  /anthropic/i, /Bytespider/i, /Google-Extended/i,
  /DotBot/i, /SemrushBot/i, /AhrefsBot/i, /MJ12bot/i,
]

// 검색엔진 봇 중 랜딩에 허용할 것들
const ALLOWED_SEARCH_BOTS = [
  /Googlebot/i, /Yeti/i, /Bingbot/i, /NaverBot/i,
]

// === API Rate Limiting (IP 기반, 인메모리) ===
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const API_RATE_LIMIT = 60       // 분당 최대 요청
const API_RATE_WINDOW = 60_000  // 1분 (ms)
const CLEANUP_INTERVAL = 300_000 // 5분마다 만료 엔트리 정리
let lastCleanup = Date.now()

function isRateLimited(ip: string): boolean {
  const now = Date.now()

  // 주기적으로 만료된 엔트리 정리 (메모리 누수 방지)
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    const expiredKeys: string[] = []
    rateLimitMap.forEach((val, key) => {
      if (now > val.resetAt) expiredKeys.push(key)
    })
    expiredKeys.forEach(key => rateLimitMap.delete(key))
    lastCleanup = now
  }

  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + API_RATE_WINDOW })
    return false
  }

  entry.count++
  return entry.count > API_RATE_LIMIT
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ua = request.headers.get('user-agent') || ''
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  // --- 1) API 보호: Rate Limit + 봇 차단 ---
  if (pathname.startsWith('/api/')) {
    // Webhook 엔드포인트는 외부 서비스에서 호출하므로 봇 차단 제외
    if (pathname.startsWith('/api/webhooks/')) {
      return NextResponse.next()
    }

    // 봇이 API 호출 시 차단
    const isBot = BOT_PATTERNS.some((p) => p.test(ua))
    if (isBot) {
      return NextResponse.json(
        { error: '접근이 차단되었습니다.' },
        { status: 403 }
      )
    }

    // User-Agent 없으면 차단
    if (!ua || ua.length < 10) {
      return NextResponse.json(
        { error: '잘못된 요청입니다.' },
        { status: 400 }
      )
    }

    // Rate Limit 체크
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
        { status: 429 }
      )
    }
  }

  // --- 2) 대시보드 페이지 봇 차단 ---
  const protectedFromBots = [
    '/dashboard', '/keywords', '/content', '/seo-check',
    '/tracking', '/report', '/settings', '/competitors',
    '/blog-index', '/opportunities', '/admin',
    '/credits', '/billing', '/post-check', '/instagram',
    '/keywords-bulk', '/learning',
  ]
  const isProtectedPage = protectedFromBots.some((p) => pathname.startsWith(p))

  if (isProtectedPage) {
    const isBot = BOT_PATTERNS.some((p) => p.test(ua))
    if (isBot) {
      return new NextResponse('Not Found', { status: 404 })
    }
  }

  // --- 3) 랜딩/공개 페이지: 검색엔진 봇만 허용, 스크래퍼 차단 ---
  const publicPages = ['/', '/terms', '/privacy']
  const isPublicPage = publicPages.includes(pathname)

  if (isPublicPage) {
    const isBot = BOT_PATTERNS.some((p) => p.test(ua))
    const isAllowedBot = ALLOWED_SEARCH_BOTS.some((p) => p.test(ua))

    if (isBot && !isAllowedBot) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // --- 4) 기존 Supabase 인증 미들웨어 ---
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  try {
    const { updateSession } = await import('@/lib/supabase/middleware')
    return await updateSession(request)
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
