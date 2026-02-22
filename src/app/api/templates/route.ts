import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - 사용자의 템플릿 목록 조회
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { data: templates, error } = await supabase
      .from('content_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Templates GET] 오류:', errorMessage)
    return NextResponse.json(
      { error: `템플릿 목록을 가져오는 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// POST - 새 템플릿 저장
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, description, advancedOptions } = body

    // 입력 검증
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: '템플릿 이름을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!advancedOptions || typeof advancedOptions !== 'object') {
      return NextResponse.json(
        { error: '저장할 옵션 데이터가 없습니다.' },
        { status: 400 }
      )
    }

    // 템플릿 저장
    const { data: template, error } = await supabase
      .from('content_templates')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        advanced_options: advancedOptions,
      })
      .select()
      .single()

    if (error) {
      // 템플릿 개수 제한 에러 처리
      if (error.message.includes('최대 5개')) {
        return NextResponse.json(
          { error: '템플릿은 최대 5개까지만 저장할 수 있습니다. 기존 템플릿을 삭제한 후 다시 시도해주세요.' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({ template })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Templates POST] 오류:', errorMessage)
    return NextResponse.json(
      { error: `템플릿을 저장하는 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// DELETE - 템플릿 삭제
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('id')

    if (!templateId) {
      return NextResponse.json(
        { error: '템플릿 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('content_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', user.id) // 본인 템플릿만 삭제 가능

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Templates DELETE] 오류:', errorMessage)
    return NextResponse.json(
      { error: `템플릿을 삭제하는 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
