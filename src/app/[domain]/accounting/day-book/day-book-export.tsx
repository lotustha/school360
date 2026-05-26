"use client"

import { FileSpreadsheet, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DayBookEntry } from "@/actions/accounting/reports"

function csvEscape(v: string | null | undefined): string {
  const cleaned = (v ?? "").toString().replace(/\r/g, "").replace(/\n+/g, " ")
  const s = cleaned.replace(/"/g, '""')
  return /[",]/.test(s) ? `"${s}"` : s
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const lines = [header.map(csvEscape).join(",")]
  for (const row of rows) lines.push(row.map(csvEscape).join(","))
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function DayBookExportButtons({ entries, dateBS }: { entries: DayBookEntry[]; dateBS: string }) {
  function exportCsv() {
    const rows: string[][] = []
    for (const e of entries) {
      for (const l of e.lines) {
        rows.push([
          e.voucherNumber ?? "", e.voucherType, e.status,
          e.partyName ?? "", e.narration,
          l.accountCode, l.accountName,
          l.debit, l.credit,
        ])
      }
    }
    downloadCsv(
      `day-book-${dateBS}.csv`,
      ["Voucher #", "Type", "Status", "Party", "Narration", "Account Code", "Account Name", "Debit", "Credit"],
      rows,
    )
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={exportCsv} disabled={entries.length === 0} className="cursor-pointer gap-1.5 text-xs">
        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()} disabled={entries.length === 0} className="cursor-pointer gap-1.5 text-xs">
        <Printer className="w-3.5 h-3.5" /> Print
      </Button>
    </>
  )
}
