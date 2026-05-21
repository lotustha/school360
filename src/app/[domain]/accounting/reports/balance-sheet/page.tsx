import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, XCircle, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { getBalanceSheet } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"
import { ReportExportButton } from "@/components/accounting/report-export-button"

export const metadata: Metadata = { title: "Balance Sheet" }

export default async function BalanceSheetPage({
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

  const bs = await getBalanceSheet(fyId!, sp.asOf)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Balance Sheet</h1>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2 text-xs">
            <select name="fy" defaultValue={fyId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
              {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
            </select>
            <button type="submit" className="h-9 px-3 bg-primary text-white rounded-md font-bold cursor-pointer">Apply</button>
          </form>
          <ReportExportButton kind="balance-sheet" data={bs} schoolName={school.name} />
          <Link href={`/accounting/reports/balance-sheet/print?fy=${fyId}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm"><span className="font-semibold">As at:</span> <span className="font-mono">{formatBS(bs.asOfBS)}</span></p>
          <span className={cn(
            "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md",
            bs.balanced ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200",
          )}>
            {bs.balanced ? <><CheckCircle2 className="w-3.5 h-3.5" /> Balanced</> : <><XCircle className="w-3.5 h-3.5" /> NOT balanced</>}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* LIABILITIES + CAPITAL FUND (left) */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50/60 border-b border-slate-200">Liabilities &amp; Capital Fund</p>

            {bs.liabilities.length > 0 && (
              <Section title="Liabilities" rows={bs.liabilities} />
            )}

            {(bs.equity.length > 0 || parseFloat(bs.currentYearSurplus) > 0) && (
              <div>
                <p className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-50/30">Capital Fund</p>
                {bs.equity.map((l, i) => (
                  <Row key={i} code={l.code} name={l.name} amount={l.amount} />
                ))}
                {parseFloat(bs.currentYearSurplus) > 0 && (
                  <Row
                    code=""
                    name={bs.isSurplus ? "Add: Current year surplus" : "Less: Current year deficit"}
                    amount={(bs.isSurplus ? "" : "(") + bs.currentYearSurplus + (bs.isSurplus ? "" : ")")}
                  />
                )}
              </div>
            )}

            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total Liabilities &amp; Capital Fund</span>
              <span className="font-mono tabular-nums text-sm">Rs. {bs.totalLiabilitiesAndEquity}</span>
            </div>
          </div>

          {/* ASSETS (right) */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50/60 border-b border-slate-200">Assets</p>
            <Section title="" rows={bs.assets} />
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total Assets</span>
              <span className="font-mono tabular-nums text-sm">Rs. {bs.totalAssets}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: { code: string; name: string; amount: string }[] }) {
  return (
    <div>
      {title && <p className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-50/30">{title}</p>}
      {rows.map((l, i) => <Row key={i} code={l.code} name={l.name} amount={l.amount} />)}
    </div>
  )
}

function Row({ code, name, amount }: { code: string; name: string; amount: string }) {
  return (
    <div className="px-5 py-2 flex items-center justify-between text-sm border-b border-slate-100 hover:bg-primary/4">
      <span>
        {code && <span className="font-mono text-xs text-slate-400 mr-2">{code}</span>}
        {name}
      </span>
      <span className="font-mono tabular-nums">{amount}</span>
    </div>
  )
}
