import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Printer, Scale, ArrowDownRight, ArrowUpRight, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { prisma } from "@/lib/prisma"
import { getTrialBalance } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS, todayBS } from "@/lib/nepali-date"
import { ReportExportButton } from "@/components/accounting/report-export-button"
import { ReportKpi, BalancedBadge } from "@/components/accounting/report-shell"
import { TrialBalanceClient } from "./trial-balance-client"

export const metadata: Metadata = { title: "Trial Balance" }

export default async function TrialBalancePage({
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
  if (!fyId) redirect("/accounting/setup")

  const tb = await getTrialBalance(fyId, sp.asOf)
  const activeFy = fys.find(f => f.id === fyId)

  const totalDr = parseFloat(tb.totalDebit)  || 0
  const totalCr = parseFloat(tb.totalCredit) || 0
  const diff = Math.abs(totalDr - totalCr)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Trial Balance</h1>
            {activeFy && (
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-slate-200">
                FY {activeFy.name}
              </Badge>
            )}
            <BalancedBadge balanced={tb.balanced} dr={tb.totalDebit} cr={tb.totalCredit} />
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            <Scale className="w-3 h-3 text-slate-400" />
            <span>As at</span>
            <span className="font-mono">{formatBS(tb.asOfBS)}</span>
            <span className="text-slate-300">·</span>
            <span>{tb.rows.length} account{tb.rows.length === 1 ? "" : "s"} with activity</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportExportButton kind="trial-balance" data={tb} schoolName={school.name} />
          <Link href={`/accounting/reports/trial-balance/print?fy=${fyId}${sp.asOf ? `&asOf=${sp.asOf}` : ""}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter form */}
      <form className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">Fiscal year</label>
          <select name="fy" defaultValue={fyId} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
            {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}{f.isCurrent ? " (current)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">As of (BS)</label>
          <input
            name="asOf"
            type="text"
            defaultValue={sp.asOf ?? ""}
            placeholder={activeFy?.endBS}
            className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 font-mono"
          />
        </div>
        <Button type="submit" className="h-11 cursor-pointer">Apply</Button>
      </form>

      {/* Quick as-of presets */}
      <div className="flex gap-1.5 flex-wrap items-center justify-end">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">As of</span>
        {[
          { label: "Today",    asOf: todayBS() },
          { label: "FY end",   asOf: undefined },
        ].map(p => {
          const isActive = (sp.asOf ?? "") === (p.asOf ?? "")
          const qs = new URLSearchParams({ fy: fyId })
          if (p.asOf) qs.set("asOf", p.asOf)
          return (
            <Link key={p.label} href={`/accounting/reports/trial-balance?${qs.toString()}`}>
              <Badge variant={isActive ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                {p.label}
              </Badge>
            </Link>
          )
        })}
      </div>

      {/* Hero KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total Debit"   value={`Rs. ${tb.totalDebit}`}  subtitle={`${tb.rows.filter(r => parseFloat(r.debit)  > 0).length} accounts`} icon={ArrowDownRight} tone="emerald" />
        <ReportKpi label="Total Credit"  value={`Rs. ${tb.totalCredit}`} subtitle={`${tb.rows.filter(r => parseFloat(r.credit) > 0).length} accounts`} icon={ArrowUpRight}   tone="rose" />
        <ReportKpi label="Accounts"      value={String(tb.rows.length)}  subtitle="With activity in period"                                             icon={ListChecks}     tone="primary" />
        <ReportKpi
          label="Balance Check"
          value={tb.balanced ? "Balanced" : `Off ${diff.toFixed(2)}`}
          subtitle={tb.balanced ? "Σ Dr = Σ Cr" : "Investigate variance before reporting"}
          icon={Scale}
          tone={tb.balanced ? "emerald" : "rose"}
        />
      </div>

      {/* Table (client) */}
      <TrialBalanceClient
        rows={tb.rows}
        totalDebit={tb.totalDebit}
        totalCredit={tb.totalCredit}
        fyId={fyId}
      />
    </div>
  )
}
