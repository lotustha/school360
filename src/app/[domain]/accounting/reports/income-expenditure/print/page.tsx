import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getIncomeExpenditure } from "@/actions/accounting/reports"
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
  const ie = await getIncomeExpenditure(fyId, sp.asOf)

  const maxLen = Math.max(ie.income.length, ie.expense.length)
  const expRows = [...ie.expense, ...Array.from({ length: maxLen - ie.expense.length }, () => null)]
  const incRows = [...ie.income,  ...Array.from({ length: maxLen - ie.income.length },  () => null)]

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Income & Expenditure Account"
      subtitle={`For the period ended ${formatBS(ie.asOfBS)}`}
    >
      <div className="grid grid-cols-2 gap-0 border border-slate-400">
        <div className="border-r border-slate-400">
          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 border-b border-slate-400">Expenditure</p>
          {expRows.map((l, i) => <PrintRow key={i} item={l} />)}
          {ie.isSurplus && (
            <PrintRow item={{ code: "", name: "To Surplus carried to Capital Fund", amount: ie.surplusOrDeficit }} bold />
          )}
          <div className="px-2 py-1.5 border-t-2 border-slate-700 bg-slate-100 flex items-center justify-between font-bold">
            <span className="text-[10px] uppercase tracking-wider">Total</span>
            <span className="font-mono tabular-nums">{ie.isSurplus
              ? (parseFloat(ie.totalExpense) + parseFloat(ie.surplusOrDeficit)).toFixed(2)
              : ie.totalExpense}</span>
          </div>
        </div>
        <div>
          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 border-b border-slate-400">Income</p>
          {incRows.map((l, i) => <PrintRow key={i} item={l} />)}
          {!ie.isSurplus && parseFloat(ie.surplusOrDeficit) > 0 && (
            <PrintRow item={{ code: "", name: "By Deficit transferred from Capital Fund", amount: ie.surplusOrDeficit }} bold />
          )}
          <div className="px-2 py-1.5 border-t-2 border-slate-700 bg-slate-100 flex items-center justify-between font-bold">
            <span className="text-[10px] uppercase tracking-wider">Total</span>
            <span className="font-mono tabular-nums">{!ie.isSurplus
              ? (parseFloat(ie.totalIncome) + parseFloat(ie.surplusOrDeficit)).toFixed(2)
              : ie.totalIncome}</span>
          </div>
        </div>
      </div>
    </ReportPrintShell>
  )
}

function PrintRow({ item, bold }: { item: { code: string; name: string; amount: string } | null; bold?: boolean }) {
  if (!item) return <div className="px-2 py-1 text-sm border-b border-slate-200 h-7">&nbsp;</div>
  return (
    <div className={"px-2 py-1 flex items-center justify-between text-sm border-b border-slate-200 " + (bold ? "font-bold" : "")}>
      <span>
        {item.code && <span className="font-mono text-xs text-slate-500 mr-2">{item.code}</span>}
        {item.name}
      </span>
      <span className="font-mono tabular-nums">{item.amount}</span>
    </div>
  )
}
