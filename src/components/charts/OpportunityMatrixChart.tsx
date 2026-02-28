'use client'

import { useMemo, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, ReferenceArea, ReferenceLine
} from 'recharts'
import { formatNumber } from '@/components/keywords/keyword-utils'

interface OpportunityItem {
  keyword: string
  monthlySearch: number
  compIdx: string
  score: number
  category: string
  source?: 'ai' | 'naver'
}

interface Props {
  opportunities: OpportunityItem[]
}

export default function OpportunityMatrixChart({ opportunities }: Props) {
  // === Y축 불연속 구간 감지 ===
  // 검색량 이상치가 있으면 상단 구간을 압축하여 밀집 구간을 확대 표시
  const axisBreak = useMemo(() => {
    if (opportunities.length < 5) return null

    const searches = opportunities.map(o => o.monthlySearch).sort((a, b) => a - b)
    const p80 = searches[Math.floor(searches.length * 0.8)]
    const max = searches[searches.length - 1]

    // max가 P80의 4배 이상일 때만 축 압축 활성화
    if (max <= p80 * 4 || p80 <= 10) return null

    // 불연속 지점: P80의 2배 (대부분 데이터 위)
    const breakAt = Math.ceil(p80 * 2 / 100) * 100 || 1000
    // 압축 비율: 불연속 위 구간을 아래 구간의 30% 높이로 압축
    const compressRatio = Math.max(3, (max - breakAt) / (breakAt * 0.3))

    return { breakAt, max, compressRatio }
  }, [opportunities])

  // 실제값 → 차트값 변환
  const toY = useCallback((val: number): number => {
    if (!axisBreak || val <= axisBreak.breakAt) return val
    return axisBreak.breakAt + (val - axisBreak.breakAt) / axisBreak.compressRatio
  }, [axisBreak])

  // 차트값 → 실제값 역변환 (틱 라벨용)
  const fromY = useCallback((ty: number): number => {
    if (!axisBreak || ty <= axisBreak.breakAt) return ty
    return axisBreak.breakAt + (ty - axisBreak.breakAt) * axisBreak.compressRatio
  }, [axisBreak])

  // 산점도 데이터: X=기회점수, Y=검색량(변환 적용)
  const matrixData = useMemo(() => {
    return opportunities.map((opp, i) => {
      const jitterX = ((i % 3) - 1) * 0.4
      const jitterY = ((Math.floor(i / 3) % 3) - 1) * 0.015
      return {
        x: opp.score + jitterX,
        y: toY(opp.monthlySearch * (1 + jitterY)),
        rawScore: opp.score,
        rawSearch: opp.monthlySearch,
        keyword: opp.keyword,
        compIdx: opp.compIdx,
        category: opp.category,
        source: opp.source,
        isTopRanked: i < 5,
      }
    })
  }, [opportunities, toY])

  // Y축 최대값
  const yAxisMax = useMemo(() => {
    const maxSearch = Math.max(...opportunities.map(o => o.monthlySearch))
    const rawMax = Math.max(100, Math.ceil(maxSearch * 1.2 / 100) * 100)
    return toY(rawMax)
  }, [opportunities, toY])

  // Y축 틱 값 (불연속 시 수동 지정)
  const yTicks = useMemo(() => {
    if (!axisBreak) return undefined

    const step = axisBreak.breakAt <= 500 ? 100
      : axisBreak.breakAt <= 2000 ? 500
        : axisBreak.breakAt <= 5000 ? 1000
          : 2000
    const below: number[] = []
    for (let v = 0; v <= axisBreak.breakAt; v += step) below.push(v)

    // 불연속 위: 최대값만 표시
    const above = [toY(axisBreak.max)]

    return [...below, ...above]
  }, [axisBreak, toY])

  // X축 범위 + 존 경계선
  const scoreRange = useMemo(() => {
    if (opportunities.length === 0) return { min: 40, max: 80, threshold: 60 }
    const scores = opportunities.map(o => o.score)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    return {
      min: Math.max(0, minScore - 5),
      max: Math.min(100, maxScore + 8),
      threshold: Math.round((minScore + maxScore) / 2),
    }
  }, [opportunities])

  // 검색량 중앙값 (존 경계용) — 변환 적용
  const searchMedian = useMemo(() => {
    if (opportunities.length === 0) return 500
    const sorted = [...opportunities].map(o => o.monthlySearch).sort((a, b) => a - b)
    return toY(sorted[Math.floor(sorted.length / 2)])
  }, [opportunities, toY])

  // 틱 포매터: 차트값 → 실제값 → 표시 문자열
  const formatYTick = useCallback((v: number) => {
    const real = fromY(v)
    if (real >= 10000) return `${(real / 10000).toFixed(1)}만`
    if (real >= 1000) return `${(real / 1000).toFixed(0)}천`
    return String(Math.round(real))
  }, [fromY])

  return (
    <div className="relative w-full h-[300px] sm:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 12, bottom: 40, left: 32 }}>
          {/* 4분면 배경 존 */}
          <ReferenceArea x1={scoreRange.threshold} x2={scoreRange.max + 2} y1={searchMedian} y2={yAxisMax} fill="#10b981" fillOpacity={0.04} stroke="none" />
          <ReferenceArea x1={scoreRange.threshold} x2={scoreRange.max + 2} y1={0} y2={searchMedian} fill="#3b82f6" fillOpacity={0.03} stroke="none" />
          <ReferenceArea x1={scoreRange.min - 2} x2={scoreRange.threshold} y1={searchMedian} y2={yAxisMax} fill="#f59e0b" fillOpacity={0.025} stroke="none" />
          <ReferenceArea x1={scoreRange.min - 2} x2={scoreRange.threshold} y1={0} y2={searchMedian} fill="#9ca3af" fillOpacity={0.02} stroke="none" />

          {/* 불연속 구간 시각 표시 (압축 경계에 줄무늬 띠) */}
          {axisBreak && (
            <ReferenceArea
              y1={axisBreak.breakAt * 0.96}
              y2={toY(axisBreak.breakAt * 1.08)}
              fill="url(#breakPattern)"
              fillOpacity={1}
              stroke="none"
            />
          )}

          {/* 존 경계선 */}
          <ReferenceLine x={scoreRange.threshold} stroke="#e5e7eb" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine y={searchMedian} stroke="#e5e7eb" strokeDasharray="4 3" strokeWidth={1} />
          <CartesianGrid strokeDasharray="3 3" opacity={0.04} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[scoreRange.min, scoreRange.max]}
            label={{ value: '기회 점수 →', position: 'insideBottom', offset: -25, style: { fontSize: 11, fontWeight: 600, fill: '#6b7280' } }}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db', strokeWidth: 1.5 }}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, yAxisMax]}
            ticks={yTicks}
            tickFormatter={formatYTick}
            label={{ value: '월간 검색량', angle: -90, position: 'insideLeft', offset: -18, style: { fontSize: 11, fontWeight: 600, fill: '#6b7280' } }}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db', strokeWidth: 1.5 }}
            tickLine={false}
            width={44}
          />
          <RechartsTooltip
            cursor={{ strokeDasharray: '3 3', stroke: '#d1d5db' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as (typeof matrixData)[0]
              const compLabel = d.compIdx === 'LOW' ? '낮음' : d.compIdx === 'MEDIUM' ? '보통' : d.compIdx === 'HIGH' ? '높음' : '미확인'
              return (
                <div className="rounded-xl border-2 bg-background/98 backdrop-blur-sm px-4 py-3 shadow-2xl text-sm min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${d.source === 'ai' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                    <span className="font-bold truncate">{d.keyword}</span>
                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${d.source === 'ai' ? 'bg-purple-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {d.source === 'ai' ? 'AI' : 'N'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <span className="text-muted-foreground">기회 점수</span>
                    <span className={`font-bold text-right ${d.rawScore >= 65 ? 'text-emerald-600' : d.rawScore >= 55 ? 'text-amber-600' : 'text-red-500'}`}>{d.rawScore}점</span>
                    <span className="text-muted-foreground">월간 검색량</span>
                    <span className="font-medium text-right">{d.rawSearch <= 20 ? '< 10' : formatNumber(d.rawSearch)}</span>
                    <span className="text-muted-foreground">경쟁도</span>
                    <span className="font-medium text-right">{compLabel}</span>
                  </div>
                </div>
              )
            }}
          />
          {/* SVG defs: 불연속 구간 패턴 */}
          <defs>
            <pattern id="breakPattern" width="8" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
              <rect width="8" height="6" fill="white" />
              <path d="M0,3 L2,1 L4,3 L6,5 L8,3" stroke="#cbd5e1" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <Scatter
            data={matrixData}
            shape={(props: unknown) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: (typeof matrixData)[0] }
              if (!cx || !cy) return <g />
              const isAi = payload.source === 'ai'
              const isTop = payload.isTopRanked
              const r = isTop ? 11 : 5.5
              const fill = isAi ? '#a855f7' : '#10b981'
              const stroke = isAi ? '#7c3aed' : '#059669'
              const opacity = isTop ? 0.95 : 0.65
              return (
                <g>
                  {isTop && (
                    <>
                      <circle cx={cx} cy={cy} r={r + 8} fill={fill} fillOpacity={0.08} />
                      <circle cx={cx} cy={cy} r={r + 4} fill={fill} fillOpacity={0.15} />
                    </>
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    fillOpacity={opacity}
                    stroke={stroke}
                    strokeWidth={isTop ? 2.5 : 1.5}
                  />
                </g>
              )
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
