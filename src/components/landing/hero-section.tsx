'use client'

import { useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function HeroSection() {
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
        setMessage('등록 완료! 출시 소식을 가장 먼저 전해드릴게요.')
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || '등록에 실패했습니다. 다시 시도해주세요.')
      }
    } catch {
      setStatus('error')
      setMessage('네트워크 오류가 발생했습니다.')
    }
  }

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            AI 기반 네이버 블로그 SEO 도구
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            네이버 블로그 상위 노출,
            <br />
            <span className="text-primary">AI가 도와드립니다</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            키워드 리서치부터 AI 콘텐츠 생성, SEO 점수 분석, 순위 트래킹까지.
            <br className="hidden sm:block" />
            네이버 블로그 SEO의 모든 것을 한 곳에서 관리하세요.
          </p>

          {/* 이메일 수집 폼 */}
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
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

          {/* 숫자 통계 */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-8">
            {[
              { value: '10만+', label: '키워드 분석' },
              { value: '5,000+', label: 'AI 콘텐츠 생성' },
              { value: '95%', label: 'SEO 정확도' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-foreground sm:text-3xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
