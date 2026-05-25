"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Inbox, ReceiptText, Banknote, ArrowLeftRight, NotebookPen, Coins, Landmark } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import type { CombinedBookRow } from "@/actions/accounting/reports"

type Side = "ALL" | "CASH" | "BANK"

const VOUCHER_ICON: Record<string, React.ElementType> = {
  RV: ReceiptText, PV: Banknote, CV: ArrowLeftRight, JV: NotebookPen,
}
const VOUCHER_TONE: Record<string, string> = {
  RV: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PV: "bg-rose-50    text-rose-700    border-rose-200",
  CV: "bg-sky-50     text-sky-700     border-sky-200",
  JV: "bg-violet-50  text-violet-700  border-violet-200",
}

interface Props {
  rows:              CombinedBookRow[]
  openingCash:       string
  openingBank:       string
  closingCash:       string
  closingBank:       string
  totalCashReceipts: string
  totalCashPayments: string
  totalBankReceipts: string
  totalBankPayments: string
}

export function CashBookClient({
  rows, openingCash, openingBank, closingCash, closingBank,
  totalCashReceipts, totalCashPayments, totalBankReceipts, totalBankPayments,
}: Props) {
  const [search, setSearch] = useState("")
  const [side, setSide]     = useState<Side>("ALL")

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      // Side filter: row must have at least one non-zero amount on the chosen side(s)
      const hasCash = parseFloat(r.cashDr) > 0 || parseFloat(r.cashCr) > 0
      const hasBank = parseFloat(r.bankDr) > 0 || parseFloat(r.bankCr) > 0
      if (side === "CASH" && !hasCash) return false
      if (side === "BANK" && !hasBank) return false
      if (!q) return true
      return (
        (r.voucherNumber?.toLowerCase().includes(q) ?? false) ||
        r.narration.toLowerCase().includes(q) ||
        r.voucherType.toLowerCase().includes(q)
      )
    })
  }, [rows, side, search])

  // Filtered totals (recompute against current view)
  const totals = useMemo(() => {
    return filteredRows.reduce((acc, r) => ({
      cashDr: acc.cashDr + (parseFloat(r.cashDr) || 0),
      cashCr: acc.cashCr + (parseFloat(r.cashCr) || 0),
      bankDr: acc.bankDr + (parseFloat(r.bankDr) || 0),
      bankCr: acc.bankCr + (parseFloat(r.bankCr) || 0),
    }), { cashDr: 0, cashCr: 0, bankDr: 0, bankCr: 0 })
  }, [filteredRows])

  const grouped = useMemo(() => {
    const byDate = new Map<string, CombinedBookRow[]>()
    for (const r of filteredRows) {
      const k = r.dateBS
      const arr = byDate.get(k) ?? []
      arr.push(r)
      byDate.set(k, arr)
    }
    return Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredRows])

  const showFilteredTotals = search.trim() !== "" || side !== "ALL"

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
      {/* Filter toolbar */}
      <div className="px-5 py-3 border-b border-white/60 flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-slate-100/60 rounded-lg p-0.5">
          {(["ALL", "CASH", "BANK"] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition flex items-center gap-1.5",
                side === s ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {s === "CASH" && <Coins className="w-3 h-3" />}
              {s === "BANK" && <Landmark className="w-3 h-3" />}
              {s}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search voucher / narration / type…"
            className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {filteredRows.length < rows.length
            ? `${filteredRows.length} of ${rows.length}`
            : `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}
        </span>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="p-16 text-center">
          <Inbox className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No cash or bank activity in this period.</p>
          <p className="text-xs text-slate-400 mt-1">Try widening the date range or post a voucher first.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-16 text-center">
          <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No entries match the current filter.</p>
          <button onClick={() => { setSearch(""); setSide("ALL") }} className="text-xs text-primary font-bold mt-2 hover:underline cursor-pointer">
            Reset filter
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th rowSpan={2} className="px-3 py-2 text-left w-32 align-bottom">Voucher</th>
                <th rowSpan={2} className="px-3 py-2 text-left align-bottom">Narration</th>
                <th colSpan={2} className="px-3 py-1 text-center border-l border-slate-200 bg-emerald-50/60">
                  <Coins className="w-3 h-3 inline mr-1 text-emerald-600" />
                  Cash
                </th>
                <th colSpan={2} className="px-3 py-1 text-center border-l border-slate-200 bg-sky-50/60">
                  <Landmark className="w-3 h-3 inline mr-1 text-sky-600" />
                  Bank
                </th>
                <th rowSpan={2} className="px-3 py-2 text-right w-28 align-bottom border-l border-slate-200">Cash Bal</th>
                <th rowSpan={2} className="px-3 py-2 text-right w-28 align-bottom">Bank Bal</th>
              </tr>
              <tr>
                <th className="px-3 py-1 text-right w-24 border-l border-slate-200 bg-emerald-50/60" title="Debit — money in">Dr (In)</th>
                <th className="px-3 py-1 text-right w-24 bg-emerald-50/60" title="Credit — money out">Cr (Out)</th>
                <th className="px-3 py-1 text-right w-24 border-l border-slate-200 bg-sky-50/60" title="Debit — money in">Dr (In)</th>
                <th className="px-3 py-1 text-right w-24 bg-sky-50/60" title="Credit — money out">Cr (Out)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {/* Opening row */}
              <tr className="bg-slate-50/60 font-semibold border-b border-slate-200">
                <td colSpan={2} className="px-3 py-2 text-right text-[10px] uppercase tracking-widest text-slate-500">Opening balance</td>
                <td colSpan={4}></td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{openingCash}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{openingBank}</td>
              </tr>

              {/* Date-grouped rows */}
              {grouped.flatMap(([date, dateRows]) => [
                <tr key={`hdr-${date}`} className="bg-slate-50/40 border-y border-slate-100/80">
                  <td colSpan={8} className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-black text-slate-500">
                    {formatBS(date)}
                  </td>
                </tr>,
                ...dateRows.map((r, i) => {
                  const Icon = VOUCHER_ICON[r.voucherType] ?? ReceiptText
                  const tone = VOUCHER_TONE[r.voucherType] ?? VOUCHER_TONE.JV
                  return (
                    <tr key={`${date}-${i}-${r.voucherId}`} className="hover:bg-primary/4 transition-colors">
                      <td className="px-3 py-2 text-xs">
                        <Link href={`/accounting/vouchers/${r.voucherId}`} className="inline-flex items-center gap-1.5 font-mono font-bold text-primary hover:underline">
                          <span className={cn("w-5 h-5 rounded flex items-center justify-center border", tone)}>
                            <Icon className="w-3 h-3" />
                          </span>
                          {r.voucherNumber ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">{r.narration}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 font-semibold border-l border-slate-100">
                        {parseFloat(r.cashDr) > 0 ? r.cashDr : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700 font-semibold">
                        {parseFloat(r.cashCr) > 0 ? r.cashCr : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 font-semibold border-l border-slate-100">
                        {parseFloat(r.bankDr) > 0 ? r.bankDr : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700 font-semibold">
                        {parseFloat(r.bankCr) > 0 ? r.bankCr : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 border-l border-slate-100">{r.cashRunning}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">{r.bankRunning}</td>
                    </tr>
                  )
                }),
              ])}
            </tbody>
            <tfoot className="bg-slate-50/80 font-bold sticky bottom-0 backdrop-blur-xl">
              {showFilteredTotals && (
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-[10px] uppercase tracking-widest text-slate-500">
                    Filtered subtotal
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 border-l border-slate-100">{totals.cashDr.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700">{totals.cashCr.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 border-l border-slate-100">{totals.bankDr.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700">{totals.bankCr.toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-200">
                <td colSpan={2} className="px-3 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Period totals</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700 border-l border-slate-100">{totalCashReceipts}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-rose-700">{totalCashPayments}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700 border-l border-slate-100">{totalBankReceipts}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-rose-700">{totalBankPayments}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums border-l border-slate-100 font-black">{closingCash}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-black">{closingBank}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Footer tips */}
      <div className="px-5 py-2.5 border-t border-slate-100/80 bg-slate-50/40 text-[11px] text-slate-500 flex items-center justify-between gap-2 flex-wrap">
        <span>
          <strong className="text-emerald-700">Dr (In)</strong> = money received ·
          <strong className="text-rose-700 ml-1.5">Cr (Out)</strong> = money paid out
        </span>
        <span className="font-mono">
          Cash {closingCash} · Bank {closingBank}
        </span>
      </div>
    </div>
  )
}
