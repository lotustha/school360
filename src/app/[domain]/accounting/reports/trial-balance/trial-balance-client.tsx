"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TrialBalanceRow } from "@/actions/accounting/reports"

const TYPE_TONE: Record<string, string> = {
  ASSET:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  LIABILITY: "bg-rose-50    text-rose-700    border-rose-200",
  EQUITY:    "bg-violet-50  text-violet-700  border-violet-200",
  INCOME:    "bg-sky-50     text-sky-700     border-sky-200",
  EXPENSE:   "bg-amber-50   text-amber-700   border-amber-200",
}

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const

interface Props {
  rows:        TrialBalanceRow[]
  totalDebit:  string
  totalCredit: string
  fyId:        string
}

export function TrialBalanceClient({ rows, totalDebit, totalCredit, fyId }: Props) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"ALL" | typeof TYPE_ORDER[number]>("ALL")
  const [groupByType, setGroupByType] = useState(true)

  const counts = useMemo(() => ({
    ALL:       rows.length,
    ASSET:     rows.filter(r => r.type === "ASSET").length,
    LIABILITY: rows.filter(r => r.type === "LIABILITY").length,
    EQUITY:    rows.filter(r => r.type === "EQUITY").length,
    INCOME:    rows.filter(r => r.type === "INCOME").length,
    EXPENSE:   rows.filter(r => r.type === "EXPENSE").length,
  }), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filter !== "ALL" && r.type !== filter) return false
      if (!q) return true
      return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
    })
  }, [rows, search, filter])

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-white/60 flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-slate-100/60 rounded-lg p-0.5">
          {(["ALL", ...TYPE_ORDER] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={cn(
                "px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition flex items-center gap-1.5",
                filter === t ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {t === "ALL" ? "ALL" : t.slice(0, 4)}
              <span className="text-[10px] font-mono tabular-nums text-slate-400">{counts[t]}</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search code / name / type…"
            className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <label className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={groupByType} onChange={e => setGroupByType(e.target.checked)} className="cursor-pointer" />
          Group by type
        </label>

        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {filtered.length < rows.length ? `${filtered.length} of ${rows.length}` : `${rows.length} accounts`}
        </span>
      </div>

      {/* Body */}
      {rows.length === 0 ? (
        <div className="p-16 text-center">
          <Inbox className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No postings yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center">
          <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No accounts match the current filter.</p>
          <button onClick={() => { setSearch(""); setFilter("ALL") }} className="text-xs text-primary font-bold mt-2 hover:underline cursor-pointer">
            Reset
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th className="px-4 py-3 text-left w-24">Code</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left w-24">Type</th>
                <th className="px-4 py-3 text-right w-32">Debit</th>
                <th className="px-4 py-3 text-right w-32">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {groupByType
                ? TypeGroupedRows({ rows: filtered, fyId })
                : filtered.map(r => <TbRow key={r.accountId} r={r} fyId={fyId} />)}
            </tbody>
            <tfoot className="bg-slate-50/80 font-bold sticky bottom-0 backdrop-blur-xl border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Period totals</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700">{totalDebit}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-700">{totalCredit}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function TbRow({ r, fyId }: { r: TrialBalanceRow; fyId: string }) {
  return (
    <tr className="hover:bg-primary/4 transition-colors">
      <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.code}</td>
      <td className="px-4 py-2">
        <Link href={`/accounting/ledger?account=${r.accountId}&fy=${fyId}`} className="hover:text-primary hover:underline">
          {r.name}
        </Link>
      </td>
      <td className="px-4 py-2">
        <span className={cn("text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border", TYPE_TONE[r.type] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
          {r.type.slice(0, 3)}
        </span>
      </td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-700 font-semibold">
        {parseFloat(r.debit) > 0 ? r.debit : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-700 font-semibold">
        {parseFloat(r.credit) > 0 ? r.credit : <span className="text-slate-300">—</span>}
      </td>
    </tr>
  )
}

function TypeGroupedRows({ rows, fyId }: { rows: TrialBalanceRow[]; fyId: string }) {
  const grouped = TYPE_ORDER
    .map(t => ({ type: t, items: rows.filter(r => r.type === t) }))
    .filter(g => g.items.length > 0)

  return grouped.flatMap(g => {
    const dr = g.items.reduce((a, r) => a + (parseFloat(r.debit)  || 0), 0)
    const cr = g.items.reduce((a, r) => a + (parseFloat(r.credit) || 0), 0)
    return [
      <tr key={`hdr-${g.type}`} className="bg-slate-50/40 border-y border-slate-200">
        <td colSpan={3} className="px-4 py-1.5">
          <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border", TYPE_TONE[g.type])}>
            {g.type} <span className="text-slate-400 font-mono">{g.items.length}</span>
          </span>
        </td>
        <td className="px-4 py-1.5 text-right font-mono tabular-nums text-[11px] text-emerald-700/70">{dr.toFixed(2)}</td>
        <td className="px-4 py-1.5 text-right font-mono tabular-nums text-[11px] text-rose-700/70">{cr.toFixed(2)}</td>
      </tr>,
      ...g.items.map(r => <TbRow key={r.accountId} r={r} fyId={fyId} />),
    ]
  })
}
