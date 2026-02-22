import { NextResponse } from 'next/server'
import { extractBlogId } from '@/lib/utils/text'
import { fetchBlogPosts } from '@/lib/naver/blog-crawler'

export const dynamic = 'force-dynamic'

// 블로그 정보 조회
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('blog_url, blog_id, blog_name, blog_thumbnail, blog_total_posts, blog_score, blog_level, blog_category_keywords, blog_last_post_date, blog_updated_at, blog_verified, blog_verified_at, blog_verification_code, blog_verification_blocked')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.blog_url) {
      return NextResponse.json({ blogProfile: null })
    }

    return NextResponse.json({
      blogProfile: {
        blogUrl: profile.blog_url,
        blogId: profile.blog_id,
        blogName: profile.blog_name,
        blogThumbnail: profile.blog_thumbnail,
        totalPosts: profile.blog_total_posts,
        blogScore: profile.blog_score,
        blogLevel: profile.blog_level,
        categoryKeywords: profile.blog_category_keywords || [],
        lastPostDate: profile.blog_last_post_date,
        updatedAt: profile.blog_updated_at,
        verified: profile.blog_verified,
        verifiedAt: profile.blog_verified_at,
        verificationCode: profile.blog_verified ? null : profile.blog_verification_code,
        verificationBlocked: profile.blog_verification_blocked,
      },
    })
  } catch (error) {
    console.error('[Blog Profile] 조회 오류:', error)
    return NextResponse.json({ error: '블로그 정보 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

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

    // 2. 블로그 존재 여부 직접 확인 (RSS/크롤링)
    const blogId = extractBlogId(blogUrl.trim())
    if (!blogId) {
      return NextResponse.json(
        { error: '올바른 네이버 블로그 URL이 아닙니다. (예: https://blog.naver.com/아이디)' },
        { status: 400 }
      )
    }

    let blogName: string | null = null
    let totalPosts = 0
    try {
      const crawlResult = await fetchBlogPosts(blogId, 10)
      if (crawlResult.posts.length === 0) {
        return NextResponse.json(
          { error: '블로그를 찾을 수 없거나 포스트가 없습니다. URL이 정확한지, 블로그가 공개 상태인지 확인해주세요.' },
          { status: 400 }
        )
      }
      blogName = crawlResult.blogName
      totalPosts = crawlResult.posts.length
    } catch (crawlError) {
      console.error('[Blog Profile] 블로그 크롤링 실패:', crawlError)
      return NextResponse.json(
        { error: '블로그 정보를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.' },
        { status: 400 }
      )
    }

    // 3. 소유권 인증 코드 생성 (6자리 영숫자)
    const verificationCode = generateVerificationCode()

    // profiles 테이블 업데이트 (기본 정보만 저장, 점수는 블로그 지수 분석 시 업데이트)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        blog_url: blogUrl.trim(),
        blog_id: blogId,
        blog_name: blogName || blogId,
        blog_thumbnail: null,
        blog_total_posts: totalPosts,
        blog_score: 0,
        blog_level: '',
        blog_category_keywords: [],
        blog_last_post_date: null,
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
        blogUrl: blogUrl.trim(),
        blogId,
        blogName: blogName || blogId,
        blogScore: 0,
        blogLevel: '',
        totalPosts,
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

// 6자리 인증 코드 생성 (영숫자 대문자)
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
