'use client'

import { useMemo, useState } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { analyzeSeo, analyzeReadability } from '@/lib/seo/engine'
import { analyzeDia, type DiaAnalysisResult } from '@/lib/dia/engine'
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Sparkles, Shield } from 'lucide-react'
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
      const dia = analyzeDia(keyword.trim(), debouncedTitle.trim(), debouncedContent.trim())
      return { seo, readability, dia }
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

  const { seo, readability, dia } = analysis
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

      {/* DIA 점수 (D.I.A. 품질 분석) */}
      <DiaScoreSection dia={dia} compact={compact} />

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

// ===== DIA 점수 섹션 컴포넌트 =====

function getDiaGradeColor(grade: string) {
  switch (grade) {
    case 'S': return { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200', bgLight: 'bg-emerald-50' }
    case 'A+': return { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-200', bgLight: 'bg-green-50' }
    case 'A': return { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-200', bgLight: 'bg-teal-50' }
    case 'B+': return { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200', bgLight: 'bg-blue-50' }
    case 'B': return { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-200', bgLight: 'bg-yellow-50' }
    case 'C': return { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-200', bgLight: 'bg-orange-50' }
    default: return { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-200', bgLight: 'bg-red-50' }
  }
}

function DiaScoreSection({ dia, compact }: { dia: DiaAnalysisResult; compact: boolean }) {
  const [showDiaDetails, setShowDiaDetails] = useState(!compact)
  const colors = getDiaGradeColor(dia.grade)

  // compact 모드: 점수가 낮은 카테고리 3개만
  const displayCategories = compact
    ? [...dia.categories].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore)).slice(0, 3)
    : dia.categories

  return (
    <div className="space-y-2">
      {/* DIA 총점 */}
      <div className={cn('rounded-lg border p-4', colors.border, colors.bgLight)}>
        <div className="flex items-center gap-3">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full', colors.bg)}>
            <span className="text-lg font-bold text-white">{dia.totalScore}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Shield className="h-3.5 w-3.5" />
                D.I.A. 품질
              </span>
              <span className={cn('text-xs font-bold', colors.text)}>
                {dia.grade} {dia.gradeInfo.label}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-white/60">
              <div
                className={cn('h-2 rounded-full transition-all duration-300', colors.bg)}
                style={{ width: `${dia.totalScore}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{dia.gradeInfo.description}</p>
          </div>
        </div>
      </div>

      {/* DIA 카테고리별 점수 */}
      <div className="rounded-lg border">
        <button
          className="flex w-full items-center justify-between p-3 text-sm font-medium"
          onClick={() => setShowDiaDetails(!showDiaDetails)}
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            {compact ? 'DIA 약한 항목' : 'DIA 항목별 분석'}
          </span>
          {showDiaDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showDiaDetails && (
          <div className="space-y-3 border-t px-3 pb-3 pt-2">
            {displayCategories.map((cat) => {
              const pct = (cat.score / cat.maxScore) * 100
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{cat.name}</span>
                    <span className={cn('font-medium', getScoreTextClass(pct))}>
                      {cat.score}/{cat.maxScore}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className={cn('h-1.5 rounded-full transition-all duration-300', getScoreBgClass(pct))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {!compact && <p className="mt-0.5 text-[10px] text-muted-foreground">{cat.tip}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* DIA 경험 하이라이트 (compact가 아닐 때만) */}
      {!compact && dia.experienceHighlights.length > 0 && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <p className="mb-1.5 text-xs font-medium text-purple-700">경험 정보 감지</p>
          <ul className="space-y-1">
            {dia.experienceHighlights.slice(0, 3).map((h, i) => (
              <li key={i} className="text-[10px] text-purple-600 truncate">
                &ldquo;...{h}...&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* DIA 의도 경고 */}
      {dia.intentWarnings.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="mb-1.5 text-xs font-medium text-red-700">DIA 경고</p>
          <ul className="space-y-1">
            {dia.intentWarnings.slice(0, compact ? 2 : 4).map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
