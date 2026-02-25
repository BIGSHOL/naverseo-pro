'use client'

import { useState } from 'react'
import { Loader2, Copy, Check, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PlanGateAlert } from '@/components/plan-gate-alert'
import type { Plan } from '@/types/database'

interface HashtagItem {
  tag: string
  category: 'mega' | 'large' | 'medium' | 'niche'
  estimatedSize: string
}

interface HashtagResult {
  hashtags: HashtagItem[]
  totalCount: number
  copyText: string
}

const CATEGORY_CONFIG = {
  mega: { label: 'Mega (50만+)', color: 'bg-red-100 text-red-700 border-red-200' },
  large: { label: 'Large (10만~50만)', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium (1만~10만)', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  niche: { label: 'Niche (1만 미만)', color: 'bg-green-100 text-green-700 border-green-200' },
} as const

interface Props {
  userPlan?: Plan
}

export function InstagramTabHashtags({ userPlan }: Props) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planGate, setPlanGate] = useState<string | null>(null)
  const [result, setResult] = useState<HashtagResult | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!keyword.trim()) {
      setError('키워드를 입력해주세요.')
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
        body: JSON.stringify({ mode: 'hashtags', keyword: keyword.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.planGate) {
          setPlanGate(data.error)
        } else {
          setError(data.error || '해시태그 추천에 실패했습니다.')
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
    await navigator.clipboard.writeText(result.copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">키워드 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="예: 카페추천, 다이어트식단, 서울여행..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
            />
            <Button onClick={handleGenerate} disabled={loading || !keyword.trim()} className="shrink-0">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Hash className="mr-2 h-4 w-4" />
                  추천
                </>
              )}
            </Button>
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
                해시태그 {result.totalCount}개
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <><Check className="mr-1 h-3 w-3" />복사됨</>
                ) : (
                  <><Copy className="mr-1 h-3 w-3" />전체 복사</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {(['mega', 'large', 'medium', 'niche'] as const).map((cat) => {
              const items = result.hashtags.filter((h) => h.category === cat)
              if (items.length === 0) return null
              const config = CATEGORY_CONFIG[cat]
              return (
                <div key={cat}>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {config.label} ({items.length}개)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((h) => (
                      <Badge
                        key={h.tag}
                        variant="outline"
                        className={`${config.color} cursor-default`}
                      >
                        {h.tag}
                        <span className="ml-1 opacity-60">{h.estimatedSize}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
