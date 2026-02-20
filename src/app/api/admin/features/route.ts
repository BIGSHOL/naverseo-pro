import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'
import { TOGGLEABLE_FEATURES } from '@/lib/features'

/** 비활성화된 기능 목록 조회 */
export async function GET() {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'disabled_features')
      .single()

    const disabledKeys: string[] = data?.value || []

    // 각 기능의 활성화/비활성화 상태를 포함하여 반환
    const features = TOGGLEABLE_FEATURES.map((f) => ({
      ...f,
      enabled: !disabledKeys.includes(f.key),
    }))

    return NextResponse.json({ features, disabledKeys })
  } catch (error) {
    console.error('[Admin Features] 조회 오류:', error)
    return NextResponse.json(
      { error: '기능 설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/** 기능 활성화/비활성화 토글 */
export async function PATCH(request: Request) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { key, enabled } = body as { key: string; enabled: boolean }

    if (!key || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: '기능 키와 활성화 상태가 필요합니다.' },
        { status: 400 }
      )
    }

    // 유효한 기능 키인지 확인
    const validKeys = TOGGLEABLE_FEATURES.map((f) => f.key)
    if (!validKeys.includes(key)) {
      return NextResponse.json(
        { error: '유효하지 않은 기능 키입니다.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 현재 비활성화 목록 가져오기
    const { data: current } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'disabled_features')
      .single()

    let disabledKeys: string[] = current?.value || []

    if (enabled) {
      // 활성화: 목록에서 제거
      disabledKeys = disabledKeys.filter((k: string) => k !== key)
    } else {
      // 비활성화: 목록에 추가
      if (!disabledKeys.includes(key)) {
        disabledKeys.push(key)
      }
    }

    // 테이블에 행이 없으면 upsert
    const { error: upsertError } = await supabase
      .from('system_settings')
      .upsert(
        { key: 'disabled_features', value: disabledKeys, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )

    if (upsertError) {
      console.error('[Admin Features] 저장 오류:', upsertError)
      return NextResponse.json(
        { error: '기능 설정 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const featureName = TOGGLEABLE_FEATURES.find((f) => f.key === key)?.label || key
    return NextResponse.json({
      success: true,
      disabledKeys,
      message: `${featureName} 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`,
    })
  } catch (error) {
    console.error('[Admin Features] 수정 오류:', error)
    return NextResponse.json(
      { error: '기능 설정 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
