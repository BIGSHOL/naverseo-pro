'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PLANS, type Plan } from '@/types/database'
import type { UserRole } from '@/types/database'
import { navItems, adminNavItems, canAccessFeature } from '@/lib/navigation'
import { Lock } from 'lucide-react'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'

export function Sidebar() {
  const pathname = usePathname()
  const [plan, setPlan] = useState<Plan>('free')
  const [role, setRole] = useState<UserRole>('user')
  const [creditsBalance, setCreditsBalance] = useState(0)
  const [creditsQuota, setCreditsQuota] = useState(30)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // 소셜 프로필 이미지 가져오기
        if (isSupabaseConfigured()) {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const meta = user.user_metadata
            setAvatarUrl(meta?.avatar_url || meta?.picture || null)
            setUserName(meta?.full_name || meta?.name || '')
            setUserEmail(user.email || '')
          }
        }

        const res = await fetch('/api/dashboard')
        if (!res.ok) return
        const data = await res.json()
        const userRole = (data.profile?.role || 'user') as UserRole
        setPlan(userRole === 'admin' ? 'admin' : (data.profile?.plan || 'free') as Plan)
        setRole(userRole)
        setCreditsBalance(data.profile?.credits_balance ?? 0)
        setCreditsQuota(data.profile?.credits_monthly_quota ?? 30)
      } catch {
        // 로드 실패 시 기본값 유지
      }
    }
    load()
  }, [pathname])

  const planInfo = PLANS[plan]
  const creditPercent = creditsQuota > 0 ? Math.min(100, (creditsBalance / creditsQuota) * 100) : 0

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
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const locked = !canAccessFeature(plan, item.minPlan)
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={locked ? '/billing' : item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      locked
                        ? 'cursor-default text-muted-foreground/50'
                        : isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5', locked && 'opacity-40')} />
                    <span className={cn('flex-1', locked && 'opacity-60')}>{item.label}</span>
                    {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  </Link>
                </TooltipTrigger>
                {locked && (
                  <TooltipContent side="right">
                    <p>{item.minPlan === 'lite' ? 'Lite' : 'Starter'} 이상 플랜 필요</p>
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })}

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

        {/* 하단 프로필 + 크레딧 표시 */}
        <div className="border-t p-4">
          {/* 사용자 프로필 */}
          {(avatarUrl || userEmail) && (
            <div className="mb-3 flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" referrerPolicy="no-referrer" />}
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {(userName || userEmail).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                {userName && <p className="truncate text-xs font-medium">{userName}</p>}
                <p className="truncate text-[11px] text-muted-foreground">{userEmail}</p>
              </div>
            </div>
          )}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">현재 플랜</p>
            <p className="text-sm font-semibold">{planInfo.name}</p>
            <div className="mt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>크레딧</span>
                      <span>{creditsBalance.toLocaleString()}/{creditsQuota.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-background">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          creditPercent <= 20 ? 'bg-red-500' : creditPercent <= 50 ? 'bg-amber-500' : 'bg-primary'
                        )}
                        style={{ width: `${creditPercent}%` }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>이번 달 남은 크레딧입니다</p></TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
