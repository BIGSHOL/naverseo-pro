import { Navbar } from '@/components/landing/navbar'
import { FaqSection } from '@/components/landing/faq-section'
import { Footer } from '@/components/landing/footer'

export const metadata = {
  title: '자주 묻는 질문 - NaverSEO Pro',
  description: 'NaverSEO Pro 서비스 이용에 대한 자주 묻는 질문과 답변을 확인하세요.',
}

export default function FaqPage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="pt-16">
        <FaqSection />
      </div>
      <Footer />
    </main>
  )
}
