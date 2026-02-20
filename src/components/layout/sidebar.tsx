'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { PLANS, type Plan } from '@/types/database'
import type { UserRole } from '@/types/database'
import { navItems, adminNavItems } from '@/lib/navigation'

function parseLimit(limitStr: string): number | null {
  if (limitStr === '무제한') return null
  const match = limitStr.match(/(\d+)/)
  return match ? Number(match[1]) : null
}

export function Sidebar() {
  const pathname = usePathname()
  const [plan, setPlan] = useState<Plan>('free')
  const [role, setRole] = useState<UserRole>('user')
  const [keywordsUsed, setKeywordsUsed] = useState(0)
  const [contentUsed, setContentUsed] = useState(0)
  const [analysisUsed, setAnalysisUsed] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) return
        const data = await res.json()
        const userRole = (data.profile?.role || 'user') as UserRole
        setPlan(userRole === 'admin' ? 'admin' : (data.profile?.plan || 'free') as Plan)
        setRole(userRole)
        setKeywordsUsed(data.profile?.keywords_used_this_month || 0)
        setContentUsed(data.profile?.content_generated_this_month || 0)
        // 날짜가 오늘과 다르면 리셋된 것으로 간주
        const today = new Date().toISOString().slice(0, 10)
        const resetDate = data.profile?.analysis_reset_date || ''
        setAnalysisUsed(resetDate === today ? (data.profile?.analysis_used_today || 0) : 0)
      } catch {
        // 로드 실패 시 기본값 유지
      }
    }
    load()
  }, [pathname])

  const planInfo = PLANS[plan]
  const kwLimit = parseLimit(planInfo.keywords)
  const ctLimit = parseLimit(planInfo.content)
  const anLimit = parseLimit(planInfo.analysis)

  const kwPercent = kwLimit ? Math.min(100, (keywordsUsed / kwLimit) * 100) : 0
  const ctPercent = ctLimit ? Math.min(100, (contentUsed / ctLimit) * 100) : 0
  const anPercent = anLimit ? Math.min(100, (analysisUsed / anLimit) * 100) : 0

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

        {/* 하단 사용량 표시 */}
        <div className="border-t p-4">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">현재 플랜</p>
            <p className="text-sm font-semibold">{planInfo.name}</p>
            <div className="mt-2 space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>키워드 조회</span>
                      <span>{kwLimit ? `${keywordsUsed}/${kwLimit}` : `${keywordsUsed}/∞`}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: kwLimit ? `${kwPercent}%` : '0%' }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>이번 달 키워드 조회 사용량입니다</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>콘텐츠 생성</span>
                      <span>{ctLimit ? `${contentUsed}/${ctLimit}` : `${contentUsed}/∞`}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: ctLimit ? `${ctPercent}%` : '0%' }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>이번 달 AI 콘텐츠 생성 사용량입니다</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>블로그 분석</span>
                      <span>{anLimit ? `${analysisUsed}/${anLimit}` : `${analysisUsed}/∞`}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: anLimit ? `${anPercent}%` : '0%' }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>오늘의 블로그 분석 사용량입니다 (일간 제한)</p></TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
