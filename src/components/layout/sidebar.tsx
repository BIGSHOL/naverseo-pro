'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Wand2,
  BarChart3,
  TrendingUp,
  CalendarDays,
  FileDown,
  Settings,
} from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'
import { PLANS, type Plan } from '@/types/database'

const navItems = [
  { label: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { label: '키워드 리서치', href: '/keywords', icon: Search },
  { label: 'AI 콘텐츠 생성', href: '/content', icon: Wand2 },
  { label: 'SEO 점수 체크', href: '/seo-check', icon: BarChart3 },
  { label: '순위 트래킹', href: '/tracking', icon: TrendingUp },
  { label: '콘텐츠 캘린더', href: '/content/calendar', icon: CalendarDays },
  { label: 'SEO 리포트', href: '/report', icon: FileDown },
  { label: '설정', href: '/settings', icon: Settings },
]

function parseLimit(limitStr: string): number | null {
  if (limitStr === '무제한') return null
  const match = limitStr.match(/(\d+)/)
  return match ? Number(match[1]) : null
}

export function Sidebar() {
  const pathname = usePathname()
  const [plan, setPlan] = useState<Plan>('free')
  const [keywordsUsed, setKeywordsUsed] = useState(0)
  const [contentUsed, setContentUsed] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) return
        const data = await res.json()
        setPlan((data.profile?.plan || 'free') as Plan)
        setKeywordsUsed(data.profile?.keywords_used_this_month || 0)
        setContentUsed(data.profile?.content_generated_this_month || 0)
      } catch {
        // 로드 실패 시 기본값 유지
      }
    }
    load()
  }, [pathname])

  const planInfo = PLANS[plan]
  const kwLimit = parseLimit(planInfo.keywords)
  const ctLimit = parseLimit(planInfo.content)

  const kwPercent = kwLimit ? Math.min(100, (keywordsUsed / kwLimit) * 100) : 0
  const ctPercent = ctLimit ? Math.min(100, (contentUsed / ctLimit) * 100) : 0

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
      <div className="flex h-full flex-col">
        {/* 로고 */}
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard">
            <Logo size="md" />
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* 하단 사용량 표시 */}
        <div className="border-t p-4">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">현재 플랜</p>
            <p className="text-sm font-semibold">{planInfo.name}</p>
            <div className="mt-2 space-y-1">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>키워드 조회</span>
                  <span>{kwLimit ? `${keywordsUsed}/${kwLimit}` : `${keywordsUsed} (무제한)`}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: kwLimit ? `${kwPercent}%` : '0%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>콘텐츠 생성</span>
                  <span>{ctLimit ? `${contentUsed}/${ctLimit}` : `${contentUsed} (무제한)`}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: ctLimit ? `${ctPercent}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
