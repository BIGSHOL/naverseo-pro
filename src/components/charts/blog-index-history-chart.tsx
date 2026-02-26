'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
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
    trustScore?: number | null
    topicAuthorityScore?: number | null
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

interface AlgorithmDataPoint {
  date: string
  rawDate: string
  label: string
  'D.I.A.': number | null
  'C-Rank': number | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AlgorithmTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload as AlgorithmDataPoint
  const dateStr = new Date(data.rawDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const lines: { name: string; value: number | null; color: string }[] = [
    { name: 'D.I.A.', value: data['D.I.A.'], color: '#a855f7' },
    { name: 'C-Rank', value: data['C-Rank'], color: '#f59e0b' },
  ]

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md max-w-[200px]">
      <p className="text-xs text-muted-foreground mb-1.5">{dateStr}</p>
      {lines.map(line => (
        <div key={line.name} className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
            {line.name}
          </span>
          <span className="font-bold">{line.value ?? '-'}/100</span>
        </div>
      ))}
    </div>
  )
}

interface BlogIndexHistoryChartProps {
  history: HistoryEntry[]
  stats: HistoryStats
  mode?: 'total' | 'category' | 'algorithm'
  axisMode?: '4axis' | '5axis'
}

interface ChartDataPoint {
  date: string
  keywords: string
  score: number
  rawDate: string
  levelLabel: string | null
  prevScore: number | null
}

interface CategoryDataPoint {
  date: string
  rawDate: string
  label: string
  콘텐츠: number | null
  방문자: number | null
  SEO: number | null
  신뢰도: number | null
  검색성과?: number | null
}

// X축 커스텀 틱: 날짜만 표시 ("|인덱스" 접미사 제거)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomXTick({ x, y, payload }: any) {
  if (!payload?.value) return null
  const date = (payload.value as string).split('|')[0] || ''
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
        {date}
      </text>
    </g>
  )
}

// 카테고리 차트용 X축 (날짜만)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CategoryXTick({ x, y, payload }: any) {
  if (!payload?.value) return null
  const date = (payload.value as string).split('|')[0] || ''
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
        {date}
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
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CategoryTooltip({ active, payload, maxPerAxis = 25, is5 = false }: any) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload as CategoryDataPoint
  const dateStr = new Date(data.rawDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const lines: { name: string; value: number | null; color: string }[] = [
    { name: '콘텐츠', value: data.콘텐츠, color: '#3b82f6' },
    { name: '방문자', value: data.방문자, color: '#8b5cf6' },
    { name: 'SEO', value: data.SEO, color: '#22c55e' },
    { name: '신뢰도', value: data.신뢰도, color: '#06b6d4' },
  ]
  if (is5) lines.push({ name: '검색성과', value: data.검색성과 ?? null, color: '#f59e0b' })

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md max-w-[200px]">
      <p className="text-xs text-muted-foreground mb-1.5">{dateStr}</p>
      {lines.map(line => (
        <div key={line.name} className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
            {line.name}
          </span>
          <span className="font-bold">{line.value ?? '-'}/{maxPerAxis}</span>
        </div>
      ))}
    </div>
  )
}

export function BlogIndexHistoryChart({ history, stats, mode = 'total', axisMode = '4axis' }: BlogIndexHistoryChartProps) {
  // 오래된 순으로 정렬
  const sorted = history.slice().sort(
    (a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
  )

  if (mode === 'algorithm') {
    // D.I.A. + C-Rank 추이 차트
    const algoData: AlgorithmDataPoint[] = sorted.map((h, i) => {
      const date = new Date(h.checked_at).toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
      })
      return {
        label: `${date}|${i}`,
        date,
        rawDate: h.checked_at,
        'D.I.A.': (h.metrics?.diaScore as number) ?? null,
        'C-Rank': (h.metrics?.crankScore as number) ?? null,
      }
    })

    const hasData = algoData.some(d => d['D.I.A.'] !== null || d['C-Rank'] !== null)

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground">{stats.measurements}회 측정</span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-muted-foreground">D.I.A. / C-Rank 추정 점수 추이 (각 100점 만점)</span>
        </div>

        {!hasData || algoData.length < 2 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            최신 측정부터 D.I.A./C-Rank 데이터가 기록됩니다. 2회 이상 측정 후 추이가 표시됩니다.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={algoData} margin={{ top: 5, right: 20, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={<CategoryXTick />}
                stroke="hsl(var(--muted-foreground))"
                interval={0}
                height={40}
                padding={{ left: 30, right: 30 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => String(v)}
              />
              <Tooltip content={<AlgorithmTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
              />
              <Line type="monotone" dataKey="D.I.A." stroke="#a855f7" strokeWidth={2.5} dot={{ r: 4, fill: '#a855f7', strokeWidth: 2, stroke: '#fff' }} connectNulls name="D.I.A." />
              <Line type="monotone" dataKey="C-Rank" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} connectNulls name="C-Rank" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    )
  }

  if (mode === 'category') {
    const is5 = axisMode === '5axis'
    const scale20 = (v: number | null) => v != null ? Math.round(v * 20 / 25) : null
    const maxPerAxis = is5 ? 20 : 25

    // 카테고리별 차트 데이터
    const categoryData: CategoryDataPoint[] = sorted.map((h, i) => {
      const date = new Date(h.checked_at).toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullResult = (h as any).full_result
      const searchBonusScore: number | null = fullResult?.searchBonus?.score ?? (h.metrics as Record<string, unknown>)?.searchBonusScore as number ?? null
      return {
        label: `${date}|${i}`,
        date,
        rawDate: h.checked_at,
        콘텐츠: is5 ? scale20(h.content_score) : h.content_score,
        방문자: is5 ? scale20(h.popularity_score) : h.popularity_score,
        SEO: is5 ? scale20(h.search_score) : h.search_score,
        신뢰도: is5 ? scale20(h.activity_score) : h.activity_score,
        검색성과: is5 ? scale20(searchBonusScore) : undefined,
      }
    })

    const catLines: { name: string; key: string; color: string }[] = [
      { name: '콘텐츠', key: '콘텐츠', color: '#3b82f6' },
      { name: '방문자', key: '방문자', color: '#8b5cf6' },
      { name: 'SEO', key: 'SEO', color: '#22c55e' },
      { name: '신뢰도', key: '신뢰도', color: '#06b6d4' },
    ]
    if (is5) catLines.push({ name: '검색성과', key: '검색성과', color: '#f59e0b' })

    return (
      <div className="space-y-3">
        {/* 상단 통계 */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground">{stats.measurements}회 측정</span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-muted-foreground">{is5 ? '5대축' : '4대축'} 점수 추이 (각 {maxPerAxis}점 만점)</span>
        </div>

        {categoryData.length < 2 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            측정 기록이 2개 이상 쌓이면 카테고리별 추이 차트가 표시됩니다.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={categoryData} margin={{ top: 5, right: 20, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={<CategoryXTick />}
                stroke="hsl(var(--muted-foreground))"
                interval={0}
                height={40}
                padding={{ left: 30, right: 30 }}
              />
              <YAxis
                domain={[0, maxPerAxis]}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => String(v)}
              />
              <Tooltip content={<CategoryTooltip maxPerAxis={maxPerAxis} is5={is5} />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
              />
              {catLines.map(l => (
                <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3, fill: l.color }} connectNulls name={l.name} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    )
  }

  // 총점 차트 (기존) - label에 인덱스 추가로 같은 날짜 구분
  const chartData: (ChartDataPoint & { label: string })[] = sorted.map((h, i) => {
    const date = new Date(h.checked_at).toLocaleDateString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
    })
    return {
      label: `${date}|${i}`,
      date,
      keywords: '',
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
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={<CustomXTick />}
              stroke="hsl(var(--muted-foreground))"
              interval={0}
              height={30}
              padding={{ left: 30, right: 30 }}
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
