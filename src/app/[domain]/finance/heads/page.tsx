import { Metadata } from "next"
import { ClipboardList } from "lucide-react"
import { listFeeHeads } from "@/actions/billing/fee-heads"
import { listAccounts } from "@/actions/accounting/accounts"
import { HeadsClient } from "./heads-client"

export const metadata: Metadata = { title: "Fee Heads · Fees" }

export default async function FeeHeadsPage() {
  const [heads, accounts] = await Promise.all([listFeeHeads(), listAccounts()])
  const incomeAccounts = accounts
    .filter(a => a.type === "INCOME" && a.isActive)
    .map(a => ({ id: a.id, code: a.code, name: a.name, type: "INCOME" as const }))
    .sort((a, b) => a.code.localeCompare(b.code))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Heads</h1>
          <p className="text-sm text-muted-foreground mt-1">Catalog of every fee type. Each head links to one INCOME account in the chart of accounts.</p>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
          <ClipboardList className="w-3 h-3" />{heads.length} head{heads.length === 1 ? "" : "s"}
        </div>
      </div>
      <HeadsClient initialHeads={heads} incomeAccounts={incomeAccounts} />
    </div>
  )
}
