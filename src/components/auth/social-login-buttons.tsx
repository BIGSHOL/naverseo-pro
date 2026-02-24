'use client'

import { useState } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface SocialLoginButtonsProps {
  redirectTo?: string
}

export default function SocialLoginButtons({ redirectTo }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    setLoading(provider)
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo || `${origin}/api/auth/callback`,
        },
      })
    } catch {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Google */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-3 border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        onClick={() => handleOAuth('google')}
        disabled={!!loading}
      >
        {loading === 'google' ? (
          '연결 중...'
        ) : (
          <>
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google로 계속하기
          </>
        )}
      </Button>

      {/* Kakao */}
      <Button
        type="button"
        className="w-full gap-3 border-0 text-[#191919] hover:opacity-90"
        style={{ backgroundColor: '#FEE500' }}
        onClick={() => handleOAuth('kakao')}
        disabled={!!loading}
      >
        {loading === 'kakao' ? (
          '연결 중...'
        ) : (
          <>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#191919">
              <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.12c-.1.35.3.64.6.44l4.8-3.18c.44.04.88.06 1.34.06 5.52 0 10-3.36 10-7.68S17.52 3 12 3z" />
            </svg>
            카카오로 계속하기
          </>
        )}
      </Button>

      {/* 구분선 */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">또는</span>
        </div>
      </div>
    </div>
  )
}
