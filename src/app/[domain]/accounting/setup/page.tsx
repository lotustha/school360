import { Metadata } from "next"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { listAccounts } from "@/actions/accounting/accounts"
import { getOpeningBalances } from "@/actions/accounting/opening-balances"
import { SetupWizard } from "./setup-wizard"

export const metadata: Metadata = { title: "Setup" }

export default async function SetupPage() {
  const [years, current, accounts] = await Promise.all([
    listFiscalYears(),
    getCurrentFiscalYear(),
    listAccounts(),
  ])

  const initialOpenings = current
    ? await getOpeningBalances(current.id).then(rows =>
        rows.map(r => ({
          accountId: r.accountId,
          debit:     r.debit.toString(),
          credit:    r.credit.toString(),
        }))
      )
    : []

  return (
    <SetupWizard
      fiscalYears={years.map(y => ({
        id: y.id, name: y.name, startBS: y.startBS, endBS: y.endBS,
        status: y.status, isCurrent: y.isCurrent,
      }))}
      currentFyId={current?.id ?? null}
      accounts={accounts.map(a => ({
        id: a.id, code: a.code, name: a.name, type: a.type, isSystem: a.isSystem,
      }))}
      initialOpenings={initialOpenings}
    />
  )
}
