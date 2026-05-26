import Link from "next/link"
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import {
  Printer, ArrowLeftRight, ArrowDownRight, ArrowUpRight, Coins, Landmark,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { prisma } from "@/lib/prisma"
import { getReceiptsPayments } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS, todayBS } from "@/lib/nepali-date"
import { ReportExportButton } from "@/components/accounting/report-export-button"
import { ReportDateField } from "@/components/accounting/report-date-field"
import { FyBadge } from "@/components/accounting/fy-badge"
import { ReportKpi, BalancedBadge } from "@/components/accounting/report-shell"

export const metadata: Metadata = { title: "Receipts & Payments" }

export default async function ReceiptsPaymentsPage({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; from?: string; to?: string }>
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

  const rp = await getReceiptsPayments(fyId, sp.from, sp.to)
  const balanced = Math.abs(parseFloat(rp.totalReceiptsSide) - parseFloat(rp.totalPaymentsSide)) < 0.005

  const openCash  = parseFloat(rp.openingCash)  || 0
  const openBank  = parseFloat(rp.openingBank)  || 0
  const closeCash = parseFloat(rp.closingCash)  || 0
  const closeBank = parseFloat(rp.closingBank)  || 0
  const periodReceipts = rp.receipts.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)
  const periodPayments = rp.payments.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)
  const cashDelta = closeCash - openCash
  const bankDelta = closeBank - openBank

  const maxLen = Math.max(rp.receipts.length, rp.payments.length)
  const padR = [...rp.receipts, ...Array.from({ length: maxLen - rp.receipts.length }, () => null)]
  const padP = [...rp.payments, ...Array.from({ length: maxLen - rp.payments.length }, () => null)]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Receipts &amp; Payments</h1>
            {activeFy && <FyBadge fyName={activeFy.name} status={activeFy.status} />}
            <BalancedBadge balanced={balanced} dr={rp.totalReceiptsSide} cr={rp.totalPaymentsSide} />
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            <ArrowLeftRight className="w-3 h-3 text-slate-400" />
            <span className="font-mono">{formatBS(rp.fromBS)} → {formatBS(rp.toBS)}</span>
            <span className="text-slate-300">·</span>
            <span>{rp.receipts.length} receipt heads · {rp.payments.length} payment heads</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportExportButton kind="receipts-payments" data={rp} schoolName={school.name} />
          <Link href={`/accounting/reports/receipts-payments/print?fy=${fyId}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter */}
      <form className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-4 grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">Fiscal year</label>
          <select name="fy" defaultValue={fyId} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
            {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}{f.isCurrent ? " (current)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">From (BS)</label>
          <ReportDateField name="from" defaultValue={sp.from ?? ""} placeholder={rp.fromBS} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">To (BS)</label>
          <ReportDateField name="to" defaultValue={sp.to ?? ""} placeholder={rp.toBS} />
        </div>
        <Button type="submit" className="h-11 cursor-pointer">Apply</Button>
      </form>

      {/* Quick range presets */}
      <div className="flex gap-1.5 flex-wrap items-center justify-end">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Quick range</span>
        {[
          { label: "Today",      from: todayBS(),         to: todayBS() },
          { label: "FY → today", from: activeFy?.startBS, to: todayBS() },
          { label: "Full FY",    from: undefined,         to: undefined },
        ].map(p => {
          const isActive = (sp.from ?? "") === (p.from ?? "") && (sp.to ?? "") === (p.to ?? "")
          const qs = new URLSearchParams({ fy: fyId })
          if (p.from) qs.set("from", p.from)
          if (p.to)   qs.set("to",   p.to)
          return (
            <Link key={p.label} href={`/accounting/reports/receipts-payments?${qs.toString()}`}>
              <Badge variant={isActive ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">{p.label}</Badge>
            </Link>
          )
        })}
      </div>

      {/* Hero KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Period Receipts" value={`Rs. ${periodReceipts.toFixed(2)}`} subtitle={`${rp.receipts.length} heads · money in`}  icon={ArrowDownRight} tone="emerald" />
        <ReportKpi label="Period Payments" value={`Rs. ${periodPayments.toFixed(2)}`} subtitle={`${rp.payments.length} heads · money out`} icon={ArrowUpRight}   tone="rose" />
        <PositionChange label="Cash Position" opening={rp.openingCash} closing={rp.closingCash} delta={cashDelta} icon={Coins}    tone="emerald" />
        <PositionChange label="Bank Position" opening={rp.openingBank} closing={rp.closingBank} delta={bankDelta} icon={Landmark} tone="sky" />
      </div>

      {/* T-account body */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Receipts side */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-emerald-50/40 border-b border-slate-200">
              Receipts (Dr)
            </p>
            <Row item={{ code: "", name: "Opening — Cash in Hand", amount: rp.openingCash }} muted icon={Coins} />
            <Row item={{ code: "", name: "Opening — Bank Accounts", amount: rp.openingBank }} muted icon={Landmark} />
            <div className="border-t border-slate-200/80" />
            {padR.map((l, i) => <Row key={i} item={l} tone="emerald" />)}
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total Receipts Side</span>
              <span className="font-mono tabular-nums text-sm">Rs. {rp.totalReceiptsSide}</span>
            </div>
          </div>

          {/* Payments side */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-rose-50/40 border-b border-slate-200">
              Payments (Cr)
            </p>
            {padP.map((l, i) => <Row key={i} item={l} tone="rose" />)}
            <div className="border-t border-slate-200/80" />
            <Row item={{ code: "", name: "Closing — Cash in Hand", amount: rp.closingCash }} muted icon={Coins} />
            <Row item={{ code: "", name: "Closing — Bank Accounts", amount: rp.closingBank }} muted icon={Landmark} />
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total Payments Side</span>
              <span className="font-mono tabular-nums text-sm">Rs. {rp.totalPaymentsSide}</span>
            </div>
          </div>
        </div>

        {/* Footer tip */}
        <div className="px-5 py-2.5 border-t border-slate-100/80 bg-slate-50/40 text-[11px] text-slate-500">
          The Receipts &amp; Payments account is a pure cash-flow statement. Both sides should always equal because every cash movement appears as either an opening, a receipt, a payment, or a closing balance.
        </div>
      </div>
    </div>
  )
}

function PositionChange({
  label, opening, closing, delta, icon: Icon, tone,
}: {
  label: string
  opening: string
  closing: string
  delta:   number
  icon:    React.ElementType
  tone:    "emerald" | "sky"
}) {
  const palette = tone === "emerald"
    ? { ring: "border-emerald-500/20", grad: "from-emerald-50", chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600" }
    : { ring: "border-sky-500/20",     grad: "from-sky-50",     chip: "bg-sky-500/10 text-sky-700",         icon: "text-sky-600" }
  const positive = delta >= 0
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <Icon className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className="font-mono tabular-nums text-2xl font-black tracking-tight">Rs. {closing}</p>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-slate-500">Opened at <span className="font-mono">{opening}</span></span>
        <span className={cn("font-mono font-bold inline-flex items-center gap-0.5", positive ? "text-emerald-700" : "text-rose-700")}>
          {positive ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {positive ? "+" : ""}{delta.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

function Row({
  item, muted, tone, icon: Icon,
}: {
  item: { code: string; name: string; amount: string } | null
  muted?: boolean
  tone?: "emerald" | "rose"
  icon?: React.ElementType
}) {
  if (!item) return <div className="px-5 py-2 text-sm border-b border-slate-100 h-9">&nbsp;</div>
  return (
    <div className={cn(
      "px-5 py-2 flex items-center justify-between text-sm border-b border-slate-100 hover:bg-primary/4",
      muted && "bg-slate-50/40 italic text-slate-600",
    )}>
      <span className="min-w-0 flex-1 truncate inline-flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
        {item.code && <span className="font-mono text-xs text-slate-400">{item.code}</span>}
        <span className="truncate">{item.name}</span>
      </span>
      <span className={cn(
        "font-mono tabular-nums ml-2",
        tone === "emerald" && "text-emerald-700 font-semibold",
        tone === "rose"    && "text-rose-700 font-semibold",
      )}>
        {item.amount}
      </span>
    </div>
  )
}
