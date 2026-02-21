import { NextRequest, NextResponse } from 'next/server'
import { callAI, getUserAiProvider, hasAiApiKey, parseGeminiJson } from '@/lib/ai/gemini'
import {
  buildSystemPrompt,
  buildUserPrompt,
  detectContentType,
  generateDemoContent,
  postProcessContent,
  analyzeSeo,
  validateContentStructure,
  type ContentGenerationRequest,
} from '@/lib/content/engine'
import { checkContentLimit } from '@/lib/plan-check'
import { searchNaverBlog } from '@/lib/naver/blog-search'
import { getKeywordStats, type NaverKeywordResult } from '@/lib/naver/search-ad'
import { fetchKeywordTrend } from '@/lib/naver/datalab'
import { getSearchEnrichmentData } from '@/lib/naver/search-enrichment'

// 간단한 SEO 점수 계산 (DB 저장용, 100점 만점)
function calculateBasicSeoScore(keyword: string, title: string, content: string, additionalKeywords?: string[]): number {
  const result = analyzeSeo(keyword, title, content, additionalKeywords)
  return result.totalScore
}

// ===== 데이터 강화 헬퍼 함수들 =====

/**
 * SERP 자동 참조: 네이버 블로그 상위 결과 + 1위 글 구조 분석
 */
async function fetchSerpReference(keyword: string): Promise<{ text: string; count: number } | null> {
  const hasNaverApi = process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET
  if (!hasNaverApi) return null

  try {
    const result = await searchNaverBlog(keyword, 5)
    if (!result.items || result.items.length === 0) return null

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

    const text = `## 현재 상위 노출 블로그 분석
다음은 "${keyword}" 검색 시 상위에 노출되는 글들입니다. 이들보다 더 유용하고 차별화된 콘텐츠를 작성하세요:
${topPosts.join('\n')}${structureInfo}

차별화 전략:
- 위 글들이 다루지 않는 정보나 관점을 추가하세요
- 더 구체적인 수치, 날짜, 경험 정보를 포함하세요
- 더 체계적인 구조와 깊이 있는 분석을 제공하세요`

    return { text, count: topPosts.length }
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

    // 사용량 증가
    await supabase.rpc('increment_content_usage', { uid: user.id }).maybeSingle()

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

    // 플랜 사용량 체크
    const planCheck = await checkContentLimit(supabase, user.id)
    if (!planCheck.allowed) {
      return NextResponse.json(
        { error: planCheck.message, planLimit: true, plan: planCheck.plan, limit: planCheck.limit, used: planCheck.used },
        { status: 403 }
      )
    }

    const { keyword, tone = '친근하고 정보적인', additionalKeywords = [], contentType: requestedType, targetLength, includeFaq, referenceAnalysis, businessInfo } = await request.json()

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
      includeFaq: includeFaq !== false,
      businessInfo: businessInfo?.name ? businessInfo : undefined,
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

    // ===== 데이터 강화: 4개 네이버 API 병렬 호출 =====
    const enrichmentType = contentRequest.contentType === 'local' ? 'local'
      : contentRequest.contentType === 'comparison' ? 'comparison'
      : 'other'

    const [serpResult, keywordsResult, trendResult, searchEnrichmentResult] = await Promise.allSettled([
      fetchSerpReference(keyword.trim()),
      fetchRelatedKeywordsForContent(keyword.trim()),
      fetchKeywordTrendForContent(keyword.trim()),
      getSearchEnrichmentData(keyword.trim(), enrichmentType),
    ])

    const serpRef = serpResult.status === 'fulfilled' ? serpResult.value : null
    const keywordsRef = keywordsResult.status === 'fulfilled' ? keywordsResult.value : null
    const trendRef = trendResult.status === 'fulfilled' ? trendResult.value : null
    const searchEnrichment = searchEnrichmentResult.status === 'fulfilled' ? searchEnrichmentResult.value : null

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

    // AI 프롬프트 생성 (additionalKeywords 병합 후)
    const systemPrompt = buildSystemPrompt(contentRequest)
    let userMessage = buildUserPrompt(contentRequest)

    // 프롬프트 주입 순서: 연관 키워드 → 트렌드 → SERP → 참고 블로그
    if (keywordsRef) {
      userMessage += '\n\n' + keywordsRef.text
    }

    if (trendRef) {
      userMessage += '\n\n' + trendRef.text
    }

    if (serpRef) {
      userMessage += '\n\n' + serpRef.text
    }

    // 실제 검색 결과에서 추출한 업체명/제품명 주입 (local/comparison 타입)
    if (searchEnrichment) {
      if (searchEnrichment.realBusinessNames && searchEnrichment.realBusinessNames.length > 0) {
        userMessage += `\n\n## 실제 검색되는 업체 예시
다음은 "${keyword}" 검색 시 실제로 언급되는 업체들입니다. 이를 참고하되, 그대로 사용하지 말고 유사한 패턴으로 콘텐츠를 작성하세요:
${searchEnrichment.realBusinessNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

⚠️ 중요: 위 업체명은 참고만 하세요. 반드시 주제에 맞는 실제 존재할 법한 업체명으로 작성하세요.`
      }

      if (searchEnrichment.realProductNames && searchEnrichment.realProductNames.length > 0) {
        userMessage += `\n\n## 실제 검색되는 제품 예시
다음은 "${keyword}" 검색 시 실제로 언급되는 제품들입니다:
${searchEnrichment.realProductNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

⚠️ 중요: 위 제품명은 참고만 하세요. 비교형 콘텐츠에 맞는 실제 제품으로 작성하세요.`
      }
    }

    // 참고 URL 분석 결과가 있으면 프롬프트에 추가
    if (referenceAnalysis && referenceAnalysis.headings?.length > 0) {
      userMessage += `\n\n## 참고 블로그 구조 분석
상위노출 블로그의 구조를 참고하여 유사하거나 더 나은 구조로 작성해주세요:
- 참고 글 제목: "${referenceAnalysis.title}"
- 참고 글 분량: ${referenceAnalysis.charCount?.toLocaleString() || '알 수 없음'}자
- 참고 글 목차: ${referenceAnalysis.headings.join(' → ')}
위 구조를 참고하되, 동일한 내용 복사가 아닌 키워드에 맞는 독창적인 콘텐츠를 작성하세요.`
    }

    // enrichment 메타데이터 (프론트엔드 표시용)
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
    const hasEnrichment = Object.keys(enrichment).length > 0

    try {
      const response = await callAI(provider, systemPrompt, userMessage, 4096, { jsonMode: true })

      const parsed = parseGeminiJson<{
        title: string
        content: string
        tags: string[]
        metaDescription?: string
      }>(response)

      // 엔진으로 후처리 (SEO 분석 + 가독성 분석 + 태그/메타 보강)
      const processedResult = postProcessContent(contentRequest, parsed)

      // 콘텐츠 품질 검증 (범용 템플릿 남용 감지)
      const validation = validateContentStructure(
        processedResult.content,
        contentRequest.contentType || detectContentType(keyword.trim()),
        keyword.trim()
      )

      // DB에 저장
      const saved = await saveGeneratedContent(keyword.trim(), processedResult.title, processedResult.content, contentRequest.additionalKeywords)

      return NextResponse.json({
        ...processedResult,
        contentId: saved?.id,
        seoScore: saved?.seoScore,
        enrichment: hasEnrichment ? enrichment : undefined,
        validation: {
          score: validation.score,
          warnings: validation.warnings,
          errors: validation.errors,
          isValid: validation.isValid,
        },
      })
    } catch (aiError) {
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError)

      // 429 Rate Limit
      if (aiMsg.includes('429') || aiMsg.includes('quota') || aiMsg.includes('Too Many Requests')) {
        return NextResponse.json(
          { error: 'AI API 사용량 한도에 도달했습니다. 1분 후 다시 시도해주세요.' },
          { status: 429 }
        )
      }

      // JSON 파싱 실패 → 데모 콘텐츠 폴백
      if (aiMsg.includes('JSON') || aiMsg.includes('파싱')) {
        const demo = generateDemoContent(contentRequest)
        const saved = await saveGeneratedContent(keyword.trim(), demo.title, demo.content)
        return NextResponse.json({
          ...demo,
          contentId: saved?.id,
          seoScore: saved?.seoScore,
          isDemo: true,
          notice: 'AI 응답 형식 오류로 데모 콘텐츠를 대신 생성했습니다.',
        })
      }

      throw aiError
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[AI Content] 오류:', errorMessage)

    // 429 Rate Limit
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
