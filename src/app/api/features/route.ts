import { NextResponse } from 'next/server'

// API Route는 항상 동적으로 실행 (cookies 사용으로 인한 정적 빌드 방지)
export const dynamic = 'force-dynamic'

/**
 * 공개 API: 비활성화된 기능 목록 조회
 * 인증 불필요 - 모든 클라이언트에서 기능 상태 확인용
 */
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()

    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'disabled_features')
      .single()

    return NextResponse.json({
      disabledFeatures: data?.value || [],
    })
  } catch {
    // 테이블이 없거나 오류 시 모든 기능 활성화 상태로 반환
    return NextResponse.json({
      disabledFeatures: [],
    })
  }
}
