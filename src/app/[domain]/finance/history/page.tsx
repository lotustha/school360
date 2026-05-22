import Link from "next/link"
import { Metadata } from "next"
import { Printer, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listFeePayments } from "@/actions/accounting/fee-payments"
import { formatBS } from "@/lib/nepali-date"

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
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left">Receipt #</th>
                <th className="px-4 py-3 text-left">Date (BS)</th>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Fee head</th>
                <th className="px-4 py-3 text-center w-24">Method</th>
                <th className="px-4 py-3 text-left w-28">Voucher</th>
                <th className="px-4 py-3 text-right w-28">Amount</th>
                <th className="px-4 py-3 text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-primary/4">
                  <td className="px-4 py-2 font-mono text-xs font-bold text-primary">{r.receiptNumber}</td>
                  <td className="px-4 py-2 text-xs">{formatBS(r.dateBS)}</td>
                  <td className="px-4 py-2">
                    <p className="font-semibold">{r.studentName}</p>
                    {r.className && <p className="text-[11px] text-muted-foreground">{r.className}</p>}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className="font-mono text-slate-400">{r.feeAccountCode}</span>{" "}
                    {r.feeAccountName}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant="outline" className="text-[10px] font-bold">{r.method}</Badge>
                    {r.bankName && <p className="text-[10px] text-muted-foreground mt-0.5">{r.bankName}</p>}
                  </td>
                  <td className="px-4 py-2">
                    {r.voucherId && (
                      <Link href={`/accounting/vouchers/${r.voucherId}`} className="font-mono text-xs text-primary hover:underline">
                        {r.voucherNumber}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">{r.amount}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/finance/receipts/${r.id}/print`} target="_blank">
                      <Button size="sm" variant="ghost" className="cursor-pointer text-xs h-7 gap-1">
                        <Printer className="w-3 h-3" /> Print
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50/60 font-bold">
              <tr>
                <td colSpan={6} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Total</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">Rs. {total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
