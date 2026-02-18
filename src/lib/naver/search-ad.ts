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
  const apiKey = process.env.NAVER_AD_API_KEY
  const secretKey = process.env.NAVER_AD_SECRET_KEY
  const customerId = process.env.NAVER_AD_CUSTOMER_ID

  if (!apiKey || !secretKey || !customerId) {
    throw new Error('네이버 검색광고 API 키가 설정되지 않았습니다.')
  }

  const timestamp = Date.now()
  const method = 'GET'
  const path = '/keywordstool'
  const signature = generateSignature(timestamp, method, path, secretKey)

  const params = new URLSearchParams({
    hintKeywords,
    showDetail: '1',
  })

  const response = await fetch(
    `https://api.searchad.naver.com${path}?${params.toString()}`,
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
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10)
    return isNaN(num) ? 5 : num // "< 10"이면 5로 추정
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

// 키워드 점수 계산 (검색량 대비 경쟁도)
export function calculateKeywordScore(keyword: NaverKeywordResult): number {
  const totalSearch = keyword.monthlyPcQcCnt + keyword.monthlyMobileQcCnt
  if (totalSearch === 0) return 0

  // 경쟁도 가중치: LOW=3, MEDIUM=2, HIGH=1
  const compWeight =
    keyword.compIdx === 'LOW' ? 3 : keyword.compIdx === 'MEDIUM' ? 2 : 1

  // 점수 = log(총검색량) × 경쟁도가중치 × 10, 최대 100
  const score = Math.min(100, Math.round(Math.log10(totalSearch + 1) * compWeight * 10))
  return score
}
