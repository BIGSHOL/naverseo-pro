import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
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
  metadataBase: new URL('https://www.naverseopro.com'),
  title: 'NaverSEO Pro - AI 기반 네이버 블로그 SEO 올인원 도구',
  description:
    '키워드 검색, AI 콘텐츠 생성, SEO 점수 분석, 순위 트래킹까지. 네이버 블로그 SEO의 모든 것을 한 곳에서.',
  keywords: ['네이버 SEO', '블로그 SEO', 'AI 콘텐츠', '키워드 분석', '순위 트래킹'],
  openGraph: {
    title: 'NaverSEO Pro - 네이버 블로그 상위 노출의 비밀',
    description: '키워드 분석부터 AI 글쓰기, SEO 점수 체크, 순위 트래킹까지. 블로그 운영자와 마케터를 위한 올인원 SEO 도구.',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'NaverSEO Pro',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'NaverSEO Pro - AI 기반 네이버 블로그 SEO 올인원 도구',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NaverSEO Pro - 네이버 블로그 상위 노출의 비밀',
    description: '키워드 분석부터 AI 글쓰기, SEO 점수 체크, 순위 트래킹까지. 블로그 운영자와 마케터를 위한 올인원 SEO 도구.',
    images: ['/banner.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
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
        <Script
          src="https://app.lemonsqueezy.com/js/lemon.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  )
}
