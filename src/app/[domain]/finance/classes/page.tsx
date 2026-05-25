import Link from "next/link"
import { Metadata } from "next"
import { GraduationCap, ArrowRight, Users, AlertCircle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

export const metadata: Metadata = { title: "Classes · Fees" }

export default async function ClassesLandingPage() {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  const currentFY = await prisma.fiscalYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true, name: true } })

  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: {
      faculty: { select: { name: true } },
      _count:  { select: { students: true } },
    },
    orderBy: { name: "asc" },
  })

  // Aggregate StudentFee totals per class (for the current FY only — fast lookup)
  const aggregates = currentFY ? await prisma.studentFee.groupBy({
    by: ["studentId"],
    where: { schoolId, fiscalYearId: currentFY.id },
    _sum: { finalAmount: true, paidAmount: true },
  }) : []

  const studentIds = aggregates.map(a => a.studentId)
  const studentClassMap = studentIds.length > 0
    ? new Map((await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, classId: true },
      })).map(s => [s.id, s.classId]))
    : new Map<string, string | null>()

  const classTotals = new Map<string, { billed: number; paid: number }>()
  for (const a of aggregates) {
    const classId = studentClassMap.get(a.studentId)
    if (!classId) continue
    const t = classTotals.get(classId) ?? { billed: 0, paid: 0 }
    t.billed += Number(a._sum.finalAmount ?? 0)
    t.paid   += Number(a._sum.paidAmount ?? 0)
    classTotals.set(classId, t)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
        <p className="text-sm text-muted-foreground mt-1">Open a class to view the per-student fee grid, apply plans, or bill a period.</p>
      </div>

      {!currentFY && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            No current fiscal year. <Link href="/accounting/fiscal-years" className="underline font-bold">Configure one →</Link>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(c => {
          const t = classTotals.get(c.id) ?? { billed: 0, paid: 0 }
          const outstanding = Math.max(0, t.billed - t.paid)
          return (
            <Link key={c.id} href={`/finance/classes/${c.id}`} className="block group">
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 p-5 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/8 transition-all duration-200 cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold truncate">{c.name}</p>
                    {c.faculty?.name && <p className="text-[11px] text-slate-500 truncate">{c.faculty.name}</p>}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="space-y-1 mb-3">
                  <Stat label="Students" value={`${c._count.students}`} icon={Users} />
                  <Stat label="Billed"   value={`Rs. ${t.billed.toFixed(2)}`} />
                  <Stat label="Outstanding" value={`Rs. ${outstanding.toFixed(2)}`} tone={outstanding > 0 ? "rose" : "emerald"} />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition" />
              </div>
            </Link>
          )
        })}
      </div>

      {classes.length === 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 p-12 text-center">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No classes defined yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            <Link href="/academics/classes" className="underline font-bold">Create classes in Academics →</Link>
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, icon: Icon, tone = "slate" }: {
  label: string; value: string; icon?: React.ElementType
  tone?: "slate" | "emerald" | "rose"
}) {
  const cls = {
    slate:   "text-slate-700",
    emerald: "text-emerald-700",
    rose:    "text-rose-700",
  }[tone]
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </span>
      <span className={`font-mono tabular-nums font-bold ${cls}`}>{value}</span>
    </div>
  )
}
