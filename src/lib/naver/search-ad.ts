import crypto from 'crypto'

// 네이버 검색광고 API HMAC-SHA256 서명 생성
function generateSignature(
  timestamp: number,
  method: string,
  path: string,
  secretKey: string
): string {
  const message = `${timestamp}.${method}.${path}`
  const hmac = crypto.createHmac('sha256', secretKey)
  hmac.update(message)
  return hmac.digest('base64')
}

export interface NaverKeywordResult {
  relKeyword: string
  monthlyPcQcCnt: number
  monthlyMobileQcCnt: number
  monthlyAvePcClkCnt: number
  monthlyAveMobileClkCnt: number
  monthlyAvePcCtr: number
  monthlyAveMobileCtr: number
  plAvgDepth: number
  compIdx: string // 'HIGH' | 'MEDIUM' | 'LOW'
}

// 네이버 검색광고 API - 키워드 검색량 조회
export async function getKeywordStats(
  hintKeywords: string
): Promise<NaverKeywordResult[]> {
  const apiKey = process.env.NAVER_AD_API_KEY?.trim()
  const secretKey = process.env.NAVER_AD_SECRET_KEY?.trim()
  const customerId = process.env.NAVER_AD_CUSTOMER_ID?.trim()

  if (!apiKey || !secretKey || !customerId) {
    throw new Error('네이버 검색광고 API 키가 설정되지 않았습니다.')
  }

  const timestamp = Date.now()
  const method = 'GET'
  const path = '/keywordstool'
  const signature = generateSignature(timestamp, method, path, secretKey)

  // 네이버 API는 hintKeywords에 공백을 허용하지 않음 → 공백 제거
  const cleanedKeywords = hintKeywords.replace(/\s+/g, '')
  const queryString = `hintKeywords=${encodeURIComponent(cleanedKeywords)}&showDetail=1`

  const response = await fetch(
    `https://api.searchad.naver.com${path}?${queryString}`,
    {
      method,
      headers: {
        'X-API-KEY': apiKey,
        'X-Customer': customerId,
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString(),
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Naver API] 오류:', response.status, errorText)
    throw new Error(`네이버 API 오류: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const keywordList = data.keywordList || []

  // 네이버 API는 검색량이 적으면 "< 10" 같은 문자열을 반환함 → 숫자로 변환
  return keywordList.map((kw: Record<string, unknown>) => ({
    relKeyword: kw.relKeyword as string,
    monthlyPcQcCnt: parseSearchCount(kw.monthlyPcQcCnt),
    monthlyMobileQcCnt: parseSearchCount(kw.monthlyMobileQcCnt),
    monthlyAvePcClkCnt: parseSearchCount(kw.monthlyAvePcClkCnt),
    monthlyAveMobileClkCnt: parseSearchCount(kw.monthlyAveMobileClkCnt),
    monthlyAvePcCtr: typeof kw.monthlyAvePcCtr === 'number' ? kw.monthlyAvePcCtr : 0,
    monthlyAveMobileCtr: typeof kw.monthlyAveMobileCtr === 'number' ? kw.monthlyAveMobileCtr : 0,
    plAvgDepth: typeof kw.plAvgDepth === 'number' ? kw.plAvgDepth : 0,
    compIdx: (kw.compIdx as string) || '-',
  }))
}

// "< 10" 같은 문자열을 숫자로 안전하게 변환
function parseSearchCount(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    // "< 10" → 숫자 부분만 추출
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10)
    if (isNaN(num)) {
      // 숫자가 전혀 없는 문자열 (예: "< 10"에서 공백 제거 후 빈 문자열)
      if (value.includes('<')) return 5 // "< 10" 류 → 5로 추정
      return 0
    }
    return num
  }
  return 0
}

// 키워드 경쟁도를 한국어로 변환
export function getCompetitionLabel(compIdx: string): string {
  switch (compIdx) {
    case 'HIGH':
      return '높음'
    case 'MEDIUM':
      return '보통'
    case 'LOW':
      return '낮음'
    default:
      return '-'
  }
}

// 키워드 점수 계산 (검색량 대비 경쟁도 - 블로그 SEO 관점)
// 높은 점수 = 검색량 충분 + 경쟁 낮음 → 상위 노출 가능성 높은 키워드
export function calculateKeywordScore(keyword: NaverKeywordResult): number {
  const totalSearch = keyword.monthlyPcQcCnt + keyword.monthlyMobileQcCnt
  if (totalSearch === 0) return 0

  // 검색량 점수 (0~50): 구간별 선형 매핑으로 롱테일도 공정하게 평가
  let volumeScore: number
  if (totalSearch >= 50000) volumeScore = 50
  else if (totalSearch >= 10000) volumeScore = 40 + ((totalSearch - 10000) / 40000) * 10
  else if (totalSearch >= 1000) volumeScore = 25 + ((totalSearch - 1000) / 9000) * 15
  else if (totalSearch >= 100) volumeScore = 10 + ((totalSearch - 100) / 900) * 15
  else volumeScore = (totalSearch / 100) * 10

  // 경쟁도 점수 (0~50): LOW가 블로그 노출에 유리
  const compScore =
    keyword.compIdx === 'LOW' ? 50 :
    keyword.compIdx === 'MEDIUM' ? 30 : 10

  return Math.min(100, Math.round(volumeScore + compScore))
}
