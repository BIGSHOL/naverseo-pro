/**
 * 네이버 데이터랩 검색 트렌드 API
 *
 * 키워드의 최근 12개월 검색 트렌드를 조회하여
 * 상승/안정/하락 여부를 판별합니다.
 *
 * API: POST https://openapi.naver.com/v1/datalab/search
 * 인증: NAVER_CLIENT_ID + NAVER_CLIENT_SECRET (블로그 검색과 동일)
 */

export interface TrendDataPoint {
  period: string   // "2025-01-01"
  ratio: number    // 0-100 (상대 검색량)
}

export interface TrendResult {
  keyword: string
  data: TrendDataPoint[]
  trendDirection: 'rising' | 'stable' | 'declining'
  recentRatio: number    // 최근 3개월 평균
  avgRatio: number       // 12개월 전체 평균
  isAvailable: boolean
}

const EMPTY_RESULT = (keyword: string): TrendResult => ({
  keyword,
  data: [],
  trendDirection: 'stable',
  recentRatio: 0,
  avgRatio: 0,
  isAvailable: false,
})

/**
 * 키워드의 최근 12개월 검색 트렌드 조회
 * @param keyword 조회할 키워드
 * @returns TrendResult (실패 시 isAvailable: false)
 */
export async function fetchKeywordTrend(keyword: string): Promise<TrendResult> {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return EMPTY_RESULT(keyword)
  }

  try {
    // 최근 12개월 기간 계산
    const endDate = new Date()
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 1)

    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    const body = {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      timeUnit: 'month',
      keywordGroups: [
        {
          groupName: keyword,
          keywords: [keyword],
        },
      ],
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[DataLab] HTTP 오류: ${res.status}`)
      return EMPTY_RESULT(keyword)
    }

    const json = await res.json()

    // 응답 형식: { startDate, endDate, timeUnit, results: [{ title, keywords, data: [{period, ratio}] }] }
    const results = json.results
    if (!results || results.length === 0 || !results[0].data || results[0].data.length === 0) {
      return EMPTY_RESULT(keyword)
    }

    const data: TrendDataPoint[] = results[0].data.map((d: { period: string; ratio: number }) => ({
      period: d.period,
      ratio: Math.round(d.ratio),
    }))

    // 트렌드 방향 판별: 최근 3개월 vs 이전 기간
    const trendDirection = detectTrendDirection(data)

    // 평균값 계산
    const recentData = data.slice(-3)
    const recentRatio = recentData.length > 0
      ? Math.round(recentData.reduce((s, d) => s + d.ratio, 0) / recentData.length)
      : 0
    const avgRatio = data.length > 0
      ? Math.round(data.reduce((s, d) => s + d.ratio, 0) / data.length)
      : 0

    return {
      keyword,
      data,
      trendDirection,
      recentRatio,
      avgRatio,
      isAvailable: true,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[DataLab] 타임아웃 (5초)')
    } else {
      console.error('[DataLab] 트렌드 조회 실패:', error)
    }
    return EMPTY_RESULT(keyword)
  }
}

/**
 * 트렌드 방향 판별
 * 최근 3개월 평균 vs 이전 기간 평균 비교
 * - > 1.15 → rising (15% 이상 상승)
 * - < 0.85 → declining (15% 이상 하락)
 * - 그 외 → stable
 */
function detectTrendDirection(data: TrendDataPoint[]): 'rising' | 'stable' | 'declining' {
  if (data.length < 4) return 'stable'

  const recent3 = data.slice(-3)
  const prior = data.slice(0, -3)

  const recentAvg = recent3.reduce((s, d) => s + d.ratio, 0) / recent3.length
  const priorAvg = prior.reduce((s, d) => s + d.ratio, 0) / prior.length

  if (priorAvg === 0) return 'stable'

  const ratio = recentAvg / priorAvg

  if (ratio > 1.15) return 'rising'
  if (ratio < 0.85) return 'declining'
  return 'stable'
}
