// 포트원(PortOne) V2 서버 사이드 유틸리티

const PORTONE_API_URL = 'https://api.portone.io'

// 결제 검증 (포트원 API로 결제 상태 확인)
export async function verifyPayment(paymentId: string) {
  const apiSecret = process.env.PORTONE_API_SECRET
  if (!apiSecret) {
    throw new Error('포트원 API 시크릿이 설정되지 않았습니다.')
  }

  const response = await fetch(
    `${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${apiSecret}`,
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('[PortOne] 결제 조회 오류:', data)
    throw new Error(data.message || '결제 정보를 조회할 수 없습니다.')
  }

  return data
}

// 포트원 설정 여부 확인
export function isPortOneConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_PORTONE_STORE_ID &&
    process.env.PORTONE_API_SECRET
  )
}

// 주문번호 생성 (유니크)
export function generatePaymentId(plan: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `NSEO_${plan}_${timestamp}_${random}`
}
