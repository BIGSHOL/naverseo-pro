'use client'

import { useRouter } from 'next/navigation'
import { Bell, LogOut, User, Info, Sparkles, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MobileSidebar } from './mobile-sidebar'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'

const notifications = [
  {
    icon: Sparkles,
    title: '서비스 오픈',
    message: 'NaverSEO Pro가 정식 오픈했습니다! 무료 플랜으로 체험해보세요.',
    time: '2026.02.19',
  },
  {
    icon: Megaphone,
    title: '결제 기능 준비 중',
    message: '유료 플랜 결제 기능은 곧 오픈 예정입니다. 현재는 무료로 이용 가능합니다.',
    time: '공지',
  },
  {
    icon: Info,
    title: '사용 팁',
    message: 'URL로 가져오기 기능으로 기존 블로그 글의 SEO 점수를 바로 확인해보세요!',
    time: '팁',
  },
]

export function Header() {
  const router = useRouter()

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // 로그아웃 실패 시 무시
      }
    }
    router.push('/')
    router.refresh()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <MobileSidebar />
        <h2 className="text-lg font-semibold lg:hidden">NaverSEO Pro</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* 알림 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">알림</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((item, i) => (
                <div
                  key={i}
                  className="flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50"
                >
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {item.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* 프로필 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary">
                  U
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="mr-2 h-4 w-4" />
              내 프로필
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
