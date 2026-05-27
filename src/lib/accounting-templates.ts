// Quick-voucher template builders. Pure functions: given a small input shape,
// each builder produces a complete VoucherInput ready for the standard create+post
// action. Keeps UI templates trivial — no double-entry math in the React layer.

import type { VoucherInput } from "@/lib/accounting"

export type QuickTemplateId =
  | "day-fee-collection"
  | "salary-payroll"
  | "fee-receipt"
  | "donation"
  | "pay-salary"
  | "pay-rent"
  | "pay-expense"
  | "deposit-cash"
  | "withdraw-cash"

export interface QuickTemplate {
  id:          QuickTemplateId
  type:        "RV" | "PV" | "CV"
  title:       string
  description: string
  color:       "emerald" | "violet" | "amber" | "rose" | "sky" | "slate"
  recommended?: boolean
}

export const QUICK_TEMPLATES: QuickTemplate[] = [
  // ─── Recommended (lump-sum) — match how Nepali school accountants actually work
  { id: "day-fee-collection", type: "RV", title: "Day's Fee Collection",     description: "End-of-day total: cash + bank, split by fee head (Tuition, Admission…).", color: "emerald", recommended: true },
  { id: "salary-payroll",     type: "PV", title: "Monthly Salary Payroll",   description: "Total gross with TDS + SSF deductions, single voucher for the whole month.", color: "violet",  recommended: true },

  // ─── Per-party (for individual receipts / payments)
  { id: "fee-receipt",   type: "RV", title: "Single Fee Receipt",         description: "Record one student's fee payment with their name on the voucher.", color: "emerald" },
  { id: "donation",      type: "RV", title: "Receive Donation / Grant",   description: "Incoming donation. Dr Cash/Bank, Cr Donations.",     color: "emerald" },
  { id: "pay-salary",    type: "PV", title: "Pay Single Salary",          description: "One employee's salary with TDS and SSF deductions.", color: "violet" },
  { id: "pay-rent",      type: "PV", title: "Pay Rent (TDS 10%)",         description: "House/building rent with 10% TDS per IRD rule.",    color: "amber" },
  { id: "pay-expense",   type: "PV", title: "Pay Expense",                description: "Utilities, stationery, repairs — no TDS/VAT.",      color: "rose" },
  { id: "deposit-cash",  type: "CV", title: "Deposit Cash to Bank",       description: "Move cash from till to bank.",                      color: "sky" },
  { id: "withdraw-cash", type: "CV", title: "Withdraw Cash from Bank",    description: "Withdraw bank funds to office till.",               color: "sky" },
]

// ─── Builders ───────────────────────────────────────────────────────────────
// Each function takes a minimal input shape and returns the full VoucherInput.
// The caller supplies fiscalYearId and dateBS once at the form level.

interface CommonArgs {
  fiscalYearId: string
  dateBS:       string
  narration?:   string
}

export interface FeeReceiptInput extends CommonArgs {
  amount:         string
  studentName:    string
  feeAccountId:   string  // e.g. 4100 Tuition, 4200 Admission, etc.
  sourceAccountId: string // Cash (1110) or Bank (1120)
}

export function buildFeeReceipt(a: FeeReceiptInput): VoucherInput {
  return {
    fiscalYearId: a.fiscalYearId,
    type:         "RV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || `Fee received from ${a.studentName}`,
    partyType:    "STUDENT",
    partyName:    a.studentName,
    lines: [
      { accountId: a.sourceAccountId, debit: a.amount, credit: "0",       partyType: "STUDENT", partyName: a.studentName } as never,
      { accountId: a.feeAccountId,    debit: "0",       credit: a.amount },
    ],
  }
}

export interface DonationInput extends CommonArgs {
  amount:           string
  donorName:        string
  donationAccountId: string // e.g. 4600 Donations & Grants
  sourceAccountId:  string  // Cash or Bank
}

export function buildDonation(a: DonationInput): VoucherInput {
  return {
    fiscalYearId: a.fiscalYearId,
    type:         "RV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || `Donation from ${a.donorName}`,
    partyType:    "OTHER",
    partyName:    a.donorName,
    lines: [
      { accountId: a.sourceAccountId,    debit: a.amount, credit: "0" },
      { accountId: a.donationAccountId,  debit: "0",       credit: a.amount },
    ],
  }
}

export interface PaySalaryInput extends CommonArgs {
  employeeName:        string
  panNumber?:          string
  gross:               string   // total salary
  tdsAmount?:          string   // optional, can be 0
  ssfAmount?:          string   // optional, can be 0
  pfAmount?:           string   // employee Provident Fund
  pfEmployerAmount?:   string   // employer PF match
  citAmount?:          string   // employee Citizen Investment Trust
  citEmployerAmount?:  string   // employer CIT contribution
  salaryAccountId:         string   // 5100 Salaries & Allowances
  tdsPayableAccountId:     string   // 2130 TDS Payable
  ssfPayableAccountId:     string   // 2140 SSF Payable
  pfPayableAccountId?:     string   // 2145 PF Payable
  citPayableAccountId?:    string   // 2146 CIT Payable
  employerContribAccountId?: string // 5150 Employer Contributions
  sourceAccountId:     string   // Cash or Bank (for net pay)
}

export function buildPaySalary(a: PaySalaryInput): VoucherInput {
  const gross = parseFloat(a.gross || "0") || 0
  const tds   = parseFloat(a.tdsAmount || "0") || 0
  const ssf   = parseFloat(a.ssfAmount || "0") || 0
  const pf    = parseFloat(a.pfAmount || "0") || 0
  const pfE   = parseFloat(a.pfEmployerAmount || "0") || 0
  const cit   = parseFloat(a.citAmount || "0") || 0
  const citE  = parseFloat(a.citEmployerAmount || "0") || 0
  const net   = (gross - tds - ssf - pf - cit).toFixed(2)
  const employer = pfE + citE

  const lines: VoucherInput["lines"] = [
    { accountId: a.salaryAccountId, debit: a.gross, credit: "0", partyType: "EMPLOYEE", partyName: a.employeeName } as never,
  ]
  if (employer > 0 && a.employerContribAccountId) lines.push({ accountId: a.employerContribAccountId, debit: employer.toFixed(2), credit: "0" })
  if (tds > 0) lines.push({ accountId: a.tdsPayableAccountId, debit: "0", credit: a.tdsAmount! })
  if (ssf > 0) lines.push({ accountId: a.ssfPayableAccountId, debit: "0", credit: a.ssfAmount! })
  if (pf + pfE > 0 && a.pfPayableAccountId)   lines.push({ accountId: a.pfPayableAccountId,  debit: "0", credit: (pf + pfE).toFixed(2) })
  if (cit + citE > 0 && a.citPayableAccountId) lines.push({ accountId: a.citPayableAccountId, debit: "0", credit: (cit + citE).toFixed(2) })
  lines.push({ accountId: a.sourceAccountId, debit: "0", credit: net })

  return {
    fiscalYearId: a.fiscalYearId,
    type:         "PV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || `Salary to ${a.employeeName}`,
    partyType:    "EMPLOYEE",
    partyName:    a.employeeName,
    panNumber:    a.panNumber || null,
    tdsBase:      tds > 0 ? a.gross     : null,
    tdsAmount:    tds > 0 ? a.tdsAmount : null,
    lines,
  }
}

export interface PayRentInput extends CommonArgs {
  landlordName:        string
  panNumber?:          string
  gross:               string   // rent amount (before TDS)
  tdsPercent?:         string   // default 10
  rentAccountId:       string   // 5200 Rent
  tdsPayableAccountId: string   // 2130 TDS Payable
  sourceAccountId:     string   // Cash or Bank
}

export function buildPayRent(a: PayRentInput): VoucherInput {
  const gross   = parseFloat(a.gross || "0") || 0
  const pct     = parseFloat(a.tdsPercent || "10") || 10
  const tds     = (gross * pct) / 100
  const net     = (gross - tds).toFixed(2)
  const tdsStr  = tds.toFixed(2)

  return {
    fiscalYearId: a.fiscalYearId,
    type:         "PV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || `Rent paid to ${a.landlordName} (TDS ${pct}%)`,
    partyType:    "VENDOR",
    partyName:    a.landlordName,
    panNumber:    a.panNumber || null,
    tdsBase:      a.gross,
    tdsPercent:   String(pct),
    tdsAmount:    tdsStr,
    lines: [
      { accountId: a.rentAccountId,       debit: a.gross, credit: "0", partyType: "VENDOR", partyName: a.landlordName } as never,
      { accountId: a.tdsPayableAccountId, debit: "0",      credit: tdsStr },
      { accountId: a.sourceAccountId,     debit: "0",      credit: net },
    ],
  }
}

export interface PayExpenseInput extends CommonArgs {
  payeeName?:        string
  amount:            string
  expenseAccountId:  string
  sourceAccountId:   string
}

export function buildPayExpense(a: PayExpenseInput): VoucherInput {
  return {
    fiscalYearId: a.fiscalYearId,
    type:         "PV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || (a.payeeName ? `Expense paid to ${a.payeeName}` : "Expense"),
    partyType:    a.payeeName ? "VENDOR" : null,
    partyName:    a.payeeName || null,
    lines: [
      { accountId: a.expenseAccountId, debit: a.amount, credit: "0" },
      { accountId: a.sourceAccountId,  debit: "0",       credit: a.amount },
    ],
  }
}

export interface ContraInput extends CommonArgs {
  amount:          string
  cashAccountId:   string  // 1110
  bankAccountId:   string  // 1120
}

/** Deposit cash to bank: Dr Bank, Cr Cash. */
export function buildDepositCash(a: ContraInput): VoucherInput {
  return {
    fiscalYearId: a.fiscalYearId,
    type:         "CV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || "Cash deposited to bank",
    lines: [
      { accountId: a.bankAccountId, debit: a.amount, credit: "0" },
      { accountId: a.cashAccountId, debit: "0",       credit: a.amount },
    ],
  }
}

/** Withdraw cash from bank: Dr Cash, Cr Bank. */
export function buildWithdrawCash(a: ContraInput): VoucherInput {
  return {
    fiscalYearId: a.fiscalYearId,
    type:         "CV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || "Cash withdrawn from bank",
    lines: [
      { accountId: a.cashAccountId, debit: a.amount, credit: "0" },
      { accountId: a.bankAccountId, debit: "0",       credit: a.amount },
    ],
  }
}

// ─── Lump-sum templates (recommended for Nepali schools) ───────────────────

export interface FeeHeadAmount {
  accountId: string   // e.g. 4100 Tuition Fee
  label:     string   // for narration / display
  amount:    string
}

export interface DayFeeCollectionInput extends CommonArgs {
  cashAmount:    string  // received in cash (may be "0")
  bankAmount:    string  // received via bank/cheque (may be "0")
  cashAccountId: string
  bankAccountId: string
  heads:         FeeHeadAmount[]   // breakdown by income head
}

/** End-of-day fee collection summary. Cash + Bank as Dr, each fee head as Cr. */
export function buildDayFeeCollection(a: DayFeeCollectionInput): VoucherInput {
  const cash = parseFloat(a.cashAmount || "0") || 0
  const bank = parseFloat(a.bankAmount || "0") || 0
  const lines: VoucherInput["lines"] = []

  if (cash > 0) lines.push({ accountId: a.cashAccountId, debit: a.cashAmount, credit: "0" })
  if (bank > 0) lines.push({ accountId: a.bankAccountId, debit: a.bankAmount, credit: "0" })

  for (const h of a.heads) {
    if ((parseFloat(h.amount || "0") || 0) > 0) {
      lines.push({ accountId: h.accountId, debit: "0", credit: h.amount })
    }
  }

  const headSummary = a.heads
    .filter(h => (parseFloat(h.amount || "0") || 0) > 0)
    .map(h => h.label)
    .join(", ")

  return {
    fiscalYearId: a.fiscalYearId,
    type:         "RV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || `Day's fee collection${headSummary ? ` (${headSummary})` : ""}`,
    lines,
  }
}

export interface SalaryPayrollInput extends CommonArgs {
  period?:             string  // e.g. "Baisakh 2082"
  totalGross:          string
  totalTds:            string  // may be "0"
  totalSsf:            string  // may be "0"
  totalPf?:            string  // employee Provident Fund
  totalPfEmployer?:    string  // employer PF match
  totalCit?:           string  // employee Citizen Investment Trust
  totalCitEmployer?:   string  // employer CIT contribution
  salaryAccountId:     string
  tdsPayableAccountId: string
  ssfPayableAccountId: string
  pfPayableAccountId?:     string  // 2145 PF Payable
  citPayableAccountId?:    string  // 2146 CIT Payable
  employerContribAccountId?: string // 5150 Employer Contributions
  sourceAccountId:     string  // Cash or Bank
}

/** Monthly payroll lump sum. Dr Salary (+ Dr Employer PF/CIT), Cr TDS/SSF/PF/CIT Payable, Cr Cash/Bank (net). */
export function buildSalaryPayroll(a: SalaryPayrollInput): VoucherInput {
  const gross = parseFloat(a.totalGross || "0") || 0
  const tds   = parseFloat(a.totalTds   || "0") || 0
  const ssf   = parseFloat(a.totalSsf   || "0") || 0
  const pf    = parseFloat(a.totalPf    || "0") || 0
  const pfE   = parseFloat(a.totalPfEmployer  || "0") || 0
  const cit   = parseFloat(a.totalCit   || "0") || 0
  const citE  = parseFloat(a.totalCitEmployer || "0") || 0
  const net   = (gross - tds - ssf - pf - cit).toFixed(2)
  const employer = pfE + citE

  const lines: VoucherInput["lines"] = [
    { accountId: a.salaryAccountId, debit: a.totalGross, credit: "0" },
  ]
  if (employer > 0 && a.employerContribAccountId) lines.push({ accountId: a.employerContribAccountId, debit: employer.toFixed(2), credit: "0" })
  if (tds > 0) lines.push({ accountId: a.tdsPayableAccountId, debit: "0", credit: a.totalTds })
  if (ssf > 0) lines.push({ accountId: a.ssfPayableAccountId, debit: "0", credit: a.totalSsf })
  if (pf + pfE > 0 && a.pfPayableAccountId)   lines.push({ accountId: a.pfPayableAccountId,  debit: "0", credit: (pf + pfE).toFixed(2) })
  if (cit + citE > 0 && a.citPayableAccountId) lines.push({ accountId: a.citPayableAccountId, debit: "0", credit: (cit + citE).toFixed(2) })
  lines.push({ accountId: a.sourceAccountId, debit: "0", credit: net })

  return {
    fiscalYearId: a.fiscalYearId,
    type:         "PV",
    dateBS:       a.dateBS,
    narration:    a.narration?.trim() || (a.period ? `Salary payroll — ${a.period}` : "Monthly salary payroll"),
    tdsBase:      tds > 0 ? a.totalGross : null,
    tdsAmount:    tds > 0 ? a.totalTds   : null,
    lines,
  }
}
