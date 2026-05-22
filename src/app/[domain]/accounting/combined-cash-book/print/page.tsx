import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCombinedCashBook } from "@/actions/accounting/reports"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { ReportPrintShell } from "@/components/accounting/report-print-shell"
import { formatBS } from "@/lib/nepali-date"

export const dynamic = "force-dynamic"

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

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Cash + Bank Book (Double-column)"
      subtitle={`${formatBS(book.fromBS)} to ${formatBS(book.toBS)}`}
      landscape
    >
      <table className="w-full text-xs border border-slate-400">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-400">
            <th rowSpan={2} className="px-1 py-1 text-left text-[9px] uppercase tracking-wider font-bold w-20 align-bottom">Date</th>
            <th rowSpan={2} className="px-1 py-1 text-left text-[9px] uppercase tracking-wider font-bold w-24 align-bottom">Voucher</th>
            <th rowSpan={2} className="px-1 py-1 text-left text-[9px] uppercase tracking-wider font-bold align-bottom">Narration</th>
            <th colSpan={2} className="px-1 py-0.5 text-center text-[9px] uppercase tracking-wider font-bold border-l border-slate-300">Cash</th>
            <th colSpan={2} className="px-1 py-0.5 text-center text-[9px] uppercase tracking-wider font-bold border-l border-slate-300">Bank</th>
            <th rowSpan={2} className="px-1 py-1 text-right text-[9px] uppercase tracking-wider font-bold w-20 align-bottom border-l border-slate-300">Cash Bal</th>
            <th rowSpan={2} className="px-1 py-1 text-right text-[9px] uppercase tracking-wider font-bold w-20 align-bottom">Bank Bal</th>
          </tr>
          <tr className="bg-slate-50 border-b border-slate-300">
            <th className="px-1 py-0.5 text-right text-[9px] font-bold w-20 border-l border-slate-300">Receipt</th>
            <th className="px-1 py-0.5 text-right text-[9px] font-bold w-20">Payment</th>
            <th className="px-1 py-0.5 text-right text-[9px] font-bold w-20 border-l border-slate-300">Receipt</th>
            <th className="px-1 py-0.5 text-right text-[9px] font-bold w-20">Payment</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-slate-50 font-semibold border-b border-slate-200">
            <td colSpan={3} className="px-1 py-1 text-right text-[9px] uppercase tracking-wider">Opening balance</td>
            <td colSpan={4}></td>
            <td className="px-1 py-1 text-right font-mono tabular-nums border-l border-slate-300">{book.openingCash}</td>
            <td className="px-1 py-1 text-right font-mono tabular-nums">{book.openingBank}</td>
          </tr>
          {book.rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="px-1 py-0.5">{formatBS(r.dateBS)}</td>
              <td className="px-1 py-0.5 font-mono text-[10px]">{r.voucherNumber ?? "—"}</td>
              <td className="px-1 py-0.5">{r.narration}</td>
              <td className="px-1 py-0.5 text-right font-mono tabular-nums border-l border-slate-200">{parseFloat(r.cashDr) > 0 ? r.cashDr : ""}</td>
              <td className="px-1 py-0.5 text-right font-mono tabular-nums">{parseFloat(r.cashCr) > 0 ? r.cashCr : ""}</td>
              <td className="px-1 py-0.5 text-right font-mono tabular-nums border-l border-slate-200">{parseFloat(r.bankDr) > 0 ? r.bankDr : ""}</td>
              <td className="px-1 py-0.5 text-right font-mono tabular-nums">{parseFloat(r.bankCr) > 0 ? r.bankCr : ""}</td>
              <td className="px-1 py-0.5 text-right font-mono tabular-nums border-l border-slate-200">{r.cashRunning}</td>
              <td className="px-1 py-0.5 text-right font-mono tabular-nums">{r.bankRunning}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
            <td colSpan={3} className="px-1 py-1 text-right text-[9px] uppercase">Totals</td>
            <td className="px-1 py-1 text-right font-mono tabular-nums border-l border-slate-300">{book.totalCashReceipts}</td>
            <td className="px-1 py-1 text-right font-mono tabular-nums">{book.totalCashPayments}</td>
            <td className="px-1 py-1 text-right font-mono tabular-nums border-l border-slate-300">{book.totalBankReceipts}</td>
            <td className="px-1 py-1 text-right font-mono tabular-nums">{book.totalBankPayments}</td>
            <td className="px-1 py-1 text-right font-mono tabular-nums border-l border-slate-300">{book.closingCash}</td>
            <td className="px-1 py-1 text-right font-mono tabular-nums">{book.closingBank}</td>
          </tr>
        </tfoot>
      </table>
    </ReportPrintShell>
  )
}
