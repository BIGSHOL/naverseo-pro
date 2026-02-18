import { NextResponse } from 'next/server'

// 기존 콘텐츠의 SEO 점수를 일괄 재계산
function calculateBasicSeoScore(keyword: string, title: string, content: string): number {
  let score = 0

  // 1. 제목 최적화 (20점)
  const titleHasKeyword = title.includes(keyword)
  const titleLength = title.length
  if (titleHasKeyword) score += 10
  if (titleLength >= 15 && titleLength <= 50) score += 10
  else if (titleLength >= 10) score += 5

  // 2. 구조 (20점)
  const hasH2 = content.includes('## ')
  const hasH3 = content.includes('### ')
  const headingCount = (content.match(/^#{2,3}\s/gm) || []).length
  if (hasH2) score += 8
  if (hasH3) score += 4
  if (headingCount >= 3) score += 8
  else if (headingCount >= 1) score += 4

  // 3. 키워드 밀도 (20점)
  const keywordCount = content.split(keyword).length - 1
  const contentLength = content.length
  if (keywordCount >= 3 && keywordCount <= 15) score += 15
  else if (keywordCount >= 1) score += 8
  if (contentLength > 0 && keywordCount / (contentLength / 100) < 3) score += 5

  // 4. 콘텐츠 품질 (20점)
  if (contentLength >= 2000) score += 15
  else if (contentLength >= 1000) score += 10
  else if (contentLength >= 500) score += 5
  const hasImages = content.includes('[이미지')
  if (hasImages) score += 5

  // 5. 가독성 (20점)
  const paragraphs = content.split('\n\n').filter(p => p.trim()).length
  if (paragraphs >= 5) score += 10
  else if (paragraphs >= 3) score += 5
  const hasList = content.includes('- ') || content.includes('1. ')
  if (hasList) score += 5
  const hasBold = content.includes('**')
  if (hasBold) score += 5

  return Math.min(100, score)
}

export async function POST() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // seo_score가 null인 콘텐츠 조회
    const { data: contents, error } = await supabase
      .from('generated_content')
      .select('id, target_keyword, title, content')
      .eq('user_id', user.id)
      .is('seo_score', null)

    if (error) {
      return NextResponse.json({ error: 'DB 조회 실패' }, { status: 500 })
    }

    if (!contents || contents.length === 0) {
      return NextResponse.json({ message: '업데이트할 콘텐츠가 없습니다.', updated: 0 })
    }

    let updated = 0
    for (const c of contents) {
      const seoScore = calculateBasicSeoScore(c.target_keyword, c.title, c.content)
      const { error: updateError } = await supabase
        .from('generated_content')
        .update({ seo_score: seoScore })
        .eq('id', c.id)

      if (!updateError) updated++
    }

    return NextResponse.json({
      message: `${updated}개의 콘텐츠 SEO 점수가 업데이트되었습니다.`,
      updated,
      total: contents.length,
    })
  } catch (error) {
    console.error('[Recalculate SEO] 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
