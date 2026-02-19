'use client'

import { useMemo, useState } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { analyzeSeo, analyzeReadability } from '@/lib/content/engine'
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LiveSeoPanelProps {
  keyword: string
  title: string
  content: string
  additionalKeywords?: string[]
  compact?: boolean
}

function getScoreBgClass(score: number) {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function getScoreTextClass(score: number) {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

function getCharCountInfo(len: number) {
  if (len < 800) return { color: 'text-red-500', label: '너무 짧음' }
  if (len < 1500) return { color: 'text-yellow-500', label: '짧음' }
  if (len <= 3000) return { color: 'text-green-500', label: '적정' }
  return { color: 'text-yellow-500', label: '길 수 있음' }
}

export function LiveSeoPanel({ keyword, title, content, additionalKeywords, compact = false }: LiveSeoPanelProps) {
  const debouncedContent = useDebounce(content, 300)
  const debouncedTitle = useDebounce(title, 300)
  const [showDetails, setShowDetails] = useState(!compact)

  const analysis = useMemo(() => {
    if (!debouncedContent || debouncedContent.trim().length < 50 || !keyword.trim()) return null
    try {
      const seo = analyzeSeo(keyword.trim(), debouncedTitle.trim(), debouncedContent.trim(), additionalKeywords)
      const readability = analyzeReadability(debouncedContent.trim())
      return { seo, readability }
    } catch {
      return null
    }
  }, [debouncedContent, debouncedTitle, keyword, additionalKeywords])

  if (!analysis) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          {!keyword.trim() ? '키워드를 입력하세요' : '본문 50자 이상 입력 시 실시간 분석이 시작됩니다'}
        </p>
      </div>
    )
  }

  const { seo, readability } = analysis
  const charInfo = getCharCountInfo(debouncedContent.length)

  // compact 모드: 점수가 낮은 카테고리 5개만
  const displayCategories = compact
    ? [...seo.categories].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore)).slice(0, 5)
    : seo.categories

  return (
    <div className="space-y-4">
      {/* 총점 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${getScoreBgClass(seo.totalScore)}`}>
            <span className="text-lg font-bold text-white">{seo.totalScore}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">실시간 SEO 점수</span>
              <span className={cn('text-xs font-medium', getScoreTextClass(seo.totalScore))}>
                {seo.totalScore >= 80 ? '우수' : seo.totalScore >= 60 ? '양호' : seo.totalScore >= 40 ? '보통' : '개선 필요'}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getScoreBgClass(seo.totalScore)}`}
                style={{ width: `${seo.totalScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 글자 수 + 가독성 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">글자 수</p>
          <p className={cn('text-lg font-bold', charInfo.color)}>{debouncedContent.length.toLocaleString()}</p>
          <p className={cn('text-xs', charInfo.color)}>{charInfo.label}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">가독성</p>
          <p className={cn('text-lg font-bold', getScoreTextClass(readability.score))}>{readability.grade}</p>
          <p className="text-xs text-muted-foreground">{readability.score}점</p>
        </div>
      </div>

      {/* 카테고리별 점수 */}
      <div className="rounded-lg border">
        <button
          className="flex w-full items-center justify-between p-3 text-sm font-medium"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span>{compact ? '약한 항목 TOP 5' : '항목별 분석'}</span>
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showDetails && (
          <div className="space-y-3 border-t px-3 pb-3 pt-2">
            {displayCategories.map((cat) => {
              const pct = (cat.score / cat.maxScore) * 100
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{cat.name}</span>
                    <span className={cn('font-medium', getScoreTextClass(pct))}>
                      {cat.score}/{cat.maxScore}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${getScoreBgClass(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 강점/개선점 (compact 모드에서는 개선점만) */}
      {!compact && seo.strengths.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="mb-2 text-xs font-medium text-green-700">강점</p>
          <ul className="space-y-1">
            {seo.strengths.slice(0, 3).map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-green-700">
                <CheckCircle className="mt-0.5 h-3 w-3 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {seo.improvements.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <p className="mb-2 text-xs font-medium text-yellow-700">개선 필요</p>
          <ul className="space-y-1">
            {seo.improvements.slice(0, compact ? 3 : 5).map((imp, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-yellow-700">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {imp}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
