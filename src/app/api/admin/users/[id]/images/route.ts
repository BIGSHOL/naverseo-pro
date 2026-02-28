import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-check'
import { createAdminClient } from '@/lib/supabase/admin'

const PER_PAGE = 20

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const offset = (page - 1) * PER_PAGE

    const adminDb = createAdminClient()

    // Supabase Storage에서 사용자 폴더 내 파일 목록 조회
    const { data: files, error } = await adminDb.storage
      .from('ai-images')
      .list(id, {
        limit: PER_PAGE,
        offset,
        sortBy: { column: 'created_at', order: 'desc' },
      })

    if (error) {
      console.error('[Admin Images] Storage 조회 오류:', error)
      return NextResponse.json(
        { error: '이미지 목록 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 이미지 파일만 필터 (.emptyFolderPlaceholder 등 제외)
    const imageFiles = (files || []).filter(f =>
      f.name && /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)
    )

    // 공개 URL 생성
    const images = imageFiles.map(f => {
      const { data: urlData } = adminDb.storage
        .from('ai-images')
        .getPublicUrl(`${id}/${f.name}`)

      return {
        name: f.name,
        url: urlData?.publicUrl || '',
        size: f.metadata?.size || 0,
        createdAt: f.created_at || '',
      }
    })

    // 전체 파일 수 조회 (대략적 — offset 0으로 1000개까지 카운트)
    let totalCount = images.length + offset
    if (imageFiles.length === PER_PAGE) {
      // 다음 페이지가 있을 수 있음 — 추가 카운트 조회
      const { data: countFiles } = await adminDb.storage
        .from('ai-images')
        .list(id, { limit: 1000, offset: 0 })
      totalCount = (countFiles || []).filter(f =>
        f.name && /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)
      ).length
    }

    return NextResponse.json({
      images,
      page,
      perPage: PER_PAGE,
      totalCount,
      totalPages: Math.ceil(totalCount / PER_PAGE),
    })
  } catch (error) {
    console.error('[Admin Images] 오류:', error)
    return NextResponse.json(
      { error: '이미지 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const body = await request.json()
    const { fileNames } = body as { fileNames: string[] }

    if (!fileNames || fileNames.length === 0) {
      return NextResponse.json({ error: '삭제할 파일을 선택해주세요.' }, { status: 400 })
    }

    const adminDb = createAdminClient()
    const paths = fileNames.map(name => `${id}/${name}`)

    const { error } = await adminDb.storage
      .from('ai-images')
      .remove(paths)

    if (error) {
      console.error('[Admin Images] 삭제 오류:', error)
      return NextResponse.json(
        { error: '이미지 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ deleted: fileNames.length })
  } catch (error) {
    console.error('[Admin Images] 삭제 오류:', error)
    return NextResponse.json(
      { error: '이미지 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
