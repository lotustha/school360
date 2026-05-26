import Link from "next/link"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import {
  CalendarDays, ChevronLeft, ChevronRight, FileText, ArrowDownRight, ArrowUpRight,
  CheckCircle2, AlertTriangle, ReceiptText, Banknote, ArrowLeftRight, NotebookPen,
  Printer, FileSpreadsheet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getDayBook } from "@/actions/accounting/reports"
import { getCurrentFiscalYear, listFiscalYears } from "@/actions/accounting/fiscal-years"
import { todayBS, formatBS, toAD, toBS } from "@/lib/nepali-date"
import { DayBookFilter } from "./day-book-filter"
import { DayBookClient } from "./day-book-client"
import { DayBookExportButtons } from "./day-book-export"

export const metadata: Metadata = { title: "Day Book" }

const TYPE_ICON: Record<string, React.ElementType> = {
  RV: ReceiptText, PV: Banknote, CV: ArrowLeftRight, JV: NotebookPen, BL: FileSpreadsheet,
}
const TYPE_TONE: Record<string, string> = {
  RV: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PV: "bg-rose-50    text-rose-700    border-rose-200",
  CV: "bg-sky-50     text-sky-700     border-sky-200",
  JV: "bg-violet-50  text-violet-700  border-violet-200",
  BL: "bg-amber-50   text-amber-700   border-amber-200",
}
const TYPE_LABEL: Record<string, string> = {
  RV: "Receipt", PV: "Payment", CV: "Contra", JV: "Journal", BL: "Bill",
}

function shiftDayBS(bsStr: string, deltaDays: number): string {
  const ad = toAD(bsStr)
  const next = new Date(ad.getTime() + deltaDays * 86400000)
  return toBS(next)
}

export default async function DayBookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; fy?: string }>
}) {
  const sp = await searchParams
  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")

  const fyId   = sp.fy   ?? current?.id ?? fys[0]?.id!
  const dateBS = sp.date ?? todayBS()
  const today  = todayBS()
  const prevBS = shiftDayBS(dateBS, -1)
  const nextBS = shiftDayBS(dateBS, +1)

  const entries = await getDayBook(fyId!, dateBS)
  const activeFy = fys.find(f => f.id === fyId)

  // Aggregate metrics
  const totalDr = entries.reduce((a, e) => a + (parseFloat(e.totalDebit)  || 0), 0)
  const totalCr = entries.reduce((a, e) => a + (parseFloat(e.totalCredit) || 0), 0)
  const balanced = Math.abs(totalDr - totalCr) < 0.005
  const reversedCount = entries.filter(e => e.status === "REVERSED").length

  const byType = ["RV", "PV", "CV", "JV", "BL"].map(t => {
    const items = entries.filter(e => e.voucherType === t)
    const total = items.reduce((a, e) => a + (parseFloat(e.totalDebit) || 0), 0)
    return { type: t, count: items.length, total }
  })

  function qs(date: string) {
    return new URLSearchParams({ fy: fyId, date }).toString()
  }

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Day Book</h1>
            {activeFy && (
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-slate-200">
                FY {activeFy.name}
              </Badge>
            )}
            {dateBS === today && (
              <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                TODAY
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            <CalendarDays className="w-3 h-3 text-slate-400" />
            <span className="font-mono">{formatBS(dateBS)}</span>
            <span className="text-slate-300">·</span>
            <span>{entries.length} voucher{entries.length === 1 ? "" : "s"}</span>
            {reversedCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-amber-700">{reversedCount} reversed</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DayBookExportButtons entries={entries} dateBS={dateBS} />
        </div>
      </div>

      {/* ── Date navigator ─────────────────────────────────────── */}
      <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <Link href={`/accounting/day-book?${qs(prevBS)}`}>
          <Button size="sm" variant="outline" className="cursor-pointer gap-1 text-xs">
            <ChevronLeft className="w-3.5 h-3.5" /> {formatBS(prevBS)}
          </Button>
        </Link>
        <div className="flex-1 min-w-[200px] flex items-center justify-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Viewing</span>
          <span className="font-mono font-bold text-sm tabular-nums">{formatBS(dateBS)}</span>
        </div>
        <Link href={`/accounting/day-book?${qs(nextBS)}`}>
          <Button size="sm" variant="outline" className="cursor-pointer gap-1 text-xs">
            {formatBS(nextBS)} <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
        {dateBS !== today && (
          <Link href={`/accounting/day-book?${qs(today)}`}>
            <Badge variant="outline" className="cursor-pointer text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200 ml-1">
              Jump to today
            </Badge>
          </Link>
        )}
        <div className="ml-auto">
          <DayBookFilter
            initialFyId={fyId!}
            initialDateBS={dateBS}
            fiscalYears={fys.map(f => ({ id: f.id, name: f.name, isCurrent: f.isCurrent }))}
          />
        </div>
      </div>

      {/* ── Hero KPIs ──────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Vouchers"
          value={String(entries.length)}
          subtitle={reversedCount > 0 ? `${reversedCount} reversed` : "All posted clean"}
          icon={FileText}
          tone="primary"
        />
        <Kpi
          label="Total Debit"
          value={`Rs. ${totalDr.toFixed(2)}`}
          subtitle="Sum of all Dr lines"
          icon={ArrowDownRight}
          tone="emerald"
        />
        <Kpi
          label="Total Credit"
          value={`Rs. ${totalCr.toFixed(2)}`}
          subtitle="Sum of all Cr lines"
          icon={ArrowUpRight}
          tone="rose"
        />
        <BalanceKpi balanced={balanced} dr={totalDr} cr={totalCr} hasEntries={entries.length > 0} />
      </div>

      {/* ── Voucher mix strip ──────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-3">Voucher Mix</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {byType.map(t => {
              const Icon = TYPE_ICON[t.type] ?? ReceiptText
              const tone = TYPE_TONE[t.type] ?? TYPE_TONE.JV
              return (
                <div key={t.type} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white/60">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center border flex-shrink-0", tone)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{TYPE_LABEL[t.type]}</p>
                    <p className="text-[10px] text-slate-400">{t.count} voucher{t.count === 1 ? "" : "s"}</p>
                  </div>
                  <p className="font-mono tabular-nums text-sm font-black text-slate-700">
                    {t.count > 0 ? `Rs. ${t.total.toFixed(2)}` : "—"}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Vouchers list ──────────────────────────────────────── */}
      <DayBookClient entries={entries} />
    </div>
  )
}

// ─── KPI helpers ─────────────────────────────────────────────────────────────

function Kpi({
  label, value, subtitle, icon: Icon, tone,
}: {
  label: string
  value: string
  subtitle: string
  icon: React.ElementType
  tone: "primary" | "emerald" | "rose"
}) {
  const palette = {
    primary: { ring: "border-primary/20",     grad: "from-primary/5",  chip: "bg-primary/10 text-primary",         icon: "text-primary" },
    emerald: { ring: "border-emerald-500/20", grad: "from-emerald-50", chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600" },
    rose:    { ring: "border-rose-500/20",    grad: "from-rose-50",    chip: "bg-rose-500/10 text-rose-700",       icon: "text-rose-600" },
  }[tone]
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <Icon className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className="font-mono tabular-nums text-2xl font-black tracking-tight">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>
    </div>
  )
}

function BalanceKpi({ balanced, dr, cr, hasEntries }: { balanced: boolean; dr: number; cr: number; hasEntries: boolean }) {
  if (!hasEntries) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-white/0 rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Day Balance</p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-500/10">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
        </div>
        <p className="font-bold text-2xl tracking-tight text-slate-500">—</p>
        <p className="text-[11px] text-slate-500 mt-1">No activity</p>
      </div>
    )
  }
  const palette = balanced
    ? { ring: "border-emerald-500/20", grad: "from-emerald-50",  chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600", value: "text-emerald-700" }
    : { ring: "border-rose-500/20",    grad: "from-rose-50",     chip: "bg-rose-500/10 text-rose-700",       icon: "text-rose-600",    value: "text-rose-700" }
  const diff = Math.abs(dr - cr).toFixed(2)
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Day Balance</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          {balanced ? <CheckCircle2 className={cn("w-4 h-4", palette.icon)} /> : <AlertTriangle className={cn("w-4 h-4", palette.icon)} />}
        </div>
      </div>
      <p className={cn("font-black text-2xl tracking-tight", palette.value)}>
        {balanced ? "Balanced" : `Off by ${diff}`}
      </p>
      <p className="text-[11px] text-slate-500 mt-1">
        {balanced ? "Σ Dr = Σ Cr" : "Dr and Cr don't match"}
      </p>
    </div>
  )
}
