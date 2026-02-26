import Link from 'next/link'
import { ArrowRight, Check, Clock, Wand2, BarChart3, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

const valuePoints = [
  { icon: Clock, text: '콘텐츠 제작 시간 95% 절감' },
  { icon: Wand2, text: 'AI 기반 SEO 콘텐츠 생성' },
  { icon: BarChart3, text: '10개 항목 SEO 정밀 분석' },
  { icon: TrendingUp, text: '네이버 검색 순위 자동 추적' },
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
          콘텐츠 제작이 아닌, 성과에 집중하세요
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          월 <span className="font-semibold text-foreground">$5</span>부터 SEO 전문 도구를 도입하세요.
          <br className="hidden sm:block" />
          매달 <span className="font-semibold text-foreground">50시간 이상</span>을 절약하고, 상위 노출 전략에 집중할 수 있습니다.
        </p>

        {/* 가치 요약 */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {valuePoints.map((point) => (
            <div key={point.text} className="flex flex-col items-center gap-2 rounded-lg bg-background p-4 shadow-sm">
              <point.icon className="h-5 w-5 text-primary" />
              <span className="whitespace-nowrap text-xs font-medium">{point.text}</span>
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
