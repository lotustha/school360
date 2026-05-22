import { Metadata } from "next"
import { redirect } from "next/navigation"
import { listAccounts } from "@/actions/accounting/accounts"
import { listBankAccountsAll } from "@/actions/accounting/bank-accounts"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { CollectFeeClient } from "./collect-client"

export const metadata: Metadata = { title: "Collect Fee" }

export default async function CollectFeePage() {
  const fy = await getCurrentFiscalYear()
  if (!fy) redirect("/accounting/setup")

  const [accounts, banks] = await Promise.all([listAccounts(), listBankAccountsAll()])
  const incomeAccounts = accounts
    .filter(a => a.type === "INCOME" && a.isActive)
    .map(a => ({ id: a.id, code: a.code, name: a.name }))
    .sort((a, b) => a.code.localeCompare(b.code))

  return (
    <CollectFeeClient
      fiscalYearName={fy.name}
      incomeAccounts={incomeAccounts}
      banks={banks.filter(b => b.isActive).map(b => ({ id: b.id, name: b.bankName, code: b.glCode }))}
    />
  )
}
