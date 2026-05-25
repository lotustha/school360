import Link from "next/link"
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { Printer, Landmark, ArrowDownRight, ArrowUpRight, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { prisma } from "@/lib/prisma"
import { getBankBook, listBankAccounts } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS, todayBS } from "@/lib/nepali-date"
import { ReportExportButton } from "@/components/accounting/report-export-button"
import { BookView } from "@/components/accounting/book-view"

export const metadata: Metadata = { title: "Bank Book" }

export default async function BankBookPage({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; account?: string; from?: string; to?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { name: true } })
  if (!school) notFound()

  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id

  const banks = await listBankAccounts()

  let book
  try {
    book = await getBankBook(fyId!, sp.from, sp.to, sp.account)
  } catch (e) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-amber-200/60 shadow-sm p-8 text-center max-w-2xl">
        <p className="text-sm text-amber-700 font-semibold">{(e as Error).message}</p>
        <p className="text-xs text-muted-foreground mt-2">Add a BANK-subtype account in your Chart of Accounts.</p>
        <Link href="/accounting/bank-accounts">
          <Button size="sm" className="mt-4 cursor-pointer">Open Bank Accounts</Button>
        </Link>
      </div>
    )
  }

  const opening = parseFloat(book.openingBalance) || 0
  const closing = parseFloat(book.closingBalance) || 0
  const receipts = parseFloat(book.totalReceipts) || 0
  const payments = parseFloat(book.totalPayments) || 0
  const movement = closing - opening
  const flowMax = Math.max(receipts, payments, 1)
  const activeFy = fys.find(f => f.id === fyId)

  // Quick links to switch between bank accounts (cards instead of dropdown)
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Bank Book</h1>
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-sky-50 text-sky-700 border-sky-200">
              {book.accountCode}
            </Badge>
            {activeFy && (
              <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">
                FY {activeFy.name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            <Landmark className="w-3 h-3 text-slate-400" />
            {book.accountName}
            <span className="text-slate-300">·</span>
            <span className="font-mono">{formatBS(book.fromBS)} → {formatBS(book.toBS)}</span>
            <span className="text-slate-300">·</span>
            <span>{book.rows.length} entr{book.rows.length === 1 ? "y" : "ies"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/accounting/bank-reconciliation?account=${book.accountId}`}>
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Scale className="w-3.5 h-3.5" /> Reconcile
            </Button>
          </Link>
          <ReportExportButton kind="bank-book" data={book} schoolName={school.name} />
          <Link href={`/accounting/bank-book/print?fy=${fyId}&account=${book.accountId}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      {/* Account switcher (only when there are multiple banks) */}
      {banks.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Account</span>
          {banks.map(b => {
            const isActive = b.id === book.accountId
            const qs = new URLSearchParams({ fy: fyId!, account: b.id })
            if (sp.from) qs.set("from", sp.from)
            if (sp.to)   qs.set("to", sp.to)
            return (
              <Link key={b.id} href={`/accounting/bank-book?${qs.toString()}`}>
                <Badge variant={isActive ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold gap-1 px-2 py-1">
                  <Landmark className="w-3 h-3" />
                  <span className="font-mono">{b.code}</span>
                  <span>·</span>
                  <span>{b.name}</span>
                </Badge>
              </Link>
            )
          })}
        </div>
      )}

      {/* Hero KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PositionKpi
          label="Bank Balance"
          value={book.closingBalance}
          opening={book.openingBalance}
          movement={movement}
          icon={Landmark}
          tone="sky"
        />
        <FlowKpi
          label="Deposits"
          value={book.totalReceipts}
          subtitle={`${book.rows.filter(r => parseFloat(r.receipt) > 0).length} entries · money in`}
          icon={ArrowDownRight}
          tone="emerald"
        />
        <FlowKpi
          label="Withdrawals"
          value={book.totalPayments}
          subtitle={`${book.rows.filter(r => parseFloat(r.payment) > 0).length} entries · money out`}
          icon={ArrowUpRight}
          tone="rose"
        />
        <NetFlowKpi
          receipts={receipts}
          payments={payments}
          max={flowMax}
        />
      </div>

      {/* Filter strip */}
      <form className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-4 grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
        <input type="hidden" name="account" value={book.accountId} />
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

      {/* Quick range presets */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Quick range</span>
        {[
          { label: "Today",      from: todayBS(),         to: todayBS() },
          { label: "FY → today", from: activeFy?.startBS, to: todayBS() },
          { label: "Full FY",    from: undefined,         to: undefined },
        ].map(p => {
          const isActive =
            (sp.from ?? "") === (p.from ?? "") &&
            (sp.to   ?? "") === (p.to   ?? "")
          const qs = new URLSearchParams({ fy: fyId!, account: book.accountId })
          if (p.from) qs.set("from", p.from)
          if (p.to)   qs.set("to",   p.to)
          return (
            <Link key={p.label} href={`/accounting/bank-book?${qs.toString()}`}>
              <Badge variant={isActive ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                {p.label}
              </Badge>
            </Link>
          )
        })}
      </div>

      {/* Main table */}
      <BookView
        rows={book.rows}
        openingBalance={book.openingBalance}
        closingBalance={book.closingBalance}
        totalReceipts={book.totalReceipts}
        totalPayments={book.totalPayments}
        inLabel="Deposit"
        outLabel="Withdrawal"
        emptyText="No bank activity in this period."
      />
    </div>
  )
}

// ─── KPI helpers ─────────────────────────────────────────────────────────────

function PositionKpi({
  label, value, opening, movement, icon: Icon, tone,
}: {
  label: string
  value: string
  opening: string
  movement: number
  icon: React.ElementType
  tone: "emerald" | "sky"
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
      <p className="font-mono tabular-nums text-2xl font-black tracking-tight">Rs. {value}</p>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-slate-500">Opened at <span className="font-mono">{opening}</span></span>
        <span className={cn("font-mono font-bold inline-flex items-center gap-0.5", positive ? "text-emerald-700" : "text-rose-700")}>
          {positive ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {positive ? "+" : ""}{movement.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

function FlowKpi({
  label, value, subtitle, icon: Icon, tone,
}: {
  label: string
  value: string
  subtitle: string
  icon: React.ElementType
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
      <p className="font-mono tabular-nums text-2xl font-black tracking-tight">Rs. {value}</p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>
    </div>
  )
}

function NetFlowKpi({ receipts, payments, max }: { receipts: number; payments: number; max: number }) {
  const net = receipts - payments
  const positive = net >= 0
  const palette = positive
    ? { ring: "border-primary/20",   grad: "from-primary/5",  chip: "bg-primary/10 text-primary",         icon: "text-primary",      value: "text-primary",      label: "Net inflow" }
    : { ring: "border-amber-500/20", grad: "from-amber-50",   chip: "bg-amber-500/10 text-amber-700",     icon: "text-amber-600",    value: "text-amber-700",    label: "Net outflow" }
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{palette.label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          {positive ? <ArrowDownRight className={cn("w-4 h-4", palette.icon)} /> : <ArrowUpRight className={cn("w-4 h-4", palette.icon)} />}
        </div>
      </div>
      <p className={cn("font-mono tabular-nums text-2xl font-black tracking-tight", palette.value)}>
        {positive ? "+" : ""}Rs. {net.toFixed(2)}
      </p>
      <p className="text-[11px] text-slate-500 mt-1">{receipts.toFixed(2)} in · {payments.toFixed(2)} out</p>
      <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(receipts / max) * 100}%` }} />
        <div className="h-full bg-rose-500    transition-all duration-700" style={{ width: `${(payments / max) * 100}%` }} />
      </div>
    </div>
  )
}
