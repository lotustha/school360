import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getFeePayment } from "@/actions/accounting/fee-payments"
import { ReceiptPrintView } from "./receipt-print"

export const dynamic = "force-dynamic"

export default async function Print({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params
  const [school, fp] = await Promise.all([
    prisma.school.findUnique({
      where: { slug: domain },
      select: { name: true, address: true, panNumber: true, phone: true },
    }),
    getFeePayment(id),
  ])
  if (!school || !fp) notFound()
  return <ReceiptPrintView school={school} receipt={fp} />
}
