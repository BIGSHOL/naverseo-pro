// 토스페이먼츠 서버 사이드 유틸리티

const TOSS_API_URL = 'https://api.tosspayments.com/v1'

// 결제 승인 요청
export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    throw new Error('토스페이먼츠 시크릿 키가 설정되지 않았습니다.')
  }

  const auth = Buffer.from(`${secretKey}:`).toString('base64')

  const response = await fetch(`${TOSS_API_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('[TossPayments] 승인 오류:', data)
    throw new Error(data.message || '결제 승인에 실패했습니다.')
  }

  return data
}

// 토스페이먼츠 설정 여부 확인
export function isTossConfigured(): boolean {
  return !!(process.env.TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY)
}

// 주문번호 생성 (유니크)
export function generateOrderId(plan: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `NSEO_${plan}_${timestamp}_${random}`
}
