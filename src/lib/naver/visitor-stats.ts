/**
 * 네이버 블로그 방문자 통계 조회
 *
 * NVisitorgp4Ajax.nhn API를 통해 일별 방문자 수를 가져옵니다.
 * 이 API는 인증 없이 접근 가능한 공개 XML 엔드포인트입니다.
 */

export interface VisitorData {
  dailyVisitors: number[]    // 일별 방문자 수 배열
  avgDailyVisitors: number   // 평균 일일 방문자 수
  isAvailable: boolean       // 데이터 조회 성공 여부
  source?: 'api' | 'today' | 'history'  // 데이터 출처: api=30일API, today=오늘만, history=DB누적평균
  historyDays?: number       // history 소스일 때 누적 일수
}

/**
 * 블로그 방문자 수 조회
 * @param blogId 네이버 블로그 ID (예: "myblog123")
 * @returns VisitorData (실패시 isAvailable: false)
 */
export async function fetchBlogVisitors(blogId: string): Promise<VisitorData> {
  try {
    const url = `https://blog.naver.com/NVisitorgp4Ajax.naver?blogId=${encodeURIComponent(blogId)}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5초 타임아웃

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NaverSEO-Pro/1.0',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[VisitorStats] HTTP 오류: ${res.status}`)
      return { dailyVisitors: [], avgDailyVisitors: 0, isAvailable: false }
    }

    const xml = await res.text()
    const visitors = parseVisitorXml(xml)

    if (visitors.length === 0) {
      return { dailyVisitors: [], avgDailyVisitors: 0, isAvailable: false }
    }

    const avg = Math.round(visitors.reduce((s, v) => s + v, 0) / visitors.length)

    return {
      dailyVisitors: visitors,
      avgDailyVisitors: avg,
      isAvailable: true,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[VisitorStats] 타임아웃 (5초)')
    } else {
      console.error('[VisitorStats] 방문자 조회 실패:', error)
    }
    return { dailyVisitors: [], avgDailyVisitors: 0, isAvailable: false }
  }
}

/**
 * NVisitorgp4Ajax 응답 XML 파싱
 * 응답 형식: <visitorcnt> 태그 안에 <visitor cnt="숫자" /> 형태
 */
function parseVisitorXml(xml: string): number[] {
  const visitors: number[] = []

  // <visitor cnt="123" /> 패턴 매칭
  const regex = /cnt="(\d+)"/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(xml)) !== null) {
    const count = parseInt(match[1], 10)
    if (!isNaN(count)) {
      visitors.push(count)
    }
  }

  return visitors
}
