import { Clock, TrendingDown, Search, Wallet, ArrowDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const problems = [
  {
    icon: Search,
    title: '키워드 선정에 매번 1시간+',
    description:
      '검색량 확인, 경쟁도 분석, 연관 키워드 조사까지. 네이버 광고센터를 오가며 데이터 없이 키워드를 선정하고 계시진 않으신가요?',
    cost: '월 20시간 낭비',
  },
  {
    icon: Clock,
    title: '글 1편 쓰는데 3~4시간',
    description:
      '리서치, 구조 설계, 본문 작성, 이미지 배치까지. 한 편에 반나절이 소요되어 주 3회 포스팅 유지가 어렵습니다.',
    cost: '월 48시간 소모',
  },
  {
    icon: TrendingDown,
    title: '노출 안 되는 이유를 모름',
    description:
      '열심히 써도 검색 결과에 안 보이는데, 제목이 문제인지 본문이 문제인지 알 수가 없습니다.',
    cost: '노력 대비 성과 0',
  },
  {
    icon: Wallet,
    title: 'SEO 대행 맡기면 월 50~200만원',
    description:
      '블로그 마케팅 대행사 의뢰 시 월 최소 50만원 이상. 내 블로그에 최적화된 맞춤 전략인지 검증하기도 어렵습니다.',
    cost: '연 600만원~2,400만원',
  },
]

export function ProblemSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            블로그 운영자의 공통된 고민
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            매달 수십 시간의 작업 시간과 수백만 원의 비용이 소모되고 있습니다
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem) => (
            <Card key={problem.title} className="border-none bg-background shadow-md">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                  <problem.icon className="h-7 w-7 text-destructive" />
                </div>
                <h3 className="text-base font-semibold">{problem.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {problem.description}
                </p>
                <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                  <ArrowDown className="h-3 w-3" />
                  {problem.cost}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 전환 문구 */}
        <div className="mt-16 text-center">
          <p className="text-xl font-semibold">
            이 모든 문제를 <span className="text-primary">월 9,900원</span>부터 해결할 수 있다면?
          </p>
        </div>
      </div>
    </section>
  )
}
