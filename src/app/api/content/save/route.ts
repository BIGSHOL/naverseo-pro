import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeSeo } from '@/lib/content/engine'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { contentId, title, content } = await request.json()

    if (!contentId) {
      return NextResponse.json({ error: '콘텐츠 ID가 필요합니다.' }, { status: 400 })
    }

    // 소유권 확인
    const { data: existing } = await supabase
      .from('generated_content')
      .select('id, user_id, target_keyword')
      .eq('id', contentId)
      .single()

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: '콘텐츠를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content

    // 콘텐츠가 변경되면 SEO 점수 재계산
    if (content !== undefined) {
      const seoResult = analyzeSeo(
        existing.target_keyword,
        title || existing.target_keyword,
        content
      )
      updateData.seo_score = seoResult.totalScore
    }

    const { error: updateError } = await supabase
      .from('generated_content')
      .update(updateData)
      .eq('id', contentId)

    if (updateError) {
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      seoScore: updateData.seo_score,
    })
  } catch (error) {
    console.error('[Content Save] 오류:', error)
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
