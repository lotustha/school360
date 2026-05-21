import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { listAccounts } from "@/actions/accounting/accounts"
import { VoucherForm } from "@/components/accounting/voucher-form"
import { VOUCHER_TYPE_LABEL, VOUCHER_TYPES, type VoucherType } from "@/lib/accounting"

export const metadata: Metadata = { title: "New Voucher" }

export default async function NewVoucherPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type: rawType } = await params
  const typeUpper = rawType.toUpperCase() as VoucherType
  if (!VOUCHER_TYPES.includes(typeUpper)) notFound()

  const fy = await getCurrentFiscalYear()
  if (!fy) redirect("/accounting/setup")

  const accounts = await listAccounts()

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">New {VOUCHER_TYPE_LABEL[typeUpper]}</h1>
      <VoucherForm
        type={typeUpper}
        fiscalYearId={fy.id}
        fiscalYearName={fy.name}
        accounts={accounts.map(a => ({
          id: a.id, code: a.code, name: a.name, type: a.type, subType: a.subType, isActive: a.isActive,
        }))}
      />
    </div>
  )
}
