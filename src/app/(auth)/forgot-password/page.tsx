'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const supabaseReady = isSupabaseConfigured()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!supabaseReady) {
      setError('Supabase가 설정되지 않았습니다.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSent(true)
    } catch {
      setError('비밀번호 재설정 요청 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Card className="overflow-hidden">
        <div className="relative flex flex-col items-center bg-gradient-to-b from-primary/10 via-primary/5 to-transparent px-6 pb-2 pt-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/20">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            전송 완료
          </div>
        </div>

        <CardHeader className="pb-2 pt-4 text-center">
          <CardTitle className="text-2xl">이메일을 확인해주세요</CardTitle>
          <CardDescription className="text-base">
            <strong className="text-foreground">{email}</strong>
            <span className="mt-1 block text-sm">
              위 주소로 비밀번호 재설정 링크를 보냈습니다
            </span>
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full gap-2">
              <ArrowLeft className="h-4 w-4" />
              로그인으로 돌아가기
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">비밀번호 찾기</CardTitle>
        <CardDescription>
          가입한 이메일을 입력하면 재설정 링크를 보내드립니다
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '전송 중...' : '재설정 링크 보내기'}
          </Button>
          <Link
            href="/login"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            로그인으로 돌아가기
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
