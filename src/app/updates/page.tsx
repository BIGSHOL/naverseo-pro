import { Navbar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'
import { Badge } from '@/components/ui/badge'

export const metadata = {
  title: '업데이트 내역 | NaverSEO Pro',
  description: 'NaverSEO Pro의 최신 업데이트 내역을 확인하세요.',
}

// 업데이트 타입
type UpdateType = 'feat' | 'fix' | 'refactor' | 'chore'

interface UpdateEntry {
  date: string         // YYYY-MM-DD
  type: UpdateType
  message: string      // 커밋 메시지 스타일
}

// 새로운 업데이트는 이 배열 맨 위에 추가
const UPDATES: UpdateEntry[] = [
  // 2026-03-02
  { date: '2026-03-02', type: 'feat', message: 'AI 이미지 자동 압축 — WebP 변환으로 이미지 용량 ~90% 절감, 블로그 로딩 속도 향상' },
  { date: '2026-03-02', type: 'fix', message: 'AI 약점 개선 안정화 — 1회 개선 후 자동 비활성화로 중복 수정 방지' },
  { date: '2026-03-02', type: 'refactor', message: '페이지 로딩 개선 — 요금제·크레딧 정보가 깜빡임 없이 즉시 표시' },
  // 2026-03-01
  { date: '2026-03-01', type: 'feat', message: 'AI 이미지 자동 생성 — 콘텐츠의 [이미지] 마커에 AI가 맞춤 이미지를 자동 생성하여 삽입' },
  { date: '2026-03-01', type: 'feat', message: 'SEO 엔진 전면 개선 — 16단계 등급 체계 통합 + 블로그지수·리포트·UI 동기화' },
  { date: '2026-03-01', type: 'fix', message: 'AI 콘텐츠 글 길이 정확도 향상 — 요청한 분량에 맞게 엄격하게 생성' },
  // 2026-02-28
  { date: '2026-02-28', type: 'feat', message: 'AI 콘텐츠 자동 최적화 — 생성 후 SEO 약점 자동 수정 + 6단계 실시간 진행 표시' },
  { date: '2026-02-28', type: 'feat', message: 'AI 약점 개선 시각 효과 — 수정 전/후를 색상 애니메이션으로 비교 확인' },
  { date: '2026-02-28', type: 'fix', message: '모바일 UI 전면 최적화 — 전 페이지 텍스트 줄바꿈·차트·레이아웃 반응형 개선' },
  { date: '2026-02-28', type: 'fix', message: '키워드 삭제 시 페이지 멈춤 현상 수정' },
  // 2026-02-27
  { date: '2026-02-27', type: 'feat', message: 'AI 실시간 타이핑 효과 — 콘텐츠 생성·경쟁 분석에서 AI가 글을 써내려가는 모습을 실시간 확인' },
  { date: '2026-02-27', type: 'feat', message: '상위노출 분석 전면 리뉴얼 — 4차원 난이도 평가 + 이미지·품질 기반 경쟁 분석' },
  { date: '2026-02-27', type: 'feat', message: 'SEO 점수 체크 강화 — URL 분석 시 통계·태그·서식·이미지 갤러리 + AI 심층 분석' },
  { date: '2026-02-27', type: 'feat', message: '블로그 지수 대규모 업데이트 — 16단계 등급 체계 + 4대축/5대축 전환 + 어뷰징 감지 + 카테고리 벤치마크' },
  // 2026-02-26
  { date: '2026-02-26', type: 'feat', message: '키워드 검색 — 상위 5개 검색결과 타입 표시 (블로그/카페/외부/포스트/지식인)' },
  // 2026-02-25
  { date: '2026-02-25', type: 'feat', message: '검색 누락 조회·포화지수·키워드 대량조회·인스타그램 변환 추가' },
  { date: '2026-02-25', type: 'feat', message: '리치텍스트 에디터 — 서식 편집 + 네이버 블로그에 서식 유지 붙여넣기' },
  { date: '2026-02-25', type: 'feat', message: 'AI 콘텐츠 품질 향상 — 키워드 의미 추출 + 약점 개선 정밀도 + 콘텐츠 방향 입력' },
  // 2026-02-24
  { date: '2026-02-24', type: 'feat', message: '소셜 로그인 (Google + Kakao) + 프로필 이미지 + 해외 결제 지원' },
]

const TYPE_CONFIG: Record<UpdateType, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  feat: { label: '신규', variant: 'default', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  fix: { label: '수정', variant: 'outline', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  refactor: { label: '개선', variant: 'secondary', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  chore: { label: '기타', variant: 'outline', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
}

// 날짜별 그룹핑
function groupByDate(entries: UpdateEntry[]): Map<string, UpdateEntry[]> {
  const map = new Map<string, UpdateEntry[]>()
  for (const entry of entries) {
    const existing = map.get(entry.date) || []
    existing.push(entry)
    map.set(entry.date, existing)
  }
  return map
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`
}

export default function UpdatesPage() {
  const grouped = groupByDate(UPDATES)

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-bold">업데이트 내역</h1>
        <p className="mb-10 text-muted-foreground">
          NaverSEO Pro의 최신 변경 사항을 확인하세요.
        </p>

        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([date, entries]) => (
            <div key={date} className="relative">
              {/* 날짜 헤더 */}
              <div className="sticky top-16 z-10 mb-3 flex items-center gap-3 bg-background pb-1">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {formatDate(date)}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* 엔트리 목록 */}
              <div className="ml-[5px] space-y-2 border-l border-border pl-6">
                {entries.map((entry, idx) => {
                  const config = TYPE_CONFIG[entry.type]
                  return (
                    <div key={idx} className="flex items-start gap-3 py-1">
                      <Badge
                        variant={config.variant}
                        className={`mt-0.5 shrink-0 text-xs ${config.color}`}
                      >
                        {config.label}
                      </Badge>
                      <span className="text-sm leading-relaxed text-foreground/90">
                        {entry.message}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  )
}
