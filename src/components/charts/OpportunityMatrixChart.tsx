'use client'

import { useMemo } from 'react'
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
  // 산점도 매트릭스 데이터: X=기회점수, Y=검색량
  const matrixData = useMemo(() => {
    return opportunities.map((opp, i) => {
      // 같은 점수에서 겹침 방지용 소폭 jitter
      const jitterX = ((i % 3) - 1) * 0.4
      const jitterY = ((Math.floor(i / 3) % 3) - 1) * 0.015
      return {
        x: opp.score + jitterX,
        y: opp.monthlySearch * (1 + jitterY),
        rawScore: opp.score,
        rawSearch: opp.monthlySearch,
        keyword: opp.keyword,
        compIdx: opp.compIdx,
        category: opp.category,
        source: opp.source,
        isTopRanked: i < 5,
      }
    })
  }, [opportunities])

  // Y축 최대값
  const yAxisMax = useMemo(() => {
    const maxSearch = Math.max(...opportunities.map(o => o.monthlySearch))
    return Math.max(100, Math.ceil(maxSearch * 1.2 / 100) * 100)
  }, [opportunities])

  // 차트 X축 범위 + 존 경계선
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

  // 검색량 중앙값 (존 경계용)
  const searchMedian = useMemo(() => {
    if (opportunities.length === 0) return 500
    const sorted = [...opportunities].map(o => o.monthlySearch).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }, [opportunities])

  return (
    <div className="relative w-full h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 24, bottom: 45, left: 48 }}>
          {/* 4분면 배경 존 - 더 미묘하게 */}
          <ReferenceArea x1={scoreRange.threshold} x2={scoreRange.max + 2} y1={searchMedian} y2={yAxisMax} fill="#10b981" fillOpacity={0.04} stroke="none" />
          <ReferenceArea x1={scoreRange.threshold} x2={scoreRange.max + 2} y1={0} y2={searchMedian} fill="#3b82f6" fillOpacity={0.03} stroke="none" />
          <ReferenceArea x1={scoreRange.min - 2} x2={scoreRange.threshold} y1={searchMedian} y2={yAxisMax} fill="#f59e0b" fillOpacity={0.025} stroke="none" />
          <ReferenceArea x1={scoreRange.min - 2} x2={scoreRange.threshold} y1={0} y2={searchMedian} fill="#9ca3af" fillOpacity={0.02} stroke="none" />
          {/* 존 경계선 */}
          <ReferenceLine x={scoreRange.threshold} stroke="#e5e7eb" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine y={searchMedian} stroke="#e5e7eb" strokeDasharray="4 3" strokeWidth={1} />
          <CartesianGrid strokeDasharray="3 3" opacity={0.04} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[scoreRange.min, scoreRange.max]}
            label={{ value: '기회 점수 →', position: 'insideBottom', offset: -30, style: { fontSize: 12, fontWeight: 600, fill: '#6b7280' } }}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db', strokeWidth: 1.5 }}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, yAxisMax]}
            tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v >= 1000 ? `${(v / 1000).toFixed(0)}천` : String(Math.round(v))}
            label={{ value: '월간 검색량', angle: -90, position: 'insideLeft', offset: -26, style: { fontSize: 12, fontWeight: 600, fill: '#6b7280' } }}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db', strokeWidth: 1.5 }}
            tickLine={false}
            width={56}
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
                  {/* 상위 5개만 후광 효과 */}
                  {isTop && (
                    <>
                      <circle cx={cx} cy={cy} r={r + 8} fill={fill} fillOpacity={0.08} />
                      <circle cx={cx} cy={cy} r={r + 4} fill={fill} fillOpacity={0.15} />
                    </>
                  )}
                  {/* 메인 점 - 더 진하고 크게 */}
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
