import Link from "next/link"
import { Metadata } from "next"
import { FileText, Plus, Receipt, Banknote, Wallet, TrendingUp, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { listFeePayments } from "@/actions/accounting/fee-payments"
import { HistoryTable } from "./history-table"
import { HistoryFilters } from "./history-filters"

export const metadata: Metadata = { title: "Payment History" }

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; method?: string }>
}) {
  const sp = await searchParams
  const rows = await listFeePayments({
    fromBS: sp.from,
    toBS:   sp.to,
    method: sp.method,
  })

  // Exclude voided receipts from money totals (they're reversed in the GL)
  const live = rows.filter(r => r.voucherStatus !== "REVERSED")
  const voidedCount = rows.length - live.length
  const total       = live.reduce((s, r) => s + parseFloat(r.amount), 0)

  const byMethod: Record<string, { count: number; total: number }> = {}
  for (const r of live) {
    const m = r.method
    if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 }
    byMethod[m].count++
    byMethod[m].total += parseFloat(r.amount)
  }

  const hasFilter = !!(sp.from || sp.to || sp.method)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
          <p className="text-sm text-muted-foreground">
            All fee receipts ever recorded.
            {hasFilter && <span className="text-amber-600 font-bold"> · filtered</span>}
          </p>
        </div>
        <Link href="/finance/collect">
          <Button size="sm" className="gap-1.5 cursor-pointer h-10">
            <Plus className="w-4 h-4" /> Collect Fee
          </Button>
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label={hasFilter ? "Receipts (filtered)" : "Total receipts"} value={`${live.length}`}                  sub={voidedCount > 0 ? `${voidedCount} voided excluded` : "All live"} tone="primary" icon={Receipt} />
        <KPI label="Collected"                                            value={`Rs. ${formatMoney(total)}`}        sub={`Avg Rs. ${live.length > 0 ? formatMoney(total / live.length) : "0"}`} tone="emerald" icon={TrendingUp} />
        <KPI label="Cash"                                                 value={`Rs. ${formatMoney(byMethod.CASH?.total ?? 0)}`} sub={`${byMethod.CASH?.count ?? 0} receipts`} tone="amber" icon={Banknote} />
        <KPI label="Non-cash"                                             value={`Rs. ${formatMoney((byMethod.BANK?.total ?? 0) + (byMethod.CHEQUE?.total ?? 0) + (byMethod.ONLINE?.total ?? 0))}`} sub={`${(byMethod.BANK?.count ?? 0) + (byMethod.CHEQUE?.count ?? 0) + (byMethod.ONLINE?.count ?? 0)} receipts (bank/cheque/online)`} tone="sky" icon={Wallet} />
      </div>

      <HistoryFilters rows={rows} />

      {voidedCount > 0 && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 inline-flex items-center gap-2">
          <Ban className="w-3.5 h-3.5" />
          {voidedCount} voided receipt{voidedCount === 1 ? "" : "s"} {voidedCount === 1 ? "is" : "are"} shown below with a strike-through and excluded from totals.
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-1">
              {hasFilter ? "No payments match the filters." : "No fee payments recorded yet."}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {hasFilter ? "Try widening the date range or clearing method." : "Start collecting and they'll appear here."}
            </p>
            <Link href="/finance/collect">
              <Button className="gap-1.5 cursor-pointer">
                <Plus className="w-4 h-4" /> Record First Payment
              </Button>
            </Link>
          </div>
        ) : (
          <HistoryTable rows={rows} />
        )}
      </div>
    </div>
  )
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function KPI({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "primary" | "emerald" | "amber" | "sky"
  icon: React.ElementType
}) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",     value: "text-amber-700" },
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",         value: "text-sky-700" },
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 ring-1", palette.ring)}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", palette.icon)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={cn("text-xl font-bold font-mono tabular-nums leading-tight", palette.value)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
