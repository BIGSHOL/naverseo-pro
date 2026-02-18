'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CtaSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage('등록 완료! 곧 만나요.')
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || '등록에 실패했습니다.')
      }
    } catch {
      setStatus('error')
      setMessage('네트워크 오류가 발생했습니다.')
    }
  }

  return (
    <section className="py-20 bg-primary/5">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          지금 바로 시작하세요
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          무료 플랜으로 NaverSEO Pro의 강력한 기능을 체험해보세요.
          <br className="hidden sm:block" />
          사전 등록하시면 출시 소식을 가장 먼저 전해드립니다.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
        >
          <Input
            type="email"
            placeholder="이메일 주소를 입력하세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12"
            required
          />
          <Button
            type="submit"
            size="lg"
            className="h-12 whitespace-nowrap"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? '등록 중...' : '사전 등록'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        {message && (
          <p
            className={`mt-3 text-sm ${
              status === 'success' ? 'text-primary' : 'text-destructive'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  )
}
