import { NextRequest, NextResponse } from 'next/server'
import { callAI, callGeminiStream, callClaudeStream, getUserAiProvider, hasAiApiKey, parseGeminiJson } from '@/lib/ai/gemini'

export const maxDuration = 60
import {
  buildSystemPrompt,
  buildUserPrompt,
  detectContentType,
  detectDomainCategory,
  generateDemoContent,
  postProcessContent,
  autoOptimizeContent,
  analyzeSeo,
  validateContentStructure,
  type ContentGenerationRequest,
} from '@/lib/content/engine'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { searchNaverBlog, type NaverBlogSearchItem } from '@/lib/naver/blog-search'
import { getKeywordStats, type NaverKeywordResult } from '@/lib/naver/search-ad'
import { fetchKeywordTrend } from '@/lib/naver/datalab'
import { getSearchEnrichmentData } from '@/lib/naver/search-enrichment'
import { scheduleCollection, collectFromSearchResults, getPatternPromptSection } from '@/lib/blog-learning'

// 간단한 SEO 점수 계산 (DB 저장용, 100점 만점)
function calculateBasicSeoScore(keyword: string, title: string, content: string, additionalKeywords?: string[]): number {
  const result = analyzeSeo(keyword, title, content, additionalKeywords)
  return result.totalScore
}

/**
 * SERP 검색 결과에서 키워드의 실제 카테고리와 최적 콘텐츠 유형을 추론
 * AI 할루시네이션 방지: 신조어/약어가 informational로 오분류되는 것을 SERP 데이터로 교정
 *
 * 예: "두쫀쿠" 검색 시 SERP에 "디저트", "쿠키", "맛있는" 등이 반복 → review 유형으로 교정
 */
function inferContentTypeFromSerp(
  items: Array<{ title: string; description: string }>
): { suggestedType: string | null; category: string } {
  if (!items || items.length === 0) return { suggestedType: null, category: '' }

  const allText = items
    .map(i => `${i.title.replace(/<[^>]*>/g, '')} ${i.description.replace(/<[^>]*>/g, '')}`)
    .join(' ')

  const scores: Record<string, { score: number; category: string }> = {
    review: {
      score: (allText.match(/맛집|카페|디저트|쿠키|빵|케이크|먹방|레시피|요리|달콤|베이커리|초콜릿|커피|음료|식당|간식|과자|아이스크림|떡|치킨|피자|맛있|후기|리뷰|사용기|언박싱|제품|개봉기|솔직|맛|먹어|먹고|주문|배달|포장|가격|구매|쇼핑|화장품|스킨케어/gi) || []).length,
      category: '음식/제품/후기',
    },
    howto: {
      score: (allText.match(/방법|하는\s?법|만들기|만드는|설치|설정|세팅|따라하기|가이드|튜토리얼|순서|단계|초보|입문/gi) || []).length,
      category: '방법/가이드',
    },
    comparison: {
      score: (allText.match(/비교|vs|대결|순위|랭킹|TOP|베스트|추천\s?순위|고르는|선택지/gi) || []).length,
      category: '비교/추천',
    },
  }

  const best = Object.entries(scores).sort(([, a], [, b]) => b.score - a.score)[0]

  // 최소 3회 이상 매칭되어야 신뢰할 수 있는 추론
  if (best[1].score >= 3) {
    return { suggestedType: best[0], category: best[1].category }
  }

  return { suggestedType: null, category: '' }
}

/**
 * SERP 제목들에서 키워드의 실제 의미(풀네임)를 추출
 * 예: "두쫀쿠" → SERP 제목 "두쫀쿠 두바이 쫀득 쿠키 맛있는 디저트" → "두바이 쫀득 쿠키"
 *
 * 전략: 모든 제목에서 키워드를 제거한 뒤, 가장 자주 반복되는 2~4어절 구문을 추출
 */
function extractKeywordMeaning(
  keyword: string,
  items: Array<{ title: string; description: string }>
): string | null {
  if (!items || items.length === 0) return null

  const cleanKeyword = keyword.trim().replace(/<[^>]*>/g, '')
  const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const keywordRegex = new RegExp(escaped, 'gi')

  // 모든 제목에서 키워드를 제거하고 남은 단어들의 2~3어절 구문 빈도 계산
  const phraseCounts = new Map<string, number>()

  for (const item of items) {
    const title = item.title.replace(/<[^>]*>/g, '').replace(keywordRegex, ' ').trim()
    const words = title.split(/[\s,·|()!?:]+/).filter(w => w.length >= 2)

    // 2어절 구문
    for (let i = 0; i + 1 < words.length; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
    }
    // 3어절 구문
    for (let i = 0; i + 2 < words.length; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
    }
  }

  // 가장 빈번한 구문 (최소 2회 이상)
  let bestPhrase = ''
  let bestCount = 0
  Array.from(phraseCounts.entries()).forEach(([phrase, count]) => {
    if (count > bestCount && count >= 2) {
      bestCount = count
      bestPhrase = phrase
    }
  })

  return bestPhrase || null
}

/**
 * 지역 업종 키워드에서 "특정 상호명" vs "카테고리" 구분
 *
 * 예: "침산동 인재원 학원" → "인재원"이 SERP에 반복 → 특정 상호명
 * 예: "침산동 학원" → 특별한 고유명사 없음 → 카테고리
 *
 * 전략:
 * 1. 키워드에서 지역명 + 업종 접미사를 제거하여 잠재적 상호명 추출
 * 2. SERP 제목에서 해당 상호명 반복 여부 확인
 * 3. 반복 3회 이상이면 특정 상호명으로 판정
 */
function detectSpecificBusiness(
  keyword: string,
  items: Array<{ title: string; description: string }>
): { isSpecific: boolean; businessName: string | null } {
  if (!items || items.length === 0) return { isSpecific: false, businessName: null }

  // 1. 지역명 제거
  const locationPattern = /[가-힣]{2,5}(동|구|시|역|군|읍|면)\s*/g
  const nearPattern = /(근처|주변)\s*/g
  let cleaned = keyword.replace(locationPattern, '').replace(nearPattern, '').trim()

  // 2. 업종 접미사 제거하여 잠재적 상호명 추출
  const businessSuffixes = [
    '학원', '카페', '병원', '치과', '의원', '한의원', '약국', '헬스장', '헬스',
    '필라테스', '요가', '수영장', '식당', '맛집', '음식점', '미용실', '헤어',
    '네일', '피부관리', '부동산', '호텔', '모텔', '펜션', '어린이집', '유치원',
    '골프', '체육관', '스튜디오', '꽃집', '세탁소', '정비소',
    '피부과', '정형외과', '안과', '이비인후과', '소아과', '산부인과',
  ]
  let potentialName = cleaned
  for (const suffix of businessSuffixes) {
    potentialName = potentialName.replace(new RegExp(suffix + '$'), '').trim()
  }

  // 상호명 후보가 없거나 너무 짧으면 (1글자 이하) 카테고리로 판정
  if (!potentialName || potentialName.length <= 1) {
    return { isSpecific: false, businessName: null }
  }

  // "수학", "영어", "초등" 같은 일반 수식어는 상호명이 아님
  const genericModifiers = /^(수학|영어|국어|과학|초등|중등|고등|입시|논술|코딩|미술|음악|피아노|태권도|발레|유아|성인|남성|여성|종합|24시간|소형|대형)$/
  if (genericModifiers.test(potentialName)) {
    return { isSpecific: false, businessName: null }
  }

  // 3. SERP 제목들에서 상호명 후보 등장 빈도 확인
  const escaped = potentialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nameRegex = new RegExp(escaped, 'gi')
  let matchCount = 0

  for (const item of items) {
    const text = `${item.title.replace(/<[^>]*>/g, '')} ${item.description.replace(/<[^>]*>/g, '')}`
    if (nameRegex.test(text)) {
      matchCount++
    }
    nameRegex.lastIndex = 0 // 글로벌 정규식 리셋
  }

  // SERP 5개 중 3개 이상에서 등장하면 특정 상호명
  if (matchCount >= 3) {
    const suffix = cleaned.replace(potentialName, '').trim()
    return { isSpecific: true, businessName: suffix ? `${potentialName} ${suffix}` : potentialName }
  }

  return { isSpecific: false, businessName: null }
}

// ===== 데이터 강화 헬퍼 함수들 =====

/**
 * 네이버 웹 검색 API 폴백 (블로그 검색 결과 없을 때 키워드 의미 파악용)
 */
async function fetchNaverWebSearch(keyword: string, display: number = 5): Promise<{ title: string; description: string }[]> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return []

  try {
    const params = new URLSearchParams({ query: keyword, display: String(display) })
    const res = await fetch(`https://openapi.naver.com/v1/search/webkr.json?${params}`, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []).map((item: { title: string; description: string }) => ({
      title: item.title.replace(/<[^>]*>/g, ''),
      description: item.description.replace(/<[^>]*>/g, ''),
    }))
  } catch {
    return []
  }
}

/**
 * SERP 자동 참조: 네이버 블로그 상위 결과 + 1위 글 구조 분석
 * 블로그 검색 결과 없으면 웹 검색으로 폴백하여 키워드 의미 파악
 */
async function fetchSerpReference(keyword: string): Promise<{ text: string; count: number; items: NaverBlogSearchItem[]; keywordContext: string } | null> {
  const hasNaverApi = process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET
  if (!hasNaverApi) return null

  try {
    const result = await searchNaverBlog(keyword, 5)
    const hasBlogResults = result.items && result.items.length > 0

    // 블로그 검색 결과가 없으면 웹 검색으로 폴백
    if (!hasBlogResults) {
      console.log(`[Content SERP] 블로그 검색 결과 0건 → 웹 검색 폴백 시도: "${keyword}"`)
      const webResults = await fetchNaverWebSearch(keyword, 5)
      if (webResults.length === 0) return null

      // 웹 검색 결과로 키워드 컨텍스트만 생성 (SERP 분석 없이)
      const topPosts = webResults.map((item, i) =>
        `${i + 1}. "${item.title}" - ${item.description.substring(0, 100)}`
      )
      const keywordContext = `## ⚠️ 키워드 의미 파악 (최우선 - 반드시 읽고 따르세요)
"${keyword}" 검색 시 네이버에서 실제로 나오는 결과입니다:
${topPosts.join('\n')}

**위 검색 결과를 분석하여 "${keyword}"가 실제로 무엇을 의미하는지 정확히 파악한 뒤 콘텐츠를 작성하세요.**
- 이 키워드는 약어, 신조어, 줄임말일 수 있습니다. 검색 결과에서 드러나는 실제 의미를 따르세요
- 검색 결과와 전혀 다른 주제의 콘텐츠를 생성하면 안 됩니다
- 키워드를 임의로 해석하거나 허구의 정의를 만들어내지 마세요`

      return { text: '', count: 0, items: [], keywordContext }
    }

    const topPosts = result.items.slice(0, 5).map((item, i) => {
      const cleanTitle = item.title.replace(/<[^>]*>/g, '')
      const cleanDesc = item.description.replace(/<[^>]*>/g, '').substring(0, 100)
      return `${i + 1}. "${cleanTitle}" - ${cleanDesc}`
    })

    // 상위 1위 글의 본문 구조 분석 시도
    let structureInfo = ''
    const topUrl = result.items[0]?.link
    if (topUrl) {
      try {
        const structureResult = await fetchTopPostStructure(topUrl)
        if (structureResult) {
          structureInfo = `\n\n상위 1위 글 구조 분석:
- 글자 수: ${structureResult.charCount.toLocaleString()}자
- 소제목: ${structureResult.headingCount}개
- 이미지: ${structureResult.imageCount}개
→ 이보다 더 풍부하고 체계적인 구조로 작성하세요.`
        }
      } catch { /* 구조 분석 실패는 무시 */ }
    }

    // 상위 게시물 제목/설명에서 키워드 의미 컨텍스트 추출
    const keywordContext = `## ⚠️ 키워드 의미 파악 (최우선 - 반드시 읽고 따르세요)
"${keyword}" 검색 시 네이버에서 실제로 나오는 글들의 제목과 설명입니다:
${topPosts.join('\n')}

**위 검색 결과를 분석하여 "${keyword}"가 실제로 무엇을 의미하는지 정확히 파악한 뒤 콘텐츠를 작성하세요.**
- 이 키워드는 약어, 신조어, 줄임말일 수 있습니다. 검색 결과에서 드러나는 실제 의미를 따르세요
- 검색 결과와 전혀 다른 주제의 콘텐츠를 생성하면 안 됩니다
- 키워드를 임의로 해석하거나 허구의 정의를 만들어내지 마세요`

    const text = `## 현재 상위 노출 블로그 분석
다음은 "${keyword}" 검색 시 상위에 노출되는 글들입니다. 이들보다 더 유용하고 차별화된 콘텐츠를 작성하세요:
${topPosts.join('\n')}${structureInfo}

차별화 전략:
- 위 글들이 다루지 않는 정보나 관점을 추가하세요
- 더 구체적인 수치, 날짜, 경험 정보를 포함하세요
- 더 체계적인 구조와 깊이 있는 분석을 제공하세요`

    return { text, count: topPosts.length, items: result.items, keywordContext }
  } catch {
    return null
  }
}

/**
 * 상위 1위 블로그 글의 구조 분석 (글자수, 소제목 수, 이미지 수)
 */
async function fetchTopPostStructure(url: string): Promise<{
  charCount: number
  headingCount: number
  imageCount: number
} | null> {
  try {
    // 모바일 URL로 변환하여 SSR 콘텐츠 접근
    const mobileUrl = url.replace('://blog.naver.com', '://m.blog.naver.com')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(mobileUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) return null
    const html = await res.text()

    // 본문 텍스트 길이 추정 (스크립트/스타일 태그 제거 후)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const charCount = textContent.length > 500 ? textContent.length : 0

    // 소제목 수 (h2, h3, se-text-paragraph에서 strong 태그 등)
    const headingMatches = html.match(/<h[23][^>]*>/gi)
    const headingCount = headingMatches ? headingMatches.length : 0

    // 이미지 수 (과다 카운트 방지: 최대 20)
    const imageMatches = html.match(/<img[^>]+src="[^"]*postfiles[^"]*"/gi) || html.match(/<img[^>]+>/gi)
    const imageCount = imageMatches ? Math.min(imageMatches.length, 20) : 0

    if (charCount === 0) return null

    return { charCount, headingCount, imageCount }
  } catch {
    return null
  }
}

/**
 * 연관 키워드 데이터 조회 (검색광고 API)
 * 검색량, 경쟁도 등을 가져와 AI 프롬프트에 주입
 */
async function fetchRelatedKeywordsForContent(keyword: string): Promise<{
  text: string
  topKeywords: string[]
  count: number
} | null> {
  const hasNaverAdApi = process.env.NAVER_AD_API_KEY &&
    process.env.NAVER_AD_SECRET_KEY &&
    process.env.NAVER_AD_CUSTOMER_ID
  if (!hasNaverAdApi) return null

  try {
    const results = await getKeywordStats(keyword)
    if (!results || results.length === 0) return null

    const normalizedKeyword = keyword.replace(/\s+/g, '')

    // 검색량 >= 50이고, 입력 키워드 자체가 아닌 연관 키워드만 필터
    const relevant = results
      .filter((kw: NaverKeywordResult) => {
        const total = kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt
        return total >= 50 && kw.relKeyword.replace(/\s+/g, '') !== normalizedKeyword
      })
      .sort((a: NaverKeywordResult, b: NaverKeywordResult) => {
        const totalA = a.monthlyPcQcCnt + a.monthlyMobileQcCnt
        const totalB = b.monthlyPcQcCnt + b.monthlyMobileQcCnt
        return totalB - totalA
      })
      .slice(0, 15)

    if (relevant.length === 0) return null

    const topKeywords = relevant.slice(0, 5).map((kw: NaverKeywordResult) => kw.relKeyword)

    const lines = relevant.map((kw: NaverKeywordResult) => {
      const total = kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt
      const compLabel = kw.compIdx === 'HIGH' ? '경쟁높음' :
        kw.compIdx === 'MEDIUM' ? '경쟁보통' :
        kw.compIdx === 'LOW' ? '경쟁낮음' : '미확인'
      return `- "${kw.relKeyword}" (월 ${total.toLocaleString()}회, ${compLabel})`
    })

    const text = `## 네이버 연관 키워드 데이터
"${keyword}" 검색 시 실제로 함께 검색되는 연관 키워드들입니다. 검색량이 높은 키워드를 본문에 자연스럽게 포함하면 SEO 효과가 높아집니다:
${lines.join('\n')}

활용 전략:
- 검색량 상위 3~5개 키워드는 소제목이나 본문에 반드시 포함
- 경쟁 낮은 키워드는 자연스럽게 배치하여 롱테일 노출 확보
- 키워드 스터핑은 절대 금지 (자연스러운 문맥에서만 사용)`

    return { text, topKeywords, count: relevant.length }
  } catch {
    return null
  }
}

/**
 * 검색 트렌드 데이터 조회 (데이터랩 API)
 * 키워드의 최근 트렌드를 분석하여 AI 프롬프트에 주입
 */
async function fetchKeywordTrendForContent(keyword: string): Promise<{
  text: string
  direction: string
  ratio: number
} | null> {
  try {
    const trend = await fetchKeywordTrend(keyword)
    if (!trend.isAvailable) return null

    const directionLabel = {
      rising: '상승 중',
      stable: '안정적',
      declining: '하락 중',
    }[trend.trendDirection]

    // 최근 6개월 미니 차트
    const recent6 = trend.data.slice(-6).map(d => {
      const month = d.period.substring(5, 7) + '월'
      const barLength = Math.max(1, Math.round(d.ratio / 10))
      const bar = '\u2588'.repeat(barLength)
      return `${month} ${bar} (${d.ratio})`
    })

    const trendAdvice = trend.trendDirection === 'rising'
      ? '이 키워드는 관심이 증가하고 있습니다. "최근", "2026년" 등 최신 정보를 강조하고, 시의성 있는 내용을 포함하세요.'
      : trend.trendDirection === 'declining'
        ? '관심이 감소하는 추세입니다. 핵심 정보를 집중적으로 다루고, 관련 대안 키워드("연관 키워드 데이터" 참고)도 적극 활용하세요.'
        : '꾸준한 관심이 있는 키워드입니다. 전문성 있는 깊이 있는 콘텐츠로 차별화하세요.'

    const text = `## 검색 트렌드 분석
"${keyword}" 키워드의 최근 검색 트렌드: ${directionLabel}
최근 인기도: ${trend.recentRatio}/100 (12개월 평균: ${trend.avgRatio}/100)

최근 6개월 추이:
${recent6.join('\n')}

${trendAdvice}`

    return { text, direction: directionLabel, ratio: trend.recentRatio }
  } catch {
    return null
  }
}

// Supabase에 생성된 콘텐츠 저장 + 사용량 증가
async function saveGeneratedContent(keyword: string, title: string, content: string, additionalKeywords?: string[]) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const seoScore = calculateBasicSeoScore(keyword, title, content, additionalKeywords)

    // 콘텐츠 저장 (SEO 점수 포함)
    const { data } = await supabase.from('generated_content').insert({
      user_id: user.id,
      target_keyword: keyword,
      title,
      content,
      status: 'draft',
      seo_score: seoScore,
    }).select('id').single()

    // 크레딧 차감
    await deductCredits(supabase, user.id, 'content_generation', { keyword })

    return { id: data?.id || null, seoScore }
  } catch {
    console.error('[Content] DB 저장 실패')
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 사용자의 AI 제공자 조회
    const provider = await getUserAiProvider(supabase, user.id)

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'content_generation')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    const { keyword, tone = '친근하고 정보적인', additionalKeywords = [], contentType: requestedType, targetLength, includeFaq, referenceAnalysis, businessInfo, contentDirection, advancedOptions, domainCategory, customDomain } = await request.json()

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '타겟 키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 콘텐츠 생성 요청 구성
    const contentRequest: ContentGenerationRequest = {
      keyword: keyword.trim(),
      tone,
      additionalKeywords: additionalKeywords.length > 0 ? additionalKeywords : undefined,
      contentType: requestedType || detectContentType(keyword.trim()),
      targetLength: targetLength || 'medium',
      includeFaq: includeFaq === true,
      businessInfo: businessInfo?.name ? businessInfo : undefined,
      contentDirection: typeof contentDirection === 'string' && contentDirection.trim() ? contentDirection.trim() : undefined,
      domainCategory: domainCategory || detectDomainCategory(keyword.trim()) || undefined,
      customDomain: domainCategory === 'other' && typeof customDomain === 'string' ? customDomain.trim() || undefined : undefined,
      advancedOptions: advancedOptions || undefined,
    }

    // API 키가 없으면 데모 콘텐츠 (엔진 활용)
    if (!hasAiApiKey(provider)) {
      const demo = generateDemoContent(contentRequest)
      const saved = await saveGeneratedContent(keyword.trim(), demo.title, demo.content, contentRequest.additionalKeywords)
      return NextResponse.json({
        ...demo,
        contentId: saved?.id,
        seoScore: saved?.seoScore,
      })
    }

    // === 실제 API: NDJSON 스트리밍으로 프로그레스 전송 ===
    const trimmedKeyword = keyword.trim()
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        try {
          // Step 1/4: 네이버 데이터 수집 (5개 API 병렬 호출, 개별 완료 추적)
          let enrichmentsDone = 0
          const TOTAL_ENRICHMENTS = 5

          send({ type: 'progress', step: 1, totalSteps: 6, message: '네이버 데이터 수집 중...', current: 0, total: TOTAL_ENRICHMENTS })

          const wrapEnrichment = <T>(promise: Promise<T>): Promise<T> => {
            return promise.finally(() => {
              enrichmentsDone++
              send({
                type: 'progress', step: 1, totalSteps: 6,
                message: `네이버 데이터 수집 중... (${enrichmentsDone}/${TOTAL_ENRICHMENTS})`,
                current: enrichmentsDone, total: TOTAL_ENRICHMENTS,
              })
            })
          }

          const enrichmentType = contentRequest.contentType === 'local' ? 'local'
            : contentRequest.contentType === 'comparison' ? 'comparison'
            : 'other'

          const [serpResult, keywordsResult, trendResult, searchEnrichmentResult, learningResult] = await Promise.allSettled([
            wrapEnrichment(fetchSerpReference(trimmedKeyword)),
            wrapEnrichment(fetchRelatedKeywordsForContent(trimmedKeyword)),
            wrapEnrichment(fetchKeywordTrendForContent(trimmedKeyword)),
            wrapEnrichment(getSearchEnrichmentData(trimmedKeyword, enrichmentType)),
            wrapEnrichment(getPatternPromptSection(trimmedKeyword, contentRequest.contentType || 'informational', contentRequest.domainCategory || null)),
          ])

          const serpRef = serpResult.status === 'fulfilled' ? serpResult.value : null
          const keywordsRef = keywordsResult.status === 'fulfilled' ? keywordsResult.value : null
          const trendRef = trendResult.status === 'fulfilled' ? trendResult.value : null
          const searchEnrichment = searchEnrichmentResult.status === 'fulfilled' ? searchEnrichmentResult.value : null
          const learningRef = learningResult.status === 'fulfilled' ? learningResult.value : null

          // 블로그 학습 파이프라인: 백그라운드 수집
          if (serpRef?.items) {
            scheduleCollection(() => collectFromSearchResults(trimmedKeyword, serpRef.items, 'content_generation'))
          }

          // 연관 키워드 상위 5개를 additionalKeywords에 자동 병합
          if (keywordsRef && keywordsRef.topKeywords.length > 0) {
            const existingSet = new Set(contentRequest.additionalKeywords || [])
            const merged = [...(contentRequest.additionalKeywords || [])]
            for (const kw of keywordsRef.topKeywords) {
              if (!existingSet.has(kw)) {
                existingSet.add(kw)
                merged.push(kw)
              }
            }
            contentRequest.additionalKeywords = merged.slice(0, 10)
          }

          // Step 2/4: 검색 데이터 분석 (SERP 기반 키워드/콘텐츠 유형 교정)
          send({ type: 'progress', step: 2, totalSteps: 6, message: '검색 데이터 분석 중...' })

          let serpKeywordMeaning: string | null = null
          let serpInferredCategory = ''
          let specificBusiness: { isSpecific: boolean; businessName: string | null } = { isSpecific: false, businessName: null }
          const originalContentType = contentRequest.contentType

          if (serpRef && serpRef.items.length > 0) {
            const serpItems = serpRef.items.map(item => ({
              title: item.title,
              description: item.description,
            }))

            if (originalContentType === 'local') {
              specificBusiness = detectSpecificBusiness(trimmedKeyword, serpItems)
              if (specificBusiness.isSpecific) {
                console.log(`[Content] ★ 특정 상호명 감지: "${specificBusiness.businessName}" → 단일 업체 소개/리뷰 모드`)
                contentRequest.specificBusinessName = specificBusiness.businessName!
              }
            }

            const inference = inferContentTypeFromSerp(serpItems)
            serpInferredCategory = inference.category

            if (!requestedType && inference.suggestedType && inference.suggestedType !== contentRequest.contentType) {
              if (specificBusiness.isSpecific) {
                console.log(`[Content] ★ SERP가 ${inference.suggestedType}을 제안했지만, 특정 상호명 감지로 local 유지`)
              } else {
                console.log(`[Content] ★ SERP 기반 콘텐츠 유형 교정: ${contentRequest.contentType} → ${inference.suggestedType} (카테고리: ${serpInferredCategory})`)
                contentRequest.contentType = inference.suggestedType as 'review' | 'howto' | 'comparison'
              }
            }

            serpKeywordMeaning = extractKeywordMeaning(trimmedKeyword, serpItems)
            if (serpKeywordMeaning) {
              console.log(`[Content] ★ 키워드 의미 추출: "${trimmedKeyword}" = "${serpKeywordMeaning}"`)
            }
          }

          const noSerpData = !serpRef
          const noKeywordData = !keywordsRef
          const noTrendData = !trendRef
          const isUnknownKeyword = noSerpData && noKeywordData && noTrendData

          console.log(`[Content] 키워드="${trimmedKeyword}" enrichment 결과:`)
          console.log(`  SERP: ${serpRef ? `${serpRef.count}개 결과` : 'null'}`)
          console.log(`  키워드: ${keywordsRef ? `${keywordsRef.count}개 연관` : 'null'}`)
          console.log(`  트렌드: ${trendRef ? `${trendRef.direction}(${trendRef.ratio})` : 'null'}`)
          console.log(`  SERP 추론: 유형=${contentRequest.contentType}, 카테고리=${serpInferredCategory || '없음'}, 의미=${serpKeywordMeaning || '없음'}`)
          console.log(`  특정상호: ${specificBusiness.isSpecific ? specificBusiness.businessName : '아님'}`)
          console.log(`  isUnknownKeyword: ${isUnknownKeyword}`)

          // AI 프롬프트 생성
          let systemPrompt = buildSystemPrompt(contentRequest)

          if (serpKeywordMeaning || serpRef?.keywordContext) {
            let keywordDefinition = `## 🔴 키워드 정의 (이 정보를 반드시 먼저 읽고 따르세요)\n`
            if (serpKeywordMeaning) {
              keywordDefinition += `"${trimmedKeyword}"의 실제 의미: "${serpKeywordMeaning}"\n`
            }
            if (serpRef?.keywordContext) {
              const contextLines = serpRef.keywordContext.split('\n').filter(l => /^\d+\./.test(l.trim()))
              if (contextLines.length > 0) {
                keywordDefinition += `\n네이버 검색 결과:\n${contextLines.join('\n')}\n`
              }
            }
            keywordDefinition += `\n**위 정보가 이 키워드의 실제 의미입니다. 이와 다른 의미로 해석하거나 허구의 정의를 만들어내면 안 됩니다.**\n**키워드의 실제 의미에 맞는 콘텐츠를 작성하세요.**\n\n`
            systemPrompt = keywordDefinition + systemPrompt
          }

          if (specificBusiness.isSpecific && specificBusiness.businessName) {
            const serpTitles = serpRef?.items
              ?.slice(0, 5)
              .map(item => item.title.replace(/<[^>]*>/g, ''))
              .join('\n- ') || ''
            if (serpTitles) {
              systemPrompt = `## 네이버 검색 결과 참고 (${specificBusiness.businessName})\n- ${serpTitles}\n\n위 검색 결과를 참고하여 "${specificBusiness.businessName}"에 대한 정보를 정리하세요.\n\n` + systemPrompt
            }
          }

          let userMessagePrefix = ''
          if (serpKeywordMeaning) {
            userMessagePrefix += `## 키워드 의미 확인\n"${trimmedKeyword}" = "${serpKeywordMeaning}"\n이 의미에 맞는 콘텐츠를 작성하세요.\n\n`
          }
          if (serpRef?.keywordContext) {
            userMessagePrefix += serpRef.keywordContext + '\n\n'
          }
          if (isUnknownKeyword) {
            userMessagePrefix += `## ⛔ 중요 경고: 데이터 없는 키워드
"${trimmedKeyword}" 키워드로 네이버 검색 결과, 연관 키워드, 검색 트렌드가 모두 존재하지 않습니다.

이는 다음 중 하나를 의미합니다:
1. 실제로 존재하지 않는 단어/개념
2. 검색량이 거의 없는 극히 마이너한 키워드
3. 오타이거나 의미 없는 문자열

**반드시 다음 규칙을 따르세요:**
- 만약 이 키워드가 실제로 존재하는 개념이라면 → 정상적으로 콘텐츠를 작성하세요
- 만약 이 키워드가 존재하지 않거나 의미를 알 수 없다면 → content 필드에 반드시 다음 문구로 시작하세요: "⚠️ 정보 부족: 이 키워드에 대한 검색 데이터가 존재하지 않습니다."
- 절대 존재하지 않는 개념을 허구로 만들어내지 마세요
- "~란?", "~의 정의" 같은 식으로 없는 개념을 설명하는 것은 금지입니다
- 확실하지 않은 정보를 사실인 것처럼 작성하지 마세요

`
          }

          let userMessage = userMessagePrefix + buildUserPrompt(contentRequest)
          if (keywordsRef) userMessage += '\n\n' + keywordsRef.text
          if (trendRef) userMessage += '\n\n' + trendRef.text
          if (serpRef) userMessage += '\n\n' + serpRef.text
          if (learningRef && learningRef.sampleCount >= 3) userMessage += '\n\n' + learningRef.text

          if (searchEnrichment) {
            if (searchEnrichment.realBusinessNames && searchEnrichment.realBusinessNames.length > 0) {
              userMessage += `\n\n## 네이버 검색에서 확인된 실제 업체
다음은 "${keyword}" 검색 시 네이버에서 실제로 확인되는 업체들입니다:
${searchEnrichment.realBusinessNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

⚠️ 필수 규칙:
- 위 업체명 또는 검색 결과에 등장하는 실제 업체명만 사용하세요
- 가짜 업체명을 만들지 마세요 (A 학원, B 카페 같은 가명 절대 금지)
- 확인할 수 없는 가격·주소·운영시간은 "직접 문의 필요"로 표시하세요`
            }
            if (searchEnrichment.realProductNames && searchEnrichment.realProductNames.length > 0) {
              userMessage += `\n\n## 네이버 검색에서 확인된 실제 제품
다음은 "${keyword}" 검색 시 네이버에서 실제로 확인되는 제품들입니다:
${searchEnrichment.realProductNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

⚠️ 필수: 위 제품명 또는 검색 결과에 등장하는 실제 제품명만 사용하세요. 가짜 제품명 금지.`
            }
          }

          if (referenceAnalysis && referenceAnalysis.headings?.length > 0) {
            userMessage += `\n\n## 참고 블로그 구조 분석
상위노출 블로그의 구조를 참고하여 유사하거나 더 나은 구조로 작성해주세요:
- 참고 글 제목: "${referenceAnalysis.title}"
- 참고 글 분량: ${referenceAnalysis.charCount?.toLocaleString() || '알 수 없음'}자
- 참고 글 목차: ${referenceAnalysis.headings.join(' → ')}
위 구조를 참고하되, 동일한 내용 복사가 아닌 키워드에 맞는 독창적인 콘텐츠를 작성하세요.`
          }

          // enrichment 메타데이터
          const enrichment: Record<string, unknown> = {}
          if (keywordsRef) {
            enrichment.relatedKeywordsCount = keywordsRef.count
            enrichment.autoKeywords = keywordsRef.topKeywords
          }
          if (trendRef) {
            enrichment.trendDirection = trendRef.direction
            enrichment.trendRatio = trendRef.ratio
          }
          if (serpRef) {
            enrichment.serpRefCount = serpRef.count
          }
          if (learningRef) {
            enrichment.learningPatternCount = learningRef.sampleCount
            enrichment.learningMatchType = learningRef.matchType
          }
          const hasEnrichment = Object.keys(enrichment).length > 0

          // Step 3/4: AI 콘텐츠 생성
          send({ type: 'progress', step: 3, totalSteps: 6, message: 'AI 콘텐츠 생성 중...' })

          try {
            const onDelta = (delta: string) => send({ type: 'stream', delta })
            const response = provider === 'gemini'
              ? await callGeminiStream(systemPrompt, userMessage, 4096, { jsonMode: true, thinkingBudget: 2048 }, onDelta)
              : await callClaudeStream(systemPrompt, userMessage, 4096, { jsonMode: true }, onDelta)

            // Step 4/6: SEO 분석 + 후처리
            send({ type: 'progress', step: 4, totalSteps: 6, message: 'SEO 자동 최적화 중...' })

            const parsed = parseGeminiJson<{
              title: string
              content: string
              tags: string[]
              metaDescription?: string
            }>(response)

            const processedResult = postProcessContent(contentRequest, parsed)

            // 로컬 자동 최적화 (API 비용 0)
            const optimizeResult = autoOptimizeContent(
              trimmedKeyword,
              processedResult.title,
              processedResult.content,
              processedResult.tags || parsed.tags,
              contentRequest.additionalKeywords || [],
              processedResult.metaDescription || parsed.metaDescription
            )

            // Self-Healing 패치 전송 (프론트엔드 sweep 애니메이션용)
            // 원본(최적화 전) 콘텐츠 + 패치를 보내서 "AI가 스스로 수정하는" 효과 표현
            if (optimizeResult.patches.length > 0) {
              send({
                type: 'selfHealPatches',
                rawTitle: processedResult.title,
                rawContent: processedResult.content,
                patches: optimizeResult.patches,
              })
            }

            // 최적화 항목별 서브 프로그레스 전송
            if (optimizeResult.optimizations.length > 0) {
              for (let i = 0; i < optimizeResult.optimizations.length; i++) {
                send({
                  type: 'progress', step: 4, totalSteps: 6,
                  message: `SEO 자동 최적화 중... ${optimizeResult.optimizations[i]}`,
                  current: i + 1,
                  total: optimizeResult.optimizations.length,
                })
              }
            }

            // Step 5/6: 품질 검증
            const scoreDiff = optimizeResult.scoreAfter - optimizeResult.scoreBefore
            send({
              type: 'progress', step: 5, totalSteps: 6,
              message: scoreDiff > 0
                ? `품질 검증 완료 (SEO 점수: ${optimizeResult.scoreBefore} → ${optimizeResult.scoreAfter}, +${scoreDiff}점 자동 개선)`
                : `품질 검증 완료 (SEO 점수: ${optimizeResult.scoreAfter}점)`,
            })

            const validation = validateContentStructure(
              optimizeResult.content,
              contentRequest.contentType || detectContentType(trimmedKeyword),
              trimmedKeyword
            )

            if (isUnknownKeyword && !optimizeResult.content.includes('정보 부족')) {
              validation.warnings.push('이 키워드는 네이버 검색 데이터가 없습니다. AI가 생성한 내용의 정확성을 직접 확인해주세요.')
              validation.score = Math.max(0, validation.score - 20)
            }

            // Step 6/6: 저장
            send({ type: 'progress', step: 6, totalSteps: 6, message: '저장 중...' })

            const saved = await saveGeneratedContent(trimmedKeyword, optimizeResult.title, optimizeResult.content, contentRequest.additionalKeywords)

            send({
              type: 'result',
              ...processedResult,
              title: optimizeResult.title,
              content: optimizeResult.content,
              tags: optimizeResult.tags,
              metaDescription: optimizeResult.metaDescription,
              isDemo: false,
              contentId: saved?.id,
              seoScore: optimizeResult.scoreAfter,
              enrichment: hasEnrichment ? enrichment : undefined,
              unknownKeyword: isUnknownKeyword || undefined,
              validation: {
                score: validation.score,
                warnings: validation.warnings,
                errors: validation.errors,
                isValid: validation.isValid,
              },
              autoOptimized: optimizeResult.optimizations.length > 0,
              optimizations: optimizeResult.optimizations,
              scoreBefore: optimizeResult.scoreBefore,
              scoreAfter: optimizeResult.scoreAfter,
            })
          } catch (aiError) {
            const aiMsg = aiError instanceof Error ? aiError.message : String(aiError)

            if (aiMsg.includes('429') || aiMsg.includes('quota') || aiMsg.includes('Too Many Requests')) {
              send({ type: 'error', error: 'AI API 사용량 한도에 도달했습니다. 1분 후 다시 시도해주세요.' })
              return
            }

            if (aiMsg.includes('JSON') || aiMsg.includes('파싱')) {
              const demo = generateDemoContent(contentRequest)
              const saved = await saveGeneratedContent(trimmedKeyword, demo.title, demo.content)
              send({
                type: 'result',
                ...demo,
                contentId: saved?.id,
                seoScore: saved?.seoScore,
                isDemo: true,
                notice: 'AI 응답 형식 오류로 데모 콘텐츠를 대신 생성했습니다.',
              })
              return
            }

            throw aiError
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error('[AI Content] 스트리밍 오류:', errorMessage)

          if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
            send({ type: 'error', error: 'AI API 사용량 한도에 도달했습니다. 1분 후 다시 시도해주세요.' })
          } else {
            send({ type: 'error', error: 'AI 콘텐츠 생성 중 오류가 발생했습니다.' })
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[AI Content] 오류:', errorMessage)

    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
      return NextResponse.json(
        { error: 'AI API 사용량 한도에 도달했습니다. 1분 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'AI 콘텐츠 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
