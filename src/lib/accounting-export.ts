"use client"

// Client-side XLSX export for accounting reports. Same pattern as
// src/lib/ledger-export.ts: build an array-of-arrays, push merge ranges,
// XLSX.writeFile triggers the browser download.

import * as XLSX from "xlsx"
import type {
  CashBookResult,
  TrialBalance, IncomeExpenditureResult, ReceiptsPaymentsResult, BalanceSheetResult,
} from "@/actions/accounting/reports"

function applyMeta(ws: XLSX.WorkSheet, colWidths: number[]) {
  ws["!cols"] = colWidths.map(w => ({ wch: w }))
}

function pushBook(wb: XLSX.WorkBook, ws: XLSX.WorkSheet, name: string) {
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
}

function header(schoolName: string, title: string, subtitle: string, colCount: number): {
  aoa: (string | number)[][]
  merges: XLSX.Range[]
} {
  return {
    aoa: [
      [schoolName],
      [title],
      [subtitle],
      [],
    ],
    merges: [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ],
  }
}

// ─── Trial Balance ─────────────────────────────────────────────────────────

export function exportTrialBalance(schoolName: string, tb: TrialBalance, filename = "trial-balance.xlsx") {
  const COL_COUNT = 5
  const h = header(schoolName, "Trial Balance", `As at ${tb.asOfBS}`, COL_COUNT)

  const aoa: (string | number)[][] = [
    ...h.aoa,
    ["Code", "Account", "Type", "Debit", "Credit"],
    ...tb.rows.map(r => [r.code, r.name, r.type, parseFloat(r.debit) || "", parseFloat(r.credit) || ""]),
    ["", "", "Totals", parseFloat(tb.totalDebit), parseFloat(tb.totalCredit)],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!merges"] = h.merges
  applyMeta(ws, [10, 38, 12, 14, 14])
  pushBook(wb, ws, "Trial Balance")
  XLSX.writeFile(wb, filename)
}

// ─── Cash Book / Bank Book (shared shape) ──────────────────────────────────

export function exportBook(schoolName: string, book: CashBookResult, kind: "Cash Book" | "Bank Book", filename?: string) {
  const COL_COUNT = 6
  const subtitle = `${book.accountCode} ${book.accountName} · ${book.fromBS} to ${book.toBS}`
  const h = header(schoolName, kind, subtitle, COL_COUNT)

  const drLabel = kind === "Cash Book" ? "Receipt (Dr)" : "Deposit (Dr)"
  const crLabel = kind === "Cash Book" ? "Payment (Cr)" : "Withdrawal (Cr)"

  const aoa: (string | number)[][] = [
    ...h.aoa,
    ["Date (BS)", "Voucher", "Narration", drLabel, crLabel, "Balance"],
    ["", "", "Opening balance", "", "", parseFloat(book.openingBalance)],
    ...book.rows.map(r => [
      r.dateBS, r.voucherNumber ?? "—", r.narration,
      parseFloat(r.receipt) || "", parseFloat(r.payment) || "", parseFloat(r.balance),
    ]),
    ["", "", "Totals", parseFloat(book.totalReceipts), parseFloat(book.totalPayments), parseFloat(book.closingBalance)],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!merges"] = h.merges
  applyMeta(ws, [12, 16, 40, 14, 14, 14])
  pushBook(wb, ws, kind)
  XLSX.writeFile(wb, filename ?? `${kind.toLowerCase().replace(" ", "-")}.xlsx`)
}

// ─── Income & Expenditure A/c ──────────────────────────────────────────────

export function exportIncomeExpenditure(schoolName: string, ie: IncomeExpenditureResult, filename = "income-expenditure.xlsx") {
  const COL_COUNT = 6
  const h = header(schoolName, "Income & Expenditure Account", `For the period ended ${ie.asOfBS}`, COL_COUNT)

  const aoa: (string | number)[][] = [
    ...h.aoa,
    ["Expenditure", "", "Amount", "Income", "", "Amount"],
  ]

  const maxLen = Math.max(ie.income.length, ie.expense.length)
  for (let i = 0; i < maxLen; i++) {
    const e = ie.expense[i]
    const c = ie.income[i]
    aoa.push([
      e?.code ?? "", e?.name ?? "", e ? parseFloat(e.amount) : "",
      c?.code ?? "", c?.name ?? "", c ? parseFloat(c.amount) : "",
    ])
  }

  if (ie.isSurplus) {
    aoa.push(["", "Surplus carried to Capital Fund", parseFloat(ie.surplusOrDeficit), "", "", ""])
  } else if (parseFloat(ie.surplusOrDeficit) > 0) {
    aoa.push(["", "", "", "", "Deficit transferred from Capital Fund", parseFloat(ie.surplusOrDeficit)])
  }

  const leftTotal  = ie.isSurplus ? parseFloat(ie.totalExpense) + parseFloat(ie.surplusOrDeficit) : parseFloat(ie.totalExpense)
  const rightTotal = !ie.isSurplus && parseFloat(ie.surplusOrDeficit) > 0 ? parseFloat(ie.totalIncome) + parseFloat(ie.surplusOrDeficit) : parseFloat(ie.totalIncome)
  aoa.push(["", "Total", leftTotal, "", "Total", rightTotal])

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!merges"] = h.merges
  applyMeta(ws, [8, 30, 14, 8, 30, 14])
  pushBook(wb, ws, "I&E")
  XLSX.writeFile(wb, filename)
}

// ─── Receipts & Payments A/c ───────────────────────────────────────────────

export function exportReceiptsPayments(schoolName: string, rp: ReceiptsPaymentsResult, filename = "receipts-payments.xlsx") {
  const COL_COUNT = 6
  const h = header(schoolName, "Receipts & Payments Account", `${rp.fromBS} to ${rp.toBS}`, COL_COUNT)

  const aoa: (string | number)[][] = [
    ...h.aoa,
    ["Receipts", "", "Amount", "Payments", "", "Amount"],
    ["", "Opening — Cash", parseFloat(rp.openingCash), "", "", ""],
    ["", "Opening — Bank", parseFloat(rp.openingBank), "", "", ""],
  ]

  const maxLen = Math.max(rp.receipts.length, rp.payments.length)
  for (let i = 0; i < maxLen; i++) {
    const r = rp.receipts[i]
    const p = rp.payments[i]
    aoa.push([
      r?.code ?? "", r?.name ?? "", r ? parseFloat(r.amount) : "",
      p?.code ?? "", p?.name ?? "", p ? parseFloat(p.amount) : "",
    ])
  }

  aoa.push(["", "", "", "", "Closing — Cash", parseFloat(rp.closingCash)])
  aoa.push(["", "", "", "", "Closing — Bank", parseFloat(rp.closingBank)])
  aoa.push(["", "Total", parseFloat(rp.totalReceiptsSide), "", "Total", parseFloat(rp.totalPaymentsSide)])

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!merges"] = h.merges
  applyMeta(ws, [8, 30, 14, 8, 30, 14])
  pushBook(wb, ws, "R&P")
  XLSX.writeFile(wb, filename)
}

// ─── Balance Sheet ─────────────────────────────────────────────────────────

export function exportBalanceSheet(schoolName: string, bs: BalanceSheetResult, filename = "balance-sheet.xlsx") {
  const COL_COUNT = 6
  const h = header(schoolName, "Balance Sheet", `As at ${bs.asOfBS}`, COL_COUNT)

  const aoa: (string | number)[][] = [
    ...h.aoa,
    ["Liabilities & Capital Fund", "", "Amount", "Assets", "", "Amount"],
  ]

  // Build the left side rows
  const leftRows: { code: string; name: string; amount: number }[] = []
  if (bs.liabilities.length > 0) {
    leftRows.push({ code: "", name: "— Liabilities —", amount: NaN })
    for (const l of bs.liabilities) leftRows.push({ code: l.code, name: l.name, amount: parseFloat(l.amount) })
  }
  if (bs.equity.length > 0 || parseFloat(bs.currentYearSurplus) > 0) {
    leftRows.push({ code: "", name: "— Capital Fund —", amount: NaN })
    for (const l of bs.equity) leftRows.push({ code: l.code, name: l.name, amount: parseFloat(l.amount) })
    if (parseFloat(bs.currentYearSurplus) > 0) {
      leftRows.push({
        code: "",
        name: bs.isSurplus ? "Add: Current year surplus" : "Less: Current year deficit",
        amount: parseFloat(bs.currentYearSurplus) * (bs.isSurplus ? 1 : -1),
      })
    }
  }

  const rightRows = bs.assets.map(a => ({ code: a.code, name: a.name, amount: parseFloat(a.amount) }))

  const maxLen = Math.max(leftRows.length, rightRows.length)
  for (let i = 0; i < maxLen; i++) {
    const l = leftRows[i]
    const r = rightRows[i]
    aoa.push([
      l?.code ?? "", l?.name ?? "", l && !isNaN(l.amount) ? l.amount : "",
      r?.code ?? "", r?.name ?? "", r ? r.amount : "",
    ])
  }

  aoa.push(["", "Total", parseFloat(bs.totalLiabilitiesAndEquity), "", "Total", parseFloat(bs.totalAssets)])

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!merges"] = h.merges
  applyMeta(ws, [8, 32, 14, 8, 32, 14])
  pushBook(wb, ws, "Balance Sheet")
  XLSX.writeFile(wb, filename)
}
