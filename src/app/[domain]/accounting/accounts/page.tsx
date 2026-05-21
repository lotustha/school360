import { Metadata } from "next"
import { listAccounts } from "@/actions/accounting/accounts"
import { AccountsClient } from "./accounts-client"

export const metadata: Metadata = { title: "Chart of Accounts" }

export default async function AccountsPage() {
  const accounts = await listAccounts()
  return (
    <AccountsClient
      accounts={accounts.map(a => ({
        id: a.id, code: a.code, name: a.name, type: a.type, subType: a.subType,
        parentId: a.parentId, isControl: a.isControl, isSystem: a.isSystem, isActive: a.isActive,
      }))}
    />
  )
}
