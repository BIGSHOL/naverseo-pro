import { NextResponse } from 'next/server'
import { fetchBlogPosts } from '@/lib/naver/blog-crawler'
import { stripHtml } from '@/lib/utils/text'

export const dynamic = 'force-dynamic'

// 블로그 소유권 인증
export async function POST(req: Request) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 사용자의 블로그 정보 및 인증 코드 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('blog_url, blog_id, blog_verification_code, blog_verification_code_created_at, blog_verification_attempts, blog_verification_last_attempt_at, blog_verification_blocked, blog_verified')
      .eq('id', user.id)
      .single()

    if (!profile?.blog_url) {
      return NextResponse.json({ error: '등록된 블로그가 없습니다.' }, { status: 400 })
    }

    if (profile.blog_verified) {
      return NextResponse.json({ error: '이미 인증된 블로그입니다.' }, { status: 400 })
    }

    // 차단 확인
    if (profile.blog_verification_blocked) {
      return NextResponse.json(
        { error: '인증이 차단되었습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      )
    }

    if (!profile.blog_verification_code || !profile.blog_verification_code_created_at) {
      return NextResponse.json({ error: '인증 코드가 생성되지 않았습니다.' }, { status: 400 })
    }

    // 1. 인증 코드 만료 확인 (10분)
    const codeCreatedAt = new Date(profile.blog_verification_code_created_at)
    const now = new Date()
    const minutesPassed = (now.getTime() - codeCreatedAt.getTime()) / 1000 / 60

    if (minutesPassed > 10) {
      return NextResponse.json(
        { error: '인증 코드가 만료되었습니다. 블로그를 다시 등록해주세요.' },
        { status: 400 }
      )
    }

    // 2. Rate Limiting 확인 (1시간에 5회)
    const lastAttemptAt = profile.blog_verification_last_attempt_at
      ? new Date(profile.blog_verification_last_attempt_at)
      : null
    const hoursPassed = lastAttemptAt
      ? (now.getTime() - lastAttemptAt.getTime()) / 1000 / 60 / 60
      : 999

    // 1시간이 지났으면 카운트 리셋
    const currentAttempts = hoursPassed >= 1 ? 0 : (profile.blog_verification_attempts || 0)

    if (currentAttempts >= 5) {
      // 5회 이상 시도 시 차단
      await supabase
        .from('profiles')
        .update({ blog_verification_blocked: true })
        .eq('id', user.id)

      return NextResponse.json(
        { error: '인증 시도 횟수를 초과했습니다. 계정이 차단되었습니다. 관리자에게 문의하세요.' },
        { status: 429 }
      )
    }

    // 3. 시도 횟수 증가
    const newAttempts = currentAttempts + 1
    await supabase
      .from('profiles')
      .update({
        blog_verification_attempts: newAttempts,
        blog_verification_last_attempt_at: now.toISOString(),
      })
      .eq('id', user.id)

    // 통합 블로그 크롤러 사용 (RSS → 검색 API → 페이지 크롤링)
    const crawlResult = await fetchBlogPosts(profile.blog_id || '', 5)

    if (crawlResult.posts.length === 0) {
      return NextResponse.json(
        { error: '최신 글을 찾을 수 없습니다. 블로그에 최소 1개 이상의 공개 글이 있어야 합니다.' },
        { status: 400 }
      )
    }

    // 최신 5개 글의 내용에서 인증 코드 검색
    const verificationPattern = new RegExp(
      `\\[인증코드[:\\s]*${profile.blog_verification_code}\\]|\\[코드[:\\s]*${profile.blog_verification_code}\\]`,
      'i'
    )

    let codeFound = false
    for (const post of crawlResult.posts) {
      const description = stripHtml(post.description || '')
      if (verificationPattern.test(description)) {
        codeFound = true
        break
      }
    }

    if (!codeFound) {
      return NextResponse.json(
        {
          error: `최신 글에서 인증 코드를 찾을 수 없습니다. 글 하단에 "[인증코드: ${profile.blog_verification_code}]"를 추가해주세요.`,
        },
        { status: 400 }
      )
    }

    // 인증 성공 - DB 업데이트
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        blog_verified: true,
        blog_verified_at: new Date().toISOString(),
        blog_verification_attempts: 0,
        blog_verification_last_attempt_at: null,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Blog Verify] 업데이트 실패:', updateError)
      return NextResponse.json({ error: '인증 정보 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '블로그 소유권이 성공적으로 인증되었습니다!',
    })
  } catch (error) {
    console.error('[Blog Verify] 오류:', error)
    return NextResponse.json({ error: '인증 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
