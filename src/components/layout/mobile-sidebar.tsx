'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, LayoutDashboard, Search, Wand2, BarChart3, TrendingUp, CalendarDays, FileDown, Settings, Activity, Users, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'

const navItems = [
  { label: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { label: '키워드 리서치', href: '/keywords', icon: Search },
  { label: '키워드 발굴', href: '/opportunities', icon: Lightbulb },
  { label: 'AI 콘텐츠 생성', href: '/content', icon: Wand2 },
  { label: 'SEO 점수 체크', href: '/seo-check', icon: BarChart3 },
  { label: '상위노출 분석', href: '/competitors', icon: Users },
  { label: '블로그 지수', href: '/blog-index', icon: Activity },
  { label: '순위 트래킹', href: '/tracking', icon: TrendingUp },
  { label: '콘텐츠 캘린더', href: '/content/calendar', icon: CalendarDays },
  { label: 'SEO 리포트', href: '/report', icon: FileDown },
  { label: '설정', href: '/settings', icon: Settings },
]

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <Logo size="md" />
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
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
        </div>
      </SheetContent>
    </Sheet>
  )
}
