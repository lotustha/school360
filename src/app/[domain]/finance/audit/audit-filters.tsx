"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { X, Download, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AuditRow } from "./audit-table"

const ENTITIES = ["", "FeeHead", "FeePlan", "PlanItem", "StudentFee", "FeePaymentAllocation"] as const
const ACTIONS  = ["", "CREATE", "UPDATE", "DELETE", "CANCEL", "WRITE_OFF", "APPROVE", "POST", "REVERSE", "BILL_PERIOD"] as const

const RANGES = [
  { key: "all",   label: "All time" },
  { key: "24h",   label: "Last 24h" },
  { key: "7d",    label: "Last 7 days" },
  { key: "30d",   label: "Last 30 days" },
] as const

export function AuditFilters({ rows }: { rows: AuditRow[] }) {
  const router = useRouter()
  const sp = useSearchParams()
  const entity = sp.get("entity") ?? ""
  const action = sp.get("action") ?? ""
  const range  = sp.get("range")  ?? "all"

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v); else params.delete(k)
    }
    router.push(`/finance/audit${params.toString() ? `?${params}` : ""}`)
  }

  function clearAll() { router.push("/finance/audit") }

  function exportCsv() {
    const headers = ["When (ISO)", "User", "Entity", "Action", "Entity ID", "Before (JSON)", "After (JSON)"]
    const escape = (v: string) => {
      const cleaned = v.replace(/\r/g, "").replace(/\n+/g, " ")
      const s = cleaned.replace(/"/g, '""')
      return /[",]/.test(s) ? `"${s}"` : s
    }
    const lines = [headers.join(",")]
    for (const r of rows) {
      lines.push([
        r.at, r.userName, r.entity, r.action, r.entityId,
        r.before ? JSON.stringify(r.before) : "",
        r.after  ? JSON.stringify(r.after)  : "",
      ].map(escape).join(","))
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `billing-audit-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const hasFilter = !!entity || !!action || range !== "all"

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-3 space-y-2">
      {/* Range pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1 mr-1">
          <CalendarClock className="w-3 h-3" /> When
        </span>
        {RANGES.map(r => (
          <button
            key={r.key} type="button"
            onClick={() => pushParams({ range: r.key === "all" ? "" : r.key })}
            className={cn(
              "px-2 h-7 rounded-md text-[10px] font-bold uppercase tracking-widest cursor-pointer border transition-colors",
              range === r.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/75 border-slate-200 text-slate-600 hover:border-slate-300",
            )}
          >{r.label}</button>
        ))}
      </div>

      {/* Entity pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Entity</span>
        {ENTITIES.map(e => (
          <button
            key={e || "ALL"} type="button"
            onClick={() => pushParams({ entity: e })}
            className={cn(
              "px-2 h-7 rounded-md text-[10px] font-bold uppercase tracking-widest cursor-pointer border transition-colors",
              entity === e
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/75 border-slate-200 text-slate-600 hover:border-slate-300",
            )}
          >{e || "All"}</button>
        ))}
      </div>

      {/* Action pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Action</span>
        {ACTIONS.map(a => (
          <button
            key={a || "ALL"} type="button"
            onClick={() => pushParams({ action: a })}
            className={cn(
              "px-2 h-7 rounded-md text-[10px] font-bold uppercase tracking-widest cursor-pointer border transition-colors",
              action === a
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/75 border-slate-200 text-slate-600 hover:border-slate-300",
            )}
          >{a || "All"}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {hasFilter && (
          <Button variant="ghost" onClick={clearAll} className="h-8 text-slate-500 hover:text-rose-600 cursor-pointer text-xs">
            <X className="w-3 h-3 mr-1" /> Reset
          </Button>
        )}
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0} className="h-8 cursor-pointer gap-1.5 ml-auto text-xs">
          <Download className="w-3 h-3" /> Export CSV
        </Button>
      </div>
    </div>
  )
}
