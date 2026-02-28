'use client'

import { useMemo, useState } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { analyzeSeo, analyzeReadability } from '@/lib/seo/engine'
import { analyzeDia, type DiaAnalysisResult } from '@/lib/dia/engine'
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Sparkles, Shield, Lightbulb, TrendingUp, ArrowUp } from 'lucide-react'
import type { SeoCategory } from '@/lib/seo/engine'
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

// ===== 실시간 개선 가이드 =====

interface ImprovementTip {
  categoryName: string
  categoryId: string
  priority: 'high' | 'medium' | 'low'
  currentScore: number
  maxScore: number
  gap: number
  details: string
  tip: string
}

/** 카테고리 ID → 개선 안내 텍스트 */
const CATEGORY_TIPS: Record<string, string> = {
  title_keyword: '제목 앞쪽에 핵심 키워드를 포함하세요',
  title_length: '제목을 20~40자로 조정하세요',
  heading_structure: '소제목(##)을 3개 이상 사용하세요',
  keyword_density: '본문에 키워드를 자연스럽게 반복하세요',
  keyword_distribution: '도입부·중간·마무리에 키워드를 배치하세요',
  content_length: '콘텐츠를 2,000자 이상으로 작성하세요',
  multimedia: '[이미지: 설명] 태그를 4개 이상 추가하세요',
  readability_elements: '볼드(**), 리스트(-) 등 가독성 요소를 추가하세요',
  related_keywords: '관련 키워드를 본문에 더 포함하세요',
  tags_cta: '태그(#)와 댓글/공감 유도 문구를 추가하세요',
  internal_links: '내부 링크를 3개 이상 추가하세요',
  meta_description: '도입부 첫 문장에 키워드를 포함하세요',
  mobile_optimization: '문장과 문단을 짧게 나누세요',
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function getImprovementTips(categories: SeoCategory[], limit: number): ImprovementTip[] {
  return categories
    .filter(cat => cat.score < cat.maxScore)
    .map(cat => ({
      categoryName: cat.name,
      categoryId: cat.id,
      priority: cat.priority,
      currentScore: cat.score,
      maxScore: cat.maxScore,
      gap: cat.maxScore - cat.score,
      details: cat.details,
      tip: CATEGORY_TIPS[cat.id] || cat.details,
    }))
    .sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
      if (pDiff !== 0) return pDiff
      return b.gap - a.gap
    })
    .slice(0, limit)
}

function getPriorityConfig(priority: 'high' | 'medium' | 'low') {
  switch (priority) {
    case 'high': return { label: '긴급', bg: 'bg-red-100', text: 'text-red-700', border: 'border-l-red-500' }
    case 'medium': return { label: '권장', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-l-yellow-500' }
    case 'low': return { label: '참고', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-l-blue-500' }
  }
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

  // 개선 포인트: compact 3개, 전체 5개
  const tips = getImprovementTips(seo.categories, compact ? 3 : 5)
  const potentialScore = Math.min(100, seo.totalScore + tips.reduce((sum, t) => sum + t.gap, 0))

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
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', seo.gradeInfo.badgeColor)}>
                {seo.gradeInfo.label}
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

      {/* 실시간 개선 가이드 */}
      {tips.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-1.5 border-b border-amber-200 px-3 py-2">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">실시간 개선 가이드</span>
          </div>
          <div className="divide-y divide-amber-100">
            {tips.map((tip) => {
              const pct = (tip.currentScore / tip.maxScore) * 100
              const config = getPriorityConfig(tip.priority)
              return (
                <div
                  key={tip.categoryId}
                  className={cn(
                    'border-l-2 px-3 py-2.5',
                    config.border,
                    tip.priority === 'high' && 'animate-pulse'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('rounded px-1 py-0.5 text-[10px] font-bold', config.bg, config.text)}>
                        {config.label}
                      </span>
                      <span className="text-xs font-medium">{tip.categoryName}</span>
                    </div>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-600">
                      <ArrowUp className="h-2.5 w-2.5" />
                      +{tip.gap}점
                    </span>
                  </div>
                  {!compact && (
                    <div className="mt-1.5 h-1 rounded-full bg-amber-200/50">
                      <div
                        className={cn('h-1 rounded-full transition-all duration-300', getScoreBgClass(pct))}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-amber-700">{tip.tip}</p>
                </div>
              )
            })}
          </div>
          {/* 잠재 점수 */}
          <div className="flex items-center justify-center gap-1.5 border-t border-amber-200 px-3 py-2">
            <TrendingUp className="h-3 w-3 text-amber-600" />
            <span className="text-[11px] text-amber-700">
              모두 개선 시 최대 <span className={cn('font-bold', getScoreTextClass(potentialScore))}>{potentialScore}점</span> 가능
            </span>
          </div>
        </div>
      )}

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
              const isWeak = pct < 50
              return (
                <div
                  key={cat.name}
                  className={cn(
                    'rounded px-2 py-1.5 -mx-1',
                    isWeak && 'border-l-2 border-l-red-400 bg-red-50/50'
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn('text-muted-foreground', isWeak && 'flex items-center gap-1')}>
                      {isWeak && <AlertTriangle className="h-3 w-3 text-red-400" />}
                      {cat.name}
                    </span>
                    <span className={cn('font-medium', getScoreTextClass(pct))}>
                      {cat.score}/{cat.maxScore}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${getScoreBgClass(pct)}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
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

      {/* 강점 (compact 모드에서는 숨김) */}
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
