import Link from "next/link"
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { getIncomeExpenditure } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"
import { ReportExportButton } from "@/components/accounting/report-export-button"

export const metadata: Metadata = { title: "Income & Expenditure" }

export default async function IncomeExpenditurePage({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; asOf?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { name: true } })
  if (!school) notFound()

  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id

  const ie = await getIncomeExpenditure(fyId!, sp.asOf)

  // Pad both sides so they have equal row count visually
  const maxLen = Math.max(ie.income.length, ie.expense.length)
  const expRows = [...ie.expense, ...Array.from({ length: maxLen - ie.expense.length }, () => null)]
  const incRows = [...ie.income,  ...Array.from({ length: maxLen - ie.income.length },  () => null)]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Income &amp; Expenditure Account</h1>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2 text-xs">
            <select name="fy" defaultValue={fyId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
              {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
            </select>
            <button type="submit" className="h-9 px-3 bg-primary text-white rounded-md font-bold cursor-pointer">Apply</button>
          </form>
          <ReportExportButton kind="income-expenditure" data={ie} schoolName={school.name} />
          <Link href={`/accounting/reports/income-expenditure/print?fy=${fyId}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60">
          <p className="text-sm">For the period ended <strong className="font-mono">{formatBS(ie.asOfBS)}</strong></p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* EXPENDITURE (Dr — left) */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50/60 border-b border-slate-200">Expenditure</p>
            {expRows.map((l, i) => (
              <Row key={i} item={l} />
            ))}
            {ie.isSurplus && (
              <Row item={{ code: "", name: "To Surplus carried to Capital Fund", amount: ie.surplusOrDeficit }} bold />
            )}
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total</span>
              <span className="font-mono tabular-nums text-sm">Rs. {ie.isSurplus
                ? (parseFloat(ie.totalExpense) + parseFloat(ie.surplusOrDeficit)).toFixed(2)
                : ie.totalExpense}</span>
            </div>
          </div>

          {/* INCOME (Cr — right) */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50/60 border-b border-slate-200">Income</p>
            {incRows.map((l, i) => (
              <Row key={i} item={l} />
            ))}
            {!ie.isSurplus && parseFloat(ie.surplusOrDeficit) > 0 && (
              <Row item={{ code: "", name: "By Deficit transferred from Capital Fund", amount: ie.surplusOrDeficit }} bold />
            )}
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total</span>
              <span className="font-mono tabular-nums text-sm">Rs. {!ie.isSurplus
                ? (parseFloat(ie.totalIncome) + parseFloat(ie.surplusOrDeficit)).toFixed(2)
                : ie.totalIncome}</span>
            </div>
          </div>
        </div>

        <div className={cn(
          "px-5 py-3 text-center text-sm font-bold border-t border-slate-200",
          ie.isSurplus ? "text-emerald-700 bg-emerald-50/60" : "text-rose-700 bg-rose-50/60",
        )}>
          {parseFloat(ie.surplusOrDeficit) === 0
            ? "No surplus or deficit"
            : `${ie.isSurplus ? "Surplus" : "Deficit"} for the period: Rs. ${ie.surplusOrDeficit}`}
        </div>
      </div>
    </div>
  )
}

function Row({ item, bold }: { item: { code: string; name: string; amount: string } | null; bold?: boolean }) {
  if (!item) return <div className="px-5 py-2 text-sm border-b border-slate-100 h-9">&nbsp;</div>
  return (
    <div className={cn("px-5 py-2 flex items-center justify-between text-sm border-b border-slate-100 hover:bg-primary/4", bold && "font-bold")}>
      <span>
        {item.code && <span className="font-mono text-xs text-slate-400 mr-2">{item.code}</span>}
        {item.name}
      </span>
      <span className="font-mono tabular-nums">{item.amount}</span>
    </div>
  )
}
