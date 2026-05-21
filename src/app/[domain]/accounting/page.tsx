import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowRight, AlertCircle, Zap, CheckCircle2, XCircle, Scale, FileText } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import { getAccountingSnapshot } from "@/actions/accounting/reports"
import { VOUCHER_TYPE_LABEL } from "@/lib/accounting"
import { DashboardCharts } from "@/components/accounting/dashboard-charts"

export const metadata: Metadata = { title: "Overview" }

export default async function AccountingHomePage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const snap = await getAccountingSnapshot()

  if (!snap) {
    return (
      <EmptyState />
    )
  }

  const { fiscalYear, voucherCounts, recent, trialBalance, ieSummary } = snap

  const totalDrafts  = voucherCounts.filter(v => v.status === "DRAFT").reduce((a, v) => a + v.count, 0)
  const totalPosted  = voucherCounts.filter(v => v.status === "POSTED").reduce((a, v) => a + v.count, 0)

  return (
    <div className="space-y-5">
      {/* FY summary card */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Current Fiscal Year</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{fiscalYear.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatBS(fiscalYear.startBS)} – {formatBS(fiscalYear.endBS)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(
              "text-xs font-bold",
              fiscalYear.status === "OPEN"   && "bg-emerald-50 text-emerald-700 border-emerald-200",
              fiscalYear.status === "CLOSED" && "bg-amber-50 text-amber-700 border-amber-200",
              fiscalYear.status === "LOCKED" && "bg-slate-100 text-slate-600 border-slate-300",
            )}>
              {fiscalYear.status}
            </Badge>
            <Link href="/accounting/quick">
              <Button size="sm" className="gap-1.5 cursor-pointer shadow-sm shadow-primary/20">
                <Zap className="w-4 h-4" /> Quick Entry
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat title="Posted Vouchers"  value={totalPosted}      icon={FileText} color="emerald" href="/accounting/vouchers" />
        <Stat title="Draft Vouchers"   value={totalDrafts}      icon={FileText} color="amber"   href="/accounting/vouchers" />
        <Stat
          title="Trial Balance"
          value={trialBalance ? (trialBalance.balanced ? "Balanced" : "Off") : "—"}
          icon={trialBalance?.balanced ? CheckCircle2 : XCircle}
          color={trialBalance?.balanced ? "emerald" : "rose"}
          href="/accounting/reports/trial-balance"
        />
        <Stat title="Books" value="View" icon={Scale} color="violet" href="/accounting/ledger" />
      </div>

      {/* Charts */}
      {ieSummary && (parseFloat(ieSummary.totalIncome) > 0 || parseFloat(ieSummary.totalExpense) > 0) && (
        <DashboardCharts
          totalIncome={ieSummary.totalIncome}
          totalExpense={ieSummary.totalExpense}
          topExpenses={ieSummary.topExpenses}
          topIncome={ieSummary.topIncome}
        />
      )}

      {/* Recent vouchers + TB summary */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
            <p className="font-semibold text-sm">Recent Vouchers</p>
            <Link href="/accounting/vouchers">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary cursor-pointer">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="p-3">
            {recent.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No vouchers yet.</p>
            ) : (
              <ul className="space-y-1">
                {recent.map(r => (
                  <li key={r.id}>
                    <Link href={`/accounting/vouchers/${r.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/4 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">
                          {r.number ?? <span className="text-amber-600">DRAFT</span>}
                          <span className="text-muted-foreground font-normal text-xs ml-1.5">· {VOUCHER_TYPE_LABEL[r.type as keyof typeof VOUCHER_TYPE_LABEL]}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.narration}</p>
                      </div>
                      <span className="text-sm font-mono tabular-nums font-semibold">Rs. {r.totalAmount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
            <p className="font-semibold text-sm">Trial Balance Check</p>
            <Link href="/accounting/reports/trial-balance">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary cursor-pointer">
                Open <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-100/80">
              <span className="text-sm text-muted-foreground">Total Debit</span>
              <span className="font-bold text-sm tabular-nums">Rs. {trialBalance?.totalDebit ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100/80">
              <span className="text-sm text-muted-foreground">Total Credit</span>
              <span className="font-bold text-sm tabular-nums">Rs. {trialBalance?.totalCredit ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">Status</span>
              {trialBalance ? (
                trialBalance.balanced ? (
                  <span className="text-sm font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Balanced</span>
                ) : (
                  <span className="text-sm font-bold text-rose-700 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Not balanced</span>
                )
              ) : (
                <span className="text-sm text-muted-foreground">No data</span>
              )}
            </div>
          </div>
        </div>
      </div>
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

function Stat({
  title, value, icon: Icon, color, href,
}: {
  title: string
  value: number | string
  icon:  React.ElementType
  color: "emerald" | "amber" | "rose" | "violet" | "primary"
  href:  string
}) {
  const palette: Record<typeof color, { bg: string; text: string; border: string }> = {
    emerald: { bg: "bg-emerald-500/8", text: "text-emerald-600", border: "border-emerald-500/20" },
    amber:   { bg: "bg-amber-500/8",   text: "text-amber-600",   border: "border-amber-500/20" },
    rose:    { bg: "bg-rose-500/8",    text: "text-rose-600",    border: "border-rose-500/20" },
    violet:  { bg: "bg-violet-500/8",  text: "text-violet-600",  border: "border-violet-500/20" },
    primary: { bg: "bg-primary/8",     text: "text-primary",     border: "border-primary/20" },
  }
  const p = palette[color]
  return (
    <Link href={href} className="block group">
      <div className={cn(
        "bg-white/70 backdrop-blur-xl rounded-xl border p-5 transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/8 cursor-pointer",
        p.border,
      )}>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", p.bg)}>
          <Icon className={cn("w-5 h-5", p.text)} />
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-sm font-semibold mt-0.5">{title}</div>
      </div>
    </Link>
  )
}
