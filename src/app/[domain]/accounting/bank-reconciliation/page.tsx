import { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Landmark } from "lucide-react"
import { listBankAccounts } from "@/actions/accounting/reports"
import { getBankReconciliation } from "@/actions/accounting/bank-reconciliation"
import { todayBS } from "@/lib/nepali-date"
import { BankRecClient } from "./bank-rec-client"

export const metadata: Metadata = { title: "Bank Reconciliation" }

export default async function BankReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; asOf?: string }>
}) {
  const sp = await searchParams
  const banks = await listBankAccounts()
  if (banks.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-amber-200/60 shadow-sm p-10 text-center max-w-2xl">
        <Landmark className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm text-slate-700">No bank accounts configured yet.</p>
        <p className="text-xs text-muted-foreground mt-2">
          Add at least one in <Link href="/accounting/bank-accounts" className="text-primary font-bold hover:underline">Bank Accounts →</Link>
        </p>
      </div>
    )
  }

  const accountId = sp.account ?? banks[0].id
  const asOf = sp.asOf ?? todayBS()

  let rec
  try {
    rec = await getBankReconciliation(accountId, asOf)
  } catch (e) {
    redirect(`/accounting/bank-reconciliation?account=${banks[0].id}&asOf=${asOf}`)
    throw e
  }

  return (
    <BankRecClient
      banks={banks.map(b => ({ id: b.id, code: b.code, name: b.name }))}
      rec={rec}
      initialAsOf={asOf}
    />
  )
}
