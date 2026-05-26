"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import type { FeePaymentRow } from "@/actions/accounting/fee-payments"

const METHODS = ["", "CASH", "BANK", "CHEQUE", "ONLINE"] as const

export function HistoryFilters({ rows }: { rows: FeePaymentRow[] }) {
  const router = useRouter()
  const sp = useSearchParams()

  const [mounted, setMounted] = useState(false)
  const [from, setFrom]       = useState(sp.get("from") ?? "")
  const [to, setTo]           = useState(sp.get("to") ?? "")
  const method                = sp.get("method") ?? ""

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(t)
  }, [])

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v); else params.delete(k)
    }
    router.push(`/finance/history${params.toString() ? `?${params}` : ""}`)
  }

  function applyDates() { pushParams({ from, to }) }
  function clearAll()   { setFrom(""); setTo(""); router.push("/finance/history") }
  function pickMethod(m: string) { pushParams({ method: m }) }

  function exportCsv() {
    const headers = ["Receipt #", "Date BS", "Student", "Class", "Fee head", "Lines", "Method", "Bank", "Voucher #", "Amount", "Remarks"]
    const escape = (v: string | null | undefined) => {
      // Strip CR, replace LF with a space — keeps the row on a single CSV line
      // while preserving the user's content (Excel/Sheets don't render embedded
      // newlines reliably across locales).
      const cleaned = (v ?? "").toString().replace(/\r/g, "").replace(/\n+/g, " ")
      const s = cleaned.replace(/"/g, '""')
      return /[",]/.test(s) ? `"${s}"` : s
    }
    const lines = [headers.join(",")]
    for (const r of rows) {
      lines.push([
        r.receiptNumber, r.dateBS, r.studentName, r.className,
        r.feeAccountName, String(r.lineCount), r.method, r.bankName,
        r.voucherNumber, r.amount, r.remarks,
      ].map(escape).join(","))
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fee-payments-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const hasFilter = !!from || !!to || !!method

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1 block">From (BS)</label>
          {mounted ? (
            <NepaliDateInput value={from} onChange={setFrom} placeholder="YYYY-MM-DD" />
          ) : (
            <div className="h-11 rounded-xl bg-white/75 border border-slate-200/80 animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1 block">To (BS)</label>
          {mounted ? (
            <NepaliDateInput value={to} onChange={setTo} placeholder="YYYY-MM-DD" />
          ) : (
            <div className="h-11 rounded-xl bg-white/75 border border-slate-200/80 animate-pulse" />
          )}
        </div>
        <Button onClick={applyDates} className="h-11 cursor-pointer">Apply dates</Button>
        {hasFilter && (
          <Button variant="ghost" onClick={clearAll} className="h-11 text-slate-500 hover:text-rose-600 cursor-pointer">
            <X className="w-3.5 h-3.5 mr-1" /> Reset all
          </Button>
        )}
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0} className="h-11 cursor-pointer gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Method</span>
        {METHODS.map(m => (
          <button
            key={m || "ALL"}
            type="button"
            onClick={() => pickMethod(m)}
            className={cn(
              "px-2 h-7 rounded-md text-[10px] font-bold uppercase tracking-widest cursor-pointer border transition-colors",
              method === m
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/75 border-slate-200 text-slate-600 hover:border-slate-300",
            )}
          >
            {m || "All"}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MethodBadge({ method }: { method: string }) {
  return (
    <Badge variant="outline" className="text-[10px] font-bold">{method}</Badge>
  )
}
