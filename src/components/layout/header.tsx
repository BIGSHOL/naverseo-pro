'use client'

import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MobileSidebar } from './mobile-sidebar'
import { useNotifications } from '@/hooks/use-notifications'

export function Header() {
  const router = useRouter()
  const { notifications, readIds, hasActionable, markRead, dismiss } = useNotifications()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
      <div className="flex items-center gap-4">
        <MobileSidebar />
        <h2 className="text-lg font-semibold">NaverSEO Pro</h2>
      </div>

      <div className="flex items-center gap-2">
        {/* 모바일 알림 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {hasActionable && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-80 p-0">
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
                    onClick={() => {
                      markRead(item.id)
                      if (item.href) router.push(item.href)
                    }}
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
      </div>
    </header>
  )
}
