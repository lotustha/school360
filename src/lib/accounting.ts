// Shared accounting types and constants. Pure (no DB/IO).
// Server actions live under src/actions/accounting/*.

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE"

export type AccountSubType =
  | "CASH" | "BANK"
  | "RECEIVABLE" | "PAYABLE"
  | "TAX_PAYABLE"
  | "CURRENT_ASSET" | "FIXED_ASSET"
  | "CURRENT_LIABILITY" | "LONG_TERM_LIABILITY"
  | "CAPITAL_FUND"
  | "OPERATING_INCOME" | "OTHER_INCOME"
  | "OPERATING_EXPENSE" | "OTHER_EXPENSE"
  | null

export type VoucherType = "RV" | "PV" | "CV" | "JV" | "BL"
export const VOUCHER_TYPES = ["RV", "PV", "CV", "JV", "BL"] as const

export const VOUCHER_TYPE_LABEL: Record<VoucherType, string> = {
  RV: "Receipt Voucher",
  PV: "Payment Voucher",
  CV: "Contra Voucher",
  JV: "Journal Voucher",
  BL: "Bill Voucher",
}

export type VoucherStatus = "DRAFT" | "POSTED" | "REVERSED"
export type FiscalYearStatus = "OPEN" | "CLOSED" | "LOCKED"
export type PartyType = "STUDENT" | "EMPLOYEE" | "VENDOR" | "OTHER"

/** Debit-natured account types — debits increase the balance. */
export const DEBIT_NATURED: ReadonlySet<AccountType> = new Set(["ASSET", "EXPENSE"])

/** Sub-types restricted to Contra voucher lines. */
export const CONTRA_SUBTYPES: ReadonlySet<NonNullable<AccountSubType>> =
  new Set(["CASH", "BANK"])

export interface VoucherLineInput {
  accountId: string
  debit:     string   // string-form decimal, e.g. "1500.00" — server uses Prisma.Decimal
  credit:    string
  partyType?: PartyType | null
  partyId?:   string | null
  narration?: string | null
}

export interface VoucherInput {
  fiscalYearId: string
  type:         VoucherType
  dateBS:       string                  // "YYYY-MM-DD"
  narration:    string
  partyType?:   PartyType | null
  partyId?:     string | null
  partyName?:   string | null
  panNumber?:   string | null
  vatTaxable?:  string | null
  vatAmount?:   string | null
  tdsBase?:     string | null
  tdsPercent?:  string | null
  tdsAmount?:   string | null
  lines:        VoucherLineInput[]
}

/** Format an integer counter into a per-FY voucher number. */
export function formatVoucherNumber(type: VoucherType, fyName: string, n: number): string {
  return `${type}-${fyName}-${String(n).padStart(4, "0")}`
}
