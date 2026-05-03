// Nepal Finance Utilities — FY 2081/82
// Do NOT inline these calculations anywhere in the codebase. Always import from here.

/** Annual TDS per Nepal Income Tax Act 2058 (amended 2081/82) */
export function computeAnnualTDS(annualSalary: number): number {
  if (annualSalary <= 500_000)  return Math.round(annualSalary * 0.01)
  if (annualSalary <= 700_000)  return Math.round(5_000 + (annualSalary - 500_000) * 0.10)
  if (annualSalary <= 1_000_000) return Math.round(25_000 + (annualSalary - 700_000) * 0.20)
  if (annualSalary <= 2_000_000) return Math.round(85_000 + (annualSalary - 1_000_000) * 0.30)
  return Math.round(385_000 + (annualSalary - 2_000_000) * 0.36)
}

export function computeMonthlyTDS(monthlySalary: number): number {
  return Math.round(computeAnnualTDS(monthlySalary * 12) / 12)
}

/** SSF: employee 11%, employer 20% of basic salary */
export function computeSSF(basicSalary: number) {
  return {
    employee: Math.round(basicSalary * 0.11),
    employer: Math.round(basicSalary * 0.20),
    total:    Math.round(basicSalary * 0.31),
  }
}

/** Nepal VAT: 13% */
export function addVAT(amount: number) {
  const vat = Math.round(amount * 0.13)
  return { subtotal: amount, vat, total: amount + vat }
}

export function extractVAT(totalWithVAT: number) {
  const subtotal = Math.round(totalWithVAT / 1.13)
  return { subtotal, vat: totalWithVAT - subtotal }
}

/** VAT invoice required for transactions ≥ Rs. 5,000 in Nepal */
export function requiresVATInvoice(amount: number): boolean {
  return amount >= 5_000
}

export function formatNPR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-NP")}`
}

/** Compute net salary from gross */
export function computeNetSalary(basic: number, allowances: Record<string, number> = {}) {
  const gross = basic + Object.values(allowances).reduce((a, b) => a + b, 0)
  const tds = computeMonthlyTDS(gross)
  const ssf = computeSSF(basic)
  return {
    basic,
    allowances,
    gross,
    tds,
    ssfEmployee: ssf.employee,
    ssfEmployer: ssf.employer,
    netSalary: gross - tds - ssf.employee,
  }
}
