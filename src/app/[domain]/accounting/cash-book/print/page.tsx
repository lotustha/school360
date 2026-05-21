import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCashBook } from "@/actions/accounting/reports"
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
  const book = await getCashBook(fyId, sp.from, sp.to)

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Cash Book"
      subtitle={`${book.accountCode} ${book.accountName} · ${formatBS(book.fromBS)} to ${formatBS(book.toBS)}`}
      landscape
    >
      <table className="w-full text-sm border border-slate-400">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-400">
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-24">Date (BS)</th>
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-32">Voucher</th>
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold">Narration</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">Receipt (Dr)</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">Payment (Cr)</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-28">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-slate-50 font-semibold border-b border-slate-200">
            <td colSpan={5} className="px-2 py-1 text-right text-xs uppercase tracking-wider">Opening balance</td>
            <td className="px-2 py-1 text-right font-mono tabular-nums">{book.openingBalance}</td>
          </tr>
          {book.rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="px-2 py-1 text-xs">{formatBS(r.dateBS)}</td>
              <td className="px-2 py-1 text-xs font-mono">{r.voucherNumber ?? "—"}</td>
              <td className="px-2 py-1 text-xs">{r.narration}</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums">{parseFloat(r.receipt) > 0 ? r.receipt : ""}</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums">{parseFloat(r.payment) > 0 ? r.payment : ""}</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums">{r.balance}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
            <td colSpan={3} className="px-2 py-1.5 text-right">Totals</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{book.totalReceipts}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{book.totalPayments}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{book.closingBalance}</td>
          </tr>
        </tfoot>
      </table>
    </ReportPrintShell>
  )
}
