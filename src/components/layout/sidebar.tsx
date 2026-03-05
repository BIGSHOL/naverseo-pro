'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PLANS } from '@/types/database'
import { navGroups, adminNavItems, canAccessFeature } from '@/lib/navigation'
import { pathToFeatureKey } from '@/lib/features'
import { Lock } from 'lucide-react'
import { useUserProfile } from '@/contexts/user-profile'
import { Switch } from '@/components/ui/switch'
import { useDesignV2 } from '@/contexts/design-v2'

export function Sidebar() {
  const pathname = usePathname()
  const {
    plan, role, creditsBalance, creditsQuota,
    avatarUrl, userName, userEmail, loaded, disabledFeatures,
  } = useUserProfile()

  const planInfo = PLANS[plan]
  const creditPercent = creditsQuota > 0 ? Math.min(100, (creditsBalance / creditsQuota) * 100) : 0

  return (
    <aside className="hidden w-[260px] shrink-0 lg:block rounded-[1.5rem] bg-[#272e3f] text-slate-100 shadow-xl overflow-hidden border border-slate-700/50 relative">
      <div className="flex h-full flex-col">
        {/* 로고 */}
        <div className="flex h-[72px] items-center border-b border-slate-700/50 px-6 bg-[#212736]">
          <Link href="/dashboard" className="text-white hover:opacity-90 transition-opacity">
            <Logo size="md" />
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {navGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-6' : ''}>
              {gi > 0 && (
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.filter((item) => {
                  const fk = pathToFeatureKey(item.href)
                  return !fk || !disabledFeatures.includes(fk)
                }).map((item) => {
                  const isActive = pathname === item.href
                  const locked = !canAccessFeature(plan, item.minPlan)
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link
                          href={locked ? '/billing' : item.href}
                          className={cn(
                            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200',
                            locked
                              ? 'cursor-default text-slate-600'
                              : isActive
                                ? 'bg-primary/20 text-emerald-400 shadow-sm'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                          )}
                        >
                          <item.icon className={cn('h-5 w-5', locked ? 'opacity-40' : isActive ? 'text-emerald-400' : 'group-hover:scale-110 transition-transform')} />
                          <span className={cn('flex-1', locked && 'opacity-60')}>{item.label}</span>
                          {locked && <Lock className="h-4 w-4 text-slate-600" />}
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
              </div>
            </div>
          ))}

          {/* 관리자 메뉴 */}
          {role === 'admin' && (
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                관리자
              </p>
              {adminNavItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/20 text-emerald-400 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive ? "text-emerald-400" : "group-hover:scale-110 transition-transform")} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </nav>

        {/* 하단 프로필 + 크레딧 표시 */}
        <div className="border-t border-slate-700/50 p-5 bg-[#212736]">
          {/* 로딩 중 스켈레톤 */}
          {!loaded ? (
            <div className="space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 rounded bg-slate-700" />
                  <div className="h-3 w-32 rounded bg-slate-700/50" />
                </div>
              </div>
              <div className="rounded-xl bg-[#1d2331] p-4 border border-slate-700/50 space-y-3">
                <div className="h-3 w-16 rounded bg-slate-700" />
                <div className="h-4 w-24 rounded bg-slate-700" />
                <div className="h-1.5 w-full rounded-full bg-slate-700/50" />
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
