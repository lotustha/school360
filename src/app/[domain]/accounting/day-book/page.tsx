import Link from "next/link"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getDayBook } from "@/actions/accounting/reports"
import { getCurrentFiscalYear, listFiscalYears } from "@/actions/accounting/fiscal-years"
import { todayBS, formatBS } from "@/lib/nepali-date"
import { DayBookFilter } from "./day-book-filter"

export const metadata: Metadata = { title: "Day Book" }

export default async function DayBookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; fy?: string }>
}) {
  const sp = await searchParams
  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")

  const fyId   = sp.fy   ?? current?.id ?? fys[0]?.id
  const dateBS = sp.date ?? todayBS()

  const entries = await getDayBook(fyId!, dateBS)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Day Book</h1>
        <DayBookFilter
          initialFyId={fyId!}
          initialDateBS={dateBS}
          fiscalYears={fys.map(f => ({ id: f.id, name: f.name }))}
        />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/60">
          <p className="text-sm">
            <span className="font-bold">{formatBS(dateBS)}</span> · {entries.length} voucher{entries.length === 1 ? "" : "s"}
          </p>
        </div>

        {entries.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No vouchers posted on this date.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map(e => (
              <div key={e.voucherId} className="p-4 hover:bg-primary/4 transition-colors">
                <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                  <Link href={`/accounting/vouchers/${e.voucherId}`} className="font-mono text-sm font-bold text-primary hover:underline">
                    {e.voucherNumber ?? "(draft)"}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {e.voucherType} · {e.partyName ?? ""}
                    {e.status === "REVERSED" && <span className="text-rose-600 font-bold ml-2">REVERSED</span>}
                  </div>
                </div>
                <p className="text-xs text-slate-600 mb-2">{e.narration}</p>
                <table className="w-full text-xs border border-slate-200 rounded">
                  <tbody className="divide-y divide-slate-100">
                    {e.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1"><span className="font-mono text-slate-500">{l.accountCode}</span> · {l.accountName}</td>
                        <td className="px-3 py-1 text-right font-mono tabular-nums w-24">{parseFloat(l.debit) > 0 ? l.debit : ""}</td>
                        <td className="px-3 py-1 text-right font-mono tabular-nums w-24">{parseFloat(l.credit) > 0 ? l.credit : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/60 font-bold">
                    <tr>
                      <td className="px-3 py-1 text-right text-[10px] uppercase tracking-widest">Total</td>
                      <td className="px-3 py-1 text-right font-mono tabular-nums">{e.totalDebit}</td>
                      <td className="px-3 py-1 text-right font-mono tabular-nums">{e.totalCredit}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
