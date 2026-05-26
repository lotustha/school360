import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getBalanceSheet } from "@/actions/accounting/reports"
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
  const bs = await getBalanceSheet(fyId, sp.asOf)

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Balance Sheet"
      subtitle={`As at ${formatBS(bs.asOfBS)}`}
    >
      <div className="grid grid-cols-2 gap-0 border border-slate-400">
        {/* Liabilities + Capital Fund */}
        <div className="border-r border-slate-400">
          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 border-b border-slate-400">Liabilities &amp; Capital Fund</p>
          {bs.liabilities.length > 0 && (
            <>
              <p className="px-2 py-1 text-xs font-bold bg-slate-50">Liabilities</p>
              {bs.liabilities.map((l, i) => <PrintRow key={i} {...l} />)}
            </>
          )}
          {bs.equity.length > 0 && (
            <>
              <p className="px-2 py-1 text-xs font-bold bg-slate-50">Capital Fund</p>
              {bs.equity.map((l, i) => <PrintRow key={i} {...l} />)}
            </>
          )}
          {parseFloat(bs.currentYearSurplus) > 0 && (
            <PrintRow
              code=""
              name={bs.isSurplus ? "Add: Current year surplus" : "Less: Current year deficit"}
              amount={(bs.isSurplus ? "" : "(") + bs.currentYearSurplus + (bs.isSurplus ? "" : ")")}
            />
          )}
          <div className="px-2 py-1.5 border-t-2 border-slate-700 bg-slate-100 flex items-center justify-between font-bold">
            <span className="text-[10px] uppercase tracking-wider">Total</span>
            <span className="font-mono tabular-nums">{bs.totalLiabilitiesAndEquity}</span>
          </div>
        </div>
        {/* Assets */}
        <div>
          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 border-b border-slate-400">Assets</p>
          {bs.assets.map((l, i) => <PrintRow key={i} {...l} />)}
          <div className="px-2 py-1.5 border-t-2 border-slate-700 bg-slate-100 flex items-center justify-between font-bold">
            <span className="text-[10px] uppercase tracking-wider">Total</span>
            <span className="font-mono tabular-nums">{bs.totalAssets}</span>
          </div>
        </div>
      </div>
      <p className="text-center text-xs mt-3 font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-full">
        {bs.balanced
          ? "Balance Sheet is balanced"
          : (
            <>
              <svg className="w-3.5 h-3.5 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-rose-700">Balance Sheet is NOT balanced</span>
            </>
          )}
      </p>
    </ReportPrintShell>
  )
}

function PrintRow({ code, name, amount }: { code: string; name: string; amount: string }) {
  return (
    <div className="px-2 py-1 flex items-center justify-between text-sm border-b border-slate-200">
      <span>
        {code && <span className="font-mono text-xs text-slate-500 mr-2">{code}</span>}
        {name}
      </span>
      <span className="font-mono tabular-nums">{amount}</span>
    </div>
  )
}
