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
  return keywordList.map((kw: Record<string, unknown>) => {
    const plAvgDepth = typeof kw.plAvgDepth === 'number' ? kw.plAvgDepth : 0
    const rawCompIdx = String(kw.compIdx ?? '').toUpperCase().trim()
    // 유효한 값만 인정, 나머지(한국어, '-', 빈 문자열 등)는 plAvgDepth로 추정
    let compIdx = (['HIGH', 'MEDIUM', 'LOW'].includes(rawCompIdx)) ? rawCompIdx : ''

    if (!compIdx) {
      if (plAvgDepth <= 3) {
        compIdx = 'LOW'
      } else if (plAvgDepth <= 8) {
        compIdx = 'MEDIUM'
      } else {
        compIdx = 'HIGH'
      }
    }

    return {
      relKeyword: kw.relKeyword as string,
      monthlyPcQcCnt: parseSearchCount(kw.monthlyPcQcCnt),
      monthlyMobileQcCnt: parseSearchCount(kw.monthlyMobileQcCnt),
      monthlyAvePcClkCnt: parseSearchCount(kw.monthlyAvePcClkCnt),
      monthlyAveMobileClkCnt: parseSearchCount(kw.monthlyAveMobileClkCnt),
      monthlyAvePcCtr: typeof kw.monthlyAvePcCtr === 'number' ? kw.monthlyAvePcCtr : 0,
      monthlyAveMobileCtr: typeof kw.monthlyAveMobileCtr === 'number' ? kw.monthlyAveMobileCtr : 0,
      plAvgDepth,
      compIdx,
    }
  })
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

// 키워드 점수 계산 (6요소 종합 평가 - 블로그 SEO 관점)
// 높은 점수 = 검색량 충분 + 경쟁 낮음 + CTR 높음 + 모바일 비중 높음 + 니치 기회
// → 상위 노출 가능성이 높은 키워드
export function calculateKeywordScore(keyword: NaverKeywordResult): number {
  const totalSearch = keyword.monthlyPcQcCnt + keyword.monthlyMobileQcCnt
  if (totalSearch === 0) return 0

  // 1. 검색량 점수 (0~35): 구간별 선형 매핑으로 롱테일도 공정하게 평가
  let volumeScore: number
  if (totalSearch >= 50000) volumeScore = 35
  else if (totalSearch >= 10000) volumeScore = 28 + ((totalSearch - 10000) / 40000) * 7
  else if (totalSearch >= 1000) volumeScore = 17 + ((totalSearch - 1000) / 9000) * 11
  else if (totalSearch >= 100) volumeScore = 7 + ((totalSearch - 100) / 900) * 10
  else if (totalSearch >= 10) volumeScore = 3 + ((totalSearch - 10) / 90) * 4  // 10~99 구간 바닥 3점 보장
  else volumeScore = (totalSearch / 10) * 3  // <10 구간도 최소 점수

  // 2. 경쟁도 점수 - plAvgDepth 연속값 (0~25)
  // plAvgDepth = 평균 노출 광고 수. 낮을수록 경쟁이 적어 블로그에 유리
  // 0 → 25점, 5 → 15점, 10 → 8점, 15+ → 3점
  let depthScore: number
  const depth = keyword.plAvgDepth || 0
  if (depth <= 0) depthScore = 25
  else if (depth <= 5) depthScore = 25 - (depth / 5) * 10
  else if (depth <= 10) depthScore = 15 - ((depth - 5) / 5) * 7
  else depthScore = Math.max(3, 8 - ((depth - 10) / 5) * 5)

  // ★ 검색량이 극소(< 50)이면 depth 점수 축소 (최소 40% 보장)
  if (totalSearch < 50) {
    const scaleFactor = Math.max(0.4, totalSearch / 50)
    depthScore = depthScore * scaleFactor
  }

  // 3. 경쟁도 카테고리 점수 (0~15): compIdx 범주형 보조 지표
  let compScore: number
  if (keyword.compIdx === 'LOW') compScore = 15
  else if (keyword.compIdx === 'MEDIUM') compScore = 8
  else if (keyword.compIdx === 'HIGH') compScore = 3
  else compScore = totalSearch < 50 ? 5 : 10  // 미확인 저볼륨: 3→5 완화

  // 4. CTR 보너스 (0~15): 높은 클릭률 = 검색 의도가 명확한 키워드
  const pcCtr = keyword.monthlyAvePcCtr || 0
  const mobileCtr = keyword.monthlyAveMobileCtr || 0
  const mobileWeight = totalSearch > 0 ? keyword.monthlyMobileQcCnt / totalSearch : 0.7
  const weightedCtr = pcCtr * (1 - mobileWeight) + mobileCtr * mobileWeight
  const ctrScore = Math.min(15, weightedCtr * 3)

  // 5. 모바일 비중 보너스 (0~10): 네이버 블로그는 모바일 소비가 주력
  const mobileRatio = totalSearch > 0 ? keyword.monthlyMobileQcCnt / totalSearch : 0
  const mobileScore = Math.min(10, Math.max(0, (mobileRatio - 0.3) * 25))

  // 6. 니치 기회 보너스 (0~8): 저검색량이지만 경쟁이 확실히 낮은 키워드에 보상
  let nicheBonus = 0
  if (totalSearch > 0 && totalSearch < 500) {
    if (depth <= 1 && (keyword.compIdx === 'LOW' || keyword.compIdx === '-')) {
      nicheBonus = totalSearch < 50 ? 8 : 5
    } else if (depth <= 3 && keyword.compIdx !== 'HIGH') {
      nicheBonus = 3
    }
  }

  return Math.min(100, Math.round(volumeScore + depthScore + compScore + ctrScore + mobileScore + nicheBonus))
}
