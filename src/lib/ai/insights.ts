/**
 * AI 인사이트 헬퍼 — 플랜 체크 + 기능 토글 + Gemini 호출 캡슐화
 *
 * 플랜별 차등:
 * - report, dashboard: Lite 이상
 * - keyword, tracking: Starter 이상
 *
 * 실패 시 null 반환 (기존 규칙 기반 폴백)
 */

import { callGemini, parseGeminiJson } from '@/lib/ai/gemini'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

/** 프롬프트 타입별 최소 플랜 레벨 */
const MIN_PLAN_LEVEL: Record<string, string[]> = {
  report: ['lite', 'starter', 'pro', 'enterprise', 'admin'],
  dashboard: ['lite', 'starter', 'pro', 'enterprise', 'admin'],
  keyword: ['starter', 'pro', 'enterprise', 'admin'],
  tracking: ['starter', 'pro', 'enterprise', 'admin'],
}

/**
 * AI 인사이트가 사용 가능한지 체크 (플랜 + 토글)
 */
export async function isAiInsightEnabled(
  supabase: SupabaseClient,
  plan: string,
  promptType: 'report' | 'dashboard' | 'keyword' | 'tracking'
): Promise<boolean> {
  // 1. 플랜 레벨 체크
  const allowedPlans = MIN_PLAN_LEVEL[promptType]
  if (!allowedPlans || !allowedPlans.includes(plan)) {
    return false
  }

  // 2. 관리자 기능 토글 체크 (system_settings.disabled_features)
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'disabled_features')
      .single()

    const disabledFeatures: string[] = data?.value || []
    if (disabledFeatures.includes('ai_insights')) {
      return false
    }
  } catch {
    // system_settings 조회 실패 시 기본 활성화
  }

  return true
}

/**
 * AI 리포트 인사이트 생성
 * @returns 인사이트 문자열 배열 또는 null (폴백 필요)
 */
export async function generateReportInsights(
  supabase: SupabaseClient,
  plan: string,
  data: {
    thisMonthAvg: number | null
    lastMonthAvg: number | null
    thisMonthContent: number
    lastMonthContent: number
    top10This: number
    top10Last: number
    gradeDistribution: Array<{ grade: string; count: number }>
  }
): Promise<string[] | null> {
  if (!(await isAiInsightEnabled(supabase, plan, 'report'))) return null
  if (!process.env.GEMINI_API_KEY) return null

  try {
    const { REPORT_INSIGHT_PROMPT } = await import('@/lib/ai/prompts/insights')

    const userMessage = `다음은 사용자의 SEO 리포트 데이터입니다:

- 이번달 평균 SEO 점수: ${data.thisMonthAvg ?? '데이터 없음'}점
- 지난달 평균 SEO 점수: ${data.lastMonthAvg ?? '데이터 없음'}점
- 이번달 콘텐츠 발행: ${data.thisMonthContent}편
- 지난달 콘텐츠 발행: ${data.lastMonthContent}편
- 이번달 TOP10 키워드: ${data.top10This}개
- 지난달 TOP10 키워드: ${data.top10Last}개
- 등급 분포: ${data.gradeDistribution.map(g => `${g.grade}(${g.count}편)`).join(', ') || '없음'}
- 분석 날짜: ${new Date().toLocaleDateString('ko-KR')}

이 데이터를 기반으로 개인화된 인사이트를 3~5개 생성해주세요.`

    const response = await callGemini(REPORT_INSIGHT_PROMPT, userMessage, 1024, {
      jsonMode: true,
      thinkingBudget: 0,
    })
    const parsed = parseGeminiJson<{ insights: string[] }>(response)
    return parsed.insights?.slice(0, 5) || null
  } catch (e) {
    console.error('[AI Insight] 리포트 인사이트 생성 실패:', e)
    return null
  }
}

/**
 * AI 대시보드 키워드 추천
 * @returns 키워드 문자열 배열 또는 null (폴백 필요)
 */
export async function generateDashboardRecommendations(
  supabase: SupabaseClient,
  plan: string,
  data: {
    keywordHistory: string[]
    contentKeywords: string[]
  }
): Promise<string[] | null> {
  if (!(await isAiInsightEnabled(supabase, plan, 'dashboard'))) return null
  if (!process.env.GEMINI_API_KEY) return null

  try {
    const { DASHBOARD_RECOMMEND_PROMPT } = await import('@/lib/ai/prompts/insights')

    const today = new Date()
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

    const userMessage = `다음은 사용자의 블로그 활동 데이터입니다:

- 최근 검색한 키워드: ${data.keywordHistory.slice(0, 15).join(', ') || '없음'}
- 이미 작성한 콘텐츠 키워드: ${data.contentKeywords.slice(0, 10).join(', ') || '없음'}
- 현재 날짜: ${today.getFullYear()}년 ${monthNames[today.getMonth()]} ${today.getDate()}일
- 계절: ${today.getMonth() >= 2 && today.getMonth() <= 4 ? '봄' : today.getMonth() >= 5 && today.getMonth() <= 7 ? '여름' : today.getMonth() >= 8 && today.getMonth() <= 10 ? '가을' : '겨울'}

이미 작성한 키워드를 제외하고, 다음에 작성하면 좋을 키워드 6개를 추천해주세요.`

    const response = await callGemini(DASHBOARD_RECOMMEND_PROMPT, userMessage, 512, {
      jsonMode: true,
      thinkingBudget: 0,
    })
    const parsed = parseGeminiJson<{ keywords: string[] }>(response)
    return parsed.keywords?.slice(0, 6) || null
  } catch (e) {
    console.error('[AI Insight] 대시보드 추천 생성 실패:', e)
    return null
  }
}

/**
 * AI 키워드 난이도 분석
 * @returns 분석 문자열 또는 null
 */
export async function generateKeywordAnalysis(
  supabase: SupabaseClient,
  plan: string,
  data: {
    seedKeyword: string
    topKeywords: Array<{
      keyword: string
      totalSearch: number
      compIdx: string
      blogCount: number
    }>
  }
): Promise<string | null> {
  if (!(await isAiInsightEnabled(supabase, plan, 'keyword'))) return null
  if (!process.env.GEMINI_API_KEY) return null

  try {
    const { KEYWORD_DIFFICULTY_PROMPT } = await import('@/lib/ai/prompts/insights')

    const top10 = data.topKeywords.slice(0, 10)
    const userMessage = `시드 키워드: "${data.seedKeyword}"

상위 ${top10.length}개 키워드 데이터:
${top10.map((kw, i) => `${i + 1}. "${kw.keyword}" — 월 검색량 ${kw.totalSearch.toLocaleString()}회, 경쟁도 ${kw.compIdx}, 블로그 비율 ${kw.blogCount}/5`).join('\n')}

이 중 블로그 상위노출에 가장 유망한 키워드와 이유를 분석해주세요.`

    const response = await callGemini(KEYWORD_DIFFICULTY_PROMPT, userMessage, 512, {
      jsonMode: true,
      thinkingBudget: 0,
    })
    const parsed = parseGeminiJson<{ analysis: string }>(response)
    return parsed.analysis || null
  } catch (e) {
    console.error('[AI Insight] 키워드 분석 생성 실패:', e)
    return null
  }
}

/**
 * AI 순위 트래킹 분석
 * @returns 분석 문자열 또는 null
 */
export async function generateTrackingAnalysis(
  supabase: SupabaseClient,
  plan: string,
  data: {
    keywords: Array<{
      keyword: string
      blogUrl: string
      currentRank: number | null
      history: Array<{ rank: number | null; date: string }>
    }>
  }
): Promise<string | null> {
  if (!(await isAiInsightEnabled(supabase, plan, 'tracking'))) return null
  if (!process.env.GEMINI_API_KEY) return null
  if (data.keywords.length === 0) return null

  try {
    const { TRACKING_ANALYSIS_PROMPT } = await import('@/lib/ai/prompts/insights')

    const summaries = data.keywords.slice(0, 10).map(kw => {
      const ranks = kw.history.slice(0, 7).map(h =>
        h.rank !== null ? `${h.rank}위` : '미진입'
      ).join(' → ')
      return `"${kw.keyword}": 현재 ${kw.currentRank !== null ? `${kw.currentRank}위` : '미진입'}, 최근 이력 [${ranks}]`
    })

    const userMessage = `트래킹 중인 키워드 ${data.keywords.length}개의 순위 변화:

${summaries.join('\n')}

전체 트래킹 상황을 요약하고, 가장 주목할 키워드와 다음 액션을 제안해주세요.`

    const response = await callGemini(TRACKING_ANALYSIS_PROMPT, userMessage, 512, {
      jsonMode: true,
      thinkingBudget: 0,
    })
    const parsed = parseGeminiJson<{ analysis: string }>(response)
    return parsed.analysis || null
  } catch (e) {
    console.error('[AI Insight] 트래킹 분석 생성 실패:', e)
    return null
  }
}
