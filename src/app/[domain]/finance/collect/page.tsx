import { Metadata } from "next"
import { redirect } from "next/navigation"
import { listAccounts } from "@/actions/accounting/accounts"
import { listBankAccountsAll } from "@/actions/accounting/bank-accounts"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { CollectFeeClient } from "./collect-client"

export const metadata: Metadata = { title: "Collect Fee" }

export default async function CollectFeePage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const fy = await getCurrentFiscalYear()
  if (!fy) redirect("/accounting/setup")

  const session = await requirePermission("finance:view")
  const sp = await searchParams

  const [accounts, banks] = await Promise.all([listAccounts(), listBankAccountsAll()])
  const incomeAccounts = accounts
    .filter(a => a.type === "INCOME" && a.isActive)
    .map(a => ({ id: a.id, code: a.code, name: a.name }))
    .sort((a, b) => a.code.localeCompare(b.code))

  // If deep-linked with ?studentId=, pre-load that student
  let preselectedStudent = null
  if (sp.studentId) {
    const s = await prisma.student.findUnique({
      where: { id: sp.studentId },
      include: {
        user:    { select: { fullName: true, avatarUrl: true } },
        class:   { select: { name: true } },
        section: { select: { name: true } },
      },
    })
    if (s && s.schoolId === session.user.schoolId) {
      preselectedStudent = {
        id:          s.id,
        name:        s.user.fullName,
        admissionNo: s.admissionNo,
        className:   s.class ? `${s.class.name}${s.section ? "-" + s.section.name : ""}` : null,
        avatarUrl:   s.user.avatarUrl,
      }
    }
  }

  return (
    <CollectFeeClient
      fiscalYearName={fy.name}
      incomeAccounts={incomeAccounts}
      banks={banks.filter(b => b.isActive).map(b => ({ id: b.id, name: b.bankName, code: b.glCode }))}
      preselectedStudent={preselectedStudent}
    />
  )
}
