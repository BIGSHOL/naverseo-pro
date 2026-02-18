import { NextRequest, NextResponse } from 'next/server'

// 블로그 지수 측정 API
// 네이버 검색 API를 활용한 역산 방식으로 블로그 파워를 측정

interface KeywordRankResult {
  keyword: string
  rank: number | null
  totalResults: number
}

// 테스트용 기본 키워드 (다양한 경쟁도)
const DEFAULT_TEST_KEYWORDS = [
  '맛집 추천',
  '여행 후기',
  '다이어트 방법',
  '자기계발 책',
  '인테리어 팁',
  '육아 정보',
  '재테크 방법',
  '카페 추천',
]

// 블로그 지수 계산
function calculateBlogIndex(results: KeywordRankResult[]): {
  score: number
  level: string
  details: {
    rankedCount: number
    totalTested: number
    avgRank: number | null
    top10Count: number
    top30Count: number
    top50Count: number
  }
} {
  const ranked = results.filter((r) => r.rank !== null)
  const rankedCount = ranked.length
  const totalTested = results.length

  if (rankedCount === 0) {
    return {
      score: 10,
      level: '입문',
      details: {
        rankedCount: 0,
        totalTested,
        avgRank: null,
        top10Count: 0,
        top30Count: 0,
        top50Count: 0,
      },
    }
  }

  const avgRank = Math.round(
    ranked.reduce((sum, r) => sum + (r.rank || 0), 0) / rankedCount
  )
  const top10Count = ranked.filter((r) => r.rank! <= 10).length
  const top30Count = ranked.filter((r) => r.rank! <= 30).length
  const top50Count = ranked.filter((r) => r.rank! <= 50).length

  // 점수 계산 (100점 만점)
  let score = 0

  // 1. 노출률 (30점) - 테스트 키워드 중 몇 개에서 100위 내 노출되는지
  const exposureRate = rankedCount / totalTested
  score += Math.round(exposureRate * 30)

  // 2. 평균 순위 (30점) - 순위가 높을수록 점수 높음
  if (avgRank <= 5) score += 30
  else if (avgRank <= 10) score += 25
  else if (avgRank <= 20) score += 20
  else if (avgRank <= 30) score += 15
  else if (avgRank <= 50) score += 10
  else if (avgRank <= 70) score += 5
  else score += 2

  // 3. TOP10 비율 (25점)
  const top10Rate = top10Count / totalTested
  score += Math.round(top10Rate * 25)

  // 4. TOP30 비율 (15점)
  const top30Rate = top30Count / totalTested
  score += Math.round(top30Rate * 15)

  // 등급 결정
  let level: string
  if (score >= 85) level = '최적화'
  else if (score >= 70) level = '우수'
  else if (score >= 55) level = '양호'
  else if (score >= 40) level = '보통'
  else if (score >= 25) level = '성장 중'
  else level = '입문'

  return {
    score: Math.min(100, score),
    level,
    details: {
      rankedCount,
      totalTested,
      avgRank,
      top10Count,
      top30Count,
      top50Count,
    },
  }
}

// 데모 결과 생성
function generateDemoResults(blogUrl: string, keywords: string[]): KeywordRankResult[] {
  return keywords.map((keyword) => {
    const rand = Math.random()
    let rank: number | null
    if (rand < 0.3) rank = null
    else if (rand < 0.5) rank = Math.floor(Math.random() * 50) + 51
    else if (rand < 0.75) rank = Math.floor(Math.random() * 40) + 11
    else rank = Math.floor(Math.random() * 10) + 1
    return {
      keyword,
      rank,
      totalResults: Math.floor(Math.random() * 100000) + 10000,
    }
  })
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

    const { blogUrl, testKeywords = [] } = await request.json()

    if (!blogUrl?.trim()) {
      return NextResponse.json(
        { error: '블로그 URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 테스트할 키워드 목록 (사용자 입력 + 기본 키워드)
    const userKeywords = (testKeywords as string[])
      .map((k: string) => k.trim())
      .filter(Boolean)
    const keywords =
      userKeywords.length > 0
        ? userKeywords
        : DEFAULT_TEST_KEYWORDS.slice(0, 5) // 기본 5개

    // 네이버 API 키 확인
    const hasNaverApi =
      process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET

    let results: KeywordRankResult[]

    if (!hasNaverApi) {
      // 데모 모드
      results = generateDemoResults(blogUrl, keywords)
    } else {
      // 실제 API 호출
      const { searchNaverBlog, extractBlogId } = await import(
        '@/lib/naver/blog-search'
      )
      const blogId = extractBlogId(blogUrl.trim())
      const matchTarget = blogId
        ? blogId.toLowerCase()
        : blogUrl
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')

      results = []

      for (const keyword of keywords) {
        try {
          const searchResult = await searchNaverBlog(keyword, 100)
          let rank: number | null = null

          for (let i = 0; i < searchResult.items.length; i++) {
            const item = searchResult.items[i]
            const itemLink = item.link.toLowerCase()
            const bloggerLink = item.bloggerlink.toLowerCase()

            if (blogId) {
              const pattern = new RegExp(
                `blog\\.naver\\.com/${matchTarget}(?:/[0-9]*)?(?:\\?|$)`,
                'i'
              )
              if (pattern.test(itemLink) || pattern.test(bloggerLink)) {
                rank = i + 1
                break
              }
            } else {
              const normalizedItem = itemLink
                .replace(/^https?:\/\//, '')
                .replace(/\/$/, '')
              const normalizedBlogger = bloggerLink
                .replace(/^https?:\/\//, '')
                .replace(/\/$/, '')
              if (
                normalizedItem.startsWith(matchTarget) ||
                normalizedBlogger.startsWith(matchTarget)
              ) {
                rank = i + 1
                break
              }
            }
          }

          results.push({
            keyword,
            rank,
            totalResults: searchResult.total,
          })

          // API 호출 간 딜레이 (네이버 rate limit 방지)
          await new Promise((resolve) => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`[BlogIndex] 키워드 "${keyword}" 검색 오류:`, error)
          results.push({ keyword, rank: null, totalResults: 0 })
        }
      }
    }

    // 지수 계산
    const indexResult = calculateBlogIndex(results)

    return NextResponse.json({
      blogUrl: blogUrl.trim(),
      ...indexResult,
      keywordResults: results,
      isDemo: !hasNaverApi,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[BlogIndex] 오류:', error)
    return NextResponse.json(
      { error: '블로그 지수 측정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
