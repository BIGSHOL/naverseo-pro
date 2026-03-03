'use client'

import { useMemo, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ===== 타입 =====

interface SeoScanPreviewProps {
  content: string
  title?: string
  keyword?: string
  scanPercent: number      // 0~100
  progressLabel?: string
  className?: string
}

type SegmentType = 'keyword' | 'heading' | 'experience' | 'data' | 'normal'

interface Segment {
  text: string
  type: SegmentType
}

interface ParsedLine {
  segments: Segment[]
  isHeading: boolean
}

// ===== 하이라이트 색상 =====

const HIGHLIGHT_COLORS: Record<SegmentType, string> = {
  keyword: 'bg-cyan-200 dark:bg-cyan-700/60 rounded-sm px-0.5 font-medium',
  heading: 'bg-violet-200 dark:bg-violet-700/60 rounded-sm px-0.5 font-semibold',
  experience: 'bg-amber-200 dark:bg-amber-700/60 rounded-sm px-0.5',
  data: 'bg-emerald-200 dark:bg-emerald-700/60 rounded-sm px-0.5 font-medium',
  normal: '',
}

// ===== 정규식 패턴 =====

const EXPERIENCE_PATTERN = /직접|체험|후기|경험|리뷰|방문|다녀왔|먹어봤|써봤|써본|사용기|맛있|예쁘|좋았|추천|만족|불편|편리|깔끔/g
const DATA_PATTERN = /\d+[만천백]?\s*원|₩[\d,]+|\d+분|\d+시간|\d+km|\d+kcal|\d+[%]|\d+,\d{3}|\d{2,}(명|개|곳|잔|인분)|영업시간|주소|전화/g
const HEADING_LINE_PATTERN = /^#{1,3}\s|^\*\*[^*]+\*\*$|^▶|^◆|^■|^●|^①|^②|^③/

// ===== 파싱 함수 =====

function parseContent(content: string, keyword?: string): { lines: ParsedLine[] } {
  const rawLines = content.slice(0, 2000).split('\n')

  const lines: ParsedLine[] = rawLines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return { segments: [{ text: ' ', type: 'normal' as SegmentType }], isHeading: false }

    const isHeading = HEADING_LINE_PATTERN.test(trimmed)
    if (isHeading) {
      return {
        segments: [{ text: trimmed.replace(/^#{1,3}\s/, '').replace(/^\*\*|\*\*$/g, ''), type: 'heading' as SegmentType }],
        isHeading: true,
      }
    }

    // 줄 내부 세그먼트 파싱
    const segments = segmentizeLine(trimmed, keyword)
    return { segments, isHeading: false }
  })

  return { lines }
}

function segmentizeLine(text: string, keyword: string | undefined): Segment[] {
  // 매치 위치 수집
  interface MatchInfo { start: number; end: number; type: SegmentType }
  const matches: MatchInfo[] = []

  // 키워드 매치
  if (keyword && keyword.trim().length > 0) {
    const kw = keyword.trim()
    let idx = 0
    while (true) {
      const found = text.indexOf(kw, idx)
      if (found === -1) break
      matches.push({ start: found, end: found + kw.length, type: 'keyword' })
      idx = found + kw.length
    }
  }

  // 경험 키워드 매치
  let m: RegExpExecArray | null
  const expRe = new RegExp(EXPERIENCE_PATTERN.source, 'g')
  while ((m = expRe.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, type: 'experience' })
  }

  // 데이터 매치
  const dataRe = new RegExp(DATA_PATTERN.source, 'g')
  while ((m = dataRe.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, type: 'data' })
  }

  if (matches.length === 0) {
    return [{ text, type: 'normal' }]
  }

  // 겹치는 매치 제거 (우선순위: keyword > data > experience)
  const priority: Record<SegmentType, number> = { keyword: 3, data: 2, experience: 1, heading: 0, normal: 0 }
  matches.sort((a, b) => a.start - b.start || priority[b.type] - priority[a.type])

  const resolved: MatchInfo[] = []
  for (const match of matches) {
    const overlaps = resolved.some(r => match.start < r.end && match.end > r.start)
    if (!overlaps) resolved.push(match)
  }
  resolved.sort((a, b) => a.start - b.start)

  // 세그먼트 분할
  const segments: Segment[] = []
  let pos = 0
  for (const r of resolved) {
    if (r.start > pos) {
      segments.push({ text: text.slice(pos, r.start), type: 'normal' })
    }
    segments.push({ text: text.slice(r.start, r.end), type: r.type })
    pos = r.end
  }
  if (pos < text.length) {
    segments.push({ text: text.slice(pos), type: 'normal' })
  }
  return segments
}

// ===== 범례 배지 =====

const LEGEND_ITEMS: { type: SegmentType; label: string; color: string }[] = [
  { type: 'keyword', label: '키워드', color: 'bg-cyan-200 text-cyan-800 dark:bg-cyan-800 dark:text-cyan-200' },
  { type: 'heading', label: '소제목', color: 'bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-200' },
  { type: 'experience', label: '경험 정보', color: 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200' },
  { type: 'data', label: '데이터', color: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200' },
]

// ===== 컴포넌트 =====

export function SeoScanPreview({
  content,
  title,
  keyword,
  scanPercent,
  progressLabel,
  className,
}: SeoScanPreviewProps) {
  const { lines } = useMemo(() => parseContent(content, keyword), [content, keyword])
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalLines = lines.length
  const scanLine = Math.floor((scanPercent / 100) * totalLines)

  // 스캔된 줄까지만 카운트 (스캔하면서 숫자가 올라가는 효과)
  const counts = useMemo(() => {
    const c: Record<SegmentType, number> = { keyword: 0, heading: 0, experience: 0, data: 0, normal: 0 }
    const limit = Math.min(scanLine + 1, lines.length)
    for (let i = 0; i < limit; i++) {
      for (const seg of lines[i].segments) {
        if (seg.type !== 'normal') c[seg.type]++
      }
    }
    return c
  }, [lines, scanLine])

  // 자동스크롤: 스캔 라인을 따라 부드럽게 스크롤
  useEffect(() => {
    const el = scrollRef.current
    if (!el || totalLines === 0) return
    const scrollRatio = scanLine / totalLines
    const targetTop = scrollRatio * (el.scrollHeight - el.clientHeight)
    el.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }, [scanLine, totalLines])

  return (
    <Card className={cn('overflow-hidden border-cyan-500/20 dark:border-cyan-400/10', className)}>
      <CardContent className="p-0">
        {/* 본문 스캔 영역 */}
        <div className="relative">
          <div ref={scrollRef} className="max-h-[400px] overflow-y-auto p-6 select-none scroll-smooth">
            {/* 제목 */}
            {title && (
              <p
                className={cn(
                  'mb-3 text-base font-bold transition-opacity duration-500',
                  scanPercent > 2 ? 'text-foreground/80' : 'text-foreground/20'
                )}
              >
                {title}
              </p>
            )}

            {/* 줄별 렌더링 */}
            {lines.map((line, lineIdx) => {
              const isScanned = lineIdx < scanLine
              const isActive = lineIdx === scanLine
              const isUnscanned = lineIdx > scanLine

              return (
                <div
                  key={lineIdx}
                  className={cn(
                    'relative text-[13px] leading-relaxed transition-all',
                    // 스캔 상태에 따른 기본 스타일
                    isScanned && 'text-foreground/70',
                    isActive && 'text-foreground/90',
                    isUnscanned && 'text-muted-foreground/15',
                    // 스캔 중인 줄 글로우
                    isActive && 'bg-cyan-400/[0.06] dark:bg-cyan-400/[0.04]',
                    // 빈 줄
                    line.segments.length === 1 && line.segments[0].text === ' ' && 'h-4',
                  )}
                  style={{
                    transitionDuration: isActive ? '300ms' : '600ms',
                  }}
                >
                  {/* 세그먼트 렌더링 */}
                  {line.segments.map((seg, segIdx) => (
                    <span
                      key={segIdx}
                      className={cn(
                        'transition-all',
                        // 스캔 완료된 줄만 하이라이트 표시
                        (isScanned || isActive) && seg.type !== 'normal'
                          ? HIGHLIGHT_COLORS[seg.type]
                          : '',
                        // 하이라이트 전환 효과
                        (isScanned || isActive) && seg.type !== 'normal'
                          ? 'opacity-100'
                          : seg.type !== 'normal' ? 'opacity-0' : '',
                      )}
                      style={{
                        transitionDuration: '400ms',
                        transitionDelay: isScanned ? `${Math.min(segIdx * 80, 400)}ms` : '0ms',
                      }}
                    >
                      {seg.text}
                    </span>
                  ))}

                  {/* 스캔 라인 (활성 줄에만) */}
                  {isActive && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0">
                      <div
                        className="h-[2px]"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.1) 10%, rgba(34,211,238,0.8) 40%, rgba(6,182,212,1) 50%, rgba(34,211,238,0.8) 60%, rgba(34,211,238,0.1) 90%, transparent 100%)',
                          animation: 'seo-scan-pulse 2s ease-in-out infinite',
                        }}
                      />
                      <div
                        className="h-[1px] -translate-y-[1px] opacity-60"
                        style={{
                          background: 'linear-gradient(90deg, transparent, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%, transparent)',
                          backgroundSize: '200% 100%',
                          animation: 'seo-scan-sweep 1.5s linear infinite',
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 하단 페이드아웃 (미스캔 영역이 있을 때만) */}
          {scanPercent < 95 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>

        {/* 하단 상태 바 + 범례 */}
        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-3">
          {/* 라이브 인디케이터 */}
          <div className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-25" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
          </div>
          <span className="text-sm font-medium">{progressLabel || 'SEO 분석 준비 중...'}</span>

          {/* 퍼센트 */}
          {scanPercent > 0 && (
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {Math.round(scanPercent)}%
            </span>
          )}

          {/* 범례 (우측) */}
          <div className="ml-auto flex flex-wrap gap-1.5">
            {LEGEND_ITEMS.map(item => {
              const count = counts[item.type]
              if (count === 0 && scanPercent < 20) return null
              return (
                <Badge
                  key={item.type}
                  variant="secondary"
                  className={cn('text-[10px] gap-1 px-1.5 py-0', item.color)}
                >
                  {item.label}
                  {count > 0 && <span className="font-bold">{count}</span>}
                </Badge>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
