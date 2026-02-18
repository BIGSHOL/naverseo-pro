import { Clock, TrendingDown, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const problems = [
  {
    icon: Search,
    title: '어떤 키워드를 써야 할지 모르겠어요',
    description:
      '검색량은 얼마나 되는지, 경쟁은 심한지... 매번 감으로 키워드를 정하고 계시지 않나요?',
  },
  {
    icon: Clock,
    title: '블로그 글 쓰는데 시간이 너무 걸려요',
    description:
      '리서치, 구조 잡기, 글쓰기까지 한 편에 3-4시간. 매일 포스팅은 거의 불가능합니다.',
  },
  {
    icon: TrendingDown,
    title: '상위 노출이 안 되는 이유를 모르겠어요',
    description:
      '열심히 써도 검색 결과에 안 보이고, 어디를 고쳐야 하는지 알 수가 없습니다.',
  },
]

export function ProblemSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            이런 고민, 하고 계시죠?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            네이버 블로그 운영자라면 누구나 겪는 문제들입니다
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {problems.map((problem) => (
            <Card key={problem.title} className="border-none bg-background shadow-md">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                  <problem.icon className="h-7 w-7 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold">{problem.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {problem.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
