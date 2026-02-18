import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'NaverSEO Pro - AI 기반 네이버 블로그 SEO 올인원 도구',
  description:
    '키워드 리서치, AI 콘텐츠 생성, SEO 점수 분석, 순위 트래킹까지. 네이버 블로그 SEO의 모든 것을 한 곳에서.',
  keywords: ['네이버 SEO', '블로그 SEO', 'AI 콘텐츠', '키워드 분석', '순위 트래킹'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
