import Link from "next/link"
import { Metadata } from "next"
import { Plus, ReceiptText, Banknote, ArrowLeftRight, NotebookPen, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listVouchers } from "@/actions/accounting/vouchers"
import { VOUCHER_TYPE_LABEL } from "@/lib/accounting"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Vouchers" }

const TYPE_ICON = { RV: ReceiptText, PV: Banknote, CV: ArrowLeftRight, JV: NotebookPen } as const

export default async function VouchersListPage() {
  const vouchers = await listVouchers()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Vouchers</h1>
        <div className="flex items-center gap-1.5">
          <Link href="/accounting/quick">
            <Button size="sm" className="gap-1.5 cursor-pointer shadow-sm shadow-primary/20">
              <Zap className="w-3.5 h-3.5" /> Quick Entry
            </Button>
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-2">or manual</span>
          {(["RV", "PV", "CV", "JV"] as const).map(t => {
            const Icon = TYPE_ICON[t]
            return (
              <Link key={t} href={`/accounting/vouchers/new/${t}`}>
                <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer text-xs">
                  <Icon className="w-3.5 h-3.5" />
                  {t}
                </Button>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {vouchers.length === 0 ? (
          <div className="p-16 text-center">
            <ReceiptText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-4">No vouchers yet.</p>
            <Link href="/accounting/vouchers/new/RV">
              <Button className="gap-1.5 cursor-pointer">
                <Plus className="w-4 h-4" /> Create First Voucher
              </Button>
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Date (BS)</th>
                <th className="px-4 py-3 text-left">Narration</th>
                <th className="px-4 py-3 text-left">FY</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {vouchers.map(v => {
                const Icon = TYPE_ICON[v.type as keyof typeof TYPE_ICON] ?? ReceiptText
                return (
                  <tr key={v.id} className="hover:bg-primary/4 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/accounting/vouchers/${v.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                        {v.number ?? <span className="text-amber-600">(draft)</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Icon className="w-3.5 h-3.5 text-slate-500" />
                        {VOUCHER_TYPE_LABEL[v.type as keyof typeof VOUCHER_TYPE_LABEL] ?? v.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{formatBS(v.dateBS)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 max-w-md truncate">{v.narration}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.fiscalYearName}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs font-semibold">
                      {v.totalAmount}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-bold",
                        v.status === "DRAFT"    && "bg-amber-50 text-amber-700 border-amber-200",
                        v.status === "POSTED"   && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        v.status === "REVERSED" && "bg-slate-100 text-slate-600 border-slate-300",
                      )}>{v.status}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
