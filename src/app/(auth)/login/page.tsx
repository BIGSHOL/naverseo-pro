'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
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
import SocialLoginButtons from '@/components/auth/social-login-buttons'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_error: '소셜 로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
  identity_already_exists: '이 소셜 계정은 이미 다른 계정에 연동되어 있습니다. 기존 계정으로 로그인하거나, 해당 계정에서 연동을 해제한 후 다시 시도해주세요.',
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabaseReady = isSupabaseConfigured()

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(AUTH_ERROR_MESSAGES[errorParam] || `로그인 오류: ${errorParam}`)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!supabaseReady) {
      setError('Supabase가 설정되지 않았습니다. .env.local 파일에 Supabase 키를 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.')
        } else {
          setError(authError.message)
        }
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl sm:text-2xl">로그인</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          계정에 로그인하여 SEO 도구를 사용하세요
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {!supabaseReady && (
            <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Supabase 미설정</p>
                <p className="mt-1 text-xs">
                  .env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.
                  설정 후 서버를 재시작해야 합니다.
                </p>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <SocialLoginButtons redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback`} />
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">비밀번호</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                비밀번호 찾기
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              회원가입
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
