"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Search, Inbox, ReceiptText, Banknote, ArrowLeftRight, NotebookPen, ExternalLink, AlertTriangle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DayBookEntry } from "@/actions/accounting/reports"

const TYPE_ICON: Record<string, React.ElementType> = {
  RV: ReceiptText, PV: Banknote, CV: ArrowLeftRight, JV: NotebookPen,
}
const TYPE_TONE: Record<string, string> = {
  RV: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PV: "bg-rose-50    text-rose-700    border-rose-200",
  CV: "bg-sky-50     text-sky-700     border-sky-200",
  JV: "bg-violet-50  text-violet-700  border-violet-200",
}

const TYPE_LABEL: Record<string, string> = {
  RV: "Receipt", PV: "Payment", CV: "Contra", JV: "Journal",
}

export function DayBookClient({ entries }: { entries: DayBookEntry[] }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"ALL" | "RV" | "PV" | "CV" | "JV">("ALL")

  const counts = useMemo(() => ({
    ALL: entries.length,
    RV:  entries.filter(e => e.voucherType === "RV").length,
    PV:  entries.filter(e => e.voucherType === "PV").length,
    CV:  entries.filter(e => e.voucherType === "CV").length,
    JV:  entries.filter(e => e.voucherType === "JV").length,
  }), [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      if (filter !== "ALL" && e.voucherType !== filter) return false
      if (!q) return true
      return (
        (e.voucherNumber?.toLowerCase().includes(q) ?? false) ||
        e.narration.toLowerCase().includes(q) ||
        (e.partyName?.toLowerCase().includes(q) ?? false) ||
        e.lines.some(l => l.accountCode.toLowerCase().includes(q) || l.accountName.toLowerCase().includes(q))
      )
    })
  }, [entries, filter, search])

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-white/60 flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-slate-100/60 rounded-lg p-0.5">
          {(["ALL", "RV", "PV", "CV", "JV"] as const).map(t => {
            const Icon = t === "ALL" ? null : TYPE_ICON[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition flex items-center gap-1.5",
                  filter === t ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {t}
                <span className="text-[10px] font-mono tabular-nums text-slate-400">{counts[t]}</span>
              </button>
            )
          })}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search voucher / party / narration / account…"
            className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {filtered.length < entries.length
            ? `${filtered.length} of ${entries.length}`
            : `${entries.length} ${entries.length === 1 ? "voucher" : "vouchers"}`}
        </span>
      </div>

      {/* Body */}
      {entries.length === 0 ? (
        <div className="p-16 text-center">
          <Inbox className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No vouchers posted on this date.</p>
          <p className="text-xs text-slate-400 mt-1">Use the date navigator above to browse other days.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center">
          <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No vouchers match the current filter.</p>
          <button onClick={() => { setSearch(""); setFilter("ALL") }} className="text-xs text-primary font-bold mt-2 hover:underline cursor-pointer">
            Reset filter
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map(e => {
            const Icon = TYPE_ICON[e.voucherType] ?? ReceiptText
            const tone = TYPE_TONE[e.voucherType] ?? TYPE_TONE.JV
            const dr = parseFloat(e.totalDebit)  || 0
            const cr = parseFloat(e.totalCredit) || 0
            const unbalanced = Math.abs(dr - cr) > 0.005
            return (
              <div key={e.voucherId} className="p-4 hover:bg-primary/4 transition-colors">
                {/* Header row */}
                <div className="flex items-start gap-3 mb-3 flex-wrap">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border", tone)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/accounting/vouchers/${e.voucherId}`}
                        className="font-mono text-sm font-bold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {e.voucherNumber ?? "(draft)"}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Link>
                      <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest", tone)}>
                        {TYPE_LABEL[e.voucherType] ?? e.voucherType}
                      </Badge>
                      {e.status === "REVERSED" && (
                        <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200 font-bold">
                          REVERSED
                        </Badge>
                      )}
                      {unbalanced && (
                        <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-bold gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> UNBALANCED
                        </Badge>
                      )}
                    </div>
                    {e.partyName && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Party: <span className="font-semibold text-slate-700">{e.partyName}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{e.narration}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Total</p>
                    <p className="font-mono tabular-nums font-black text-sm">Rs. {e.totalDebit}</p>
                  </div>
                </div>

                {/* Line items */}
                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50/60 text-[9px] uppercase tracking-widest font-black text-slate-500">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Account</th>
                      <th className="px-3 py-1.5 text-right w-24">Debit</th>
                      <th className="px-3 py-1.5 text-right w-24">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {e.lines.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50/40">
                        <td className="px-3 py-1.5">
                          <span className="font-mono text-slate-400 mr-1.5">{l.accountCode}</span>
                          {l.accountName}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {parseFloat(l.debit) > 0 ? l.debit : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-rose-700 font-semibold">
                          {parseFloat(l.credit) > 0 ? l.credit : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/60 font-bold border-t-2 border-slate-200">
                    <tr>
                      <td className="px-3 py-1.5 text-right text-[10px] uppercase tracking-widest text-slate-500">Totals</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-emerald-700">{e.totalDebit}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-rose-700">{e.totalCredit}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
