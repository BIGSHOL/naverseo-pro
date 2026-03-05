import { Logo } from '@/components/layout/logo'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <Link href="/" className="mb-8">
        <Logo size="lg" />
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        짤 2026 NaverSEO Pro. All rights reserved.
      </p>
    </div>
  )
}
