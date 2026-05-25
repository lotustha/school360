"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Inbox, ReceiptText, Banknote, ArrowLeftRight, NotebookPen } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import type { BookRow } from "@/actions/accounting/reports"

const VOUCHER_ICON: Record<string, React.ElementType> = {
  RV: ReceiptText, PV: Banknote, CV: ArrowLeftRight, JV: NotebookPen,
}
const VOUCHER_TONE: Record<string, string> = {
  RV: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PV: "bg-rose-50    text-rose-700    border-rose-200",
  CV: "bg-sky-50     text-sky-700     border-sky-200",
  JV: "bg-violet-50  text-violet-700  border-violet-200",
}

export interface BookViewProps {
  rows:             BookRow[]
  openingBalance:   string
  closingBalance:   string
  totalReceipts:    string
  totalPayments:    string
  /** Column label for Dr (debit) column. e.g. "Receipt" or "Deposit". */
  inLabel:          string
  /** Column label for Cr (credit) column. e.g. "Payment" or "Withdrawal". */
  outLabel:         string
  /** Optional empty-state explainer. */
  emptyText?:       string
}

export function BookView({
  rows, openingBalance, closingBalance,
  totalReceipts, totalPayments,
  inLabel, outLabel, emptyText,
}: BookViewProps) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"ALL" | "IN" | "OUT">("ALL")

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filter === "IN"  && !(parseFloat(r.receipt) > 0)) return false
      if (filter === "OUT" && !(parseFloat(r.payment) > 0)) return false
      if (!q) return true
      return (
        (r.voucherNumber?.toLowerCase().includes(q) ?? false) ||
        r.narration.toLowerCase().includes(q) ||
        r.voucherType.toLowerCase().includes(q)
      )
    })
  }, [rows, search, filter])

  const subTotals = useMemo(() => {
    return filteredRows.reduce((a, r) => ({
      receipt: a.receipt + (parseFloat(r.receipt) || 0),
      payment: a.payment + (parseFloat(r.payment) || 0),
    }), { receipt: 0, payment: 0 })
  }, [filteredRows])

  const grouped = useMemo(() => {
    const byDate = new Map<string, BookRow[]>()
    for (const r of filteredRows) {
      const k = r.dateBS
      const arr = byDate.get(k) ?? []
      arr.push(r)
      byDate.set(k, arr)
    }
    return Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredRows])

  const showSubtotals = search.trim() !== "" || filter !== "ALL"
  const counts = useMemo(() => ({
    all:  rows.length,
    in:   rows.filter(r => parseFloat(r.receipt) > 0).length,
    out:  rows.filter(r => parseFloat(r.payment) > 0).length,
  }), [rows])

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-white/60 flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-slate-100/60 rounded-lg p-0.5">
          {([
            { k: "ALL", label: "ALL", count: counts.all },
            { k: "IN",  label: inLabel.toUpperCase(),  count: counts.in },
            { k: "OUT", label: outLabel.toUpperCase(), count: counts.out },
          ] as const).map(o => (
            <button
              key={o.k}
              type="button"
              onClick={() => setFilter(o.k)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition flex items-center gap-1.5",
                filter === o.k ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {o.label}
              <span className="text-[10px] font-mono tabular-nums text-slate-400">{o.count}</span>
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

      {/* Body */}
      {rows.length === 0 ? (
        <div className="p-16 text-center">
          <Inbox className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">{emptyText ?? "No activity in this period."}</p>
          <p className="text-xs text-slate-400 mt-1">Try widening the date range.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-16 text-center">
          <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No entries match the current filter.</p>
          <button onClick={() => { setSearch(""); setFilter("ALL") }} className="text-xs text-primary font-bold mt-2 hover:underline cursor-pointer">
            Reset filter
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th className="px-4 py-3 text-left w-36">Voucher</th>
                <th className="px-4 py-3 text-left">Narration</th>
                <th className="px-4 py-3 text-right w-28" title="Debit — money in">{inLabel} (Dr)</th>
                <th className="px-4 py-3 text-right w-28" title="Credit — money out">{outLabel} (Cr)</th>
                <th className="px-4 py-3 text-right w-32">Running Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {/* Opening row */}
              <tr className="bg-slate-50/40 font-semibold border-b border-slate-200">
                <td colSpan={4} className="px-4 py-2 text-right text-[10px] uppercase tracking-widest text-slate-500">Opening balance</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{openingBalance}</td>
              </tr>

              {grouped.flatMap(([date, dateRows]) => [
                <tr key={`hdr-${date}`} className="bg-slate-50/40 border-y border-slate-100/80">
                  <td colSpan={5} className="px-4 py-1.5 text-[10px] uppercase tracking-widest font-black text-slate-500">
                    {formatBS(date)}
                  </td>
                </tr>,
                ...dateRows.map((r, i) => {
                  const Icon = VOUCHER_ICON[r.voucherType] ?? ReceiptText
                  const tone = VOUCHER_TONE[r.voucherType] ?? VOUCHER_TONE.JV
                  return (
                    <tr key={`${date}-${i}-${r.voucherId}`} className="hover:bg-primary/4 transition-colors">
                      <td className="px-4 py-2 text-xs">
                        <Link href={`/accounting/vouchers/${r.voucherId}`} className="inline-flex items-center gap-1.5 font-mono font-bold text-primary hover:underline">
                          <span className={cn("w-5 h-5 rounded flex items-center justify-center border", tone)}>
                            <Icon className="w-3 h-3" />
                          </span>
                          {r.voucherNumber ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 max-w-md truncate">{r.narration}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        {parseFloat(r.receipt) > 0 ? r.receipt : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-700 font-semibold">
                        {parseFloat(r.payment) > 0 ? r.payment : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">{r.balance}</td>
                    </tr>
                  )
                }),
              ])}
            </tbody>
            <tfoot className="bg-slate-50/80 font-bold sticky bottom-0 backdrop-blur-xl">
              {showSubtotals && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-[10px] uppercase tracking-widest text-slate-500">Filtered subtotal</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-700">{subTotals.receipt.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-700">{subTotals.payment.toFixed(2)}</td>
                  <td></td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-200">
                <td colSpan={2} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Period totals</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700">{totalReceipts}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-700">{totalPayments}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums font-black">{closingBalance}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Footer tip */}
      <div className="px-5 py-2.5 border-t border-slate-100/80 bg-slate-50/40 text-[11px] text-slate-500 flex items-center justify-between gap-2 flex-wrap">
        <span>
          <strong className="text-emerald-700">{inLabel} (Dr)</strong> = money received ·
          <strong className="text-rose-700 ml-1.5">{outLabel} (Cr)</strong> = money paid out
        </span>
        <span className="font-mono">
          Closing <strong>Rs. {closingBalance}</strong>
        </span>
      </div>
    </div>
  )
}
