'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'
import type { Plan, UserRole } from '@/types/database'
import { navGroups, adminNavItems, canAccessFeature } from '@/lib/navigation'

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<Plan>('free')
  const [role, setRole] = useState<UserRole>('user')
  const pathname = usePathname()

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) return
        const data = await res.json()
        const userRole = (data.profile?.role || 'user') as UserRole
        setRole(userRole)
        setPlan(userRole === 'admin' ? 'admin' : (data.profile?.plan || 'free') as Plan)
      } catch {
        // 로드 실패 시 기본값 유지
      }
    }
    loadProfile()
  }, [pathname])

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
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {navGroups.map((group, gi) => (
              <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
                {gi > 0 && (
                  <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href
                    const locked = !canAccessFeature(plan, item.minPlan)
                    return (
                      <Link
                        key={item.href}
                        href={locked ? '/billing' : item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          locked
                            ? 'text-muted-foreground/50'
                            : isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <item.icon className={cn('h-5 w-5', locked && 'opacity-40')} />
                        <span className={cn('flex-1', locked && 'opacity-60')}>{item.label}</span>
                        {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* 관리자 메뉴 */}
            {role === 'admin' && (
              <>
                <div className="my-2">
                  <div className="border-t" />
                  <p className="mt-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                    관리자
                  </p>
                </div>
                {adminNavItems.map((item) => {
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
              </>
            )}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}
