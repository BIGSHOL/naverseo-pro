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

interface RankHistoryChartProps {
  history: { rank_position: number | null; checked_at: string }[]
  keyword: string
}

interface ChartDataPoint {
  date: string
  rank: number
  rawDate: string
  isOutOfRange: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload as ChartDataPoint
  const dateStr = new Date(data.rawDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md">
      <p className="text-xs text-muted-foreground">{dateStr}</p>
      <p className="mt-1 text-sm font-bold">
        {data.isOutOfRange ? '100위 밖' : `${data.rank}위`}
      </p>
    </div>
  )
}

export function RankHistoryChart({ history, keyword }: RankHistoryChartProps) {
  // 오래된 순으로 정렬
  const chartData: ChartDataPoint[] = history
    .slice()
    .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
    .map((h) => ({
      date: new Date(h.checked_at).toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
      }),
      rank: h.rank_position ?? 101,
      rawDate: h.checked_at,
      isOutOfRange: h.rank_position === null,
    }))

  if (chartData.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        순위 기록이 2개 이상 쌓이면 그래프가 표시됩니다.
      </p>
    )
  }

  // Y축 최대값 계산 (여유 있게)
  const maxRank = Math.max(...chartData.map((d) => d.rank))
  const yMax = Math.min(maxRank + 10, 110)

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        순위 변동 추이 ({chartData.length}회 체크)
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            reversed
            domain={[1, yMax]}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v: number) => (v > 100 ? '100+' : String(v))}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="rank"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3, fill: '#6366f1' }}
            activeDot={{ r: 5, fill: '#6366f1' }}
            name={keyword}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
