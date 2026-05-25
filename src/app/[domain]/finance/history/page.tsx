import Link from "next/link"
import { Metadata } from "next"
import { FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listFeePayments } from "@/actions/accounting/fee-payments"
import { HistoryTable } from "./history-table"

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

  const total = rows.reduce((a, r) => a + parseFloat(r.amount), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
          <p className="text-sm text-muted-foreground">{rows.length} payment{rows.length === 1 ? "" : "s"} · Rs. {total.toFixed(2)} total</p>
        </div>
        <Link href="/finance/collect">
          <Button size="sm" className="gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" /> Collect Fee
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "CASH", "BANK", "CHEQUE", "ONLINE"].map(m => (
          <Link key={m || "ALL"} href={m ? `/finance/history?method=${m}` : "/finance/history"}>
            <Badge variant={(sp.method ?? "") === m ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
              {m || "ALL METHODS"}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-4">No fee payments recorded yet.</p>
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
