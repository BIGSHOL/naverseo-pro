'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Ban, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function BannedPage() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-4">
        <Ban className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="text-lg font-semibold">계정이 차단되었습니다</h2>
        <p className="text-sm text-muted-foreground">
          관리자에 의해 계정 접근이 제한되었습니다.
          <br />
          문의사항이 있으시면 관리자에게 연락해주세요.
        </p>
        <Button onClick={handleLogout} variant="outline" className="gap-2">
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </CardContent>
    </Card>
  )
}
