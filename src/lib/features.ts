/**
 * 기능 비활성화 관리 설정
 * 각 기능의 키, 이름, 설명, 경로를 정의
 */

export interface FeatureConfig {
  key: string
  label: string
  description: string
  href: string
}

/**
 * 비활성화 가능한 기능 목록
 * 대시보드와 설정은 항상 활성화 (비활성화 불가)
 */
export const TOGGLEABLE_FEATURES: FeatureConfig[] = [
  {
    key: 'keywords',
    label: '키워드 검색',
    description: '네이버 검색광고 API를 통한 키워드 검색량 조회',
    href: '/keywords',
  },
  {
    key: 'opportunities',
    label: '키워드 발굴',
    description: 'AI 기반 블루오션 키워드 발굴',
    href: '/opportunities',
  },
  {
    key: 'content',
    label: 'AI 콘텐츠 생성',
    description: 'AI를 통한 SEO 최적화 블로그 콘텐츠 생성',
    href: '/content',
  },
  {
    key: 'seo-check',
    label: 'SEO 점수 체크',
    description: '블로그 글의 SEO 점수 분석 및 개선 제안',
    href: '/seo-check',
  },
  {
    key: 'competitors',
    label: '상위노출 분석',
    description: '상위 노출 블로그의 패턴 분석 (D.I.A.)',
    href: '/competitors',
  },
  {
    key: 'blog-index',
    label: '블로그 지수',
    description: '블로그 영향력 종합 분석 및 등급 산출',
    href: '/blog-index',
  },
  {
    key: 'tracking',
    label: '순위 트래킹',
    description: '네이버 검색 순위 모니터링',
    href: '/tracking',
  },
  {
    key: 'calendar',
    label: '활동 캘린더',
    description: '콘텐츠 작성 활동 캘린더',
    href: '/content/calendar',
  },
  {
    key: 'report',
    label: 'SEO 리포트',
    description: 'SEO 분석 PDF 리포트 생성',
    href: '/report',
  },
]

/** 경로(pathname)를 기능 키로 변환 */
export function pathToFeatureKey(pathname: string): string | null {
  // /content/calendar → calendar
  if (pathname === '/content/calendar') return 'calendar'
  // /keywords → keywords
  const feature = TOGGLEABLE_FEATURES.find((f) => f.href === pathname)
  return feature?.key || null
}
