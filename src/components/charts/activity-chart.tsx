'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DailyActivity {
  date: string
  keywords: number
  content: number
  seo: number
  tracking: number
}

export default function ActivityChart({ data }: { data: DailyActivity[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="kwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ctGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="seoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="trkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <RechartsTooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
        <Area
          type="monotone" dataKey="keywords" name="키워드"
          stroke="#3b82f6" fill="url(#kwGrad)" strokeWidth={2}
        />
        <Area
          type="monotone" dataKey="content" name="콘텐츠"
          stroke="#a855f7" fill="url(#ctGrad)" strokeWidth={2}
        />
        <Area
          type="monotone" dataKey="seo" name="SEO 분석"
          stroke="#22c55e" fill="url(#seoGrad)" strokeWidth={2}
        />
        <Area
          type="monotone" dataKey="tracking" name="순위 트래킹"
          stroke="#f97316" fill="url(#trkGrad)" strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
