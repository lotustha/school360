import Link from "next/link"
import { Metadata } from "next"
import { Receipt, History, ArrowRight, Plus, Wallet, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getFinanceDashboard } from "@/actions/accounting/fee-payments"
import { formatBS } from "@/lib/nepali-date"

export const metadata: Metadata = { title: "Overview" }

export default async function FinanceOverviewPage() {
  const dash = await getFinanceDashboard()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">Collect student fees — each payment auto-posts a Receipt Voucher.</p>
        </div>
        <Link href="/finance/collect">
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-sm shadow-primary/20">
            <Plus className="w-4 h-4" /> Collect Fee
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat title="Today's Collection" value={`Rs. ${dash.todayTotal}`} desc={`${dash.todayCount} payment${dash.todayCount === 1 ? "" : "s"}`} icon={Wallet} color="emerald" />
        <Stat title="This Month" value={`Rs. ${dash.monthTotal}`} desc={`${dash.monthCount} payment${dash.monthCount === 1 ? "" : "s"}`} icon={TrendingUp} color="primary" />
        <Stat title="New Receipt" value="Collect" desc="Record a payment" icon={Receipt} color="violet" href="/finance/collect" />
        <Stat title="History" value="View all" desc="Past receipts" icon={History} color="amber" href="/finance/history" />
      </div>

      {dash.recent.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
            <p className="font-semibold text-sm">Recent Receipts</p>
            <Link href="/finance/history">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary cursor-pointer">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left">Receipt #</th>
                <th className="px-4 py-3 text-left">Date (BS)</th>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Fee head</th>
                <th className="px-4 py-3 text-center w-20">Method</th>
                <th className="px-4 py-3 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {dash.recent.map(r => (
                <tr key={r.id} className="hover:bg-primary/4">
                  <td className="px-4 py-2">
                    <Link href={`/finance/receipts/${r.id}/print`} target="_blank" className="font-mono text-xs font-bold text-primary hover:underline">
                      {r.receiptNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs">{formatBS(r.dateBS)}</td>
                  <td className="px-4 py-2 text-sm">{r.studentName}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{r.feeAccountName}</td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant="outline" className="text-[10px] font-bold">{r.method}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">Rs. {r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({
  title, value, desc, icon: Icon, color, href,
}: {
  title: string
  value: string
  desc:  string
  icon:  React.ElementType
  color: "emerald" | "primary" | "violet" | "amber"
  href?: string
}) {
  const palette = {
    emerald: { bg: "bg-emerald-500/8", text: "text-emerald-600", border: "border-emerald-500/20" },
    primary: { bg: "bg-primary/8",     text: "text-primary",     border: "border-primary/20" },
    violet:  { bg: "bg-violet-500/8",  text: "text-violet-600",  border: "border-violet-500/20" },
    amber:   { bg: "bg-amber-500/8",   text: "text-amber-600",   border: "border-amber-500/20" },
  }[color]
  const body = (
    <div className={cn(
      "bg-white/70 backdrop-blur-xl rounded-xl border p-5 transition-all duration-200",
      href && "hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/8 cursor-pointer",
      palette.border,
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", palette.bg)}>
        <Icon className={cn("w-5 h-5", palette.text)} />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-sm font-semibold mt-0.5">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </div>
  )
  return href ? <Link href={href} className="block group">{body}</Link> : body
}
