import { Metadata } from "next"
import { redirect } from "next/navigation"
import { listAccounts } from "@/actions/accounting/accounts"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { QuickVouchersClient } from "./quick-vouchers-client"

export const metadata: Metadata = { title: "Quick Entry" }

export default async function QuickVouchersPage() {
  const fy = await getCurrentFiscalYear()
  if (!fy) redirect("/accounting/setup")

  const accounts = await listAccounts()

  // Pre-resolve common system accounts by code (from the seeded COA).
  function byCode(code: string) {
    return accounts.find(a => a.code === code && a.isActive)?.id ?? ""
  }

  const presets = {
    cash:           byCode("1110"),
    bank:           byCode("1120"),
    tuition:        byCode("4100"),
    admission:      byCode("4200"),
    exam:           byCode("4300"),
    transport:      byCode("4400"),
    hostel:         byCode("4500"),
    donation:       byCode("4600"),
    salary:         byCode("5100"),
    rent:           byCode("5200"),
    utilities:      byCode("5300"),
    maintenance:    byCode("5500"),
    stationery:     byCode("5400"),
    other_expense:  byCode("5900"),
    tdsPayable:     byCode("2130"),
    ssfPayable:     byCode("2140"),
  }

  return (
    <QuickVouchersClient
      fiscalYearId={fy.id}
      fiscalYearName={fy.name}
      presets={presets}
      accounts={accounts
        .filter(a => a.isActive)
        .map(a => ({ id: a.id, code: a.code, name: a.name, type: a.type, subType: a.subType }))}
    />
  )
}
