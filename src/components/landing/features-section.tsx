import { Search, Wand2, BarChart3, TrendingUp, Activity, Users, Lightbulb, CalendarDays, FileDown, FileSearch } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const coreFeatures = [
  {
    icon: Search,
    title: '키워드 리서치',
    description:
      '네이버 검색광고 API 연동으로 실시간 검색량, PC·모바일 비율, 경쟁도, 클릭률을 한 화면에서 확인. 감이 아닌 데이터로 키워드를 선택하세요.',
    color: 'bg-blue-500/10 text-blue-600',
    saving: '키워드 조사 1시간 → 30초',
    detail: '네이버 광고센터 없이 원클릭 조회',
  },
  {
    icon: Wand2,
    title: 'AI 콘텐츠 생성',
    description:
      '키워드만 입력하면 AI가 네이버 C-Rank, D.I.A. 알고리즘에 최적화된 2,000~3,000자 블로그 글을 자동 작성합니다.',
    color: 'bg-purple-500/10 text-purple-600',
    saving: '글 작성 3시간 → 10분',
    detail: '다른 SEO 도구에는 없는 유일한 AI 글쓰기 기능',
  },
  {
    icon: BarChart3,
    title: 'SEO 점수 분석',
    description:
      '제목, 키워드 밀도, 본문 길이, 소제목 구조 등 10가지 항목을 100점 만점으로 분석. 어디를 고치면 상위 노출되는지 바로 알 수 있습니다.',
    color: 'bg-primary/10 text-primary',
    saving: 'SEO 컨설팅 비용 절감',
    detail: '전문 컨설팅 수준의 진단을 무제한으로',
  },
  {
    icon: TrendingUp,
    title: '순위 트래킹',
    description:
      '타겟 키워드의 네이버 블로그탭, 스마트블록, VIEW탭 순위를 자동 추적. 순위 변화를 한눈에 모니터링하세요.',
    color: 'bg-orange-500/10 text-orange-600',
    saving: '수동 검색 체크 불필요',
    detail: '하루 30분 절약 × 30일 = 월 15시간',
  },
]

const bonusFeatures = [
  {
    icon: FileSearch,
    title: '포스팅 누락 조회',
    description: '내 포스트가 네이버 검색에 빠져 있지 않은지 자동 체크. 색인 누락된 글을 찾아 검색 노출 기회를 되찾으세요.',
    color: 'bg-teal-500/10 text-teal-600',
  },
  {
    icon: Activity,
    title: '블로그 지수 분석',
    description: '내 블로그의 검색 노출 파워를 레이더 차트로 시각화. 상위 블로그와 비교하여 부족한 점을 파악합니다.',
    color: 'bg-cyan-500/10 text-cyan-600',
  },
  {
    icon: Users,
    title: '상위노출 분석',
    description: '상위 노출 블로그의 제목 패턴, 글 길이, 작성 주기를 분석. 데이터 기반 콘텐츠 전략을 수립하세요.',
    color: 'bg-rose-500/10 text-rose-600',
  },
  {
    icon: Lightbulb,
    title: '키워드 발굴',
    description: 'AI가 경쟁은 낮고 검색량은 충분한 블루오션 키워드를 자동 발굴. 놓치고 있던 기회를 찾아드립니다.',
    color: 'bg-yellow-500/10 text-yellow-600',
  },
  {
    icon: CalendarDays,
    title: '콘텐츠 캘린더',
    description: '생성된 콘텐츠의 발행 일정을 캘린더로 관리. 꾸준한 포스팅이 상위 노출의 핵심입니다.',
    color: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    icon: FileDown,
    title: 'SEO 리포트',
    description: 'SEO 활동 요약 리포트를 자동 생성. 클라이언트 보고나 성과 관리에 활용하세요.',
    color: 'bg-indigo-500/10 text-indigo-600',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="secondary" className="mb-4 px-4 py-1.5">
            10가지 핵심 기능
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            SEO 전문가가 하는 일,
            <br className="sm:hidden" />
            <span className="text-primary"> AI가 대신합니다</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            대행사 월 50~200만원 수준의 SEO 업무를, 월 9,900원부터 직접 수행하세요.
          </p>
        </div>

        {/* 핵심 기능 4개 */}
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {coreFeatures.map((feature) => (
            <Card
              key={feature.title}
              className="group transition-all duration-200 hover:shadow-lg"
            >
              <CardContent className="p-8">
                <div className="flex items-start justify-between">
                  <div
                    className={`mb-5 inline-flex rounded-lg p-3 ${feature.color}`}
                  >
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <Badge variant="outline" className="text-xs text-primary border-primary/30">
                    {feature.saving}
                  </Badge>
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
                <p className="mt-3 text-sm font-medium text-primary">
                  {feature.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 추가 기능 5개 */}
        <div className="mt-12">
          <div className="mb-8 text-center">
            <Badge variant="outline" className="px-4 py-1.5 text-sm">
              보너스 기능 — 추가 비용 없이 포함
            </Badge>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bonusFeatures.map((feature) => (
              <Card
                key={feature.title}
                className="group transition-all duration-200 hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`shrink-0 rounded-lg p-2.5 ${feature.color}`}
                    >
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{feature.title}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}