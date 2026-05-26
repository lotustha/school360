"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface TrendPoint { date: string; total: number }

export function CollectionTrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(0, ...data.map(d => d.total))
  return (
    <div className="h-48 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="rgb(16 185 129)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5).replace("-", "/")}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            stroke="#e2e8f0"
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            stroke="#e2e8f0"
            tickLine={false}
            axisLine={false}
            domain={[0, max * 1.15 || 100]}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
            width={32}
          />
          <Tooltip
            cursor={{ stroke: "rgb(16 185 129)", strokeWidth: 1, strokeDasharray: "3 3" }}
            contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12 }}
            formatter={(v: number) => [`Rs. ${v.toFixed(2)}`, "Collected"]}
            labelFormatter={(l: string) => l}
          />
          <Area type="monotone" dataKey="total" stroke="rgb(16 185 129)" strokeWidth={2} fill="url(#trendFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
