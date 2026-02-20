'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Mail, CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react'
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

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const supabaseReady = isSupabaseConfigured()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!supabaseReady) {
      setError('Supabase가 설정되지 않았습니다. .env.local 파일에 Supabase 키를 입력해주세요.')
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('이미 등록된 이메일입니다.')
        } else if (authError.message.includes('valid email')) {
          setError('올바른 이메일 주소를 입력해주세요.')
        } else {
          setError(authError.message)
        }
        return
      }

      // identities가 비어있으면 이미 가입된 이메일 (Supabase 보안 정책상 동일 응답)
      if (data.user?.identities?.length === 0) {
        setError('이미 등록된 이메일입니다. 로그인 페이지를 이용해주세요.')
        return
      }

      // Supabase 설정에 따라 이메일 확인이 필요할 수 있음
      if (data.user && !data.session) {
        // 신규 가입 → 이메일 확인 필요
        setSuccess(true)
      } else {
        // 바로 로그인됨 (이메일 확인 비활성화 시)
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!supabaseReady) return
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.resend({ type: 'signup', email })
    } catch {
      // 재전송 실패해도 무시
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="overflow-hidden">
        {/* 상단 그라데이션 배너 */}
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
              위 주소로 인증 메일을 보냈습니다
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6">
          {/* 인증 단계 안내 */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">인증 방법</p>
            <ol className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                받은 메일함에서 NaverSEO Pro 인증 메일을 확인
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                메일 본문의 <strong className="text-foreground">인증 링크</strong>를 클릭
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                로그인 후 바로 사용 시작
              </li>
            </ol>
          </div>

          {/* 스팸 폴더 안내 */}
          <div className="flex items-start gap-2.5 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-900 dark:bg-yellow-950/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
            <p className="text-yellow-800 dark:text-yellow-200">
              메일이 안 보이면 <strong>스팸 또는 프로모션 탭</strong>을 확인해주세요.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <Link href="/login" className="w-full">
            <Button className="w-full gap-2">
              로그인 페이지로 이동
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleResend}
            disabled={loading}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {loading ? '전송 중...' : '인증 메일 재전송'}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">회원가입</CardTitle>
        <CardDescription>
          무료 계정을 만들고 NaverSEO Pro를 시작하세요
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
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
            <Label htmlFor="password">비밀번호</Label>
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
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '회원가입 중...' : '무료로 시작하기'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              로그인
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
