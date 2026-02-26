import { NextRequest, NextResponse } from 'next/server'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { extractBlogId, stripHtml } from '@/lib/utils/text'
import { fetchBlogPosts } from '@/lib/naver/blog-crawler'

interface PostCheckResult {
  title: string
  link: string
  indexed: boolean
  totalResults?: number
  error?: string
  checkedAt: string
}

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'post_check')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    const { blogUrl } = await request.json()

    if (!blogUrl?.trim()) {
      return NextResponse.json(
        { error: '블로그 URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    const blogId = extractBlogId(blogUrl.trim())

    // 네이버 API 키 확인
    const hasNaverApi =
      process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET

    if (!hasNaverApi) {
      // 데모 모드
      const demoBlogId = blogId || blogUrl.trim().replace(/.*\//, '') || 'demo_blog'
      const demoResults = generateDemoResults(demoBlogId)

      await deductCredits(supabase, user.id, 'post_check', { blogUrl, demo: true })

      const indexedCount = demoResults.filter(r => r.indexed).length
      return NextResponse.json({
        blogUrl,
        blogId: demoBlogId,
        blogName: '데모 블로그',
        totalPosts: demoResults.length,
        indexedCount,
        missingCount: demoResults.length - indexedCount,
        results: demoResults,
        isDemo: true,
      })
    }

    // 실제 모드
    if (!blogId) {
      return NextResponse.json(
        { error: '올바른 네이버 블로그 URL을 입력해주세요. (예: https://blog.naver.com/myblog)' },
        { status: 400 }
      )
    }

    // 1. 블로그 포스트 크롤링 (최대 30개)
    const crawlResult = await fetchBlogPosts(blogId, 30)
    const posts = crawlResult.posts
    const blogName = crawlResult.blogName

    if (posts.length === 0) {
      return NextResponse.json(
        { error: '블로그에서 포스트를 가져올 수 없습니다. URL을 확인해주세요.' },
        { status: 400 }
      )
    }

    // 2. 각 포스트 제목으로 네이버 검색하여 색인 확인
    const { searchNaverBlog } = await import('@/lib/naver/blog-search')
    const results: PostCheckResult[] = []

    for (const post of posts) {
      const cleanTitle = stripHtml(post.title).trim()
      if (!cleanTitle) {
        results.push({
          title: '(제목 없음)',
          link: post.link,
          indexed: false,
          error: '제목을 파싱할 수 없습니다',
          checkedAt: new Date().toISOString(),
        })
        continue
      }

      try {
        // 따옴표로 감싸서 정확 검색
        const searchResult = await searchNaverBlog(`"${cleanTitle}"`, 10)

        // 검색 결과에서 해당 blogId가 포함된 항목이 있는지 확인
        const isIndexed = searchResult.items.some(item => {
          const itemLink = item.link.toLowerCase()
          const bloggerLink = item.bloggerlink.toLowerCase()
          const pattern = new RegExp(`blog\\.naver\\.com/${blogId.toLowerCase()}(?:/|$)`)
          return pattern.test(itemLink) || pattern.test(bloggerLink)
        })

        results.push({
          title: cleanTitle,
          link: post.link,
          indexed: isIndexed,
          totalResults: searchResult.total,
          checkedAt: new Date().toISOString(),
        })
      } catch (err) {
        results.push({
          title: cleanTitle,
          link: post.link,
          indexed: false,
          error: '검색 중 오류가 발생했습니다',
          checkedAt: new Date().toISOString(),
        })
      }

      // Rate limiting: 200ms 간격
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'post_check', {
      blogUrl,
      blogId,
      totalPosts: results.length,
    })

    const indexedCount = results.filter(r => r.indexed).length

    return NextResponse.json({
      blogUrl,
      blogId,
      blogName: blogName || blogId,
      totalPosts: results.length,
      indexedCount,
      missingCount: results.length - indexedCount,
      results,
      isDemo: false,
    })
  } catch (error) {
    console.error('[PostCheck] 오류:', error)
    return NextResponse.json(
      { error: '검색 누락 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}

/** 데모 모드: 80% 색인, 20% 누락 */
function generateDemoResults(blogId: string): PostCheckResult[] {
  const demoTitles = [
    '봄맞이 인테리어 소품 추천 BEST 10',
    '서울 근교 당일치기 여행지 5곳',
    '직장인 점심 도시락 레시피 모음',
    '아이폰 16 프로 한 달 사용 솔직 후기',
    '겨울철 피부 관리 루틴 공유',
    '초보자를 위한 주식 투자 가이드',
    '강아지 산책 시 주의사항 정리',
    '2025년 노트북 추천 가성비 TOP 5',
    '홈카페 레시피 - 달고나 커피 만들기',
    '제주도 3박 4일 여행 코스 총정리',
    '다이어트 식단 일주일 플랜',
    '넷플릭스 이번 달 신작 추천',
    '블로그 수익화 방법 총정리',
    '자동차 세차 셀프 꿀팁 모음',
    '우리 아이 독서 습관 만드는 법',
    '초간단 에어프라이어 레시피 10선',
    '여름 휴가 캠핑 준비물 체크리스트',
    '퇴근 후 자기계발 루틴 추천',
    '고양이 첫 입양 가이드',
    '가을 단풍 드라이브 코스 추천',
  ]

  return demoTitles.map((title, i) => ({
    title,
    link: `https://blog.naver.com/${blogId}/${22100000000 + i}`,
    indexed: Math.random() > 0.2, // 80% indexed
    totalResults: Math.floor(Math.random() * 5000) + 100,
    checkedAt: new Date().toISOString(),
  }))
}
