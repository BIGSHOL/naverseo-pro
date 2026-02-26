import { NextRequest, NextResponse } from 'next/server'
import { searchNaverBlog } from '@/lib/naver/blog-search'
import { callGemini, hasAiApiKey, parseGeminiJson, analyzeImagesWithGemini, COMPETITOR_ANALYSIS_PROMPT } from '@/lib/ai/gemini'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { stripHtml } from '@/lib/utils/text'
import { scheduleCollection, collectFromSearchResults, collectFromScrapedPosts } from '@/lib/blog-learning'

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

interface DifficultyAssessment {
  level: 'easy' | 'medium' | 'hard' | 'very_hard'
  score: number // 0~100 (높을수록 어려움)
  reasons: string[]
}

interface TitlePatternWords {
  word: string
  count: number
}

interface ImageAnalysis {
  totalImages: number
  imageTypes: string[]       // 사용된 이미지 유형 (직촬, 인포그래픽, 캡처 등)
  recommendation: string     // 이미지 전략 추천
}

interface AiInsights {
  summary: string
  topPatterns: string[]
  contentGaps: string[]
  recommendedStrategy: string
  recommendedContentType?: string
  recommendedTone?: string
  relatedKeywords?: string[]
  titleSuggestions: string[]
  imageAnalysis?: ImageAnalysis
}

// === 유틸리티 함수 ===

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
  const count = competitors.length || 1 // 빈 배열 시 Division by Zero 방지

  // 제목 분석
  const lengths = competitors.map(c => c.titleLength)
  const withKeyword = competitors.filter(c =>
    c.title.toLowerCase().replace(/\s+/g, '').includes(keywordLower)
  )

  const titleStats = {
    avgLength: lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
    minLength: lengths.length > 0 ? Math.min(...lengths) : 0,
    maxLength: lengths.length > 0 ? Math.max(...lengths) : 0,
    keywordInTitleRate: Math.round((withKeyword.length / count) * 100),
    keywordInTitleCount: withKeyword.length,
  }

  // 날짜 분석
  const days = competitors.map(c => c.daysSincePosted)
  const dateStats = {
    avgDaysAgo: days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
    newestDaysAgo: days.length > 0 ? Math.min(...days) : 0,
    oldestDaysAgo: days.length > 0 ? Math.max(...days) : 0,
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
    diversityRate: competitors.length > 0 ? Math.round((blogCounts.size / competitors.length) * 100) : 0,
    repeatedBlogs,
  }

  return { titleStats, dateStats, blogDiversity }
}

// === 경쟁 난이도 평가 (v2 — 연속 보간 + 가중치 차등) ===

function assessDifficulty(patterns: PatternAnalysis, competitors: CompetitorItem[]): DifficultyAssessment {
  const count = competitors.length || 1
  const reasons: string[] = []

  // === Factor 1: 콘텐츠 신선도 (max 30점) ===
  // 최신 글이 많을수록 활발하게 경쟁 중 → 진입 난이도 상승
  const w30 = patterns.dateStats.within30Days
  const w90only = patterns.dateStats.within90Days - w30
  const w365only = patterns.dateStats.within365Days - patterns.dateStats.within90Days
  const olderCount = patterns.dateStats.older
  // 가중 합산: 30일내 1.0, 90일내 0.6, 365일내 0.25, 1년이상 0.05
  const freshnessRaw = (w30 * 1.0 + w90only * 0.6 + w365only * 0.25 + olderCount * 0.05) / count
  const freshScore = Math.round(Math.min(freshnessRaw, 1) * 30)

  if (w30 >= Math.ceil(count * 0.5)) {
    reasons.push(`최근 30일 내 작성 글 ${w30}/${count}개 — 경쟁이 매우 활발한 키워드`)
  } else if (patterns.dateStats.within90Days >= Math.ceil(count * 0.5)) {
    reasons.push(`최근 90일 내 작성 글 ${patterns.dateStats.within90Days}/${count}개 — 보통 수준의 콘텐츠 갱신`)
  } else {
    reasons.push(`오래된 글이 대부분(평균 ${patterns.dateStats.avgDaysAgo}일 전) — 최신 콘텐츠로 진입 유리`)
  }

  // === Factor 2: 블로그 집중도/독점도 (max 25점) ===
  // 다양성 낮음 = 파워블로그 독점 = 진입 어려움
  const diversityRate = patterns.blogDiversity.diversityRate / 100
  let concScore = Math.round((1 - diversityRate) * 20)
  // 특정 블로그 3개 이상 독점 시 추가 점수
  const dominantBlogs = patterns.blogDiversity.repeatedBlogs.filter(b => b.count >= 3)
  if (dominantBlogs.length > 0) {
    concScore = Math.min(25, concScore + 5 * dominantBlogs.length)
    const top = dominantBlogs[0]
    reasons.push(`'${top.name}'이(가) 상위 ${top.count}개 차지 — 파워블로그가 상위를 장악 중`)
  } else if (diversityRate < 0.6) {
    reasons.push(`블로그 다양성 ${patterns.blogDiversity.diversityRate}% — 일부 블로그가 상위에 집중`)
  } else {
    reasons.push(`${patterns.blogDiversity.uniqueBlogCount}개 고유 블로그 노출 — 다양한 진입 기회`)
  }

  // === Factor 3: 키워드 포함률 (max 25점) ===
  // 제목에 키워드를 넣는 비율이 높으면 SEO 의식 높은 경쟁
  const kwRate = patterns.titleStats.keywordInTitleRate / 100
  const kwScore = Math.round(kwRate * 25)

  if (kwRate >= 0.7) {
    reasons.push(`상위 글 ${patterns.titleStats.keywordInTitleRate}%가 제목에 키워드 포함 — SEO 최적화된 경쟁`)
  } else if (kwRate >= 0.4) {
    reasons.push(`키워드 포함률 ${patterns.titleStats.keywordInTitleRate}% — 보통 수준의 SEO 경쟁`)
  } else {
    reasons.push(`키워드 포함률 ${patterns.titleStats.keywordInTitleRate}%로 낮음 — 제목 최적화만으로 차별화 가능`)
  }

  // === Factor 4: 제목 최적화 수준 (max 20점) ===
  // 평균 제목 길이가 SEO 최적 범위(20~45자)에 가까울수록 경쟁자가 SEO를 의식
  const avgLen = patterns.titleStats.avgLength
  const OPTIMAL_MIN = 20
  const OPTIMAL_MAX = 45
  const optimalCenter = (OPTIMAL_MIN + OPTIMAL_MAX) / 2 // 32.5
  const optimalHalfRange = (OPTIMAL_MAX - OPTIMAL_MIN) / 2 // 12.5
  const distFromCenter = Math.abs(avgLen - optimalCenter)
  // 최적 범위 안에 있으면 높은 점수, 범위 밖으로 갈수록 감소
  const titleOptRate = Math.max(0, 1 - distFromCenter / (optimalHalfRange * 1.5))
  const titleScore = Math.round(titleOptRate * 20)

  if (avgLen >= OPTIMAL_MIN && avgLen <= OPTIMAL_MAX) {
    reasons.push(`평균 제목 길이 ${avgLen}자 — SEO 최적 범위(${OPTIMAL_MIN}~${OPTIMAL_MAX}자)`)
  } else {
    reasons.push(`평균 제목 길이 ${avgLen}자 — 최적 범위 밖이라 제목 최적화로 우위 확보 가능`)
  }

  // === 합산 ===
  const totalScore = Math.min(100, freshScore + concScore + kwScore + titleScore)
  const level: DifficultyAssessment['level'] =
    totalScore >= 75 ? 'very_hard' :
    totalScore >= 55 ? 'hard' :
    totalScore >= 35 ? 'medium' :
    'easy'

  return { level, score: totalScore, reasons }
}

// === 제목 패턴 워드 추출 ===

function extractTitlePatterns(competitors: CompetitorItem[], keyword: string): TitlePatternWords[] {
  const stopWords = new Set(['의', '에', '를', '을', '이', '가', '은', '는', '로', '으로', '과', '와', '한', '할', '하는', '된', '되는', '및', '등', '더', '그', '이런', '저런', '그런'])
  const keywordWords = new Set(keyword.toLowerCase().split(/\s+/))
  const wordCount = new Map<string, number>()

  for (const comp of competitors) {
    // 제목에서 특수문자 제거 후 단어 추출
    const words = comp.title
      .replace(/[\[\]【】\(\)「」『』|·\-_~!@#$%^&*+=,.<>?;:'"\/\\]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w) && !keywordWords.has(w.toLowerCase()))

    const seen = new Set<string>()
    for (const word of words) {
      if (!seen.has(word)) {
        seen.add(word)
        wordCount.set(word, (wordCount.get(word) || 0) + 1)
      }
    }
  }

  return Array.from(wordCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }))
}

// === AI 분석 ===

async function getAiInsights(
  keyword: string,
  competitors: CompetitorItem[],
  patterns: PatternAnalysis,
  difficulty: DifficultyAssessment,
): Promise<AiInsights> {
  const competitorList = competitors
    .map((c, i) => `${i + 1}위. 제목: "${c.title}" | 블로그: ${c.bloggerName} | 작성일: ${c.postDateFormatted} | 설명: "${c.description.substring(0, 80)}"`)
    .join('\n')

  const difficultyLabel = difficulty.level === 'very_hard' ? '매우 어려움' : difficulty.level === 'hard' ? '어려움' : difficulty.level === 'medium' ? '보통' : '쉬움'

  // 키워드 의미 힌트: 상위 제목에서 키워드를 제거하고 자주 반복되는 2~3어절 추출
  let keywordHint = ''
  const cleanKw = keyword.trim()
  const kwEscaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const kwRegex = new RegExp(kwEscaped, 'gi')
  const phraseCounts = new Map<string, number>()
  for (const c of competitors) {
    const title = c.title.replace(kwRegex, ' ').trim()
    const words = title.split(/[\s,·|()!?:]+/).filter(w => w.length >= 2)
    for (let i = 0; i + 1 < words.length; i++) {
      const p = `${words[i]} ${words[i + 1]}`
      phraseCounts.set(p, (phraseCounts.get(p) || 0) + 1)
    }
  }
  let bestPhrase = ''
  let bestCount = 0
  phraseCounts.forEach((count, phrase) => {
    if (count > bestCount && count >= 2) { bestCount = count; bestPhrase = phrase }
  })
  if (bestPhrase) {
    keywordHint = `\n★ 키워드 의미 참고: "${keyword}" 검색 결과에서 "${bestPhrase}"이(가) 반복 등장합니다. 이 맥락에 맞춰 분석하세요.\n`
  }

  // 블로그 독점 정보
  const dominantBlogInfo = patterns.blogDiversity.repeatedBlogs
    .filter(b => b.count >= 2)
    .map(b => `${b.name}(${b.count}개)`)
    .join(', ')

  const userMessage = `키워드: "${keyword}"
${keywordHint}
네이버 블로그 검색 상위 ${competitors.length}개 결과 분석:

${competitorList}

패턴 분석 요약:
- 평균 제목 길이: ${patterns.titleStats.avgLength}자 (범위: ${patterns.titleStats.minLength}~${patterns.titleStats.maxLength}자)
- 제목에 키워드 포함률: ${patterns.titleStats.keywordInTitleRate}% (${patterns.titleStats.keywordInTitleCount}/${competitors.length}개)
- 평균 포스트 연령: ${patterns.dateStats.avgDaysAgo}일 (최신: ${patterns.dateStats.newestDaysAgo}일, 최오래: ${patterns.dateStats.oldestDaysAgo}일)
- 30일 이내 작성: ${patterns.dateStats.within30Days}개 / 90일 이내: ${patterns.dateStats.within90Days}개
- 블로그 다양성: ${patterns.blogDiversity.uniqueBlogCount}개 고유 블로그 / ${patterns.blogDiversity.totalResults}개 결과 (다양성 ${patterns.blogDiversity.diversityRate}%)
${dominantBlogInfo ? `- 다중 노출 블로그: ${dominantBlogInfo}` : ''}

경쟁 진입 난이도: ${difficultyLabel} (${difficulty.score}점/100점)
난이도 근거: ${difficulty.reasons.join(' / ')}

위 데이터를 기반으로 경쟁 분석을 해주세요.
★ 중요:
1. 먼저 이 키워드의 검색 의도(정보형/상업형/지역형/경험형/증상형)를 파악하고, 그에 맞는 콘텐츠 전략을 제시하세요.
2. summary에서 경쟁 난이도 판정(${difficultyLabel})과 일관된 톤으로 분석하세요.
3. 난이도가 "어려움" 이상이면 진입이 쉽지 않다는 점을 반영하되, 발견된 콘텐츠 기회가 있다면 구체적으로 제시하세요.

다음 JSON 형식으로 응답해주세요:
{
  "summary": "전체 경쟁 상황 2-3문장 요약 (난이도 판정과 일관되게)",
  "topPatterns": ["상위 노출 글들의 공통 패턴 1", "패턴 2", "패턴 3"],
  "contentGaps": ["기존 글들이 놓치고 있는 콘텐츠 기회 1", "기회 2"],
  "recommendedStrategy": "이 키워드로 상위 노출하기 위한 구체적 전략 (100-200자)",
  "recommendedContentType": "비교/추천형|후기/리뷰형|방법/가이드형|리스트형|정보형|지역업종형 중 하나 (상위 글 분석 기반 최적 유형)",
  "recommendedTone": "친근하고 정보적인|전문적인|재미있는|솔직한 중 하나",
  "relatedKeywords": ["상위 글 분석에서 추출한 관련 키워드 5~8개"],
  "titleSuggestions": ["추천 제목 1", "추천 제목 2", "추천 제목 3"]
}`

  const response = await callGemini(COMPETITOR_ANALYSIS_PROMPT, userMessage, 4096, { jsonMode: true })
  return parseGeminiJson<AiInsights>(response)
}

// === 이미지 분석 ===

async function analyzeCompetitorImages(
  competitorLinks: string[],
  keyword: string,
  searchItems?: import('@/lib/naver/blog-search').NaverBlogSearchItem[],
): Promise<ImageAnalysis | null> {
  try {
    const { scrapeMultiplePosts } = await import('@/lib/naver/blog-scraper')
    // 상위 5개 글만 스크래핑 (속도/비용 최적화)
    const scrapedData = await scrapeMultiplePosts(competitorLinks.slice(0, 5), 5)

    // 블로그 학습 파이프라인: 스크래핑 데이터 수집 (풀 패턴)
    if (searchItems && searchItems.length > 0 && scrapedData.size > 0) {
      scheduleCollection(() => collectFromScrapedPosts(keyword, scrapedData, searchItems, null, 'competitor_analysis'))
    }

    // 모든 이미지 URL 수집 (글당 최대 3장, 총 최대 10장)
    const allImageUrls: string[] = []
    for (const [, data] of scrapedData) {
      if (data.imageUrls && data.imageUrls.length > 0) {
        allImageUrls.push(...data.imageUrls.slice(0, 3))
      }
    }

    if (allImageUrls.length === 0) {
      return { totalImages: 0, imageTypes: ['이미지 없음'], recommendation: '상위 글에서 이미지를 추출할 수 없었습니다.' }
    }

    // Gemini Vision으로 이미지 유형 분석 (최대 10장)
    const prompt = `"${keyword}" 키워드의 네이버 블로그 상위 노출 글에서 사용된 이미지 ${allImageUrls.length}장입니다.

다음을 분석해서 JSON으로 응답하세요:
{
  "imageTypes": ["직접 촬영 사진", "인포그래픽/도표", "제품 사진", "캡처/스크린샷", "일러스트/아이콘" 등 발견된 유형],
  "dominantType": "가장 많이 사용된 이미지 유형 1개",
  "recommendation": "이 키워드에서 상위 노출을 위해 어떤 이미지를 준비해야 하는지 구체적 추천 (2-3문장)"
}`

    const visionResult = await analyzeImagesWithGemini(allImageUrls, prompt, { maxImages: 10, thinkingBudget: 0 })

    try {
      const parsed = JSON.parse(visionResult)
      return {
        totalImages: allImageUrls.length,
        imageTypes: parsed.imageTypes || [],
        recommendation: parsed.recommendation || '',
      }
    } catch {
      return {
        totalImages: allImageUrls.length,
        imageTypes: ['분석 실패'],
        recommendation: visionResult.substring(0, 200),
      }
    }
  } catch (err) {
    console.error('[Competitors] 이미지 분석 실패:', err)
    return null
  }
}

// === 데모 데이터 ===

function generateDemoCompetitors(keyword: string): CompetitorItem[] {
  const blogNames = ['블로그마스터', '일상기록장', '꿀팁대방출', '리뷰요정', '엄마의하루', '트렌드헌터', '생활연구소', '정보나눔이', '경험공유소', '스마트라이프']

  const titles = [
    `${keyword} 완벽 가이드 2026 총정리`,
    `${keyword} 추천 TOP 7 직접 비교해봄`,
    `${keyword} 후기 솔직하게 알려드릴게요`,
    `${keyword} 초보자도 쉽게 따라하는 방법`,
    `${keyword} 비교 분석 장단점 총정리`,
    `${keyword} 가성비 좋은 것만 골랐어요`,
    `[2026] ${keyword} 최신 트렌드 분석`,
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
    `2026년 최신 ${keyword} 트렌드를 분석했습니다. 올해 달라진 점을 확인해보세요.`,
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
      '최신 연도(2026)를 제목이나 본문에 명시하여 최신성 어필',
    ],
    contentGaps: [
      '대부분의 글이 일반적인 정보 나열에 그치고 있어, 구체적인 비용/가격 비교 콘텐츠가 부족',
      '동영상이나 인포그래픽 등 멀티미디어 활용 글이 적어 차별화 가능',
      '초보자 관점의 단계별 가이드가 부족하여 진입 장벽이 낮은 콘텐츠로 공략 가능',
    ],
    recommendedStrategy: `${keyword} 키워드로 상위 노출을 위해서는 직접 경험 기반의 2,500자 이상 콘텐츠를 작성하되, 기존 상위 글들이 다루지 않는 구체적인 비용 비교나 단계별 가이드 형태로 차별화하세요. 제목은 30자 내외로 키워드를 앞쪽에 배치하고, 소제목 4-5개로 구조화하여 체류 시간을 높이는 것이 핵심입니다.`,
    titleSuggestions: [
      `${keyword} 완벽 정리 - 초보자를 위한 단계별 가이드 (2026)`,
      `${keyword} 실제 비용 비교 분석 | 가성비 순위 TOP 5`,
      `${keyword} 3개월 직접 경험 후기 - 장단점 솔직 리뷰`,
    ],
    imageAnalysis: {
      totalImages: 15,
      imageTypes: ['직접 촬영 사진', '제품 비교 사진', '인포그래픽/도표'],
      recommendation: `${keyword} 관련 상위 글들은 직접 촬영한 실물 사진을 중심으로 사용하고 있습니다. 비교표나 인포그래픽을 추가하면 차별화할 수 있습니다.`,
    },
  }
}

// === API 핸들러 ===

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'competitor_analysis')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

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
      const demoDifficulty = assessDifficulty(demoPatterns, demoCompetitors)
      const demoTitlePatterns = extractTitlePatterns(demoCompetitors, cleanKeyword)
      const demoAi = includeAi ? getDemoAiInsights(cleanKeyword) : null

      await deductCredits(supabase, user.id, 'competitor_analysis', { keyword: cleanKeyword })
      return NextResponse.json({
        keyword: cleanKeyword,
        competitors: demoCompetitors,
        patterns: demoPatterns,
        difficulty: demoDifficulty,
        titlePatterns: demoTitlePatterns,
        aiInsights: demoAi,
        isDemo: true,
      })
    }

    // 네이버 블로그 검색 (상위 10개)
    const searchResult = await searchNaverBlog(cleanKeyword, 10)

    // 블로그 학습 파이프라인: 백그라운드 수집
    scheduleCollection(() => collectFromSearchResults(cleanKeyword, searchResult.items, 'competitor_analysis'))

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
    const difficulty = assessDifficulty(patterns, competitors)
    const titlePatterns = extractTitlePatterns(competitors, cleanKeyword)

    // AI 인사이트 + 이미지 분석 (병렬 실행)
    let aiInsights: AiInsights | null = null
    if (includeAi && hasAiApiKey('gemini')) {
      try {
        // AI 텍스트 분석 + 이미지 Vision 분석을 동시 실행
        const competitorLinks = competitors.map(c => c.link)
        const [aiResult, imageResult] = await Promise.allSettled([
          getAiInsights(cleanKeyword, competitors, patterns, difficulty),
          analyzeCompetitorImages(competitorLinks, cleanKeyword, searchResult.items),
        ])

        aiInsights = aiResult.status === 'fulfilled' ? aiResult.value : null
        if (aiResult.status === 'rejected') {
          console.error('[Competitors AI] AI 분석 실패:', aiResult.reason)
        }

        // 이미지 분석 결과를 aiInsights에 병합
        if (aiInsights && imageResult.status === 'fulfilled' && imageResult.value) {
          aiInsights.imageAnalysis = imageResult.value
        }
      } catch (aiError) {
        console.error('[Competitors AI] AI 분석 실패:', aiError)
      }
    }

    await deductCredits(supabase, user.id, 'competitor_analysis', { keyword: cleanKeyword })
    return NextResponse.json({
      keyword: cleanKeyword,
      competitors,
      patterns,
      difficulty,
      titlePatterns,
      aiInsights,
      isDemo: false,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Competitors] 오류:', errorMessage)
    return NextResponse.json(
      { error: `상위노출 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
