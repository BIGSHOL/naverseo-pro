import { Check, X, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const comparisonItems = [
  { task: '키워드 리서치', manual: '직접 조사 1시간+', tool: 'AI 자동 분석 30초' },
  { task: '블로그 글 작성', manual: '3~4시간/편', tool: 'AI 생성 10분/편' },
  { task: 'SEO 최적화 검토', manual: 'SEO 지식 필요', tool: '100점 만점 자동 분석' },
  { task: '순위 모니터링', manual: '매일 수동 검색', tool: '자동 트래킹 알림' },
  { task: '상위노출 분석', manual: '일일이 검색 비교', tool: 'AI 자동 분석 리포트' },
  { task: '키워드 발굴', manual: '경험과 감에 의존', tool: 'AI 블루오션 자동 발굴' },
]

const costComparison = [
  {
    label: 'SEO 대행사',
    cost: '월 50~200만원',
    period: '연 600만~2,400만원',
    cons: ['내 블로그 전략인지 불확실', '대행사 의존도 높음', '계약 기간 구속'],
  },
  {
    label: '프리랜서 고용',
    cost: '월 30~100만원',
    period: '연 360만~1,200만원',
    cons: ['품질 편차 큼', '커뮤니케이션 비용', '인력 이탈 리스크'],
  },
  {
    label: '직접 운영',
    cost: '월 60시간+ 투입',
    period: '시급 1만원 기준 월 60만원',
    cons: ['본업에 집중 어려움', '전문성 한계', '지속 운영 부담'],
  },
]

export function ComparisonSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="secondary" className="mb-4 px-4 py-1.5">
            비용 비교
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            기존 방식의 실제 비용
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            동일한 SEO 성과를 달성하는 데 드는 비용을 비교해보세요
          </p>
        </div>

        {/* 기존 방식 비용 비교 */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {costComparison.map((item) => (
            <Card key={item.label} className="border-destructive/20">
              <CardContent className="pt-6 pb-6">
                <div className="text-center mb-4">
                  <h3 className="font-semibold text-lg">{item.label}</h3>
                  <p className="mt-2 text-2xl font-bold text-destructive">{item.cost}</p>
                  <p className="text-sm text-muted-foreground">{item.period}</p>
                </div>
                <ul className="space-y-2">
                  {item.cons.map((con) => (
                    <li key={con} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 shrink-0 text-destructive" />
                      {con}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* VS 화살표 */}
        <div className="mt-8 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-full bg-primary/10 px-6 py-3">
            <span className="text-sm font-medium text-muted-foreground">위 비용 대신</span>
            <ArrowRight className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">NaverSEO Pro 하나로</span>
          </div>
        </div>

        {/* NaverSEO Pro 카드 */}
        <Card className="mt-8 border-primary shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold">NaverSEO Pro</h3>
              <p className="mt-2">
                <span className="text-4xl font-bold text-primary">월 29,000원</span>
                <span className="text-muted-foreground">부터</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                SEO 대행사 대비 <span className="font-semibold text-primary">최대 98% 절감</span>
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {comparisonItems.map((item) => (
                <div key={item.task} className="rounded-lg border p-4">
                  <p className="text-sm font-semibold mb-2">{item.task}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <X className="h-3 w-3 text-destructive shrink-0" />
                    <span className="line-through">{item.manual}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <Check className="h-3 w-3 shrink-0" />
                    <span>{item.tool}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
