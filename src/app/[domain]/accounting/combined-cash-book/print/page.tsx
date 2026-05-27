import { Fragment } from "react"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCombinedCashBook, type CombinedBookAccount } from "@/actions/accounting/reports"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { ReportPrintShell } from "@/components/accounting/report-print-shell"
import { formatBS } from "@/lib/nepali-date"

export const dynamic = "force-dynamic"

// How many cash/bank accounts fit across one A4-landscape table before we wrap
// into a continuation table (each repeats Date / Voucher / Narration).
const COLS_PER_TABLE = 3

export default async function Print({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; from?: string; to?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({
    where: { slug: domain },
    select: { name: true, address: true, panNumber: true },
  })
  if (!school) notFound()
  const fyId = sp.fy ?? (await getCurrentFiscalYear())?.id
  if (!fyId) notFound()
  const book = await getCombinedCashBook(fyId, sp.from, sp.to)

  const chunks: CombinedBookAccount[][] = []
  for (let i = 0; i < book.accounts.length; i += COLS_PER_TABLE) {
    chunks.push(book.accounts.slice(i, i + COLS_PER_TABLE))
  }

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Cash + Bank Book"
      subtitle={`${formatBS(book.fromBS)} to ${formatBS(book.toBS)}`}
      landscape
    >
      {book.accounts.length === 0 ? (
        <p className="text-xs text-slate-500">No cash or bank accounts configured.</p>
      ) : (
        chunks.map((chunk, ci) => (
          <table key={ci} className="w-full text-xs border border-slate-400 mb-5">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400">
                <th rowSpan={2} className="px-1 py-1 text-left text-[9px] uppercase tracking-wider font-bold w-16 align-bottom">Date</th>
                <th rowSpan={2} className="px-1 py-1 text-left text-[9px] uppercase tracking-wider font-bold w-20 align-bottom">Voucher</th>
                <th rowSpan={2} className="px-1 py-1 text-left text-[9px] uppercase tracking-wider font-bold align-bottom">Narration</th>
                {chunk.map(a => (
                  <th key={a.id} colSpan={3} className="px-1 py-0.5 text-center text-[9px] uppercase tracking-wider font-bold border-l border-slate-300">
                    {a.name} <span className="font-mono text-[8px] text-slate-500">{a.code}</span>
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50 border-b border-slate-300">
                {chunk.map(a => (
                  <Fragment key={a.id}>
                    <th className="px-1 py-0.5 text-right text-[9px] font-bold w-16 border-l border-slate-300">Receipt</th>
                    <th className="px-1 py-0.5 text-right text-[9px] font-bold w-16">Payment</th>
                    <th className="px-1 py-0.5 text-right text-[9px] font-bold w-20">Balance</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50 font-semibold border-b border-slate-200">
                <td colSpan={3} className="px-1 py-1 text-right text-[9px] uppercase tracking-wider">Opening balance</td>
                {chunk.map(a => (
                  <td key={a.id} colSpan={3} className="px-1 py-1 text-right font-mono tabular-nums border-l border-slate-300">{a.opening}</td>
                ))}
              </tr>
              {book.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="px-1 py-0.5">{formatBS(r.dateBS)}</td>
                  <td className="px-1 py-0.5 font-mono text-[10px]">{r.voucherNumber ?? "—"}</td>
                  <td className="px-1 py-0.5">{r.narration}</td>
                  {chunk.map(a => {
                    const c = r.perAccount[a.id]
                    return (
                      <Fragment key={a.id}>
                        <td className="px-1 py-0.5 text-right font-mono tabular-nums border-l border-slate-200">{c && parseFloat(c.dr) > 0 ? c.dr : ""}</td>
                        <td className="px-1 py-0.5 text-right font-mono tabular-nums">{c && parseFloat(c.cr) > 0 ? c.cr : ""}</td>
                        <td className="px-1 py-0.5 text-right font-mono tabular-nums">{c ? c.running : a.opening}</td>
                      </Fragment>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                <td colSpan={3} className="px-1 py-1 text-right text-[9px] uppercase">Totals</td>
                {chunk.map(a => (
                  <Fragment key={a.id}>
                    <td className="px-1 py-1 text-right font-mono tabular-nums border-l border-slate-300">{a.receipts}</td>
                    <td className="px-1 py-1 text-right font-mono tabular-nums">{a.payments}</td>
                    <td className="px-1 py-1 text-right font-mono tabular-nums">{a.closing}</td>
                  </Fragment>
                ))}
              </tr>
            </tfoot>
          </table>
        ))
      )}
    </ReportPrintShell>
  )
}
