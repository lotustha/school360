import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getVoucher } from "@/actions/accounting/vouchers"
import { VoucherPrintView } from "./voucher-print"

export const dynamic = "force-dynamic"

export default async function VoucherPrintPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params
  const [school, v] = await Promise.all([
    prisma.school.findUnique({ where: { slug: domain }, select: { name: true, address: true, panNumber: true } }),
    getVoucher(id),
  ])
  if (!school || !v) notFound()
  if (v.status === "DRAFT") return <div className="p-10 text-center">Drafts cannot be printed. Post the voucher first.</div>

  return (
    <VoucherPrintView
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      voucher={{
        id: v.id,
        type: v.type,
        number: v.number,
        dateBS: v.dateBS,
        narration: v.narration,
        partyName: v.partyName,
        panNumber: v.panNumber,
        status: v.status,
        fiscalYearName: v.fiscalYear.name,
        totalAmount: v.totalAmount.toFixed(2),
        lines: v.lines.map(l => ({
          code:      l.account.code,
          name:      l.account.name,
          narration: l.narration,
          debit:     l.debit.toFixed(2),
          credit:    l.credit.toFixed(2),
        })),
      }}
    />
  )
}
