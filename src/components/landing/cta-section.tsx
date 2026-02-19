import Link from 'next/link'
import { ArrowRight, Check, Clock, Wand2, BarChart3, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

const valuePoints = [
  { icon: Clock, text: '글 작성 시간 95% 절감' },
  { icon: Wand2, text: 'AI SEO 콘텐츠 자동 생성' },
  { icon: BarChart3, text: '100점 만점 SEO 분석' },
  { icon: TrendingUp, text: '네이버 순위 자동 추적' },
]

const trustSignals = [
  '3분 만에 가입 완료',
  '무료 체험 후 결정',
  '7일 환불 보장',
  '장기 계약 없음',
]

export function CtaSection() {
  return (
    <section className="py-20 bg-primary/5">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          블로그 글 쓰느라 하루 종일 보내지 마세요
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          월 <span className="font-semibold text-foreground">29,000원</span>으로 SEO 전문가를 고용하세요.
          <br className="hidden sm:block" />
          매달 <span className="font-semibold text-foreground">50시간 이상</span> 절약하고, 상위 노출에 집중하세요.
        </p>

        {/* 가치 요약 */}
        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
          {valuePoints.map((point) => (
            <div key={point.text} className="flex flex-col items-center gap-2 rounded-lg bg-background p-4 shadow-sm">
              <point.icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium text-center">{point.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/signup">
            <Button size="lg" className="h-12 whitespace-nowrap px-8">
              무료로 시작하기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="h-12 whitespace-nowrap px-8">
              이미 계정이 있으신가요?
            </Button>
          </Link>
        </div>

        {/* 신뢰 시그널 */}
        <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-4">
          {trustSignals.map((signal) => (
            <div key={signal} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary" />
              {signal}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
