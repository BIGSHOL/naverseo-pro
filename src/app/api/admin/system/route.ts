import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { CREDIT_COSTS } from '@/lib/credit-check'
import { PLAN_CREDITS } from '@/types/database'

export async function GET() {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    // API 키 설정 상태 확인 (값 자체는 노출하지 않음)
    const apiStatus = {
      naverSearchAd: {
        name: '네이버 검색광고 API',
        configured: !!(
          process.env.NAVER_AD_API_KEY &&
          process.env.NAVER_AD_SECRET_KEY &&
          process.env.NAVER_AD_CUSTOMER_ID
        ),
      },
      naverOpenApi: {
        name: '네이버 Open API',
        configured: !!(
          process.env.NAVER_CLIENT_ID &&
          process.env.NAVER_CLIENT_SECRET
        ),
      },
      gemini: {
        name: 'Google Gemini',
        configured: !!process.env.GEMINI_API_KEY,
      },
      claude: {
        name: 'Anthropic Claude',
        configured: !!process.env.ANTHROPIC_API_KEY,
      },
      lemonSqueezy: {
        name: 'LemonSqueezy',
        configured: !!(
          process.env.LEMONSQUEEZY_API_KEY &&
          process.env.LEMONSQUEEZY_STORE_ID
        ),
      },
      supabase: {
        name: 'Supabase',
        configured: !!(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
          process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
      },
    }

    return NextResponse.json({
      apiStatus,
      creditCosts: CREDIT_COSTS,
      planCredits: PLAN_CREDITS,
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        vercelEnv: process.env.VERCEL_ENV || 'local',
      },
    })
  } catch (error) {
    console.error('[Admin System] 오류:', error)
    return NextResponse.json(
      { error: '시스템 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
