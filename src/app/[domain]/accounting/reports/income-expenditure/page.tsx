import Link from "next/link"
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import {
  Printer, TrendingUp, ArrowDownRight, ArrowUpRight, Sparkles, AlertTriangle, Scale,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { prisma } from "@/lib/prisma"
import { getIncomeExpenditure } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS, todayBS } from "@/lib/nepali-date"
import { ReportExportButton } from "@/components/accounting/report-export-button"
import { ReportKpi } from "@/components/accounting/report-shell"

export const metadata: Metadata = { title: "Income & Expenditure" }

export default async function IncomeExpenditurePage({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; asOf?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { name: true } })
  if (!school) notFound()

  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id!
  const activeFy = fys.find(f => f.id === fyId)

  const ie = await getIncomeExpenditure(fyId, sp.asOf)

  const totalIncome  = parseFloat(ie.totalIncome)  || 0
  const totalExpense = parseFloat(ie.totalExpense) || 0
  const surplus      = parseFloat(ie.surplusOrDeficit) || 0
  const grandTotal   = totalIncome + totalExpense || 1
  const expensePct   = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0
  const incomeShare  = (totalIncome  / grandTotal) * 100
  const expenseShare = (totalExpense / grandTotal) * 100

  const maxLen = Math.max(ie.income.length, ie.expense.length)
  const expRows = [...ie.expense, ...Array.from({ length: maxLen - ie.expense.length }, () => null)]
  const incRows = [...ie.income,  ...Array.from({ length: maxLen - ie.income.length },  () => null)]

  // Top 3 each for the breakdown card
  const topIncome  = [...ie.income ].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 3)
  const topExpense = [...ie.expense].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 3)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Income &amp; Expenditure</h1>
            {activeFy && (
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-slate-200">
                FY {activeFy.name}
              </Badge>
            )}
            <Badge variant="outline" className={cn(
              "text-[10px] font-bold uppercase tracking-widest",
              surplus === 0 ? "bg-slate-100 text-slate-600 border-slate-200"
                : ie.isSurplus ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200",
            )}>
              {surplus === 0 ? "Break-even" : ie.isSurplus ? "Surplus" : "Deficit"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            <TrendingUp className="w-3 h-3 text-slate-400" />
            <span>For the period ended</span>
            <span className="font-mono">{formatBS(ie.asOfBS)}</span>
            <span className="text-slate-300">·</span>
            <span>{ie.income.length} income heads · {ie.expense.length} expense heads</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportExportButton kind="income-expenditure" data={ie} schoolName={school.name} />
          <Link href={`/accounting/reports/income-expenditure/print?fy=${fyId}${sp.asOf ? `&asOf=${sp.asOf}` : ""}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter */}
      <form className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">Fiscal year</label>
          <select name="fy" defaultValue={fyId} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
            {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}{f.isCurrent ? " (current)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">As of (BS)</label>
          <input
            name="asOf"
            type="text"
            defaultValue={sp.asOf ?? ""}
            placeholder={activeFy?.endBS}
            className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 font-mono"
          />
        </div>
        <Button type="submit" className="h-11 cursor-pointer">Apply</Button>
      </form>

      {/* Quick as-of presets */}
      <div className="flex gap-1.5 flex-wrap items-center justify-end">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">As of</span>
        {[{ label: "Today", asOf: todayBS() }, { label: "FY end", asOf: undefined }].map(p => {
          const isActive = (sp.asOf ?? "") === (p.asOf ?? "")
          const qs = new URLSearchParams({ fy: fyId })
          if (p.asOf) qs.set("asOf", p.asOf)
          return (
            <Link key={p.label} href={`/accounting/reports/income-expenditure?${qs.toString()}`}>
              <Badge variant={isActive ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">{p.label}</Badge>
            </Link>
          )
        })}
      </div>

      {/* Hero KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total Income"  value={`Rs. ${ie.totalIncome}`}  subtitle={`${ie.income.length} heads`} icon={ArrowDownRight} tone="emerald" progress={incomeShare} />
        <ReportKpi label="Total Expense" value={`Rs. ${ie.totalExpense}`} subtitle={`${ie.expense.length} heads`} icon={ArrowUpRight}   tone="rose"    progress={expenseShare} />
        <ReportKpi
          label={ie.isSurplus ? "Surplus" : surplus === 0 ? "Net Result" : "Deficit"}
          value={`Rs. ${ie.surplusOrDeficit}`}
          subtitle={ie.isSurplus ? "Income exceeds expense" : surplus === 0 ? "Break-even" : "Expense exceeds income"}
          icon={ie.isSurplus ? Sparkles : AlertTriangle}
          tone={surplus === 0 ? "slate" : ie.isSurplus ? "primary" : "amber"}
        />
        <ReportKpi
          label="Expense Ratio"
          value={totalIncome > 0 ? `${expensePct.toFixed(1)}%` : "—"}
          subtitle={totalIncome > 0 ? "Expense ÷ Income" : "No income posted yet"}
          icon={Scale}
          tone={expensePct < 100 ? "primary" : "rose"}
          progress={totalIncome > 0 ? Math.min(100, expensePct) : 0}
        />
      </div>

      {/* Income vs Expense flow bar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-3">Income vs Expense</p>
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span className="font-mono tabular-nums font-bold text-emerald-700">Rs. {ie.totalIncome}</span>
          <span className="ml-auto font-mono tabular-nums font-bold text-rose-700">Rs. {ie.totalExpense}</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${incomeShare}%` }} />
          <div className="bg-rose-500    transition-all duration-700" style={{ width: `${expenseShare}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
          <span>Income {incomeShare.toFixed(1)}%</span>
          <span>Expense {expenseShare.toFixed(1)}%</span>
        </div>
      </div>

      {/* Top 3 each */}
      <div className="grid lg:grid-cols-2 gap-4">
        <TopCard title="Top Income heads" rows={topIncome} max={Math.max(...ie.income.map(i => parseFloat(i.amount)), 1)} tone="emerald" fyId={fyId} />
        <TopCard title="Top Expense heads" rows={topExpense} max={Math.max(...ie.expense.map(e => parseFloat(e.amount)), 1)} tone="rose" fyId={fyId} />
      </div>

      {/* T-account body (traditional Dr left / Cr right) */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-rose-50/40 border-b border-slate-200">
              Expenditure (Dr)
            </p>
            {expRows.map((l, i) => <Row key={i} item={l} fyId={fyId} accountColor="rose" />)}
            {ie.isSurplus && (
              <Row item={{ code: "", name: "To Surplus carried to Capital Fund", amount: ie.surplusOrDeficit, accountId: "" }} bold fyId={fyId} accountColor="rose" />
            )}
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total</span>
              <span className="font-mono tabular-nums text-sm">Rs. {ie.isSurplus
                ? (parseFloat(ie.totalExpense) + parseFloat(ie.surplusOrDeficit)).toFixed(2)
                : ie.totalExpense}</span>
            </div>
          </div>

          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-emerald-50/40 border-b border-slate-200">
              Income (Cr)
            </p>
            {incRows.map((l, i) => <Row key={i} item={l} fyId={fyId} accountColor="emerald" />)}
            {!ie.isSurplus && parseFloat(ie.surplusOrDeficit) > 0 && (
              <Row item={{ code: "", name: "By Deficit transferred from Capital Fund", amount: ie.surplusOrDeficit, accountId: "" }} bold fyId={fyId} accountColor="emerald" />
            )}
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total</span>
              <span className="font-mono tabular-nums text-sm">Rs. {!ie.isSurplus
                ? (parseFloat(ie.totalIncome) + parseFloat(ie.surplusOrDeficit)).toFixed(2)
                : ie.totalIncome}</span>
            </div>
          </div>
        </div>

        {/* Surplus / Deficit banner */}
        <div className={cn(
          "px-5 py-3 text-center text-sm font-bold border-t border-slate-200 inline-flex items-center justify-center gap-2 w-full",
          surplus === 0 ? "text-slate-600 bg-slate-50/60"
            : ie.isSurplus ? "text-emerald-700 bg-emerald-50/60"
            : "text-rose-700 bg-rose-50/60",
        )}>
          {ie.isSurplus ? <Sparkles className="w-4 h-4" /> : surplus > 0 ? <AlertTriangle className="w-4 h-4" /> : null}
          {surplus === 0
            ? "Break-even for the period"
            : `${ie.isSurplus ? "Surplus" : "Deficit"} for the period: Rs. ${ie.surplusOrDeficit}`}
        </div>
      </div>
    </div>
  )
}

function Row({
  item, bold, fyId, accountColor,
}: {
  item: { code: string; name: string; amount: string; accountId?: string } | null
  bold?: boolean
  fyId: string
  accountColor: "emerald" | "rose"
}) {
  if (!item) return <div className="px-5 py-2 text-sm border-b border-slate-100 h-9">&nbsp;</div>
  return (
    <div className={cn("px-5 py-2 flex items-center justify-between text-sm border-b border-slate-100 hover:bg-primary/4", bold && "font-bold")}>
      <span className="min-w-0 flex-1 truncate">
        {item.code && <span className="font-mono text-xs text-slate-400 mr-2">{item.code}</span>}
        {item.accountId ? (
          <Link href={`/accounting/ledger?account=${item.accountId}&fy=${fyId}`} className="hover:text-primary hover:underline">
            {item.name}
          </Link>
        ) : item.name}
      </span>
      <span className={cn("font-mono tabular-nums ml-2", accountColor === "emerald" ? "text-emerald-700" : "text-rose-700")}>
        {item.amount}
      </span>
    </div>
  )
}

function TopCard({
  title, rows, max, tone, fyId,
}: {
  title: string
  rows: Array<{ code: string; name: string; amount: string; accountId?: string }>
  max: number
  tone: "emerald" | "rose"
  fyId: string
}) {
  const palette = tone === "emerald"
    ? { bar: "bg-emerald-400", text: "text-emerald-700" }
    : { bar: "bg-rose-400",    text: "text-rose-700" }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No entries yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => {
            const pct = (parseFloat(r.amount) / max) * 100
            return (
              <li key={r.code || r.name}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold truncate flex-1">
                    <span className="font-mono text-slate-400 mr-1.5">{r.code}</span>
                    {r.accountId ? (
                      <Link href={`/accounting/ledger?account=${r.accountId}&fy=${fyId}`} className="hover:underline">{r.name}</Link>
                    ) : r.name}
                  </span>
                  <span className={cn("font-mono tabular-nums text-xs font-black", palette.text)}>Rs. {r.amount}</span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-700", palette.bar)} style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
