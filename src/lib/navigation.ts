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
  Shield,
  UserCog,
  ServerCog,
  ToggleRight,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { label: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { label: '키워드 리서치', href: '/keywords', icon: Search },
  { label: '키워드 발굴', href: '/opportunities', icon: Lightbulb },
  { label: 'AI 콘텐츠 생성', href: '/content', icon: Wand2 },
  { label: 'SEO 점수 체크', href: '/seo-check', icon: BarChart3 },
  { label: '상위노출 분석', href: '/competitors', icon: Users },
  { label: '블로그 지수', href: '/blog-index', icon: Activity },
  { label: '순위 트래킹', href: '/tracking', icon: TrendingUp },
  { label: '활동 캘린더', href: '/content/calendar', icon: CalendarDays },
  { label: 'SEO 리포트', href: '/report', icon: FileDown },
  { label: '크레딧', href: '/credits', icon: Coins },
  { label: '설정', href: '/settings', icon: Settings },
]

export const adminNavItems: NavItem[] = [
  { label: '관리자 대시보드', href: '/admin', icon: Shield },
  { label: '사용자 관리', href: '/admin/users', icon: UserCog },
  { label: '기능 관리', href: '/admin/features', icon: ToggleRight },
  { label: '시스템 설정', href: '/admin/system', icon: ServerCog },
]
