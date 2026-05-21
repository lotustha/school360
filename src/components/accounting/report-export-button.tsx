"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  exportTrialBalance, exportBook, exportIncomeExpenditure,
  exportReceiptsPayments, exportBalanceSheet,
} from "@/lib/accounting-export"
import type {
  TrialBalance, CashBookResult, IncomeExpenditureResult,
  ReceiptsPaymentsResult, BalanceSheetResult,
} from "@/actions/accounting/reports"

interface BaseProps { schoolName: string }

type Props =
  | (BaseProps & { kind: "trial-balance";      data: TrialBalance })
  | (BaseProps & { kind: "cash-book";          data: CashBookResult })
  | (BaseProps & { kind: "bank-book";          data: CashBookResult })
  | (BaseProps & { kind: "income-expenditure"; data: IncomeExpenditureResult })
  | (BaseProps & { kind: "receipts-payments";  data: ReceiptsPaymentsResult })
  | (BaseProps & { kind: "balance-sheet";      data: BalanceSheetResult })

export function ReportExportButton(p: Props) {
  function handle() {
    switch (p.kind) {
      case "trial-balance":      return exportTrialBalance(p.schoolName, p.data)
      case "cash-book":          return exportBook(p.schoolName, p.data, "Cash Book")
      case "bank-book":          return exportBook(p.schoolName, p.data, "Bank Book")
      case "income-expenditure": return exportIncomeExpenditure(p.schoolName, p.data)
      case "receipts-payments":  return exportReceiptsPayments(p.schoolName, p.data)
      case "balance-sheet":      return exportBalanceSheet(p.schoolName, p.data)
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={handle} className="cursor-pointer gap-1.5 text-xs">
      <Download className="w-3.5 h-3.5" /> XLSX
    </Button>
  )
}
