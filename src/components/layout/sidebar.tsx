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

export function Sidebar() {
  const pathname = usePathname()
  const {
    plan, role, creditsBalance, creditsQuota,
    avatarUrl, userName, userEmail, loaded, disabledFeatures,
  } = useUserProfile()

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
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
              {gi > 0 && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
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
          {/* 로딩 중 스켈레톤 */}
          {!loaded ? (
            <div className="space-y-3 animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-2.5 w-32 rounded bg-muted" />
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 space-y-2">
                <div className="h-2.5 w-12 rounded bg-background/50" />
                <div className="h-3.5 w-16 rounded bg-background/50" />
                <div className="h-1.5 w-full rounded-full bg-background/50" />
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
