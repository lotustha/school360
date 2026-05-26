import Link from "next/link"
import { Metadata } from "next"
import {
  Receipt, History, Layers, Users, ShieldCheck, Calculator, ArrowRight, Printer,
  AlertTriangle, Wallet, TrendingUp, ListChecks,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getFinanceDashboard } from "@/actions/accounting/fee-payments"
import { CollectionTrendChart } from "./dashboard-charts"
import { QuickStudentSearch } from "./quick-student-search"

export const metadata: Metadata = { title: "Overview" }

export default async function FeesOverviewPage() {
  const dash = await getFinanceDashboard()
  const maxClass = Math.max(1, ...dash.topClasses.map(c => c.outstanding))

  return (
    <div className="space-y-6">
      {/* Header + quick search + collect CTA */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outstanding bills, collections, and audit trail at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          <QuickStudentSearch />
          <Link
            href="/finance/collect"
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:opacity-90 transition shadow-md shadow-primary/20 flex-shrink-0"
          >
            <Receipt className="w-4 h-4" /> Collect
          </Link>
        </div>
      </div>

      {/* Hero KPIs — what the bursar needs to see immediately */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Outstanding (AR)"
          value={`Rs. ${formatMoney(dash.outstandingTotal)}`}
          sub={parseFloat(dash.outstandingTotal) > 0 ? "Click to see classes with debt" : "All caught up"}
          tone={parseFloat(dash.outstandingTotal) > 0 ? "rose" : "emerald"}
          icon={Wallet}
          href={parseFloat(dash.outstandingTotal) > 0 ? "/finance/classes" : undefined}
        />
        <KpiCard
          label="Overdue"
          value={`Rs. ${formatMoney(dash.overdueTotal)}`}
          sub={`${dash.overdueCount} bill${dash.overdueCount === 1 ? "" : "s"} past due`}
          tone={dash.overdueCount > 0 ? "amber" : "slate"}
          icon={AlertTriangle}
          href={dash.overdueCount > 0 ? "/finance/classes" : undefined}
        />
        <KpiCard
          label="Collected today"
          value={`Rs. ${formatMoney(dash.todayTotal)}`}
          sub={`${dash.todayCount} receipt${dash.todayCount === 1 ? "" : "s"}`}
          tone="emerald"
          icon={Receipt}
        />
        <KpiCard
          label="Collected this month"
          value={`Rs. ${formatMoney(dash.monthTotal)}`}
          sub={`${dash.monthCount} receipt${dash.monthCount === 1 ? "" : "s"} · avg Rs. ${dash.monthCount > 0 ? (parseFloat(dash.monthTotal) / dash.monthCount).toFixed(0) : "0"}`}
          tone="primary"
          icon={TrendingUp}
        />
      </div>

      {/* Trend chart + Top classes */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Collection trend</h2>
              <p className="text-[11px] text-slate-500">Last 14 days</p>
            </div>
            <Link href="/finance/history" className="text-[11px] font-bold text-primary hover:underline cursor-pointer">View history →</Link>
          </div>
          <CollectionTrendChart data={dash.trend} />
        </div>

        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Top outstanding by class</h2>
              <p className="text-[11px] text-slate-500">Highest unpaid balances</p>
            </div>
          </div>
          {dash.topClasses.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8">No outstanding balances 🎉</div>
          ) : (
            <ul className="space-y-2.5">
              {dash.topClasses.map(c => {
                const pct = (c.outstanding / maxClass) * 100
                return (
                  <li key={c.classId}>
                    <div className="flex items-baseline justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700 truncate">{c.name}</span>
                      <span className="font-mono tabular-nums font-bold text-rose-700">Rs. {formatMoney(c.outstanding.toFixed(2))}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{c.rowCount} unpaid row{c.rowCount === 1 ? "" : "s"}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Recent receipts */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-tight">Recent receipts</h2>
            <p className="text-[11px] text-slate-500">Click a receipt # to view or reprint.</p>
          </div>
          <Link href="/finance/history" className="text-[11px] font-bold text-primary hover:underline cursor-pointer">View all →</Link>
        </div>
        {dash.recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No payments collected yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-black text-slate-500 bg-slate-50/60 border-b border-slate-100">
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Receipt #</th>
                <th className="px-4 py-2 text-left">Student</th>
                <th className="px-4 py-2 text-left">For</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left">Method</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dash.recent.map(r => {
                const isReversed = r.voucherStatus === "REVERSED"
                return (
                  <tr key={r.id} className={cn("hover:bg-slate-50/60 transition-colors", isReversed && "opacity-60")}>
                    <td className={cn("px-4 py-2.5 font-mono text-xs tabular-nums text-slate-700", isReversed && "line-through")}>{r.dateBS}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/finance/receipts/${r.id}/print`}
                        className={cn("font-mono text-xs font-bold text-slate-900 hover:text-primary hover:underline cursor-pointer", isReversed && "line-through")}
                      >
                        {r.receiptNumber}
                      </Link>
                      {isReversed && (
                        <span className="ml-2 inline-block text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">VOIDED</span>
                      )}
                    </td>
                    <td className={cn("px-4 py-2.5 text-slate-700", isReversed && "line-through")}>{r.studentName}</td>
                    <td className={cn("px-4 py-2.5 text-slate-700", isReversed && "line-through")}>{r.feeAccountName}</td>
                    <td className={cn("px-4 py-2.5 text-right font-mono font-bold tabular-nums", isReversed ? "line-through text-slate-400" : "text-emerald-700")}>Rs. {formatMoney(r.amount)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-600">{r.method}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/finance/receipts/${r.id}/print`} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer">
                        <Printer className="w-3 h-3" /> Print
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Manage shortcuts */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" /> Manage
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <ActionCard href="/finance/classes"   title="Classes"     desc="Fee schedule grid"               icon={Users}       color="sky" />
          <ActionCard href="/finance/plans"     title="Plans"       desc="Year templates per class"        icon={Layers}      color="violet" />
          <ActionCard href="/finance/heads"     title="Fee Heads"   desc="Master list"                     icon={Layers}      color="primary" />
          <ActionCard href="/finance/history"   title="History"     desc="Past receipts"                   icon={History}     color="amber" />
          <ActionCard href="/finance/audit"     title="Audit Log"   desc="Every change traced"             icon={ShieldCheck} color="primary" />
          <ActionCard href="/accounting"        title="Accounting"  desc="GL, books, reports"              icon={Calculator}  color="violet" />
        </div>
      </div>
    </div>
  )
}

function formatMoney(s: string | number): string {
  const n = typeof s === "string" ? parseFloat(s) : s
  if (!Number.isFinite(n)) return "0"
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function KpiCard({
  label, value, sub, tone, icon: Icon, href,
}: {
  label: string; value: string; sub: string
  tone: "emerald" | "primary" | "sky" | "violet" | "rose" | "amber" | "slate"
  icon: React.ElementType
  href?: string
}) {
  const palette = {
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50",  value: "text-emerald-700" },
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",        value: "text-primary" },
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",           value: "text-sky-700" },
    violet:  { ring: "ring-violet-100",  icon: "text-violet-600 bg-violet-50",     value: "text-violet-700" },
    rose:    { ring: "ring-rose-100",    icon: "text-rose-600 bg-rose-50",         value: "text-rose-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",       value: "text-amber-700" },
    slate:   { ring: "ring-slate-100",   icon: "text-slate-500 bg-slate-50",       value: "text-slate-700" },
  }[tone]
  const inner = (
    <div className={cn(
      "bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5 ring-1 h-full",
      palette.ring,
      href && "hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer",
    )}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.icon)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={cn("text-xl font-bold font-mono tabular-nums leading-tight", palette.value)}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

function ActionCard({
  href, title, desc, icon: Icon, color,
}: {
  href: string; title: string; desc: string; icon: React.ElementType
  color: "emerald" | "primary" | "violet" | "sky" | "amber"
}) {
  const palette = {
    emerald: { bg: "bg-emerald-500/8", text: "text-emerald-600" },
    primary: { bg: "bg-primary/8",     text: "text-primary" },
    violet:  { bg: "bg-violet-500/8",  text: "text-violet-600" },
    sky:     { bg: "bg-sky-500/8",     text: "text-sky-600" },
    amber:   { bg: "bg-amber-500/8",   text: "text-amber-600" },
  }[color]
  return (
    <Link href={href} className="block group">
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-4 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/5 transition-all duration-200 cursor-pointer flex items-center gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", palette.bg)}>
          <Icon className={cn("w-4 h-4", palette.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">{title}</div>
          <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
      </div>
    </Link>
  )
}
