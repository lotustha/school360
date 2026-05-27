import Link from "next/link"
import { Metadata } from "next"
import { GraduationCap, AlertCircle, Users as UsersIcon, Wallet, TrendingUp, FileText, CalendarClock } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { ClassesClient } from "./classes-client"

export const metadata: Metadata = { title: "Classes · Fees" }

export interface ClassCard {
  id:                 string
  name:               string
  facultyName:        string | null
  classTeacher:       string | null
  studentCount:       number
  billed:             number   // issued only (BILLED + PARTIAL + PAID)
  paid:               number
  outstanding:        number   // billed − paid
  planned:            number   // PLANNED rows — scheduled, not yet issued
  overdueCount:       number   // BILLED/PARTIAL rows past due date
  overdueOutstanding: number
  pct:                number
}

export default async function ClassesLandingPage() {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  const currentFY = await prisma.fiscalYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true, name: true },
  })

  const [classes, faculties] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      include: {
        faculty:      { select: { name: true } },
        classTeacher: { select: { fullName: true } },
        _count:       { select: { students: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where:   { schoolId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  // Per-class fee aggregates (current FY). Cash-basis rules:
  //   billed/paid/outstanding ← issued rows only (BILLED, PARTIAL, PAID)
  //   planned                 ← PLANNED rows (scheduled, not yet issued) — its own bucket
  //   overdue                 ← BILLED/PARTIAL rows past their due date
  // CANCELLED rows are excluded entirely.
  const now = new Date()
  const feeRows = currentFY ? await prisma.studentFee.findMany({
    where: { schoolId, fiscalYearId: currentFY.id, status: { not: "CANCELLED" } },
    select: {
      finalAmount: true, paidAmount: true, status: true, dueDateAD: true,
      student: { select: { classId: true } },
    },
  }) : []

  type Totals = { billed: number; paid: number; planned: number; overdueCount: number; overdueOutstanding: number }
  const classTotals = new Map<string, Totals>()
  for (const r of feeRows) {
    const cid = r.student.classId
    if (!cid) continue
    const t = classTotals.get(cid) ?? { billed: 0, paid: 0, planned: 0, overdueCount: 0, overdueOutstanding: 0 }
    const final = Number(r.finalAmount)
    const paid  = Number(r.paidAmount)
    if (r.status === "PLANNED") {
      t.planned += final
    } else {
      t.billed += final
      t.paid   += paid
      if ((r.status === "BILLED" || r.status === "PARTIAL") && r.dueDateAD < now) {
        t.overdueCount++
        t.overdueOutstanding += Math.max(0, final - paid)
      }
    }
    classTotals.set(cid, t)
  }

  const cards: ClassCard[] = classes.map(c => {
    const t = classTotals.get(c.id) ?? { billed: 0, paid: 0, planned: 0, overdueCount: 0, overdueOutstanding: 0 }
    const outstanding = Math.max(0, t.billed - t.paid)
    const pct = t.billed > 0 ? Math.round((t.paid / t.billed) * 100) : 0
    return {
      id:                 c.id,
      name:               c.name,
      facultyName:        c.faculty?.name ?? null,
      classTeacher:       c.classTeacher?.fullName ?? null,
      studentCount:       c._count.students,
      billed:             t.billed,
      paid:               t.paid,
      outstanding,
      planned:            t.planned,
      overdueCount:       t.overdueCount,
      overdueOutstanding: t.overdueOutstanding,
      pct,
    }
  })

  // KPI totals
  const totalStudents    = cards.reduce((s, c) => s + c.studentCount, 0)
  const totalBilled      = cards.reduce((s, c) => s + c.billed, 0)
  const totalPaid        = cards.reduce((s, c) => s + c.paid, 0)
  const totalPlanned     = cards.reduce((s, c) => s + c.planned, 0)
  const totalOverdue     = cards.reduce((s, c) => s + c.overdueOutstanding, 0)
  const totalOutstanding = Math.max(0, totalBilled - totalPaid)
  const overallPct       = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Open a class to view the per-student fee grid, apply plans, or bill a period.
            {currentFY && <span className="text-slate-400"> · FY {currentFY.name}</span>}
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
          <GraduationCap className="w-3 h-3" />{cards.length} class{cards.length === 1 ? "" : "es"}
        </div>
      </div>

      {!currentFY && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            No current fiscal year. <Link href="/accounting/fiscal-years" className="underline font-bold">Configure one →</Link> to see billing aggregates.
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPI label="Students"    value={`${totalStudents}`}                 sub="Across all classes" tone="slate"   icon={UsersIcon} />
        <KPI label="Billed"      value={`Rs. ${formatMoney(totalBilled)}`}  sub="Issued this FY"     tone="primary" icon={FileText} />
        <KPI label="Collected"   value={`Rs. ${formatMoney(totalPaid)}`}    sub={`${overallPct}% of billed`} tone="emerald" icon={TrendingUp} />
        <KPI label="Outstanding" value={`Rs. ${formatMoney(totalOutstanding)}`} sub={totalOverdue > 0 ? `Rs. ${formatMoney(totalOverdue)} overdue` : totalOutstanding > 0 ? "Awaiting collection" : "All caught up"} tone={totalOutstanding > 0 ? "rose" : "emerald"} icon={Wallet} />
        <KPI label="Planned"     value={`Rs. ${formatMoney(totalPlanned)}`} sub="Scheduled, not billed" tone="indigo" icon={CalendarClock} />
      </div>

      {cards.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 p-12 text-center">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No classes defined yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            <Link href="/academics/classes" className="underline font-bold">Create classes in Academics →</Link>
          </p>
        </div>
      ) : (
        <ClassesClient cards={cards} faculties={faculties} />
      )}
    </div>
  )
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function KPI({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "slate" | "primary" | "emerald" | "rose" | "indigo"
  icon: React.ElementType
}) {
  const palette = {
    slate:   { ring: "ring-slate-100",   icon: "text-slate-500 bg-slate-50",     value: "text-slate-700" },
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    rose:    { ring: "ring-rose-100",    icon: "text-rose-600 bg-rose-50",       value: "text-rose-700" },
    indigo:  { ring: "ring-indigo-100",  icon: "text-indigo-600 bg-indigo-50",   value: "text-indigo-700" },
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 ring-1", palette.ring)}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", palette.icon)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={cn("text-xl font-bold font-mono tabular-nums leading-tight", palette.value)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
