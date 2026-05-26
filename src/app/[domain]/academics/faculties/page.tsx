import { Metadata } from "next"
import { notFound } from "next/navigation"
import { FolderTree, GraduationCap, Users, Info } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { FacultyDrawer } from "./faculty-drawer"
import { FacultiesTable, GENERAL_ROW_ID } from "./faculties-table"
import { type FacultyColumn } from "./columns"

export const metadata: Metadata = { title: "Faculties" }

export default async function FacultiesPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, workingDays: true },
  })
  if (!school) notFound()

  const [faculties, generalClassCount, totalClasses, totalStudents] = await Promise.all([
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.class.count({ where: { schoolId: school.id, facultyId: null } }),
    prisma.class.count({ where: { schoolId: school.id } }),
    prisma.student.count({ where: { schoolId: school.id, status: "ACTIVE" } }),
  ])

  const facultyRows: FacultyColumn[] = faculties.map(f => ({
    id: f.id, name: f.name, classCount: f._count.classes, workingDays: f.workingDays,
    kind: "faculty",
  }))

  // Synthetic "General" row — represents classes without a faculty. Backed by
  // School.workingDays; non-deletable; name not renameable.
  const generalRow: FacultyColumn = {
    id:           GENERAL_ROW_ID,
    name:         "General",
    classCount:   generalClassCount,
    workingDays:  school.workingDays,
    kind:         "general",
  }

  const rows = [generalRow, ...facultyRows]
  const totalFaculties = faculties.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faculties</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Academic streams — Science, Management, Humanities, etc.
            Classes without an explicit faculty live in the General row.
          </p>
        </div>
        <FacultyDrawer schoolId={school.id} schoolWorkingDays={school.workingDays} />
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Faculties"          value={totalFaculties}      sub={totalFaculties === 0 ? "Using General only" : "Custom streams"} tone="violet" icon={FolderTree} />
        <Kpi label="General classes"    value={generalClassCount}   sub="No explicit faculty"     tone="slate"  icon={GraduationCap} />
        <Kpi label="Total classes"      value={totalClasses}        sub="Across all streams"      tone="primary" icon={GraduationCap} />
        <Kpi label="Active students"    value={totalStudents}       sub="School-wide enrolment"   tone="emerald" icon={Users} />
      </div>

      {totalFaculties === 0 && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-violet-900">All classes use the General stream</p>
            <p className="text-xs text-violet-800 mt-0.5 leading-relaxed">
              Faculties are optional. Add one only when Grade 11–12 splits into Science / Management /
              Humanities with separate classes per stream.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <FacultiesTable rows={rows} schoolId={school.id} schoolWorkingDays={school.workingDays} />
      </div>
    </div>
  )
}

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: number; sub: string
  tone: "violet" | "slate" | "primary" | "emerald"
  icon: React.ElementType
}) {
  const palette = {
    violet:  { ring: "ring-violet-100",  icon: "text-violet-600 bg-violet-50",   value: "text-violet-700" },
    slate:   { ring: "ring-slate-100",   icon: "text-slate-500 bg-slate-50",     value: "text-slate-700" },
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
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
      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>
    </div>
  )
}
