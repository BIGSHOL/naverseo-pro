/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 보안 헤더
  async headers() {
    return [
      {
        // 모든 페이지에 적용
        source: '/(.*)',
        headers: [
          // iframe 삽입 방지 (클릭재킹 차단)
          { key: 'X-Frame-Options', value: 'DENY' },
          // MIME 스니핑 방지
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer 정보 최소화
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 권한 정책 (카메라/마이크 등 차단)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HTTPS 강제 (1년, 서브도메인 포함)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // XSS 방지 CSP
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.lemonsqueezy.com https://assets.lemonsqueezy.com",
              "script-src-elem 'self' 'unsafe-inline' https://app.lemonsqueezy.com https://assets.lemonsqueezy.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
              "connect-src 'self' https://*.supabase.co https://*.google.com https://generativelanguage.googleapis.com https://api.anthropic.com https://api.searchad.naver.com https://openapi.naver.com https://api.lemonsqueezy.com",
              "frame-src https://app.lemonsqueezy.com",
            ].join('; '),
          },
        ],
      },
      {
        // API 엔드포인트 추가 보호
        source: '/api/(.*)',
        headers: [
          // 캐시 금지
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          // 검색엔진 인덱싱 차단
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // 대시보드 페이지 검색엔진 차단
        source: '/(dashboard|keywords|content|seo-check|tracking|report|settings|competitors|blog-index|opportunities|admin|credits|billing|post-check|instagram|keywords-bulk|learning)(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
};

export default nextConfig;
