'use client'

import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MobileSidebar } from './mobile-sidebar'
import { useNotifications } from '@/hooks/use-notifications'

export function Header() {
  const router = useRouter()
  const { notifications, hasActionable } = useNotifications()

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
              {notifications.map((item, i) => (
                <div
                  key={i}
                  className={`flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50 ${item.href ? 'cursor-pointer' : ''}`}
                  onClick={() => item.href && router.push(item.href)}
                >
                  <item.icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.actionable ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{item.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
