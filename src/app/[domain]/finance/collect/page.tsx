import { Metadata } from "next"
import { redirect } from "next/navigation"
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

  const banks = await listBankAccountsAll()

  // If deep-linked with ?studentId=, pre-load that student
  let preselectedStudent = null
  if (sp.studentId) {
    const s = await prisma.student.findUnique({
      where: { id: sp.studentId },
      include: {
        user:    { select: { fullName: true, avatarUrl: true } },
        class:   { select: { name: true, faculty: { select: { name: true } } } },
        section: { select: { name: true } },
      },
    })
    if (s && s.schoolId === session.user.schoolId) {
      preselectedStudent = {
        id:          s.id,
        name:        s.user.fullName,
        nameNepali:  s.fullNameNepali,
        admissionNo: s.admissionNo,
        rollNumber:  s.rollNumber,
        className:   s.class ? `${s.class.name}${s.section ? "-" + s.section.name : ""}` : null,
        facultyName: s.class?.faculty?.name ?? null,
        avatarUrl:   s.user.avatarUrl,
      }
    }
  }

  return (
    <CollectFeeClient
      fiscalYearName={fy.name}
      banks={banks.filter(b => b.isActive).map(b => ({ id: b.id, name: b.bankName, code: b.glCode }))}
      preselectedStudent={preselectedStudent}
    />
  )
}
