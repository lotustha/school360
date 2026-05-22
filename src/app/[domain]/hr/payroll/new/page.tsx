import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getPayrollRoster } from "@/actions/accounting/payroll-runs"
import { listBankAccountsAll } from "@/actions/accounting/bank-accounts"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { PayrollRunForm } from "./payroll-run-form"

export const metadata: Metadata = { title: "Run Payroll" }

export default async function NewPayrollRunPage() {
  const fy = await getCurrentFiscalYear()
  if (!fy) redirect("/accounting/setup")

  const [roster, banks] = await Promise.all([getPayrollRoster(), listBankAccountsAll()])

  return (
    <PayrollRunForm
      fiscalYearName={fy.name}
      roster={roster}
      banks={banks.filter(b => b.isActive).map(b => ({ id: b.id, name: b.bankName, code: b.glCode }))}
    />
  )
}
