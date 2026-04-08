'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PLANS } from '@/types/database'
import { navGroups, adminNavItems, canAccessFeature } from '@/lib/navigation'
import { pathToFeatureKey } from '@/lib/features'
import { Bell, Lock, Settings, LogOut, X } from 'lucide-react'
import { useUserProfile } from '@/contexts/user-profile'
import { useNotifications } from '@/hooks/use-notifications'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { useDesignV2 } from '@/contexts/design-v2'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const {
    plan, role, creditsBalance, creditsQuota,
    avatarUrl, userName, userEmail, loaded, disabledFeatures,
  } = useUserProfile()
  const { notifications, readIds, hasActionable, markRead, dismiss } = useNotifications()

  const planInfo = PLANS[plan]
  const creditPercent = creditsQuota > 0 ? Math.min(100, (creditsBalance / creditsQuota) * 100) : 0

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch { /* ignore */ }
    }
    router.push('/')
    router.refresh()
  }

  return (
    <aside className="hidden w-[260px] shrink-0 lg:block rounded-[1.5rem] bg-[#272e3f] text-slate-100 shadow-xl overflow-hidden border border-slate-700/50 relative">
      <div className="flex h-full flex-col">
        {/* 로고 */}
        <div className="flex h-[72px] items-center border-b border-slate-700/50 px-6 bg-[#212736]">
          <Link href="/dashboard" className="text-white hover:opacity-90 transition-opacity">
            <Logo size="md" theme="dark" />
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {!loaded ? (
            /* 스켈레톤: 프로필 로딩 전 */
            <div className="animate-pulse space-y-6">
              {[6, 6, 4].map((count, gi) => (
                <div key={gi}>
                  {gi > 0 && <div className="mb-2 ml-3 h-2.5 w-14 rounded bg-slate-700/60" />}
                  <div className="space-y-1">
                    {Array.from({ length: count }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                        <div className="h-5 w-5 rounded bg-slate-700/50" />
                        <div className="h-3.5 rounded bg-slate-700/50" style={{ width: `${60 + (i * 13) % 40}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
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
                                    ? 'bg-emerald-500/15 text-emerald-400 shadow-sm ring-1 ring-emerald-500/20'
                                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                              )}
                            >
                              <item.icon className={cn('h-5 w-5', locked ? 'opacity-40' : isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white group-hover:scale-110 transition-all')} />
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
                            ? 'bg-emerald-500/15 text-emerald-400 shadow-sm ring-1 ring-emerald-500/20'
                            : 'text-slate-300 hover:bg-white/8 hover:text-white'
                        )}
                      >
                        <item.icon className={cn("h-5 w-5", isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-white group-hover:scale-110 transition-all")} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </nav>

        {/* 하단 프로필 + 크레딧 + 액션 */}
        <div className="border-t border-slate-700/50 p-4 bg-[#212736]">
          {!loaded ? (
            <div className="space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 rounded bg-slate-700" />
                  <div className="h-3 w-32 rounded bg-slate-700/50" />
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-700/50" />
            </div>
          ) : (
            <>
              {/* 사용자 프로필 + 액션 */}
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" referrerPolicy="no-referrer" />}
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {(userName || userEmail).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  {userName && <p className="truncate text-xs font-medium text-slate-100">{userName}</p>}
                  <p className="truncate text-[11px] text-slate-400">{userEmail}</p>
                </div>
                {/* 액션 아이콘 */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {/* 알림 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="relative rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition-colors">
                        <Bell className="h-4 w-4" />
                        {hasActionable && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="end" className="w-80 p-0" collisionPadding={16}>
                      <div className="border-b px-4 py-3">
                        <h3 className="text-sm font-semibold">알림</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-muted-foreground">알림이 없습니다</div>
                        ) : notifications.map((item) => {
                          const isRead = readIds.has(item.id)
                          return (
                            <div
                              key={item.id}
                              className={`group flex gap-3 border-b px-4 py-3 last:border-0 transition-colors ${isRead ? 'opacity-50' : 'hover:bg-muted/50'} ${item.href ? 'cursor-pointer' : ''}`}
                              onClick={() => { markRead(item.id); if (item.href) router.push(item.href) }}
                            >
                              <item.icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.actionable && !isRead ? 'text-primary' : 'text-muted-foreground'}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{item.title}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{item.message}</p>
                                <p className="mt-1 text-xs text-muted-foreground/60">{item.time}</p>
                              </div>
                              <button
                                type="button"
                                className="shrink-0 mt-0.5 p-0.5 rounded-sm text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                onClick={(e) => { e.stopPropagation(); dismiss(item.id) }}
                                title="알림 삭제"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {/* 설정 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => router.push('/settings')}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>설정</p></TooltipContent>
                  </Tooltip>
                  {/* 로그아웃 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleLogout}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-red-400 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>로그아웃</p></TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* 크레딧 바 */}
              <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-700/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">현재 플랜</p>
                  <p className="text-xs font-semibold text-slate-100">{planInfo.name}</p>
                </div>
                <div className="mt-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>크레딧</span>
                          <span>{creditsBalance.toLocaleString()}/{creditsQuota.toLocaleString()}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-700/50">
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
