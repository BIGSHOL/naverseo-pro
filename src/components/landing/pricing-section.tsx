import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLANS, type Plan } from '@/types/database'
import Link from 'next/link'

const planOrder: Plan[] = ['free', 'starter', 'pro', 'agency']

// 각 플랜별 단가 비교 메시지
const planValueProps: Record<Plan, string | null> = {
  free: null,
  starter: '글 1편당 2,900원 · 커피 한 잔 값',
  pro: '글 1편당 1,180원 · 하루 2,000원 미만',
  agency: '글 1편당 745원 · 대행사 대비 99% 절감',
}

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="secondary" className="mb-4 px-4 py-1.5">
            SEO 대행사 월 50~200만원 → 여기서 월 29,000원
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            블로그 글 1편에 <span className="text-primary">커피 한 잔 값</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            무료로 먼저 체험하고, 효과를 확인한 후 업그레이드하세요
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planOrder.map((planKey) => {
            const plan = PLANS[planKey]
            const valueMessage = planValueProps[planKey]
            return (
              <Card
                key={planKey}
                className={`relative flex flex-col ${
                  plan.popular
                    ? 'border-primary shadow-lg scale-[1.02]'
                    : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    가장 인기
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.priceLabel}</span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/월</span>
                    )}
                  </div>
                  {valueMessage && (
                    <p className="mt-2 text-xs text-primary font-medium">
                      {valueMessage}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-4">
                  <ul className="flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className="mt-6 block">
                    <Button
                      className="w-full"
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {plan.price === 0 ? '무료로 체험하기' : '시작하기'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* 가격 보증 메시지 */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            7일 이내 전액 환불 보장 · 언제든 플랜 변경 가능 · 장기 계약 없음
          </p>
        </div>
      </div>
    </section>
  )
}
