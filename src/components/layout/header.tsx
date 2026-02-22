'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Bell, LogOut, User, Info, Sparkles, AlertTriangle, FileText, Globe, TrendingUp, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MobileSidebar } from './mobile-sidebar'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'
import { PLANS, type Plan } from '@/types/database'

interface Notification {
  icon: LucideIcon
  title: string
  message: string
  time: string
  actionable: boolean
  href?: string
}

function parseLimit(str: string): number {
  if (str.includes('무제한')) return Infinity
  const match = str.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

function buildNotifications(data: {
  profile?: { plan?: string; keywords_used_this_month?: number; content_generated_this_month?: number }
  blogProfile?: { blogUrl: string } | null
  contentStats?: { draft: number; avgSeoScore: number; total: number }
  dailyActivity?: { date: string; keywords: number; content: number }[]
}): Notification[] {
  const notifications: Notification[] = []
  const plan = (data.profile?.plan || 'free') as Plan
  const planInfo = PLANS[plan]
  if (!planInfo) return staticNotifications()

  // 1. 사용량 한도 임박 (80% 이상)
  const kwLimit = parseLimit(planInfo.keywords)
  const kwUsed = data.profile?.keywords_used_this_month || 0
  if (kwLimit !== Infinity && kwLimit > 0 && kwUsed / kwLimit >= 0.8) {
    notifications.push({
      icon: AlertTriangle,
      title: kwUsed >= kwLimit ? '키워드 조회 한도 도달' : '키워드 조회 한도 임박',
      message: `이번 달 키워드 조회 ${kwUsed}/${kwLimit}회 사용했습니다.${kwUsed >= kwLimit ? ' 플랜 업그레이드를 고려해보세요.' : ''}`,
      time: '사용량',
      actionable: true,
      href: '/settings',
    })
  }

  const ctLimit = parseLimit(planInfo.content)
  const ctUsed = data.profile?.content_generated_this_month || 0
  if (ctLimit !== Infinity && ctLimit > 0 && ctUsed / ctLimit >= 0.8) {
    notifications.push({
      icon: AlertTriangle,
      title: ctUsed >= ctLimit ? 'AI 콘텐츠 한도 도달' : 'AI 콘텐츠 한도 임박',
      message: `이번 달 콘텐츠 생성 ${ctUsed}/${ctLimit}편 사용했습니다.${ctUsed >= ctLimit ? ' 플랜 업그레이드를 고려해보세요.' : ''}`,
      time: '사용량',
      actionable: true,
      href: '/settings',
    })
  }

  // 2. 초안 콘텐츠 알림
  if (data.contentStats && data.contentStats.draft > 0) {
    notifications.push({
      icon: FileText,
      title: '초안 콘텐츠 확인',
      message: `초안 상태의 콘텐츠가 ${data.contentStats.draft}개 있습니다. SEO 체크 후 발행해보세요!`,
      time: '콘텐츠',
      actionable: true,
      href: '/content',
    })
  }

  // 3. 블로그 미등록
  if (!data.blogProfile) {
    notifications.push({
      icon: Globe,
      title: '블로그 등록하기',
      message: '블로그를 등록하면 블로그 지수 분석과 순위 트래킹을 이용할 수 있습니다.',
      time: '설정',
      actionable: true,
      href: '/settings',
    })
  }

  // 4. 평균 SEO 점수 낮음
  if (data.contentStats && data.contentStats.total > 0 && data.contentStats.avgSeoScore < 60) {
    notifications.push({
      icon: TrendingUp,
      title: 'SEO 점수 개선 필요',
      message: `평균 SEO 점수가 ${data.contentStats.avgSeoScore}점입니다. SEO 체크 기능으로 점수를 높여보세요.`,
      time: 'SEO',
      actionable: true,
      href: '/seo-check',
    })
  }

  // 5. 7일 활동 없음
  if (data.dailyActivity && data.dailyActivity.length > 0 && data.dailyActivity.every(d => d.keywords === 0 && d.content === 0)) {
    notifications.push({
      icon: Info,
      title: '활동을 시작해보세요',
      message: '최근 7일간 활동이 없습니다. 키워드 리서치부터 시작해보세요!',
      time: '활동',
      actionable: true,
      href: '/keywords',
    })
  }

  // 정적 알림 (하단에 항상 표시)
  notifications.push(...staticNotifications())

  return notifications
}

function staticNotifications(): Notification[] {
  return [
    {
      icon: Sparkles,
      title: '서비스 오픈',
      message: 'NaverSEO Pro가 정식 오픈했습니다! 무료 플랜으로 체험해보세요.',
      time: '2026.02.19',
      actionable: false,
    },
    {
      icon: Info,
      title: '사용 팁',
      message: 'URL로 가져오기 기능으로 기존 블로그 글의 SEO 점수를 바로 확인해보세요!',
      time: '팁',
      actionable: false,
    },
  ]
}

export function Header() {
  const router = useRouter()
  const [blogThumbnail, setBlogThumbnail] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>(staticNotifications())

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) return
        const data = await res.json()
        if (data.blogProfile?.blogThumbnail) {
          setBlogThumbnail(data.blogProfile.blogThumbnail)
        }
        setNotifications(buildNotifications(data))
      } catch {
        // 대시보드 데이터 로드 실패 시 정적 알림 유지
      }
    }

    loadDashboardData()
  }, [])

  const hasActionable = notifications.some(n => n.actionable)

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // 로그아웃 실패 시 무시
      }
    }
    router.push('/')
    router.refresh()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <MobileSidebar />
        <h2 className="text-lg font-semibold lg:hidden">NaverSEO Pro</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* 알림 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {hasActionable && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">알림</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((item, i) => (
                <div
                  key={i}
                  className={`flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50 ${item.href ? 'cursor-pointer' : ''}`}
                  onClick={() => item.href && router.push(item.href)}
                >
                  <item.icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.actionable ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {item.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* 프로필 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                {blogThumbnail && (
                  <AvatarImage src={blogThumbnail} alt="Blog Profile" />
                )}
                <AvatarFallback className="bg-primary/10 text-primary">
                  U
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="mr-2 h-4 w-4" />
              내 프로필
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
