"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2, AlertCircle, Printer, Square, CheckSquare } from "lucide-react"
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

  // Diff vs. user-entered statement balance
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank Reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{rec.accountCode}</span> · {rec.accountName}
            {rec.bankName && <span className="text-slate-400 ml-2">{rec.bankName}</span>}
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

      {/* Filters */}
      <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-4 grid sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Bank account</label>
          <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none">
            {banks.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">As of (BS)</label>
          <NepaliDateInput value={asOf} onChange={setAsOf} />
        </div>
        <div className="flex items-end">
          <Button onClick={applyFilters} className="cursor-pointer w-full">Apply</Button>
        </div>
      </div>

      {/* Summary cards + statement balance input */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm p-5 space-y-3">
          <p className="text-xs font-bold text-slate-700">Per Book ({formatBS(asOf)})</p>
          <div className="space-y-1 text-sm">
            <Line label="Book closing balance"            value={rec.bookBalance} />
            <Line label="− Uncleared deposits"            value={rec.unclearedDeposits} color="emerald" />
            <Line label="+ Uncleared withdrawals"         value={rec.unclearedWithdrawals} color="rose" />
            <div className="pt-2 border-t border-slate-200">
              <Line label="= Expected statement balance" value={rec.expectedStatementBalance} bold />
            </div>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm p-5 space-y-3">
          <p className="text-xs font-bold text-slate-700">Per Bank Statement</p>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Statement closing balance (from your bank statement)</label>
            <Input
              type="text" inputMode="decimal"
              value={stmtBalance}
              onChange={e => setStmtBalance(e.target.value)}
              placeholder="0.00"
              className="font-mono text-right text-lg"
            />
          </div>
          {stmtBalance && (
            <div className={cn(
              "rounded-lg p-3 flex items-center gap-2",
              reconciled
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-rose-50 border border-rose-200",
            )}>
              {reconciled
                ? <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                : <AlertCircle className="w-5 h-5 text-rose-700 flex-shrink-0" />}
              <div className="text-sm">
                <p className={cn("font-bold", reconciled ? "text-emerald-700" : "text-rose-700")}>
                  {reconciled
                    ? "Reconciled — book matches bank statement"
                    : `Difference: Rs. ${diff.toFixed(2)}`}
                </p>
                {!reconciled && (
                  <p className="text-xs text-rose-700 mt-0.5">
                    {diff > 0
                      ? "Bank statement is higher — bank may have deposits/credits you haven't entered yet."
                      : "Bank statement is lower — bank may have charges/withdrawals you haven't entered yet."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">{selected.size} row{selected.size === 1 ? "" : "s"} selected</span>
        <Button size="sm" variant="outline" onClick={selectAllUncleared} className="cursor-pointer text-xs">Select all uncleared</Button>
        <Button size="sm" variant="outline" onClick={clearSelection} className="cursor-pointer text-xs">Clear</Button>
        <div className="flex-1" />
        <Button size="sm" disabled={pending || selected.size === 0} className="cursor-pointer gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => bulkToggle(true)}>
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
          Mark Cleared
        </Button>
        <Button size="sm" variant="outline" disabled={pending || selected.size === 0} className="cursor-pointer gap-1.5" onClick={() => bulkToggle(false)}>
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
          Mark Uncleared
        </Button>
      </div>

      {/* Entries */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-3 py-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={rec.rows.length > 0 && selected.size === rec.rows.length}
                  onChange={e => {
                    if (e.target.checked) setSelected(new Set(rec.rows.map(r => r.id)))
                    else clearSelection()
                  }}
                />
              </th>
              <th className="px-3 py-3 text-left w-28">Date (BS)</th>
              <th className="px-3 py-3 text-left w-32">Voucher</th>
              <th className="px-3 py-3 text-left">Narration</th>
              <th className="px-3 py-3 text-right w-28">Deposit (Dr)</th>
              <th className="px-3 py-3 text-right w-28">Withdrawal (Cr)</th>
              <th className="px-3 py-3 text-center w-24">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {rec.rows.map(r => (
              <tr key={r.id} className={cn("hover:bg-primary/4 cursor-pointer", r.cleared && "bg-emerald-50/30")} onClick={() => toggleOne(r.id)}>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} onClick={e => e.stopPropagation()} />
                </td>
                <td className="px-3 py-2 text-xs">{formatBS(r.dateBS)}</td>
                <td className="px-3 py-2 text-xs">
                  <Link href={`/accounting/vouchers/${r.voucherId}`} className="font-mono font-bold text-primary hover:underline" onClick={e => e.stopPropagation()}>
                    {r.voucherNumber ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{r.narration}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700">{parseFloat(r.debit) > 0 ? r.debit : ""}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700">{parseFloat(r.credit) > 0 ? r.credit : ""}</td>
                <td className="px-3 py-2 text-center">
                  {r.cleared
                    ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">Cleared</Badge>
                    : <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-bold">Pending</Badge>}
                </td>
              </tr>
            ))}
            {rec.rows.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">No bank entries up to this date.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Line({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: "emerald" | "rose" }) {
  return (
    <div className={cn("flex items-center justify-between", bold && "font-bold text-base")}>
      <span className={cn("text-slate-600", bold && "text-slate-900")}>{label}</span>
      <span className={cn(
        "font-mono tabular-nums",
        color === "emerald" && "text-emerald-700",
        color === "rose"    && "text-rose-700",
      )}>Rs. {value}</span>
    </div>
  )
}
