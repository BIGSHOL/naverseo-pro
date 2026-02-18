import { Search, Wand2, BarChart3, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: Search,
    title: '키워드 리서치',
    description:
      '네이버 검색광고 API 기반 실시간 검색량 조회. PC·모바일 검색량, 경쟁도, 클릭률까지 한눈에 파악하세요.',
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    icon: Wand2,
    title: 'AI 콘텐츠 생성',
    description:
      'Claude AI가 네이버 SEO에 최적화된 블로그 글을 자동 생성합니다. C-Rank, D.I.A. 알고리즘을 반영한 고품질 콘텐츠.',
    color: 'bg-purple-500/10 text-purple-600',
  },
  {
    icon: BarChart3,
    title: 'SEO 점수 분석',
    description:
      '작성한 콘텐츠의 SEO 점수를 실시간으로 분석합니다. 제목, 본문 구조, 키워드 밀도 등 개선 포인트를 확인하세요.',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: TrendingUp,
    title: '순위 트래킹',
    description:
      '타겟 키워드의 네이버 검색 순위를 매일 자동으로 추적합니다. 블로그, 스마트블록, VIEW탭 순위를 모니터링하세요.',
    color: 'bg-orange-500/10 text-orange-600',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-primary">NaverSEO Pro</span>가 해결합니다
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            네이버 블로그 SEO에 필요한 모든 도구를 제공합니다
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group transition-all duration-200 hover:shadow-lg"
            >
              <CardContent className="p-8">
                <div
                  className={`mb-5 inline-flex rounded-lg p-3 ${feature.color}`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
