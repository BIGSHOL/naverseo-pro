'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, Clapperboard, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PlanGateAlert } from '@/components/plan-gate-alert'
import { CreditTooltip } from '@/components/credit-tooltip'
import { creditToast } from '@/lib/credit-toast'
import { savePageCache, loadPageCache } from '@/lib/session-cache'
import type { Plan } from '@/types/database'

interface ScriptSection {
  section: string
  timestamp: string
  narration: string
  visualDirection: string
}

interface ReelsResult {
  script: ScriptSection[]
  totalDuration: string
}

type Duration = '30s' | '60s'

interface Props {
  userPlan?: Plan
}

export function InstagramTabReels({ userPlan }: Props) {
  const [content, setContent] = useState('')
  const [duration, setDuration] = useState<Duration>('30s')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planGate, setPlanGate] = useState<string | null>(null)
  const [result, setResult] = useState<ReelsResult | null>(null)
  const [copied, setCopied] = useState(false)

  // 페이지 복귀 시 캐시 복원
  useEffect(() => {
    const cached = loadPageCache<{ result: ReelsResult; content: string; duration: Duration }>('instagram-reels')
    if (cached) {
      setResult(cached.result)
      setContent(cached.content)
      setDuration(cached.duration)
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
        body: JSON.stringify({ mode: 'reels', content: content.trim(), duration }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.planGate) {
          setPlanGate(data.error)
        } else {
          setError(data.error || '릴스 대본 생성에 실패했습니다.')
        }
        return
      }

      setResult(data)
      savePageCache('instagram-reels', { result: data, content: content.trim(), duration })
      creditToast('instagram_convert')
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyAll = async () => {
    if (!result) return
    const text = result.script
      .map((s) => `[${s.section}] ${s.timestamp}\n나레이션: ${s.narration}\n비주얼: ${s.visualDirection}`)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {content.length}자 입력됨
              </span>
              <div className="flex items-center gap-1 rounded-lg border p-0.5">
                <button
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    duration === '30s' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDuration('30s')}
                >
                  30초
                </button>
                <button
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    duration === '60s' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDuration('60s')}
                >
                  60초
                </button>
              </div>
            </div>
            <CreditTooltip feature="instagram_convert">
              <Button onClick={handleGenerate} disabled={loading || content.trim().length < 200}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Clapperboard className="mr-2 h-4 w-4" />
                    대본 생성 (2크레딧)
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
                릴스 대본
                <Badge variant="secondary" className="ml-2">
                  {result.totalDuration}
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                {copied ? (
                  <><Check className="mr-1 h-3 w-3" />복사됨</>
                ) : (
                  <><Copy className="mr-1 h-3 w-3" />전체 복사</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {result.script.map((section, idx) => (
                <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* 타임라인 라인 */}
                  {idx < result.script.length - 1 && (
                    <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5 bg-border" />
                  )}
                  {/* 타임스탬프 도트 */}
                  <div className="flex shrink-0 flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                  {/* 내용 */}
                  <div className="flex-1 rounded-lg border bg-card p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{section.section}</Badge>
                      <span className="text-xs text-muted-foreground">{section.timestamp}</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">나레이션</p>
                        <p className="text-sm leading-relaxed">{section.narration}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">비주얼 디렉션</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{section.visualDirection}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
