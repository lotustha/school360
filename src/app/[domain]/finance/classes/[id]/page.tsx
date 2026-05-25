import Link from "next/link"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { getClassSchedule } from "@/actions/billing/student-fees"
import { monthsInFiscalYear, fiscalYearOf, generatePlanPeriods } from "@/lib/nepali-date"
import { ClassGridClient } from "./grid-client"

export const metadata: Metadata = { title: "Class · Fees" }

export default async function ClassDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fy?: string; period?: string }>
}) {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!
  const { id } = await params
  const sp = await searchParams

  const cls = await prisma.class.findUnique({
    where: { id },
    include: { faculty: { select: { name: true } } },
  })
  if (!cls || cls.schoolId !== schoolId) notFound()

  // Fiscal years
  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { schoolId },
    orderBy: [{ isCurrent: "desc" }, { startBS: "desc" }],
    select: { id: true, name: true, startBS: true, isCurrent: true },
    take: 5,
  })
  const activeFY = sp.fy
    ? fiscalYears.find(f => f.id === sp.fy) ?? fiscalYears[0]
    : fiscalYears.find(f => f.isCurrent) ?? fiscalYears[0]

  if (!activeFY) {
    return (
      <div className="space-y-4">
        <Link href="/finance/classes" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Classes
        </Link>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
          No fiscal year configured. <Link href="/accounting/fiscal-years" className="font-bold underline">Set one up →</Link>
        </div>
      </div>
    )
  }

  // Filter
  const periodIndex = sp.period ? Number(sp.period) : undefined

  const [rows, plans, students] = await Promise.all([
    getClassSchedule({ classId: id, fiscalYearId: activeFY.id, periodIndex }),
    prisma.feePlan.findMany({
      where: { schoolId, fiscalYearId: activeFY.id, isActive: true },
      select: { id: true, name: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.student.findMany({
      where: { schoolId, classId: id, status: "ACTIVE" },
      include: {
        user:    { select: { fullName: true, avatarUrl: true } },
        section: { select: { name: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
  ])

  // Always render 12 month columns. Labels come from the plan that generated this
  // class's rows (BS Baisakh→Chaitra, AD Jan→Dec, BS Shrawan→Asar …). Fallback to
  // the FY's 12 BS months when no rows exist yet.
  let months: Array<{ monthIndex: number; label: string }>
  const sourcePlanIds = Array.from(new Set(rows.map(r => r.sourcePlanId).filter((id): id is string => !!id)))
  const sourcePlan = sourcePlanIds.length > 0
    ? await prisma.feePlan.findUnique({
        where: { id: sourcePlanIds[0] },
        select: { calendarSystem: true, startMonth: true, startYear: true },
      })
    : null

  if (sourcePlan) {
    months = generatePlanPeriods({
      calendar:   sourcePlan.calendarSystem as "BS" | "AD",
      startMonth: sourcePlan.startMonth,
      startYear:  sourcePlan.startYear,
      dueDay:     1,
    }).map(p => ({ monthIndex: p.periodIndex, label: p.label }))
  } else {
    const fyInfo = fiscalYearOf(activeFY.startBS)
    months = monthsInFiscalYear(fyInfo).map(m => ({ monthIndex: m.monthIndex, label: m.label }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/finance/classes" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Classes
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <h1 className="text-xl font-bold tracking-tight">{cls.name}</h1>
        {cls.faculty?.name && <p className="text-xs text-slate-500 mt-0.5">{cls.faculty.name}</p>}
      </div>

      <ClassGridClient
        classId={id}
        students={students.map(s => ({
          id:          s.id,
          name:        s.user.fullName,
          admissionNo: s.admissionNo,
          section:     s.section?.name ?? null,
          avatarUrl:   s.user.avatarUrl,
        }))}
        rows={rows}
        plans={plans.map(p => ({ id: p.id, name: p.name, itemCount: p._count.items }))}
        months={months}
        fiscalYears={fiscalYears.map(f => ({ id: f.id, name: f.name }))}
        activeFiscalYearId={activeFY.id}
        activePeriodIndex={periodIndex}
      />
    </div>
  )
}
