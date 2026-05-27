"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Inbox, ReceiptText, Banknote, ArrowLeftRight, NotebookPen, Coins, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import type { CombinedBookRow, CombinedBookAccount } from "@/actions/accounting/reports"

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
  rows:     CombinedBookRow[]
  accounts: CombinedBookAccount[]
}

function amt(v: string) {
  return parseFloat(v) > 0 ? v : null
}

export function CashBookClient({ rows, accounts }: Props) {
  const [search, setSearch] = useState("")
  const [visible, setVisible] = useState<Set<string>>(() => new Set(accounts.map(a => a.id)))

  // Accounts to show as columns. If the user hides everything, fall back to all.
  const shown = useMemo(() => {
    const s = accounts.filter(a => visible.has(a.id))
    return s.length ? s : accounts
  }, [accounts, visible])
  const allShown = shown.length === accounts.length

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      // Account filter: row must touch at least one shown account
      if (!allShown) {
        const hits = shown.some(a => {
          const c = r.perAccount[a.id]
          return c && (parseFloat(c.dr) > 0 || parseFloat(c.cr) > 0)
        })
        if (!hits) return false
      }
      if (!q) return true
      return (
        (r.voucherNumber?.toLowerCase().includes(q) ?? false) ||
        r.narration.toLowerCase().includes(q) ||
        r.voucherType.toLowerCase().includes(q)
      )
    })
  }, [rows, shown, allShown, search])

  // Per-shown-account filtered subtotals
  const subtotals = useMemo(() => {
    const m: Record<string, { dr: number; cr: number }> = {}
    for (const a of shown) m[a.id] = { dr: 0, cr: 0 }
    for (const r of filteredRows) {
      for (const a of shown) {
        const c = r.perAccount[a.id]
        if (c) { m[a.id].dr += parseFloat(c.dr) || 0; m[a.id].cr += parseFloat(c.cr) || 0 }
      }
    }
    return m
  }, [filteredRows, shown])

  const grouped = useMemo(() => {
    const byDate = new Map<string, CombinedBookRow[]>()
    for (const r of filteredRows) {
      const arr = byDate.get(r.dateBS) ?? []
      arr.push(r)
      byDate.set(r.dateBS, arr)
    }
    return Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredRows])

  const filterActive = search.trim() !== "" || !allShown
  const fullSpan = 2 + shown.length * 3

  function toggle(id: string) {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
      {/* Filter toolbar */}
      <div className="px-5 py-3 border-b border-white/60 flex items-center gap-2 flex-wrap">
        {accounts.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {accounts.map(a => {
              const on = visible.has(a.id)
              const isCash = a.subType === "CASH"
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  title={`${a.code} · ${a.name}`}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition inline-flex items-center gap-1.5 border",
                    on
                      ? isCash ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-sky-50 text-sky-700 border-sky-200"
                      : "bg-white/60 text-slate-400 border-slate-200 hover:text-slate-600",
                  )}
                >
                  {isCash ? <Coins className="w-3 h-3" /> : <Landmark className="w-3 h-3" />}
                  <span className="max-w-[10rem] truncate">{a.name}</span>
                </button>
              )
            })}
          </div>
        )}

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
          <button onClick={() => { setSearch(""); setVisible(new Set(accounts.map(a => a.id))) }} className="text-xs text-primary font-bold mt-2 hover:underline cursor-pointer">
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
                {shown.map(a => (
                  <th key={a.id} colSpan={3} className={cn("px-3 py-1 text-center border-l border-slate-200", a.subType === "CASH" ? "bg-emerald-50/60" : "bg-sky-50/60")}>
                    {a.subType === "CASH"
                      ? <Coins className="w-3 h-3 inline mr-1 text-emerald-600" />
                      : <Landmark className="w-3 h-3 inline mr-1 text-sky-600" />}
                    {a.name}
                    <span className="ml-1 font-mono text-[9px] text-slate-400">{a.code}</span>
                  </th>
                ))}
              </tr>
              <tr>
                {shown.map(a => (
                  <FragmentHeaders key={a.id} cash={a.subType === "CASH"} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {/* Opening row */}
              <tr className="bg-slate-50/60 font-semibold border-b border-slate-200">
                <td colSpan={2} className="px-3 py-2 text-right text-[10px] uppercase tracking-widest text-slate-500">Opening balance</td>
                {shown.map(a => (
                  <td key={a.id} colSpan={3} className="px-3 py-2 text-right font-mono tabular-nums border-l border-slate-100">{a.opening}</td>
                ))}
              </tr>

              {/* Date-grouped rows */}
              {grouped.flatMap(([date, dateRows]) => [
                <tr key={`hdr-${date}`} className="bg-slate-50/40 border-y border-slate-100/80">
                  <td colSpan={fullSpan} className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-black text-slate-500">
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
                      {shown.map(a => {
                        const c = r.perAccount[a.id]
                        return (
                          <FragmentCells
                            key={a.id}
                            dr={c ? amt(c.dr) : null}
                            cr={c ? amt(c.cr) : null}
                            running={c?.running ?? a.opening}
                          />
                        )
                      })}
                    </tr>
                  )
                }),
              ])}
            </tbody>
            <tfoot className="bg-slate-50/80 font-bold sticky bottom-0 backdrop-blur-xl">
              {filterActive && (
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-[10px] uppercase tracking-widest text-slate-500">Filtered subtotal</td>
                  {shown.map(a => (
                    <FragmentCells
                      key={a.id}
                      dr={subtotals[a.id].dr > 0 ? subtotals[a.id].dr.toFixed(2) : null}
                      cr={subtotals[a.id].cr > 0 ? subtotals[a.id].cr.toFixed(2) : null}
                      running=""
                    />
                  ))}
                </tr>
              )}
              <tr className="border-t-2 border-slate-200">
                <td colSpan={2} className="px-3 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Period totals</td>
                {shown.map(a => (
                  <FragmentCells key={a.id} dr={amt(a.receipts)} cr={amt(a.payments)} running={a.closing} runningBold />
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Footer tips */}
      <div className="px-5 py-2.5 border-t border-slate-100/80 bg-slate-50/40 text-[11px] text-slate-500">
        <strong className="text-emerald-700">Dr (In)</strong> = money received ·
        <strong className="text-rose-700 ml-1.5">Cr (Out)</strong> = money paid out ·
        <span className="ml-1.5">each cash/bank account is its own column — use the chips above to focus.</span>
      </div>
    </div>
  )
}

/** The Dr / Cr / Bal sub-header trio for one account. */
function FragmentHeaders({ cash }: { cash: boolean }) {
  const bg = cash ? "bg-emerald-50/60" : "bg-sky-50/60"
  return (
    <>
      <th className={cn("px-3 py-1 text-right w-24 border-l border-slate-200", bg)} title="Debit — money in">Dr (In)</th>
      <th className={cn("px-3 py-1 text-right w-24", bg)} title="Credit — money out">Cr (Out)</th>
      <th className={cn("px-3 py-1 text-right w-28", bg)} title="Running balance">Balance</th>
    </>
  )
}

/** The Dr / Cr / Bal cell trio for one account in a row. */
function FragmentCells({ dr, cr, running, runningBold }: { dr: string | null; cr: string | null; running: string; runningBold?: boolean }) {
  return (
    <>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 font-semibold border-l border-slate-100">
        {dr ?? <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-700 font-semibold">
        {cr ?? <span className="text-slate-300">—</span>}
      </td>
      <td className={cn("px-3 py-2 text-right font-mono tabular-nums text-slate-700", runningBold && "font-black")}>{running}</td>
    </>
  )
}
