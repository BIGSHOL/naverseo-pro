import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 블로그 정보 등록/업데이트
export async function POST(req: Request) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { blogUrl } = await req.json()

    if (!blogUrl || !blogUrl.trim()) {
      return NextResponse.json({ error: '블로그 URL을 입력해주세요.' }, { status: 400 })
    }

    // 1. 중복 등록 확인 - 다른 사용자가 이미 등록한 블로그인지 확인
    const { data: existingBlog } = await supabase
      .from('profiles')
      .select('id, blog_url, blog_name')
      .eq('blog_url', blogUrl.trim())
      .neq('id', user.id)
      .single()

    if (existingBlog) {
      return NextResponse.json(
        { error: `이 블로그는 이미 다른 사용자가 등록했습니다. (${existingBlog.blog_name || '알 수 없는 블로그'})` },
        { status: 400 }
      )
    }

    // 2. 블로그 지수 측정 API 호출 (내부 API) - 블로그 존재 여부 및 접근 가능 여부 확인
    const blogIndexResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/blog-index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blogUrl, keywords: '' }),
    })

    if (!blogIndexResponse.ok) {
      const errorData = await blogIndexResponse.json()
      const errorMsg = errorData.error || '블로그 정보를 가져올 수 없습니다.'

      // 블로그를 찾을 수 없는 경우 더 친절한 메시지
      if (errorMsg.includes('찾을 수 없습니다') || errorMsg.includes('존재하지 않습니다')) {
        return NextResponse.json(
          { error: '블로그를 찾을 수 없습니다. URL이 정확한지, 블로그가 공개 상태인지 확인해주세요.' },
          { status: 400 }
        )
      }

      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    const blogData = await blogIndexResponse.json()

    // 블로그 ID 추출
    const blogId = blogData.blogId || extractBlogId(blogUrl)

    // 3. 소유권 인증 코드 생성 (6자리 영숫자)
    const verificationCode = generateVerificationCode()

    // profiles 테이블 업데이트
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        blog_url: blogUrl,
        blog_id: blogId,
        blog_name: blogData.blogProfile?.blogName || blogId,
        blog_thumbnail: blogData.blogProfile?.thumbnail || null,
        blog_total_posts: blogData.blogProfile?.totalPosts || blogData.postAnalysis?.totalFound || 0,
        blog_score: blogData.totalScore || 0,
        blog_level: blogData.level?.label || '',
        blog_category_keywords: blogData.blogProfile?.categoryKeywords || [],
        blog_last_post_date: blogData.postAnalysis?.recentPostDays !== null
          ? new Date(Date.now() - blogData.postAnalysis.recentPostDays * 24 * 60 * 60 * 1000).toISOString()
          : null,
        blog_updated_at: new Date().toISOString(),
        blog_verification_code: verificationCode,
        blog_verification_code_created_at: new Date().toISOString(),
        blog_verification_attempts: 0,
        blog_verification_last_attempt_at: null,
        blog_verification_blocked: false,
        blog_verified: false,
        blog_verified_at: null,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Blog Profile] 업데이트 실패:', updateError)
      return NextResponse.json({ error: '블로그 정보 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      verificationCode,
      needsVerification: true,
      blogProfile: {
        blogUrl,
        blogId,
        blogName: blogData.blogProfile?.blogName || blogId,
        blogScore: blogData.totalScore || 0,
        blogLevel: blogData.level?.label || '',
        totalPosts: blogData.blogProfile?.totalPosts || 0,
      },
    })
  } catch (error) {
    console.error('[Blog Profile] 오류:', error)
    return NextResponse.json({ error: '블로그 등록 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 블로그 정보 삭제
export async function DELETE() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        blog_url: null,
        blog_id: null,
        blog_name: null,
        blog_thumbnail: null,
        blog_total_posts: 0,
        blog_score: 0,
        blog_level: null,
        blog_category_keywords: [],
        blog_last_post_date: null,
        blog_updated_at: null,
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: '블로그 정보 삭제에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Blog Profile] 삭제 오류:', error)
    return NextResponse.json({ error: '블로그 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 블로그 URL에서 ID 추출
function extractBlogId(url: string): string | null {
  const match = url.match(/blog\.naver\.com\/([^/?]+)/)
  return match ? match[1] : null
}

// 6자리 인증 코드 생성 (영숫자 대문자)
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
