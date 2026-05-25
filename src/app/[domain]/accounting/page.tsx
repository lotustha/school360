import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  ArrowRight, AlertCircle, Zap, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Activity,
  ReceiptText, Banknote, ArrowLeftRight, NotebookPen, Scale,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import { getAccountingSnapshot } from "@/actions/accounting/reports"
import { VOUCHER_TYPE_LABEL } from "@/lib/accounting"

export const metadata: Metadata = { title: "Overview" }

const TYPE_ICON: Record<string, React.ElementType> = {
  RV: ReceiptText, PV: Banknote, CV: ArrowLeftRight, JV: NotebookPen,
}

const TYPE_COLOR: Record<string, { bg: string; text: string; ring: string }> = {
  RV: { bg: "bg-emerald-50",  text: "text-emerald-600",  ring: "ring-emerald-200" },
  PV: { bg: "bg-rose-50",     text: "text-rose-600",     ring: "ring-rose-200" },
  CV: { bg: "bg-sky-50",      text: "text-sky-600",      ring: "ring-sky-200" },
  JV: { bg: "bg-violet-50",   text: "text-violet-600",   ring: "ring-violet-200" },
}

export default async function AccountingHomePage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const snap = await getAccountingSnapshot()
  if (!snap) return <EmptyState />

  const { fiscalYear, voucherCounts, recent, trialBalance, ieSummary } = snap

  // Aggregate voucher counts by status and by type
  const totalPosted   = voucherCounts.filter(v => v.status === "POSTED").reduce((a, v) => a + v.count, 0)
  const totalDrafts   = voucherCounts.filter(v => v.status === "DRAFT").reduce((a, v) => a + v.count, 0)
  const totalReversed = voucherCounts.filter(v => v.status === "REVERSED").reduce((a, v) => a + v.count, 0)

  const byType = ["RV", "PV", "CV", "JV"].map(t => ({
    type: t,
    count: voucherCounts.filter(v => v.type === t).reduce((a, v) => a + v.count, 0),
  }))
  const typeTotal = byType.reduce((a, t) => a + t.count, 0) || 1

  // Income vs Expense
  const income  = ieSummary ? parseFloat(ieSummary.totalIncome)  : 0
  const expense = ieSummary ? parseFloat(ieSummary.totalExpense) : 0
  const net     = income - expense
  const isSurplus = net >= 0
  const incomeMax = ieSummary ? Math.max(...ieSummary.topIncome.map(i => parseFloat(i.amount)), 1) : 1
  const expenseMax = ieSummary ? Math.max(...ieSummary.topExpenses.map(e => parseFloat(e.amount)), 1) : 1
  const flowMax = Math.max(income, expense, 1)

  return (
    <div className="space-y-5">
      {/* ── Header strip ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
            <Badge variant="outline" className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              fiscalYear.status === "OPEN"   && "bg-emerald-50 text-emerald-700 border-emerald-200",
              fiscalYear.status === "CLOSED" && "bg-amber-50 text-amber-700 border-amber-200",
              fiscalYear.status === "LOCKED" && "bg-slate-100 text-slate-600 border-slate-300",
            )}>
              {fiscalYear.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            FY {fiscalYear.name} · {formatBS(fiscalYear.startBS)} → {formatBS(fiscalYear.endBS)}
          </p>
        </div>
        <Link href="/accounting/quick">
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-sm shadow-primary/20">
            <Zap className="w-4 h-4" /> Quick Entry
          </Button>
        </Link>
      </div>

      {/* ── Hero: Income / Expense / Net ────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <FlowCard
          title="Income"
          amount={ieSummary?.totalIncome ?? "0.00"}
          icon={ArrowDownRight}
          color="emerald"
          fillPct={income / flowMax}
          subtitle={ieSummary && ieSummary.topIncome[0]
            ? `Top: ${ieSummary.topIncome[0].name}`
            : "No income posted yet"}
        />
        <FlowCard
          title="Expense"
          amount={ieSummary?.totalExpense ?? "0.00"}
          icon={ArrowUpRight}
          color="rose"
          fillPct={expense / flowMax}
          subtitle={ieSummary && ieSummary.topExpenses[0]
            ? `Top: ${ieSummary.topExpenses[0].name}`
            : "No expense posted yet"}
        />
        <NetCard
          isSurplus={isSurplus}
          surplus={ieSummary?.surplusOrDeficit ?? "0.00"}
          income={income}
          expense={expense}
        />
      </div>

      {/* ── Health strip ──────────────────────────────────────────── */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100/80">
          <HealthTile
            label="Posted"
            value={String(totalPosted)}
            tone="emerald"
            icon={CheckCircle2}
            href="/accounting/vouchers?status=POSTED"
          />
          <HealthTile
            label="Drafts"
            value={String(totalDrafts)}
            tone={totalDrafts > 0 ? "amber" : "slate"}
            icon={totalDrafts > 0 ? AlertTriangle : Activity}
            href="/accounting/vouchers?status=DRAFT"
            highlight={totalDrafts > 0}
          />
          <HealthTile
            label="Reversed"
            value={String(totalReversed)}
            tone="slate"
            icon={ArrowLeftRight}
            href="/accounting/vouchers?status=REVERSED"
          />
          <TbTile trialBalance={trialBalance} />
        </div>
      </div>

      {/* ── Voucher mix + Top categories ────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Voucher mix */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-sm">Voucher Mix</p>
            <Link href="/accounting/vouchers" className="text-xs text-primary hover:underline font-bold inline-flex items-center gap-1">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {byType.map(t => {
              const Icon = TYPE_ICON[t.type] ?? ReceiptText
              const palette = TYPE_COLOR[t.type] ?? TYPE_COLOR.JV
              const pct = (t.count / typeTotal) * 100
              return (
                <Link key={t.type} href={`/accounting/vouchers?type=${t.type}`} className="block group">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center ring-1", palette.bg, palette.ring)}>
                      <Icon className={cn("w-3.5 h-3.5", palette.text)} />
                    </div>
                    <span className="text-xs font-bold flex-1">{VOUCHER_TYPE_LABEL[t.type as keyof typeof VOUCHER_TYPE_LABEL] ?? t.type}</span>
                    <span className="font-mono tabular-nums text-sm font-black">{t.count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden ml-9">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        t.type === "RV" && "bg-emerald-400",
                        t.type === "PV" && "bg-rose-400",
                        t.type === "CV" && "bg-sky-400",
                        t.type === "JV" && "bg-violet-400",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Top income */}
        <TopCategoriesCard
          title="Top Income"
          tone="emerald"
          items={ieSummary?.topIncome ?? []}
          max={incomeMax}
          emptyText="No income recorded yet."
          href="/accounting/reports/income-expenditure"
        />

        {/* Top expense */}
        <TopCategoriesCard
          title="Top Expense"
          tone="rose"
          items={ieSummary?.topExpenses ?? []}
          max={expenseMax}
          emptyText="No expenses recorded yet."
          href="/accounting/reports/income-expenditure"
        />
      </div>

      {/* ── Recent activity timeline ──────────────────────────────── */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
          <p className="font-semibold text-sm inline-flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            Recent Activity
          </p>
          <Link href="/accounting/vouchers">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary cursor-pointer">
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">No vouchers posted yet.</p>
            <Link href="/accounting/quick">
              <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer">
                <Zap className="w-3.5 h-3.5" /> Create one
              </Button>
            </Link>
          </div>
        ) : (
          <ol className="relative">
            {recent.map((r, i) => {
              const Icon = TYPE_ICON[r.type] ?? ReceiptText
              const palette = TYPE_COLOR[r.type] ?? TYPE_COLOR.JV
              const isLast = i === recent.length - 1
              return (
                <li key={r.id}>
                  <Link
                    href={`/accounting/vouchers/${r.id}`}
                    className="group flex items-stretch gap-4 px-5 py-3 hover:bg-primary/4 transition-colors relative"
                  >
                    {/* Timeline rail */}
                    <div className="relative flex-shrink-0 flex flex-col items-center">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm", palette.bg)}>
                        <Icon className={cn("w-3.5 h-3.5", palette.text)} />
                      </div>
                      {!isLast && <div className="flex-1 w-px bg-slate-100 mt-1" />}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-3 pb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-slate-900">
                            {r.number ?? <span className="text-amber-600">DRAFT</span>}
                          </span>
                          <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", palette.text, palette.bg, palette.ring)}>
                            {VOUCHER_TYPE_LABEL[r.type as keyof typeof VOUCHER_TYPE_LABEL] ?? r.type}
                          </Badge>
                          {r.status === "REVERSED" && (
                            <Badge variant="outline" className="text-[9px] bg-slate-100 text-slate-500 border-slate-200">REVERSED</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.narration}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{formatBS(r.dateBS)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono tabular-nums font-black text-sm">Rs. {r.totalAmount}</p>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition ml-auto mt-0.5" />
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}

// ─── Components ──────────────────────────────────────────────────────────────

function FlowCard({
  title, amount, icon: Icon, color, fillPct, subtitle,
}: {
  title: string
  amount: string
  icon: React.ElementType
  color: "emerald" | "rose"
  fillPct: number
  subtitle: string
}) {
  const palette = color === "emerald"
    ? { ring: "border-emerald-500/20", grad: "from-emerald-50", bar: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600" }
    : { ring: "border-rose-500/20",    grad: "from-rose-50",    bar: "bg-rose-500",    chip: "bg-rose-500/10 text-rose-700",       icon: "text-rose-600" }
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5 relative overflow-hidden", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{title}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <Icon className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className="font-mono tabular-nums text-3xl font-black tracking-tight">Rs. {amount}</p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>
      <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-700", palette.bar)} style={{ width: `${Math.min(100, fillPct * 100)}%` }} />
      </div>
    </div>
  )
}

function NetCard({
  isSurplus, surplus, income, expense,
}: {
  isSurplus: boolean
  surplus:   string
  income:    number
  expense:   number
}) {
  const total = income + expense || 1
  const incomePct = (income / total) * 100
  const expensePct = (expense / total) * 100
  const palette = isSurplus
    ? { ring: "border-primary/20", grad: "from-primary/5", chip: "bg-primary/10 text-primary", icon: "text-primary", label: "Surplus", arrow: TrendingUp }
    : { ring: "border-amber-500/20", grad: "from-amber-50", chip: "bg-amber-500/10 text-amber-700", icon: "text-amber-600", label: "Deficit", arrow: TrendingDown }
  const ArrowIcon = palette.arrow
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Net {palette.label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <ArrowIcon className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className={cn("font-mono tabular-nums text-3xl font-black tracking-tight", isSurplus ? "text-primary" : "text-amber-700")}>
        Rs. {surplus}
      </p>
      <p className="text-[11px] text-slate-500 mt-1">
        {income > 0 || expense > 0 ? `${((income / total) * 100).toFixed(1)}% income · ${((expense / total) * 100).toFixed(1)}% expense` : "No flow this FY"}
      </p>
      <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${incomePct}%` }} />
        <div className="h-full bg-rose-500 transition-all duration-700"    style={{ width: `${expensePct}%` }} />
      </div>
    </div>
  )
}

function HealthTile({
  label, value, tone, icon: Icon, href, highlight,
}: {
  label: string
  value: string
  tone: "emerald" | "amber" | "slate"
  icon: React.ElementType
  href: string
  highlight?: boolean
}) {
  const palette = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600" },
    amber:   { bg: "bg-amber-500/10",   text: "text-amber-600" },
    slate:   { bg: "bg-slate-500/10",   text: "text-slate-500" },
  }[tone]
  return (
    <Link href={href} className={cn(
      "flex items-center gap-3 px-5 py-4 hover:bg-primary/4 transition-colors cursor-pointer",
      highlight && "bg-amber-50/40",
    )}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", palette.bg)}>
        <Icon className={cn("w-4 h-4", palette.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p>
        <p className="font-mono tabular-nums text-2xl font-black tracking-tight leading-tight">{value}</p>
      </div>
    </Link>
  )
}

function TbTile({ trialBalance }: { trialBalance: { totalDebit: string; totalCredit: string; balanced: boolean } | null }) {
  if (!trialBalance) {
    return (
      <Link href="/accounting/reports/trial-balance" className="flex items-center gap-3 px-5 py-4 hover:bg-primary/4 cursor-pointer">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-500/10">
          <Scale className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Trial Balance</p>
          <p className="text-sm font-bold text-slate-500">No data</p>
        </div>
      </Link>
    )
  }
  const balanced = trialBalance.balanced
  const palette = balanced
    ? { bg: "bg-emerald-500/10", text: "text-emerald-600", value: "text-emerald-700" }
    : { bg: "bg-rose-500/10",    text: "text-rose-600",    value: "text-rose-700" }
  return (
    <Link href="/accounting/reports/trial-balance" className={cn(
      "flex items-center gap-3 px-5 py-4 hover:bg-primary/4 transition-colors cursor-pointer",
      !balanced && "bg-rose-50/40",
    )}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", palette.bg)}>
        {balanced ? <CheckCircle2 className={cn("w-4 h-4", palette.text)} /> : <XCircle className={cn("w-4 h-4", palette.text)} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Trial Balance</p>
        <p className={cn("text-lg font-black leading-tight", palette.value)}>{balanced ? "Balanced" : "Off"}</p>
        <p className="text-[10px] font-mono tabular-nums text-slate-400 truncate">
          Dr {trialBalance.totalDebit} / Cr {trialBalance.totalCredit}
        </p>
      </div>
    </Link>
  )
}

function TopCategoriesCard({
  title, tone, items, max, emptyText, href,
}: {
  title: string
  tone: "emerald" | "rose"
  items: Array<{ name: string; code: string; amount: string }>
  max: number
  emptyText: string
  href: string
}) {
  const palette = tone === "emerald"
    ? { bar: "bg-emerald-400", text: "text-emerald-700" }
    : { bar: "bg-rose-400",    text: "text-rose-700" }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-sm">{title}</p>
        <Link href={href} className="text-xs text-primary hover:underline font-bold inline-flex items-center gap-1">
          Report <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.slice(0, 5).map(it => {
            const amt = parseFloat(it.amount)
            const pct = (amt / max) * 100
            return (
              <li key={it.code}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold truncate flex-1">
                    <span className="font-mono text-slate-400 mr-1.5">{it.code}</span>
                    {it.name}
                  </span>
                  <span className={cn("font-mono tabular-nums text-xs font-black", palette.text)}>Rs. {it.amount}</span>
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

function EmptyState() {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 border-dashed p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
        <AlertCircle className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-xl font-bold mb-2 tracking-tight">Accounting is not set up yet</h3>
      <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
        Run the one-time setup wizard to create your first fiscal year, seed the default Chart of Accounts, and enter opening balances. Takes about 3 minutes.
      </p>
      <Link href="/accounting/setup">
        <Button className="gap-1.5 cursor-pointer shadow-lg shadow-primary/20">
          <ArrowRight className="w-4 h-4" /> Start Setup
        </Button>
      </Link>
    </div>
  )
}
