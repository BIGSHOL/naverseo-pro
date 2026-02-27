'use client'

import { useState } from 'react'
import { Loader2, Copy, Check, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PlanGateAlert } from '@/components/plan-gate-alert'
import { CreditTooltip } from '@/components/credit-tooltip'
import type { Plan } from '@/types/database'

interface CaptionResult {
  caption: string
  callToAction: string
  charCount: number
}

interface Props {
  userPlan?: Plan
}

export function InstagramTabCaption({ userPlan }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planGate, setPlanGate] = useState<string | null>(null)
  const [result, setResult] = useState<CaptionResult | null>(null)
  const [copied, setCopied] = useState(false)

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
        body: JSON.stringify({ mode: 'caption', content: content.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.planGate) {
          setPlanGate(data.error)
        } else {
          setError(data.error || '캡션 변환에 실패했습니다.')
        }
        return
      }

      setResult(data)
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.caption)
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
            <span className="text-xs text-muted-foreground">
              {content.length}자 입력됨 {content.length < 200 && content.length > 0 && '(최소 200자)'}
            </span>
            <CreditTooltip feature="instagram_convert">
              <Button onClick={handleGenerate} disabled={loading || content.trim().length < 200}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    변환 중...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    캡션 변환
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
              <CardTitle className="text-lg">변환된 캡션</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{result.charCount}자</Badge>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <><Check className="mr-1 h-3 w-3" />복사됨</>
                  ) : (
                    <><Copy className="mr-1 h-3 w-3" />복사</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm leading-relaxed">
              {result.caption}
            </div>
            {result.callToAction && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-medium text-blue-600">CTA (행동 유도)</p>
                <p className="mt-1 text-sm text-blue-800">{result.callToAction}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
