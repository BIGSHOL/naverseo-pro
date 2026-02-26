import Link from 'next/link'
import { Logo } from '@/components/layout/logo'

export function Footer() {
  return (
    <footer className="border-t py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo size="sm" />
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              이용약관
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              개인정보처리방침
            </Link>
            <Link
              href="/updates"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              업데이트 내역
            </Link>
            <a
              href="mailto:soseon203@gmail.com"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              문의하기
            </a>
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-muted-foreground">
          © 2026 NaverSEO Pro. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
