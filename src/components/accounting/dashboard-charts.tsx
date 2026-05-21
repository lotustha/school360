"use client"

import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend, CartesianGrid,
} from "recharts"

interface IELine { name: string; code: string; amount: string }

interface Props {
  totalIncome:  string
  totalExpense: string
  topExpenses:  IELine[]
  topIncome:    IELine[]
}

const PIE_COLORS = ["#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#64748b"]

export function DashboardCharts({ totalIncome, totalExpense, topExpenses, topIncome }: Props) {
  const income  = parseFloat(totalIncome)  || 0
  const expense = parseFloat(totalExpense) || 0
  const net     = income - expense

  const barData = [
    { name: "Income",  value: income,  fill: "#10b981" },
    { name: "Expense", value: expense, fill: "#ef4444" },
    { name: net >= 0 ? "Surplus" : "Deficit", value: Math.abs(net), fill: net >= 0 ? "#0ea5e9" : "#f59e0b" },
  ]

  const expenseData = topExpenses.map((e, i) => ({
    name:  e.name,
    code:  e.code,
    value: parseFloat(e.amount) || 0,
    fill:  PIE_COLORS[i % PIE_COLORS.length],
  }))

  const incomeData = topIncome.map((e, i) => ({
    name:  e.name,
    code:  e.code,
    value: parseFloat(e.amount) || 0,
    fill:  PIE_COLORS[i % PIE_COLORS.length],
  }))

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Bar chart */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <p className="font-semibold text-sm mb-1">Income vs Expense</p>
        <p className="text-xs text-muted-foreground mb-3">FY-to-date totals</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => (v / 1000).toFixed(0) + "K"} />
            <Tooltip formatter={(v: number) => `Rs. ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie: top expenses */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <p className="font-semibold text-sm mb-1">Top Expense Heads</p>
        <p className="text-xs text-muted-foreground mb-3">Largest 5 expense accounts in current FY</p>
        {expenseData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No expenses recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={expenseData}
                dataKey="value"
                nameKey="name"
                cx="40%"
                cy="50%"
                outerRadius={85}
                innerRadius={45}
                paddingAngle={2}
              >
                {expenseData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `Rs. ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="square"
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie: top income (full width if expense pie empty, half otherwise) */}
      {incomeData.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 lg:col-span-2">
          <p className="font-semibold text-sm mb-1">Top Income Heads</p>
          <p className="text-xs text-muted-foreground mb-3">Largest 5 income accounts in current FY</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={incomeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={v => (v / 1000).toFixed(0) + "K"} />
              <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={150} />
              <Tooltip formatter={(v: number) => `Rs. ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {incomeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
