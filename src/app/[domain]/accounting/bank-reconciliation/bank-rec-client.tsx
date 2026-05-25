"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2, CheckCircle2, AlertCircle, Printer, Square, CheckSquare,
  Landmark, ArrowDownRight, ArrowUpRight, Hourglass, Equal,
  Search, RotateCcw, Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import {
  toggleClearedEntries, type BankReconciliationResult,
} from "@/actions/accounting/bank-reconciliation"

interface Bank { id: string; code: string; name: string }

type FilterMode = "ALL" | "PENDING" | "CLEARED"

export function BankRecClient({ banks, rec, initialAsOf }: {
  banks: Bank[]
  rec: BankReconciliationResult
  initialAsOf: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [stmtBalance, setStmtBalance] = useState<string>("")
  const [asOf, setAsOf] = useState(initialAsOf)
  const [selectedBank, setSelectedBank] = useState(rec.accountId)
  const [filter, setFilter] = useState<FilterMode>("ALL")
  const [search, setSearch] = useState("")

  // ─── Derived stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = rec.rows.length
    const cleared = rec.rows.filter(r => r.cleared).length
    const pending = total - cleared
    const deposits = rec.rows.reduce((a, r) => a + (parseFloat(r.debit) || 0), 0)
    const withdrawals = rec.rows.reduce((a, r) => a + (parseFloat(r.credit) || 0), 0)
    const depositCount = rec.rows.filter(r => parseFloat(r.debit) > 0).length
    const withdrawalCount = rec.rows.filter(r => parseFloat(r.credit) > 0).length
    const matchPct = total === 0 ? 100 : Math.round((cleared / total) * 100)
    return { total, cleared, pending, deposits, withdrawals, depositCount, withdrawalCount, matchPct }
  }, [rec.rows])

  // ─── Filtered + searched rows ─────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rec.rows.filter(r => {
      if (filter === "CLEARED" && !r.cleared) return false
      if (filter === "PENDING" && r.cleared) return false
      if (!q) return true
      return (
        (r.voucherNumber?.toLowerCase().includes(q) ?? false) ||
        r.narration.toLowerCase().includes(q)
      )
    })
  }, [rec.rows, filter, search])

  // ─── Selection helpers ─────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAllUncleared() {
    setSelected(new Set(rec.rows.filter(r => !r.cleared).map(r => r.id)))
  }
  function selectAllFiltered() {
    setSelected(new Set(filteredRows.map(r => r.id)))
  }
  function clearSelection() { setSelected(new Set()) }

  async function bulkToggle(cleared: boolean) {
    if (selected.size === 0) { toast.error("Select some rows first"); return }
    start(async () => {
      try {
        const res = await toggleClearedEntries({ entryIds: [...selected], cleared })
        toast.success(`${res.updated} row${res.updated === 1 ? "" : "s"} marked ${cleared ? "cleared" : "uncleared"}`)
        clearSelection()
        router.refresh()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  // ─── Statement match calculation ──────────────────────────────
  const stmtNum = parseFloat(stmtBalance || "0") || 0
  const expectedNum = parseFloat(rec.expectedStatementBalance) || 0
  const diff = stmtBalance ? (stmtNum - expectedNum) : 0
  const reconciled = stmtBalance && Math.abs(diff) < 0.005

  function applyFilters() {
    const sp = new URLSearchParams()
    sp.set("account", selectedBank)
    sp.set("asOf", asOf)
    router.push(`/accounting/bank-reconciliation?${sp.toString()}`)
  }

  // ─── Group rows by BS date for visual scanning ───────────────
  const grouped = useMemo(() => {
    const byDate = new Map<string, typeof filteredRows>()
    for (const r of filteredRows) {
      const k = r.dateBS
      const arr = byDate.get(k) ?? []
      arr.push(r)
      byDate.set(k, arr)
    }
    return Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredRows])

  return (
    <div className="space-y-5">
      {/* ── Header strip ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Bank Reconciliation</h1>
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-sky-50 text-sky-700 border-sky-200">
              {rec.accountCode}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
            <Landmark className="w-3 h-3 text-slate-400" />
            {rec.accountName}
            {rec.bankName && <span className="text-slate-400">· {rec.bankName}</span>}
            <span className="text-slate-300">·</span>
            <span className="font-mono">as of {formatBS(rec.asOfBS)}</span>
          </p>
        </div>
        <Link
          href={`/accounting/bank-reconciliation/print?account=${rec.accountId}&asOf=${asOf}${stmtBalance ? `&stmt=${stmtBalance}` : ""}`}
          target="_blank"
        >
          <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Print BRS
          </Button>
        </Link>
      </div>

      {/* ── Hero KPIs ──────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Book Balance"
          value={rec.bookBalance}
          subtitle={`${stats.total} entr${stats.total === 1 ? "y" : "ies"} through ${formatBS(rec.asOfBS)}`}
          tone="primary"
          icon={Landmark}
        />
        <KpiCard
          label="Cleared Balance"
          value={rec.clearedBookBalance}
          subtitle={`${stats.cleared} cleared · ${stats.matchPct}% complete`}
          tone="emerald"
          icon={CheckCircle2}
          progress={stats.matchPct}
        />
        <KpiCard
          label="Pending"
          value={String(stats.pending)}
          subtitle={`Dep Rs. ${stats.deposits.toFixed(2)} · Wd Rs. ${stats.withdrawals.toFixed(2)}`}
          tone={stats.pending > 0 ? "amber" : "slate"}
          icon={Hourglass}
        />
        <KpiCard
          label="Expected Statement"
          value={rec.expectedStatementBalance}
          subtitle="Book ± uncleared adjustments"
          tone="violet"
          icon={Equal}
        />
      </div>

      {/* ── Filter strip ───────────────────────────────────────── */}
      <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">Bank account</label>
          <select
            value={selectedBank}
            onChange={e => setSelectedBank(e.target.value)}
            className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          >
            {banks.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">As of (BS)</label>
          <NepaliDateInput value={asOf} onChange={setAsOf} />
        </div>
        <Button onClick={applyFilters} className="cursor-pointer h-11 gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Apply
        </Button>
      </div>

      {/* ── Reconciliation panel ───────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        {/* Book calc flow */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Book → Statement Bridge</p>
            <Badge variant="outline" className="text-[9px] font-bold">PER BOOK</Badge>
          </div>
          <div className="space-y-3">
            <BridgeRow label="Book closing balance" value={rec.bookBalance} note={`${stats.total} entries through ${formatBS(rec.asOfBS)}`} />
            <BridgeRow
              label="− Uncleared deposits"
              value={rec.unclearedDeposits}
              note={`${stats.depositCount > 0 ? `${rec.rows.filter(r => !r.cleared && parseFloat(r.debit) > 0).length} pending` : "none"}`}
              tone="emerald"
              icon={ArrowDownRight}
            />
            <BridgeRow
              label="+ Uncleared withdrawals"
              value={rec.unclearedWithdrawals}
              note={`${rec.rows.filter(r => !r.cleared && parseFloat(r.credit) > 0).length} pending`}
              tone="rose"
              icon={ArrowUpRight}
            />
            <div className="h-px bg-slate-200 my-1" />
            <BridgeRow label="= Expected statement balance" value={rec.expectedStatementBalance} bold tone="primary" />
          </div>
        </div>

        {/* Statement match */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Match Statement</p>
            <Badge variant="outline" className="text-[9px] font-bold">PER BANK</Badge>
          </div>
          <div className="mb-3">
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              Closing balance from your bank statement
            </label>
            <Input
              type="text" inputMode="decimal"
              value={stmtBalance}
              onChange={e => setStmtBalance(e.target.value)}
              placeholder="0.00"
              className="font-mono text-right text-xl h-14"
            />
          </div>
          {stmtBalance ? (
            <div className={cn(
              "rounded-xl p-4 flex items-start gap-3 border",
              reconciled
                ? "bg-emerald-50 border-emerald-200"
                : "bg-rose-50 border-rose-200",
            )}>
              {reconciled
                ? <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />}
              <div className="text-sm min-w-0 flex-1">
                <p className={cn("font-bold", reconciled ? "text-emerald-800" : "text-rose-800")}>
                  {reconciled
                    ? "Reconciled — book matches bank statement"
                    : `Off by Rs. ${Math.abs(diff).toFixed(2)}`}
                </p>
                {!reconciled && (
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    {diff > 0
                      ? "Bank statement is higher than expected — there may be deposits or credit interest the bank applied that aren't in your books yet."
                      : "Bank statement is lower than expected — there may be charges, fees, or withdrawals the bank applied that aren't in your books yet."}
                  </p>
                )}
                {reconciled && (
                  <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                    Print this reconciliation for your records, or continue clearing future entries.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-4 bg-slate-50/60 border border-slate-200 text-xs text-slate-500">
              Enter your bank statement&apos;s closing balance to verify reconciliation. The system will compare against the expected balance and surface any difference.
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk + filter toolbar ──────────────────────────────── */}
      <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {/* Filter chips */}
        <div className="inline-flex bg-slate-100/60 rounded-lg p-0.5">
          {(["ALL", "PENDING", "CLEARED"] as const).map(f => {
            const count = f === "ALL" ? stats.total : f === "PENDING" ? stats.pending : stats.cleared
            return (
              <button
                key={f}
                type="button"
                onClick={() => { setFilter(f); clearSelection() }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition flex items-center gap-1.5",
                  filter === f ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {f}
                <span className="text-[10px] font-mono tabular-nums text-slate-400">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search voucher / narration…"
            className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="flex-1" />

        {selected.size > 0 && (
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border-primary/20">
            {selected.size} selected
          </Badge>
        )}
        <Button size="sm" variant="outline" onClick={selectAllFiltered} disabled={filteredRows.length === 0} className="cursor-pointer text-xs">
          Select visible
        </Button>
        <Button size="sm" variant="outline" onClick={selectAllUncleared} disabled={stats.pending === 0} className="cursor-pointer text-xs">
          Select all pending
        </Button>
        {selected.size > 0 && (
          <Button size="sm" variant="outline" onClick={clearSelection} className="cursor-pointer text-xs">
            Clear
          </Button>
        )}
        <Button
          size="sm" disabled={pending || selected.size === 0}
          onClick={() => bulkToggle(true)}
          className="cursor-pointer gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
          Clear
        </Button>
        <Button
          size="sm" variant="outline" disabled={pending || selected.size === 0}
          onClick={() => bulkToggle(false)}
          className="cursor-pointer gap-1.5"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
          Uncheck
        </Button>
      </div>

      {/* ── Entries table ──────────────────────────────────────── */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center">
            <Landmark className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600">
              {rec.rows.length === 0 ? "No bank entries up to this date." : "No entries match the current filter."}
            </p>
            {search && (
              <button onClick={() => setSearch("")} className="text-xs text-primary font-bold mt-2 hover:underline cursor-pointer">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-3 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && filteredRows.every(r => selected.has(r.id))}
                    onChange={e => {
                      if (e.target.checked) setSelected(new Set(filteredRows.map(r => r.id)))
                      else clearSelection()
                    }}
                  />
                </th>
                <th className="px-3 py-3 text-left">Voucher</th>
                <th className="px-3 py-3 text-left">Narration</th>
                <th className="px-3 py-3 text-right w-28">Deposit</th>
                <th className="px-3 py-3 text-right w-28">Withdrawal</th>
                <th className="px-3 py-3 text-center w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {grouped.flatMap(([date, rows]) => [
                <tr key={`hdr-${date}`} className="bg-slate-50/40 border-y border-slate-100/80">
                  <td colSpan={6} className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-black text-slate-500">
                    {formatBS(date)}
                  </td>
                </tr>,
                ...rows.map(r => (
                  <tr
                    key={r.id}
                    className={cn(
                      "hover:bg-primary/4 cursor-pointer border-b border-slate-100/60 transition-colors",
                      r.cleared && "bg-emerald-50/30",
                      selected.has(r.id) && "bg-primary/8",
                    )}
                    onClick={() => toggleOne(r.id)}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        onClick={e => e.stopPropagation()}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Link
                        href={`/accounting/vouchers/${r.voucherId}`}
                        className="font-mono font-bold text-primary hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        {r.voucherNumber ?? "—"}
                      </Link>
                      <span className="ml-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{r.voucherType}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">{r.narration}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {parseFloat(r.debit) > 0 ? (
                        <span className="text-emerald-700 font-semibold">{r.debit}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {parseFloat(r.credit) > 0 ? (
                        <span className="text-rose-700 font-semibold">{r.credit}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.cleared ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Cleared
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-bold gap-1">
                          <Hourglass className="w-2.5 h-2.5" /> Pending
                        </Badge>
                      )}
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
            <tfoot className="bg-slate-50/60 border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="px-3 py-2.5 text-right text-xs uppercase tracking-widest font-black text-slate-500">
                  Totals (filtered)
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-black text-emerald-700">
                  {filteredRows.reduce((a, r) => a + (parseFloat(r.debit) || 0), 0).toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-black text-rose-700">
                  {filteredRows.reduce((a, r) => a + (parseFloat(r.credit) || 0), 0).toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Footer tips ─────────────────────────────────────────── */}
      <p className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
        <CheckCircle2 className="w-3 h-3" />
        Click any row to toggle. Use bulk actions to clear multiple at once. Cleared entries persist across sessions.
      </p>
    </div>
  )
}

// ─── Components ──────────────────────────────────────────────────────────────

function KpiCard({
  label, value, subtitle, tone, icon: Icon, progress,
}: {
  label: string
  value: string
  subtitle: string
  tone: "primary" | "emerald" | "amber" | "violet" | "slate"
  icon: React.ElementType
  progress?: number  // 0-100 — when supplied, renders a progress bar
}) {
  const palette = {
    primary: { ring: "border-primary/20",       grad: "from-primary/5",     chip: "bg-primary/10 text-primary",         icon: "text-primary",      bar: "bg-primary" },
    emerald: { ring: "border-emerald-500/20",   grad: "from-emerald-50",    chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600",  bar: "bg-emerald-500" },
    amber:   { ring: "border-amber-500/20",     grad: "from-amber-50",      chip: "bg-amber-500/10 text-amber-700",     icon: "text-amber-600",    bar: "bg-amber-500" },
    violet:  { ring: "border-violet-500/20",    grad: "from-violet-50",     chip: "bg-violet-500/10 text-violet-700",   icon: "text-violet-600",   bar: "bg-violet-500" },
    slate:   { ring: "border-slate-200",        grad: "from-slate-50",      chip: "bg-slate-500/10 text-slate-700",     icon: "text-slate-500",    bar: "bg-slate-400" },
  }[tone]
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <Icon className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className={cn("font-mono tabular-nums text-2xl font-black tracking-tight", tone === "primary" && "text-primary")}>
        {/^\d/.test(value) ? `Rs. ${value}` : value}
      </p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-700", palette.bar)} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </div>
  )
}

function BridgeRow({
  label, value, note, tone, bold, icon: Icon,
}: {
  label: string
  value: string
  note?: string
  tone?: "emerald" | "rose" | "primary"
  bold?: boolean
  icon?: React.ElementType
}) {
  const palette = {
    emerald: "text-emerald-700",
    rose:    "text-rose-700",
    primary: "text-primary",
    none:    "text-slate-900",
  }
  const t = tone ?? "none"
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1 flex items-center gap-2">
        {Icon && (
          <div className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
            t === "emerald" && "bg-emerald-50",
            t === "rose"    && "bg-rose-50",
            t === "primary" && "bg-primary/10",
          )}>
            <Icon className={cn("w-3 h-3", palette[t])} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm truncate", bold ? "font-black text-slate-900" : "text-slate-600")}>{label}</p>
          {note && <p className="text-[10px] text-slate-400 truncate">{note}</p>}
        </div>
      </div>
      <span className={cn(
        "font-mono tabular-nums flex-shrink-0",
        bold ? "text-base font-black" : "text-sm font-semibold",
        palette[t],
      )}>
        Rs. {value}
      </span>
    </div>
  )
}
