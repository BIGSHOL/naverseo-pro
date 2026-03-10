'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, Layers, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PlanGateAlert } from '@/components/plan-gate-alert'
import { CreditTooltip } from '@/components/credit-tooltip'
import { creditToast } from '@/lib/credit-toast'
import { savePageCache, loadPageCache } from '@/lib/session-cache'
import type { Plan } from '@/types/database'

interface SlideItem {
  slideNumber: number
  type: 'cover' | 'content' | 'cta'
  headline: string
  body: string
}

interface CarouselResult {
  slides: SlideItem[]
  totalSlides: number
}

const SLIDE_TYPE_CONFIG = {
  cover: { label: '표지', color: 'bg-purple-100 text-purple-700' },
  content: { label: '본문', color: 'bg-blue-100 text-blue-700' },
  cta: { label: 'CTA', color: 'bg-green-100 text-green-700' },
} as const

interface Props {
  userPlan?: Plan
}

export function InstagramTabCarousel({ userPlan }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planGate, setPlanGate] = useState<string | null>(null)
  const [result, setResult] = useState<CarouselResult | null>(null)
  const [copiedSlide, setCopiedSlide] = useState<number | null>(null)

  // 페이지 복귀 시 캐시 복원
  useEffect(() => {
    const cached = loadPageCache<{ result: CarouselResult; content: string }>('instagram-carousel')
    if (cached) {
      setResult(cached.result)
      setContent(cached.content)
    }
  }, [])

  const handleGenerate = async () => {
    if (content.trim().length < 200) {
      setError('블로그 본문을 200자 이상 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setPlanGate(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'carousel', content: content.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.planGate) {
          setPlanGate(data.error)
        } else {
          setError(data.error || '캐러셀 생성에 실패했습니다.')
        }
        return
      }

      setResult(data)
      savePageCache('instagram-carousel', { result: data, content: content.trim() })
      creditToast('instagram_convert')
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopySlide = async (slide: SlideItem) => {
    const text = `[슬라이드 ${slide.slideNumber}]\n${slide.headline}\n\n${slide.body}`
    await navigator.clipboard.writeText(text)
    setCopiedSlide(slide.slideNumber)
    setTimeout(() => setCopiedSlide(null), 2000)
  }

  const handleCopyAll = async () => {
    if (!result) return
    const text = result.slides
      .map((s) => `[슬라이드 ${s.slideNumber} - ${SLIDE_TYPE_CONFIG[s.type].label}]\n${s.headline}\n${s.body}`)
      .join('\n\n---\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedSlide(-1)
    setTimeout(() => setCopiedSlide(null), 2000)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">블로그 본문 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="네이버 블로그 글 본문을 붙여넣기 해주세요 (최소 200자)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="resize-y"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {content.length}자 입력됨 {content.length < 200 && content.length > 0 && '(최소 200자)'}
            </span>
            <CreditTooltip feature="instagram_convert">
              <Button onClick={handleGenerate} disabled={loading || content.trim().length < 200}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Layers className="mr-2 h-4 w-4" />
                    캐러셀 생성 (2크레딧)
                  </>
                )}
              </Button>
            </CreditTooltip>
          </div>
        </CardContent>
      </Card>

      {planGate && <PlanGateAlert message={planGate} currentPlan={userPlan} />}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                캐러셀 {result.totalSlides}장
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                {copiedSlide === -1 ? (
                  <><Check className="mr-1 h-3 w-3" />복사됨</>
                ) : (
                  <><Copy className="mr-1 h-3 w-3" />전체 복사</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.slides.map((slide) => {
                const typeConfig = SLIDE_TYPE_CONFIG[slide.type]
                return (
                  <div
                    key={slide.slideNumber}
                    className="group relative rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                          {slide.slideNumber}
                        </div>
                        <Badge variant="secondary" className={typeConfig.color}>
                          {typeConfig.label}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => handleCopySlide(slide)}
                      >
                        {copiedSlide === slide.slideNumber ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-start gap-2">
                      <Image className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-sm">{slide.headline}</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{slide.body}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
