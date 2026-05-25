import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import {
  Printer, FileBarChart, Wallet, Building, Banknote, Sparkles, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { prisma } from "@/lib/prisma"
import { getBalanceSheet } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS, todayBS } from "@/lib/nepali-date"
import { ReportExportButton } from "@/components/accounting/report-export-button"
import { ReportKpi, BalancedBadge } from "@/components/accounting/report-shell"

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
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id!
  const activeFy = fys.find(f => f.id === fyId)

  const bs = await getBalanceSheet(fyId, sp.asOf)

  const totalAssets = parseFloat(bs.totalAssets) || 0
  const totalLiab   = bs.liabilities.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)
  const totalEquity = bs.equity.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)
  const surplus     = parseFloat(bs.currentYearSurplus) || 0
  const capitalFund = totalEquity + (bs.isSurplus ? surplus : -surplus)
  const equityRatio = totalAssets > 0 ? (capitalFund / totalAssets) * 100 : 0
  const debtRatio   = totalAssets > 0 ? (totalLiab   / totalAssets) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Balance Sheet</h1>
            {activeFy && (
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-slate-200">
                FY {activeFy.name}
              </Badge>
            )}
            <BalancedBadge balanced={bs.balanced} dr={bs.totalAssets} cr={bs.totalLiabilitiesAndEquity} />
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            <FileBarChart className="w-3 h-3 text-slate-400" />
            <span>As at</span>
            <span className="font-mono">{formatBS(bs.asOfBS)}</span>
            <span className="text-slate-300">·</span>
            <span>{bs.assets.length} assets · {bs.liabilities.length} liabilities · {bs.equity.length} capital heads</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportExportButton kind="balance-sheet" data={bs} schoolName={school.name} />
          <Link href={`/accounting/reports/balance-sheet/print?fy=${fyId}${sp.asOf ? `&asOf=${sp.asOf}` : ""}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter */}
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

      {/* Quick presets */}
      <div className="flex gap-1.5 flex-wrap items-center justify-end">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">As of</span>
        {[{ label: "Today", asOf: todayBS() }, { label: "FY end", asOf: undefined }].map(p => {
          const isActive = (sp.asOf ?? "") === (p.asOf ?? "")
          const qs = new URLSearchParams({ fy: fyId })
          if (p.asOf) qs.set("asOf", p.asOf)
          return (
            <Link key={p.label} href={`/accounting/reports/balance-sheet?${qs.toString()}`}>
              <Badge variant={isActive ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">{p.label}</Badge>
            </Link>
          )
        })}
      </div>

      {/* Hero KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total Assets"      value={`Rs. ${bs.totalAssets}`}              subtitle={`${bs.assets.length} asset heads`}       icon={Wallet}    tone="emerald" />
        <ReportKpi label="Total Liabilities" value={`Rs. ${totalLiab.toFixed(2)}`}        subtitle={totalAssets > 0 ? `${debtRatio.toFixed(1)}% of assets` : "—"} icon={Banknote}  tone="rose"    progress={Math.min(100, debtRatio)} />
        <ReportKpi label="Capital Fund"      value={`Rs. ${capitalFund.toFixed(2)}`}      subtitle={totalAssets > 0 ? `${equityRatio.toFixed(1)}% of assets` : "—"} icon={Building}  tone="violet"  progress={Math.min(100, equityRatio)} />
        <ReportKpi
          label={surplus === 0 ? "Net Result" : bs.isSurplus ? "Year Surplus" : "Year Deficit"}
          value={`Rs. ${bs.currentYearSurplus}`}
          subtitle={surplus === 0 ? "Break-even" : bs.isSurplus ? "Added to Capital Fund" : "Reduced from Capital Fund"}
          icon={bs.isSurplus ? Sparkles : surplus > 0 ? AlertTriangle : Sparkles}
          tone={surplus === 0 ? "slate" : bs.isSurplus ? "primary" : "amber"}
        />
      </div>

      {/* Composition strip */}
      {totalAssets > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 grid md:grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-3">Liabilities + Capital composition</p>
            <div className="space-y-2.5">
              <CompBar label="Liabilities" amount={totalLiab}   total={totalAssets} tone="rose" />
              <CompBar label="Capital Fund" amount={capitalFund} total={totalAssets} tone="violet" />
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-3">Solvency at a glance</p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              For every Rs 1 of assets, the school is funded by{" "}
              <strong className="text-violet-700">Rs {(equityRatio / 100).toFixed(2)}</strong> of own capital and{" "}
              <strong className="text-rose-700">Rs {(debtRatio / 100).toFixed(2)}</strong> of liabilities.{" "}
              {equityRatio >= 70 ? "Healthy equity cushion." : equityRatio >= 40 ? "Moderate leverage." : "High leverage — investigate."}
            </p>
            <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="bg-violet-500 transition-all duration-700" style={{ width: `${Math.min(100, equityRatio)}%` }} />
              <div className="bg-rose-500   transition-all duration-700" style={{ width: `${Math.min(100, debtRatio)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* T-account body */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Liabilities + Capital Fund */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-rose-50/40 border-b border-slate-200">
              Liabilities &amp; Capital Fund
            </p>

            {bs.liabilities.length > 0 && (
              <>
                <SectionHeader title="Liabilities" />
                {bs.liabilities.map((l, i) => <Row key={i} code={l.code} name={l.name} amount={l.amount} tone="rose" />)}
                <SubtotalRow label="Subtotal — Liabilities" amount={totalLiab.toFixed(2)} tone="rose" />
              </>
            )}

            {(bs.equity.length > 0 || surplus > 0) && (
              <>
                <SectionHeader title="Capital Fund" />
                {bs.equity.map((l, i) => <Row key={i} code={l.code} name={l.name} amount={l.amount} tone="violet" />)}
                {surplus > 0 && (
                  <Row
                    code=""
                    name={bs.isSurplus ? "Add: Current year surplus" : "Less: Current year deficit"}
                    amount={bs.isSurplus ? bs.currentYearSurplus : `(${bs.currentYearSurplus})`}
                    tone="violet"
                  />
                )}
                <SubtotalRow label="Subtotal — Capital Fund" amount={capitalFund.toFixed(2)} tone="violet" />
              </>
            )}

            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total Liabilities &amp; Capital Fund</span>
              <span className="font-mono tabular-nums text-sm">Rs. {bs.totalLiabilitiesAndEquity}</span>
            </div>
          </div>

          {/* Assets */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-emerald-50/40 border-b border-slate-200">
              Assets
            </p>
            {bs.assets.map((l, i) => <Row key={i} code={l.code} name={l.name} amount={l.amount} tone="emerald" />)}
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total Assets</span>
              <span className="font-mono tabular-nums text-sm">Rs. {bs.totalAssets}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-2.5 border-t border-slate-100/80 bg-slate-50/40 text-[11px] text-slate-500">
          The Balance Sheet must balance: Assets = Liabilities + Capital Fund. A green &ldquo;Balanced&rdquo; badge means the books are internally consistent.
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-50/30 uppercase tracking-widest">{title}</p>
  )
}

function SubtotalRow({ label, amount, tone }: { label: string; amount: string; tone: "rose" | "violet" }) {
  return (
    <div className={cn(
      "px-5 py-1.5 flex items-center justify-between text-xs font-bold border-b border-slate-200",
      tone === "rose"   ? "bg-rose-50/30 text-rose-700"
                        : "bg-violet-50/30 text-violet-700",
    )}>
      <span className="uppercase tracking-widest text-[10px]">{label}</span>
      <span className="font-mono tabular-nums">Rs. {amount}</span>
    </div>
  )
}

function Row({ code, name, amount, tone }: { code: string; name: string; amount: string; tone: "emerald" | "rose" | "violet" }) {
  const palette = {
    emerald: "text-emerald-700",
    rose:    "text-rose-700",
    violet:  "text-violet-700",
  }[tone]
  return (
    <div className="px-5 py-2 flex items-center justify-between text-sm border-b border-slate-100 hover:bg-primary/4">
      <span className="min-w-0 flex-1 truncate">
        {code && <span className="font-mono text-xs text-slate-400 mr-2">{code}</span>}
        {name}
      </span>
      <span className={cn("font-mono tabular-nums ml-2", palette)}>{amount}</span>
    </div>
  )
}

function CompBar({ label, amount, total, tone }: { label: string; amount: number; total: number; tone: "rose" | "violet" }) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  const bar = tone === "rose" ? "bg-rose-500" : "bg-violet-500"
  const text = tone === "rose" ? "text-rose-700" : "text-violet-700"
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-[11px]">
        <span className={cn("font-bold", text)}>{label}</span>
        <span className="font-mono tabular-nums text-slate-700">Rs. {amount.toFixed(2)} <span className="text-slate-400">({pct.toFixed(1)}%)</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-700", bar)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}
