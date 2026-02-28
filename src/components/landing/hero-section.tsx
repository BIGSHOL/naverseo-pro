import Link from 'next/link'
import { ArrowRight, Sparkles, Search, Wand2, BarChart3, TrendingUp, Clock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            블로그 글 1편 작성 시간: 3시간 → 10분
          </Badge>

          <h1 className="text-[28px] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            블로그 1편에 3시간?
            <br />
            <span className="text-primary">AI로 10분이면 끝납니다</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-xl">
            키워드 발굴부터 SEO 최적화 글 작성,{' '}
            <br className="hidden sm:block" />
            점수 분석, 순위 추적까지.
            <br />
            월 <span className="font-semibold text-foreground">$5</span>부터 SEO 전문가를 고용하세요.
          </p>

          {/* CTA 버튼 */}
          <div className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button size="lg" className="h-12 w-full sm:w-auto whitespace-nowrap px-8">
                무료로 시작하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#pricing">
              <Button variant="outline" size="lg" className="h-12 w-full sm:w-auto whitespace-nowrap px-8">
                요금제 보기
              </Button>
            </a>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            무료 플랜으로 바로 체험 · 신용카드 필요 없음 · 3분 만에 시작
          </p>

          {/* 핵심 가치 요약 (기능이 아닌 가치 중심) */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { icon: Clock, label: '시간 절약', desc: '글 1편 3시간 → 10분', highlight: '95% 절감' },
              { icon: Wand2, label: 'AI 콘텐츠', desc: 'SEO 최적화 자동 생성', highlight: '100점 만점 분석' },
              { icon: Search, label: '키워드 분석', desc: '실시간 검색량·경쟁도', highlight: '데이터 기반' },
              { icon: TrendingUp, label: '순위 추적', desc: '네이버 검색 순위 모니터링', highlight: '자동 트래킹' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
                <Badge variant="outline" className="text-[10px] px-2 py-0">
                  {item.highlight}
                </Badge>
              </div>
            ))}
          </div>

          {/* 소셜 프루프 수치 */}
          <div className="mx-auto mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" />
              <span>AI 콘텐츠 <span className="font-semibold text-foreground">5가지 유형</span> 지원</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span>SEO <span className="font-semibold text-foreground">13개 항목</span> 정밀 분석</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Search className="h-4 w-4 text-primary" />
              <span>네이버 공식 API <span className="font-semibold text-foreground">실시간</span> 데이터</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}