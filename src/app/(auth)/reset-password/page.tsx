'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, CheckCircle2 } from 'lucide-react'
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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const supabaseReady = isSupabaseConfigured()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!supabaseReady) {
      setError('Supabase가 설정되지 않았습니다.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        if (updateError.message.includes('same password')) {
          setError('현재 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.')
        } else {
          setError(updateError.message)
        }
        return
      }

      setSuccess(true)
    } catch {
      setError('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="overflow-hidden">
        <div className="relative flex flex-col items-center bg-gradient-to-b from-primary/10 via-primary/5 to-transparent px-6 pb-2 pt-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/20">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
        </div>
        <CardHeader className="pb-2 pt-4 text-center">
          <CardTitle className="text-2xl">비밀번호 변경 완료</CardTitle>
          <CardDescription>
            새 비밀번호로 로그인할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardFooter className="px-6 pb-6">
          <Button
            className="w-full"
            onClick={() => {
              router.push('/dashboard')
              router.refresh()
            }}
          >
            대시보드로 이동
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">새 비밀번호 설정</CardTitle>
        <CardDescription>
          사용할 새 비밀번호를 입력해주세요
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
            <Label htmlFor="password">새 비밀번호</Label>
            <Input
              id="password"
              type="password"
              placeholder="6자 이상 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">비밀번호 확인</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
