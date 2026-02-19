import { NextRequest, NextResponse } from 'next/server'
import { searchNaverBlog } from '@/lib/naver/blog-search'
import { callGemini, parseGeminiJson, COMPETITOR_ANALYSIS_PROMPT } from '@/lib/ai/gemini'

// === 타입 정의 ===

interface CompetitorItem {
  rank: number
  title: string
  link: string
  description: string
  bloggerName: string
  bloggerLink: string
  postDate: string
  postDateFormatted: string
  daysSincePosted: number
  titleLength: number
  hasKeywordInTitle: boolean
}

interface PatternAnalysis {
  titleStats: {
    avgLength: number
    minLength: number
    maxLength: number
    keywordInTitleRate: number
    keywordInTitleCount: number
  }
  dateStats: {
    avgDaysAgo: number
    newestDaysAgo: number
    oldestDaysAgo: number
    within30Days: number
    within90Days: number
    within365Days: number
    older: number
  }
  blogDiversity: {
    uniqueBlogCount: number
    totalResults: number
    diversityRate: number
    repeatedBlogs: { name: string; count: number }[]
  }
}

interface AiInsights {
  summary: string
  topPatterns: string[]
  contentGaps: string[]
  recommendedStrategy: string
  titleSuggestions: string[]
}

// === 유틸리티 함수 ===

// HTML 태그 및 엔티티 제거
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// postdate(YYYYMMDD) → 오늘까지 경과 일수
function daysSince(postdate: string): number {
  const year = parseInt(postdate.substring(0, 4))
  const month = parseInt(postdate.substring(4, 6)) - 1
  const day = parseInt(postdate.substring(6, 8))
  const postDate = new Date(year, month, day)
  const now = new Date()
  const diff = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

// YYYYMMDD → YYYY.MM.DD
function formatDate(postdate: string): string {
  return `${postdate.substring(0, 4)}.${postdate.substring(4, 6)}.${postdate.substring(6, 8)}`
}

// === 패턴 분석 ===

function analyzePatterns(competitors: CompetitorItem[], keyword: string): PatternAnalysis {
  const keywordLower = keyword.toLowerCase().replace(/\s+/g, '')

  // 제목 분석
  const lengths = competitors.map(c => c.titleLength)
  const withKeyword = competitors.filter(c =>
    c.title.toLowerCase().replace(/\s+/g, '').includes(keywordLower)
  )

  const titleStats = {
    avgLength: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
    keywordInTitleRate: Math.round((withKeyword.length / competitors.length) * 100),
    keywordInTitleCount: withKeyword.length,
  }

  // 날짜 분석
  const days = competitors.map(c => c.daysSincePosted)
  const dateStats = {
    avgDaysAgo: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    newestDaysAgo: Math.min(...days),
    oldestDaysAgo: Math.max(...days),
    within30Days: days.filter(d => d <= 30).length,
    within90Days: days.filter(d => d <= 90).length,
    within365Days: days.filter(d => d <= 365).length,
    older: days.filter(d => d > 365).length,
  }

  // 블로그 다양성
  const blogCounts = new Map<string, number>()
  competitors.forEach(c => {
    blogCounts.set(c.bloggerName, (blogCounts.get(c.bloggerName) || 0) + 1)
  })
  const repeatedBlogs = Array.from(blogCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const blogDiversity = {
    uniqueBlogCount: blogCounts.size,
    totalResults: competitors.length,
    diversityRate: Math.round((blogCounts.size / competitors.length) * 100),
    repeatedBlogs,
  }

  return { titleStats, dateStats, blogDiversity }
}

// === AI 분석 ===

async function getAiInsights(
  keyword: string,
  competitors: CompetitorItem[],
  patterns: PatternAnalysis
): Promise<AiInsights> {
  const competitorList = competitors
    .map((c, i) => `${i + 1}위. 제목: "${c.title}" | 블로그: ${c.bloggerName} | 작성일: ${c.postDateFormatted} | 설명: "${c.description.substring(0, 80)}"`)
    .join('\n')

  const userMessage = `키워드: "${keyword}"

네이버 블로그 검색 상위 ${competitors.length}개 결과 분석:

${competitorList}

패턴 분석 요약:
- 평균 제목 길이: ${patterns.titleStats.avgLength}자
- 제목에 키워드 포함률: ${patterns.titleStats.keywordInTitleRate}%
- 평균 포스트 연령: ${patterns.dateStats.avgDaysAgo}일
- 30일 이내 작성: ${patterns.dateStats.within30Days}개
- 블로그 다양성: ${patterns.blogDiversity.uniqueBlogCount}개 블로그 / ${patterns.blogDiversity.totalResults}개 결과

위 데이터를 기반으로 경쟁 분석을 해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "summary": "전체 경쟁 상황 2-3문장 요약",
  "topPatterns": ["상위 노출 글들의 공통 패턴 1", "패턴 2", "패턴 3"],
  "contentGaps": ["기존 글들이 놓치고 있는 콘텐츠 기회 1", "기회 2"],
  "recommendedStrategy": "이 키워드로 상위 노출하기 위한 구체적 전략 (100-200자)",
  "titleSuggestions": ["추천 제목 1", "추천 제목 2", "추천 제목 3"]
}`

  const response = await callGemini(COMPETITOR_ANALYSIS_PROMPT, userMessage, 2048)
  return parseGeminiJson<AiInsights>(response)
}

// === 데모 데이터 ===

function generateDemoCompetitors(keyword: string): CompetitorItem[] {
  const blogNames = ['블로그마스터', '일상기록장', '꿀팁대방출', '리뷰요정', '엄마의하루', '트렌드헌터', '생활연구소', '정보나눔이', '경험공유소', '스마트라이프']

  const titles = [
    `${keyword} 완벽 가이드 2025 총정리`,
    `${keyword} 추천 TOP 7 직접 비교해봄`,
    `${keyword} 후기 솔직하게 알려드릴게요`,
    `${keyword} 초보자도 쉽게 따라하는 방법`,
    `${keyword} 비교 분석 장단점 총정리`,
    `${keyword} 가성비 좋은 것만 골랐어요`,
    `[2025] ${keyword} 최신 트렌드 분석`,
    `${keyword} 실패하지 않는 꿀팁 5가지`,
    `${keyword} 전문가가 알려주는 핵심 포인트`,
    `내돈내산 ${keyword} 3개월 사용 후기`,
  ]

  const descs = [
    `오늘은 ${keyword}에 대해 자세히 알아보겠습니다. 많은 분들이 궁금해하시는 내용을 정리했어요.`,
    `${keyword} 관련 정보를 찾고 계신가요? 직접 경험해본 후기를 바탕으로 솔직하게 작성했습니다.`,
    `${keyword}의 모든 것을 한번에 정리! 초보자도 이해하기 쉽게 설명해드릴게요.`,
    `${keyword} 시작하시는 분들을 위해 기본부터 심화까지 단계별로 정리했습니다.`,
    `여러 ${keyword}를 직접 비교해보고 장단점을 분석했습니다. 선택에 도움이 되길 바랍니다.`,
    `가성비 좋은 ${keyword}만 엄선해서 추천드립니다. 가격 대비 만족도가 높은 것들이에요.`,
    `2025년 최신 ${keyword} 트렌드를 분석했습니다. 올해 달라진 점을 확인해보세요.`,
    `${keyword}에서 실패하지 않는 핵심 꿀팁 5가지를 정리했어요.`,
    `전문가 관점에서 ${keyword}의 핵심 포인트를 짚어드립니다.`,
    `3개월 동안 직접 사용해본 ${keyword} 솔직 후기입니다. 내돈내산 리뷰!`,
  ]

  const now = new Date()
  return titles.map((title, i) => {
    const daysAgo = Math.floor(Math.random() * 150) + (i < 3 ? 7 : 30)
    const postDate = new Date(now.getTime() - daysAgo * 86400000)
    const yyyymmdd = `${postDate.getFullYear()}${String(postDate.getMonth() + 1).padStart(2, '0')}${String(postDate.getDate()).padStart(2, '0')}`

    return {
      rank: i + 1,
      title,
      link: `https://blog.naver.com/${blogNames[i].toLowerCase()}/22${3000000 + Math.floor(Math.random() * 100000)}`,
      description: descs[i],
      bloggerName: blogNames[i],
      bloggerLink: `https://blog.naver.com/${blogNames[i].toLowerCase()}`,
      postDate: yyyymmdd,
      postDateFormatted: formatDate(yyyymmdd),
      daysSincePosted: daysAgo,
      titleLength: title.length,
      hasKeywordInTitle: true,
    }
  })
}

function getDemoAiInsights(keyword: string): AiInsights {
  return {
    summary: `"${keyword}" 키워드의 상위 10개 블로그를 분석한 결과, 대부분의 글이 리스트형 콘텐츠와 후기 형태를 띠고 있습니다. 최근 3개월 이내 작성된 글이 과반수를 차지하며, 네이버 알고리즘이 최신 콘텐츠를 선호하는 경향이 뚜렷합니다.`,
    topPatterns: [
      '제목에 키워드를 앞쪽에 배치하고 "추천", "TOP", "비교" 등 클릭 유도 단어 사용',
      '2,000~3,000자 분량의 체계적 구조 (소제목 3-5개 활용)',
      '직접 경험 기반의 솔직한 톤으로 신뢰감 확보',
      '최신 연도(2025)를 제목이나 본문에 명시하여 최신성 어필',
    ],
    contentGaps: [
      '대부분의 글이 일반적인 정보 나열에 그치고 있어, 구체적인 비용/가격 비교 콘텐츠가 부족',
      '동영상이나 인포그래픽 등 멀티미디어 활용 글이 적어 차별화 가능',
      '초보자 관점의 단계별 가이드가 부족하여 진입 장벽이 낮은 콘텐츠로 공략 가능',
    ],
    recommendedStrategy: `${keyword} 키워드로 상위 노출을 위해서는 직접 경험 기반의 2,500자 이상 콘텐츠를 작성하되, 기존 상위 글들이 다루지 않는 구체적인 비용 비교나 단계별 가이드 형태로 차별화하세요. 제목은 30자 내외로 키워드를 앞쪽에 배치하고, 소제목 4-5개로 구조화하여 체류 시간을 높이는 것이 핵심입니다.`,
    titleSuggestions: [
      `${keyword} 완벽 정리 - 초보자를 위한 단계별 가이드 (2025)`,
      `${keyword} 실제 비용 비교 분석 | 가성비 순위 TOP 5`,
      `${keyword} 3개월 직접 경험 후기 - 장단점 솔직 리뷰`,
    ],
  }
}

// === API 핸들러 ===

export async function POST(request: NextRequest) {
  try {
    const { keyword, includeAi = false } = await request.json()

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '분석할 키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    const cleanKeyword = keyword.trim()

    // API 키가 없으면 데모 데이터
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
      const demoCompetitors = generateDemoCompetitors(cleanKeyword)
      const demoPatterns = analyzePatterns(demoCompetitors, cleanKeyword)
      const demoAi = includeAi ? getDemoAiInsights(cleanKeyword) : null

      return NextResponse.json({
        keyword: cleanKeyword,
        competitors: demoCompetitors,
        patterns: demoPatterns,
        aiInsights: demoAi,
        isDemo: true,
      })
    }

    // 네이버 블로그 검색 (상위 10개)
    const searchResult = await searchNaverBlog(cleanKeyword, 10)

    // 데이터 가공
    const competitors: CompetitorItem[] = searchResult.items.map((item, i) => {
      const cleanTitle = stripHtml(item.title)
      const cleanDesc = stripHtml(item.description)
      const keywordLower = cleanKeyword.toLowerCase().replace(/\s+/g, '')
      return {
        rank: i + 1,
        title: cleanTitle,
        link: item.link,
        description: cleanDesc,
        bloggerName: item.bloggername,
        bloggerLink: item.bloggerlink,
        postDate: item.postdate,
        postDateFormatted: formatDate(item.postdate),
        daysSincePosted: daysSince(item.postdate),
        titleLength: cleanTitle.length,
        hasKeywordInTitle: cleanTitle.toLowerCase().replace(/\s+/g, '').includes(keywordLower),
      }
    })

    // 패턴 분석
    const patterns = analyzePatterns(competitors, cleanKeyword)

    // AI 인사이트 (옵션)
    let aiInsights: AiInsights | null = null
    if (includeAi && process.env.GEMINI_API_KEY) {
      try {
        aiInsights = await getAiInsights(cleanKeyword, competitors, patterns)
      } catch (aiError) {
        console.error('[Competitors AI] AI 분석 실패:', aiError)
        // AI 실패해도 기본 분석은 반환
      }
    }

    return NextResponse.json({
      keyword: cleanKeyword,
      competitors,
      patterns,
      aiInsights,
      isDemo: false,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Competitors] 오류:', errorMessage)
    return NextResponse.json(
      { error: `경쟁사 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
