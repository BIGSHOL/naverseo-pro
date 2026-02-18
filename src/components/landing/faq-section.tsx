'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'NaverSEO Pro는 어떤 서비스인가요?',
    answer:
      'NaverSEO Pro는 네이버 블로그 운영자를 위한 AI 기반 SEO 올인원 도구입니다. 키워드 리서치, AI 콘텐츠 생성, SEO 점수 분석, 순위 트래킹 기능을 제공합니다.',
  },
  {
    question: 'AI가 생성한 콘텐츠의 품질은 어떤가요?',
    answer:
      'Claude AI를 활용하여 네이버 C-Rank, D.I.A. 알고리즘에 최적화된 콘텐츠를 생성합니다. SEO 구조를 갖춘 자연스러운 문체의 블로그 글을 만들어 드리며, 필요에 따라 직접 수정하실 수 있습니다.',
  },
  {
    question: '무료 플랜으로 어디까지 사용할 수 있나요?',
    answer:
      '무료 플랜에서는 월 10회 키워드 검색량 조회, 3편의 AI 콘텐츠 생성, SEO 점수 체크 기능을 이용하실 수 있습니다. 순위 트래킹은 Starter 플랜부터 제공됩니다.',
  },
  {
    question: '네이버 API 키가 필요한가요?',
    answer:
      '아니요, 별도의 API 키 없이 바로 사용하실 수 있습니다. NaverSEO Pro가 네이버 검색광고 API와 데이터랩 API를 대신 연동하여 데이터를 제공합니다.',
  },
  {
    question: '환불 정책은 어떻게 되나요?',
    answer:
      '유료 플랜 결제 후 7일 이내에 환불 요청하시면 전액 환불해 드립니다. 7일이 지난 후에는 잔여 기간에 대한 비례 환불이 적용됩니다.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            자주 묻는 질문
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            궁금한 점이 있으시면 확인해보세요
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-12">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-base">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
