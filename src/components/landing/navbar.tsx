'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/layout/logo'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { label: '기능', href: '/#features' },
    { label: '가격', href: '/#pricing' },
    { label: 'FAQ', href: '/faq' },
  ]

  return (
    <nav className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Logo size="md" />
        </Link>

        {/* 데스크탑 메뉴 */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                로그인
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">무료로 시작하기</Button>
            </Link>
          </div>
        </div>

        {/* 모바일 메뉴 버튼 */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* 모바일 메뉴 */}
      {mobileMenuOpen && (
        <div className="border-t bg-background md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs">
                  로그인
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="h-8 px-3 text-xs">시작하기</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
