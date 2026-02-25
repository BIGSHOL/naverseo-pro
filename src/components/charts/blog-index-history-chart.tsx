'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface HistoryEntry {
  id: string
  total_score: number
  search_score: number | null
  popularity_score: number | null
  content_score: number | null
  activity_score: number | null
  abuse_penalty: number | null
  level_tier: number | null
  level_label: string | null
  metrics?: {
    keywords?: string[]
    [key: string]: unknown
  } | null
  checked_at: string
}

interface HistoryStats {
  measurements: number
  highestScore: number
  lowestScore: number
  avgScore: number
  latestChange: number
  trend: 'up' | 'down' | 'stable'
}

interface BlogIndexHistoryChartProps {
  history: HistoryEntry[]
  stats: HistoryStats
}

interface ChartDataPoint {
  date: string
  keywords: string
  score: number
  rawDate: string
  levelLabel: string | null
  prevScore: number | null
}

// X축 커스텀 틱: 1행 날짜, 2행 키워드
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomXTick({ x, y, payload }: any) {
  if (!payload?.value) return null
  // payload.value = date string, 키워드는 chartData에서 찾아야 함
  // Recharts tick에서 직접 접근 불가 → date|keywords 형식으로 합쳐서 분리
  const parts = (payload.value as string).split('|')
  const date = parts[0] || ''
  const kw = parts[1] || ''

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
        {date}
      </text>
      <text x={0} y={0} dy={24} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" opacity={0.7}>
        {kw}
      </text>
    </g>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload as ChartDataPoint
  const dateStr = new Date(data.rawDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const change = data.prevScore !== null ? data.score - data.prevScore : null

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md max-w-[220px]">
      <p className="text-xs text-muted-foreground">{dateStr}</p>
      <p className="mt-1 text-sm font-bold">{data.score}점</p>
      {data.levelLabel && (
        <p className="text-[10px] text-muted-foreground">{data.levelLabel}</p>
      )}
      {change !== null && change !== 0 && (
        <p className={`mt-0.5 text-[10px] font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change > 0 ? '▲' : '▼'} {change > 0 ? '+' : ''}{change}점
        </p>
      )}
      {data.keywords && (
        <p className="mt-1 text-[10px] text-muted-foreground truncate">
          키워드: {data.keywords}
        </p>
      )}
    </div>
  )
}

// 키워드 배열 → 축약 문자열 (2개까지 + ...)
function shortenKeywords(keywords?: string[]): string {
  if (!keywords || keywords.length === 0) return '-'
  if (keywords.length <= 2) return keywords.join(', ')
  return `${keywords.slice(0, 2).join(', ')} 외${keywords.length - 2}`
}

export function BlogIndexHistoryChart({ history, stats }: BlogIndexHistoryChartProps) {
  // 오래된 순으로 정렬
  const sorted = history.slice().sort(
    (a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
  )

  const chartData: (ChartDataPoint & { label: string })[] = sorted.map((h, i) => {
    const date = new Date(h.checked_at).toLocaleDateString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
    })
    const kw = shortenKeywords(h.metrics?.keywords as string[] | undefined)
    return {
      // XAxis dataKey: "date|keywords" 합성 (CustomXTick에서 분리)
      label: `${date}|${kw}`,
      date,
      keywords: (h.metrics?.keywords as string[] | undefined)?.join(', ') || '-',
      score: h.total_score,
      rawDate: h.checked_at,
      levelLabel: h.level_label,
      prevScore: i > 0 ? sorted[i - 1].total_score : null,
    }
  })

  return (
    <div className="space-y-3">
      {/* 상단 통계 */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {/* 최근 변화 */}
        <div className="flex items-center gap-1.5">
          {stats.latestChange > 0 ? (
            <span className="font-bold text-green-600">▲ +{stats.latestChange}점</span>
          ) : stats.latestChange < 0 ? (
            <span className="font-bold text-red-600">▼ {stats.latestChange}점</span>
          ) : (
            <span className="font-medium text-muted-foreground">→ 변동 없음</span>
          )}
          {history.length >= 2 && (
            <span className="text-muted-foreground">
              ({sorted[sorted.length - 2]?.total_score ?? '-'} → {sorted[sorted.length - 1]?.total_score ?? '-'})
            </span>
          )}
        </div>

        <span className="text-muted-foreground/40">|</span>
        <span className="text-muted-foreground">{stats.measurements}회 측정</span>
        <span className="text-muted-foreground/40">|</span>
        <span className="text-muted-foreground">최고 <strong className="text-foreground">{stats.highestScore}</strong>점</span>
        <span className="text-muted-foreground/40">|</span>
        <span className="text-muted-foreground">평균 <strong className="text-foreground">{stats.avgScore}</strong>점</span>
      </div>

      {/* 차트 */}
      {chartData.length < 2 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          측정 기록이 2개 이상 쌓이면 추이 차트가 표시됩니다.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={<CustomXTick />}
              stroke="hsl(var(--muted-foreground))"
              interval={0}
              height={50}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v: number) => String(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#8b5cf6' }}
              name="총점"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
