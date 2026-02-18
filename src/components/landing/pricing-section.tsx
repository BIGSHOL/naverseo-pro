import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLANS, type Plan } from '@/types/database'
import Link from 'next/link'

const planOrder: Plan[] = ['free', 'starter', 'pro', 'agency']

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            합리적인 가격, 강력한 기능
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            무료로 시작하고, 필요에 따라 업그레이드하세요
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planOrder.map((planKey) => {
            const plan = PLANS[planKey]
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
                      {plan.price === 0 ? '무료로 시작' : '시작하기'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
