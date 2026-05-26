"use client"

import { FileSpreadsheet, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AccountLedger } from "@/actions/accounting/reports"

function csvEscape(v: string | null | undefined): string {
  const cleaned = (v ?? "").toString().replace(/\r/g, "").replace(/\n+/g, " ")
  const s = cleaned.replace(/"/g, '""')
  return /[",]/.test(s) ? `"${s}"` : s
}

export function LedgerExportButtons({ ledger }: { ledger: AccountLedger }) {
  function exportCsv() {
    const lines: string[] = []
    lines.push(["Date (BS)", "Voucher #", "Type", "Narration", "Debit", "Credit", "Running Balance"].map(csvEscape).join(","))
    // Opening balance row
    lines.push([
      "",
      "Opening",
      "",
      `${ledger.code} · ${ledger.name}`,
      ledger.openingDebit,
      ledger.openingCredit,
      "",
    ].map(csvEscape).join(","))
    for (const r of ledger.rows) {
      lines.push([
        r.dateBS, r.voucherNumber ?? "", r.voucherType,
        r.narration, r.debit, r.credit, r.running,
      ].map(csvEscape).join(","))
    }
    lines.push([
      "", "Closing", "", "", "", "", ledger.closingBalance,
    ].map(csvEscape).join(","))
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ledger-${ledger.code}-${ledger.name.replace(/[^\w]+/g, "_")}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={exportCsv} className="cursor-pointer gap-1.5 text-xs">
        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()} className="cursor-pointer gap-1.5 text-xs">
        <Printer className="w-3.5 h-3.5" /> Print
      </Button>
    </>
  )
}
