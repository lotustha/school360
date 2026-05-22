import Link from "next/link"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCombinedCashBook } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS } from "@/lib/nepali-date"

export const metadata: Metadata = { title: "Cash + Bank Book" }

export default async function CombinedCashBookPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id
  const book = await getCombinedCashBook(fyId!, sp.from, sp.to)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Cash + Bank Book <span className="text-base text-muted-foreground font-normal">(Double-column)</span></h1>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2 text-xs">
            <select name="fy" defaultValue={fyId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
              {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
            </select>
            <button type="submit" className="h-9 px-3 bg-primary text-white rounded-md font-bold cursor-pointer">Apply</button>
          </form>
          <Link href={`/accounting/combined-cash-book/print?fy=${fyId}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60">
          <p className="text-sm">
            {formatBS(book.fromBS)} – <strong>{formatBS(book.toBS)}</strong>
          </p>
          <div className="grid grid-cols-2 gap-4 mt-3 max-w-md">
            <div className="text-xs">
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Cash · Opening / Closing</p>
              <p className="font-mono"><span className="text-slate-700">{book.openingCash}</span> <span className="text-slate-400 mx-1">→</span> <strong className="text-emerald-700">{book.closingCash}</strong></p>
            </div>
            <div className="text-xs">
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Bank · Opening / Closing</p>
              <p className="font-mono"><span className="text-slate-700">{book.openingBank}</span> <span className="text-slate-400 mx-1">→</span> <strong className="text-emerald-700">{book.closingBank}</strong></p>
            </div>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-left w-24 align-bottom">Date (BS)</th>
              <th rowSpan={2} className="px-3 py-2 text-left w-32 align-bottom">Voucher</th>
              <th rowSpan={2} className="px-3 py-2 text-left align-bottom">Narration</th>
              <th colSpan={2} className="px-3 py-1 text-center border-l border-slate-200 bg-emerald-50/40">Cash</th>
              <th colSpan={2} className="px-3 py-1 text-center border-l border-slate-200 bg-sky-50/40">Bank</th>
              <th rowSpan={2} className="px-3 py-2 text-right w-24 align-bottom border-l border-slate-200">Cash Bal</th>
              <th rowSpan={2} className="px-3 py-2 text-right w-24 align-bottom">Bank Bal</th>
            </tr>
            <tr>
              <th className="px-3 py-1 text-right w-24 border-l border-slate-200 bg-emerald-50/40">Receipt</th>
              <th className="px-3 py-1 text-right w-24 bg-emerald-50/40">Payment</th>
              <th className="px-3 py-1 text-right w-24 border-l border-slate-200 bg-sky-50/40">Receipt</th>
              <th className="px-3 py-1 text-right w-24 bg-sky-50/40">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            <tr className="bg-slate-50/60 font-semibold border-b border-slate-200">
              <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-widest text-slate-500">Opening balance</td>
              <td colSpan={4}></td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{book.openingCash}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{book.openingBank}</td>
            </tr>
            {book.rows.map((r, i) => (
              <tr key={i} className="hover:bg-primary/4">
                <td className="px-3 py-2 text-xs">{formatBS(r.dateBS)}</td>
                <td className="px-3 py-2 text-xs">
                  <Link href={`/accounting/vouchers/${r.voucherId}`} className="font-mono font-bold text-primary hover:underline">
                    {r.voucherNumber ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{r.narration}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 border-l border-slate-100">{parseFloat(r.cashDr) > 0 ? r.cashDr : ""}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700">{parseFloat(r.cashCr) > 0 ? r.cashCr : ""}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 border-l border-slate-100">{parseFloat(r.bankDr) > 0 ? r.bankDr : ""}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700">{parseFloat(r.bankCr) > 0 ? r.bankCr : ""}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold border-l border-slate-100">{r.cashRunning}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{r.bankRunning}</td>
              </tr>
            ))}
            {book.rows.length === 0 && (
              <tr><td colSpan={9} className="p-10 text-center text-sm text-muted-foreground">No cash or bank activity in this period.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50/60 font-bold">
            <tr>
              <td colSpan={3} className="px-3 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700 border-l border-slate-100">{book.totalCashReceipts}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-rose-700">{book.totalCashPayments}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700 border-l border-slate-100">{book.totalBankReceipts}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-rose-700">{book.totalBankPayments}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums border-l border-slate-100">{book.closingCash}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{book.closingBank}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
