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
  { date: '2026-02-27', type: 'feat', message: '블로그 지수 — 16단계 등급 맵 리디자인 + 축별 미니바 + 벤치마크 범위 기반 판정' },
  { date: '2026-02-27', type: 'fix', message: '블로그 지수 — 평균 이미지 수/콘텐츠 깊이 실제 스크래핑 데이터 반영' },
  { date: '2026-02-27', type: 'feat', message: '블로그 지수 — 지수 변동 차트 5대축 모드 대응 (검색성과 라인 + 20점 환산)' },
  { date: '2026-02-27', type: 'feat', message: '블로그 지수 v10 — 4대축/5대축 탭 전환 (검색 성과 축 추가)' },
  { date: '2026-02-27', type: 'feat', message: '블로그 지수 v10 — 어뷰징 감점을 4대축에 통합 (총점 = 4축 합계)' },
  { date: '2026-02-27', type: 'feat', message: '블로그 지수 v10 — 범위 기반 점수 (콘텐츠 깊이·주제 집중도·이미지·빈도 최적 구간)' },
  { date: '2026-02-27', type: 'feat', message: '블로그 지수 v10 — 항목별 ±점수 상세 표시 (가점 초록/감점 빨강)' },
  { date: '2026-02-26', type: 'feat', message: '블로그 지수 v9 — 4축 재구성 + 최초 포스팅일 정확도 개선' },
  { date: '2026-02-26', type: 'feat', message: '키워드 리서치 상위 5개 검색결과 타입 표시 (블로그/카페/외부/포스트/지식인)' },
  { date: '2026-02-26', type: 'feat', message: '상위노출 분석 이미지 포함 여부 분석 추가' },
  { date: '2026-02-26', type: 'feat', message: '블로그 지수 v8 — 내부 링크 분석, 스팸 키워드/외부 링크 어뷰징 감지, 예상 체류 시간 추정' },
  { date: '2026-02-26', type: 'feat', message: '카테고리별 벤치마크 비교 시스템' },
  { date: '2026-02-25', type: 'feat', message: '블로그 지수 v6 — 16등급 체계 + 카테고리별 추이 차트' },
  { date: '2026-02-25', type: 'feat', message: '블로그 지수 v5 — 5축 균등 배분 + 검색 보너스 분리' },
  { date: '2026-02-25', type: 'feat', message: '검색 누락 조회, 포화지수, 키워드 대량조회, 인스타그램 변환 추가' },
  { date: '2026-02-25', type: 'feat', message: '상호명 키워드 콘텐츠 구조 개선 + 콘텐츠 방향 입력 추가' },
  { date: '2026-02-25', type: 'fix', message: 'AI 콘텐츠 정확도 개선 (자동 교정 + 키워드 의미 추출)' },
  { date: '2026-02-25', type: 'feat', message: '리치텍스트 에디터 교체 + HTML 클립보드 복사' },
  { date: '2026-02-25', type: 'feat', message: 'AI 약점 개선 정밀도 향상 + 마크다운 서식 렌더링 적용' },
  { date: '2026-02-24', type: 'feat', message: '소셜 로그인 (Google + Kakao) + 해외 결제 지원' },
  { date: '2026-02-24', type: 'feat', message: '프로필 이미지 표시 + 연동 계정 관리' },
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
