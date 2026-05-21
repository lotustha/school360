import { Metadata } from "next"
import { listBankAccountsAll } from "@/actions/accounting/bank-accounts"
import { listAccounts } from "@/actions/accounting/accounts"
import { BankAccountsClient } from "./bank-accounts-client"

export const metadata: Metadata = { title: "Bank Accounts" }

export default async function BankAccountsPage() {
  const [banks, accounts] = await Promise.all([listBankAccountsAll(), listAccounts()])

  // Suggest next code under 1120 (e.g. 1121, 1122, ...)
  const usedBankCodes = accounts
    .filter(a => a.code.startsWith("112") && a.code.length === 4)
    .map(a => parseInt(a.code, 10))
    .filter(n => Number.isFinite(n))
  const nextCode = (() => {
    let n = 1121
    while (usedBankCodes.includes(n)) n++
    return String(n)
  })()

  return <BankAccountsClient banks={banks} suggestedCode={nextCode} />
}
