import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getTrialBalance } from "@/actions/accounting/reports"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { ReportPrintShell } from "@/components/accounting/report-print-shell"
import { formatBS } from "@/lib/nepali-date"

export const dynamic = "force-dynamic"

export default async function Print({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; asOf?: string }>
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
  const tb = await getTrialBalance(fyId, sp.asOf)

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Trial Balance"
      subtitle={`As at ${formatBS(tb.asOfBS)}`}
    >
      <table className="w-full text-sm border border-slate-400">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-400">
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-20">Code</th>
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold">Account</th>
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-24">Type</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-32">Debit (Rs.)</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-32">Credit (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {tb.rows.map(r => (
            <tr key={r.accountId} className="border-b border-slate-200">
              <td className="px-2 py-1 font-mono text-xs">{r.code}</td>
              <td className="px-2 py-1">{r.name}</td>
              <td className="px-2 py-1 text-xs text-slate-600">{r.type}</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums">{parseFloat(r.debit) > 0 ? r.debit : ""}</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums">{parseFloat(r.credit) > 0 ? r.credit : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
            <td colSpan={3} className="px-2 py-1.5 text-right">Totals</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{tb.totalDebit}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{tb.totalCredit}</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-center text-xs mt-3 font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-full">
        {tb.balanced
          ? "Trial Balance is balanced"
          : (
            <>
              <svg className="w-3.5 h-3.5 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-rose-700">Trial Balance is NOT balanced</span>
            </>
          )}
      </p>
    </ReportPrintShell>
  )
}
