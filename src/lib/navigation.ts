import {
  LayoutDashboard,
  Search,
  Wand2,
  BarChart3,
  TrendingUp,
  CalendarDays,
  FileDown,
  Settings,
  Activity,
  Users,
  Lightbulb,
  Coins,
  ListChecks,
  CreditCard,
  Shield,
  UserCog,
  ServerCog,
  ToggleRight,
  Ticket,
  Gift,
  BrainCircuit,
  FileSearch,
  Camera,
  type LucideIcon,
} from 'lucide-react'

import type { Plan } from '@/types/database'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** 이 기능을 사용하기 위한 최소 플랜 (미지정 = 모든 플랜 허용) */
  minPlan?: Plan
}

/** 플랜 순서 (비교용) */
export const PLAN_ORDER: Plan[] = ['free', 'lite', 'starter', 'pro', 'enterprise', 'admin']

/** 현재 플랜으로 해당 기능에 접근 가능한지 확인 */
export function canAccessFeature(currentPlan: Plan, minPlan?: Plan): boolean {
  if (!minPlan) return true
  return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(minPlan)
}

export const navItems: NavItem[] = [
  { label: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { label: '키워드 검색', href: '/keywords', icon: Search },
  { label: '키워드 대량조회', href: '/keywords-bulk', icon: ListChecks, minPlan: 'starter' },
  { label: '키워드 발굴', href: '/opportunities', icon: Lightbulb, minPlan: 'starter' },
  { label: 'AI 콘텐츠 생성', href: '/content', icon: Wand2, minPlan: 'lite' },
  { label: 'SEO 점수 체크', href: '/seo-check', icon: BarChart3 },
  { label: '상위노출 분석', href: '/competitors', icon: Users, minPlan: 'starter' },
  { label: '블로그 지수', href: '/blog-index', icon: Activity },
  { label: '검색 누락 조회', href: '/post-check', icon: FileSearch },
  { label: '인스타그램 변환', href: '/instagram', icon: Camera, minPlan: 'starter' },
  { label: '순위 트래킹', href: '/tracking', icon: TrendingUp, minPlan: 'starter' },
  { label: '활동 캘린더', href: '/content/calendar', icon: CalendarDays },
  { label: 'SEO 리포트', href: '/report', icon: FileDown, minPlan: 'lite' },
  { label: '크레딧', href: '/credits', icon: Coins },
  { label: '요금제', href: '/billing', icon: CreditCard },
  { label: '설정', href: '/settings', icon: Settings },
]

export const adminNavItems: NavItem[] = [
  { label: '관리자 대시보드', href: '/admin', icon: Shield },
  { label: '사용자 관리', href: '/admin/users', icon: UserCog },
  { label: '프로모 코드', href: '/admin/promo-codes', icon: Ticket },
  { label: '추천인 관리', href: '/admin/referrals', icon: Gift },
  { label: '기능 관리', href: '/admin/features', icon: ToggleRight },
  { label: '학습 데이터', href: '/learning', icon: BrainCircuit },
  { label: '시스템 설정', href: '/admin/system', icon: ServerCog },
]
