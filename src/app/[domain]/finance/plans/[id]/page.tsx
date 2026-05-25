import Link from "next/link"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { getFeePlan } from "@/actions/billing/fee-plans"
import { PlanEditorClient } from "./editor-client"

export const metadata: Metadata = { title: "Plan editor · Fees" }

export default async function PlanEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!
  const { id } = await params
  const isNew = id === "new"

  const [plan, fiscalYears, heads, classes] = await Promise.all([
    isNew ? Promise.resolve(null) : getFeePlan(id),
    prisma.fiscalYear.findMany({ where: { schoolId }, orderBy: [{ isCurrent: "desc" }, { startBS: "desc" }], select: { id: true, name: true, isCurrent: true } }),
    prisma.feeHead.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, frequency: true, defaultAmount: true, defaultDueDay: true },
      orderBy: [{ name: "asc" }],
    }),
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  if (!isNew && !plan) notFound()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/finance/plans" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Plans
        </Link>
      </div>

      <PlanEditorClient
        plan={plan}
        fiscalYears={fiscalYears.map(f => ({ id: f.id, name: f.name, isCurrent: f.isCurrent }))}
        heads={heads.map(h => ({
          id:            h.id,
          name:          h.name,
          frequency:     h.frequency,
          defaultAmount: h.defaultAmount.toFixed(2),
          defaultDueDay: h.defaultDueDay,
        }))}
        classes={classes.map(c => ({ id: c.id, name: c.name, studentCount: c._count.students }))}
      />
    </div>
  )
}
