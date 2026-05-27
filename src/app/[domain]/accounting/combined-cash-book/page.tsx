import Link from "next/link"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { Printer, Coins, Landmark, ArrowDownRight, ArrowUpRight, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getCombinedCashBook } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS, todayBS } from "@/lib/nepali-date"
import { CashBookClient } from "./cash-book-client"

export const metadata: Metadata = { title: "Cash + Bank Book" }

export default async function CombinedCashBookPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id
  const book = await getCombinedCashBook(fyId!, sp.from, sp.to)
  const activeFy = fys.find(f => f.id === fyId)

  // Derived KPI math
  const cashIn  = parseFloat(book.totalCashReceipts) || 0
  const cashOut = parseFloat(book.totalCashPayments) || 0
  const bankIn  = parseFloat(book.totalBankReceipts) || 0
  const bankOut = parseFloat(book.totalBankPayments) || 0
  const cashOpening = parseFloat(book.openingCash) || 0
  const cashClosing = parseFloat(book.closingCash) || 0
  const bankOpening = parseFloat(book.openingBank) || 0
  const bankClosing = parseFloat(book.closingBank) || 0
  const totalReceipts = cashIn + bankIn
  const totalPayments = cashOut + bankOut
  const netFlow = totalReceipts - totalPayments
  const cashFlowMax = Math.max(cashIn, cashOut, 1)
  const bankFlowMax = Math.max(bankIn, bankOut, 1)

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Cash + Bank Book</h1>
            {activeFy && (
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-sky-50 text-sky-700 border-sky-200">
                FY {activeFy.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">
              DOUBLE-COLUMN
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {formatBS(book.fromBS)} → {formatBS(book.toBS)} · {book.rows.length} entr{book.rows.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/accounting/combined-cash-book/print?fy=${fyId}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
          <Button size="sm" variant="outline" disabled className="cursor-not-allowed gap-1.5 text-xs opacity-50" title="Coming in Phase 3">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* ── Hero KPIs ──────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PositionCard
          label="Cash in Hand"
          icon={Coins}
          tone="emerald"
          opening={book.openingCash}
          closing={book.closingCash}
          movement={cashClosing - cashOpening}
        />
        <PositionCard
          label="Bank Balance"
          icon={Landmark}
          tone="sky"
          opening={book.openingBank}
          closing={book.closingBank}
          movement={bankClosing - bankOpening}
        />
        <FlowKpiCard
          label="Total Receipts"
          icon={ArrowDownRight}
          amount={totalReceipts}
          subtitle={`Cash ${book.totalCashReceipts} · Bank ${book.totalBankReceipts}`}
          tone="emerald"
        />
        <FlowKpiCard
          label="Total Payments"
          icon={ArrowUpRight}
          amount={totalPayments}
          subtitle={`Cash ${book.totalCashPayments} · Bank ${book.totalBankPayments}`}
          tone="rose"
        />
      </div>

      {/* ── Period summary strip (net + flow visual) ───────────── */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <div className="grid md:grid-cols-3 gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">Net Cash + Bank Flow</p>
            <p className={cn("font-mono tabular-nums text-3xl font-black", netFlow >= 0 ? "text-emerald-700" : "text-rose-700")}>
              {netFlow >= 0 ? "+" : ""}Rs. {netFlow.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {netFlow >= 0 ? "Net inflow this period" : "Net outflow this period"}
            </p>
          </div>
          <FlowBar
            label="Cash"
            inAmount={cashIn}
            outAmount={cashOut}
            max={cashFlowMax}
            tone="emerald"
          />
          <FlowBar
            label="Bank"
            inAmount={bankIn}
            outAmount={bankOut}
            max={bankFlowMax}
            tone="sky"
          />
        </div>
      </div>

      {/* ── Filter strip ───────────────────────────────────────── */}
      <form className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-4 grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">Fiscal year</label>
          <select name="fy" defaultValue={fyId} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
            {fys.map(f => (
              <option key={f.id} value={f.id}>FY {f.name}{f.isCurrent ? " (current)" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">From (BS)</label>
          <input
            name="from"
            type="text"
            defaultValue={sp.from ?? ""}
            placeholder={book.fromBS}
            className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">To (BS)</label>
          <input
            name="to"
            type="text"
            defaultValue={sp.to ?? ""}
            placeholder={book.toBS}
            className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 font-mono"
          />
        </div>
        <Button type="submit" className="h-11 cursor-pointer">Apply</Button>
      </form>

      {/* ── Quick date presets ──────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Quick range</span>
        {[
          { label: "Today",    from: todayBS(), to: todayBS() },
          { label: "FY → today", from: activeFy?.startBS,         to: todayBS() },
          { label: "Full FY",  from: undefined, to: undefined },
        ].map(p => {
          const isActive =
            (sp.from ?? "") === (p.from ?? "") &&
            (sp.to   ?? "") === (p.to   ?? "")
          const qs = new URLSearchParams({ fy: fyId! })
          if (p.from) qs.set("from", p.from)
          if (p.to)   qs.set("to",   p.to)
          return (
            <Link key={p.label} href={`/accounting/combined-cash-book?${qs.toString()}`}>
              <Badge variant={isActive ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                {p.label}
              </Badge>
            </Link>
          )
        })}
      </div>

      {/* ── Main table (client-interactive, per-account columns) ── */}
      <CashBookClient rows={book.rows} accounts={book.accounts} />
    </div>
  )
}

// ─── KPI helpers (server-side OK; they're pure) ──────────────────────────────

function PositionCard({
  label, icon: Icon, tone, opening, closing, movement,
}: {
  label: string
  icon: React.ElementType
  tone: "emerald" | "sky"
  opening: string
  closing: string
  movement: number
}) {
  const palette = tone === "emerald"
    ? { ring: "border-emerald-500/20", grad: "from-emerald-50", chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600" }
    : { ring: "border-sky-500/20",     grad: "from-sky-50",     chip: "bg-sky-500/10 text-sky-700",         icon: "text-sky-600" }
  const positive = movement >= 0
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
        <span className="text-slate-500">
          Opened at <span className="font-mono">{opening}</span>
        </span>
        <span className={cn("font-mono font-bold inline-flex items-center gap-0.5", positive ? "text-emerald-700" : "text-rose-700")}>
          {positive ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {positive ? "+" : ""}{movement.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

function FlowKpiCard({
  label, icon: Icon, amount, subtitle, tone,
}: {
  label: string
  icon: React.ElementType
  amount: number
  subtitle: string
  tone: "emerald" | "rose"
}) {
  const palette = tone === "emerald"
    ? { ring: "border-emerald-500/20", grad: "from-emerald-50", chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600" }
    : { ring: "border-rose-500/20",    grad: "from-rose-50",    chip: "bg-rose-500/10 text-rose-700",       icon: "text-rose-600" }
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <Icon className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className="font-mono tabular-nums text-2xl font-black tracking-tight">Rs. {amount.toFixed(2)}</p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>
    </div>
  )
}

function FlowBar({
  label, inAmount, outAmount, max, tone,
}: {
  label: string
  inAmount: number
  outAmount: number
  max: number
  tone: "emerald" | "sky"
}) {
  const inPct  = (inAmount  / max) * 100
  const outPct = (outAmount / max) * 100
  const inBar  = tone === "emerald" ? "bg-emerald-500" : "bg-sky-500"
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label} flow</p>
      <div>
        <div className="flex items-center justify-between mb-1 text-[11px]">
          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
            <ArrowDownRight className="w-3 h-3" /> In
          </span>
          <span className="font-mono tabular-nums text-slate-700">{inAmount.toFixed(2)}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-700", inBar)} style={{ width: `${inPct}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1 text-[11px]">
          <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
            <ArrowUpRight className="w-3 h-3" /> Out
          </span>
          <span className="font-mono tabular-nums text-slate-700">{outAmount.toFixed(2)}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-rose-500 transition-all duration-700" style={{ width: `${outPct}%` }} />
        </div>
      </div>
    </div>
  )
}
