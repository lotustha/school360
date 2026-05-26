import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Users, Info, GraduationCap, BookOpen } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Prisma } from "../../../../../generated/prisma/client"
import { cn } from "@/lib/utils"
import { type SectionColumn } from "./columns"
import { SectionDrawer } from "./section-drawer"
import { SectionsTable } from "./sections-table"
import { GlobalFiltersBar } from "@/components/ui/global-filters-bar"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"

export const metadata: Metadata = { title: "Sections" }

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{ facultyId?: string; classId?: string }>
}

export default async function SectionsPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const facultyIds = parseList(sp.facultyId)
  const classIds   = parseList(sp.classId)

  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  // Faculty filter: respect "none" sentinel for classes with no faculty
  const facultyNone     = facultyIds.includes("none")
  const realFacultyIds  = facultyIds.filter(id => id !== "none")
  const classFacultyFilter: Prisma.ClassWhereInput | undefined =
    realFacultyIds.length > 0 && facultyNone
      ? { OR: [{ facultyId: { in: realFacultyIds } }, { facultyId: null }] }
      : realFacultyIds.length > 0
        ? { facultyId: { in: realFacultyIds } }
        : facultyNone
          ? { facultyId: null }
          : undefined

  const sectionWhere: Prisma.SectionWhereInput = {
    schoolId: school.id,
    ...(classIds.length > 0 && { classId: { in: classIds } }),
    ...(classFacultyFilter && { class: classFacultyFilter }),
  }

  const [sections, classes, faculties, studentsBySection, studentsTotal] = await Promise.all([
    prisma.section.findMany({
      where: sectionWhere,
      include: {
        class: {
          include: {
            faculty:  true,
            subjects: { select: { id: true, name: true }, orderBy: { name: "asc" } },
          },
        },
      },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      include: { faculty: true, sections: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Per-section student counts (active only)
    prisma.student.groupBy({
      by:    ["sectionId"],
      where: { schoolId: school.id, status: "ACTIVE", sectionId: { not: null } },
      _count: { sectionId: true },
    }),
    prisma.student.count({ where: { schoolId: school.id, status: "ACTIVE" } }),
  ])

  const sectionStudentCount = new Map<string, number>(
    studentsBySection.map(g => [g.sectionId!, g._count.sectionId]),
  )

  const rows: SectionColumn[] = sections.map(s => ({
    id:          s.id,
    name:        s.name,
    classId:     s.classId,
    className:   s.class.name,
    facultyName: s.class.faculty?.name ?? null,
    subjects:    s.class.subjects.map(sub => sub.name),
  }))

  const classesForDrawer = sortClassesByFacultyThenName(
    classes.map(c => ({
      id: c.id, name: c.name, facultyName: c.faculty?.name ?? null,
    })),
  )

  const classesForFilter = sortClassesByFacultyThenName(
    classes.map(c => ({
      id:          c.id,
      name:        c.name,
      facultyId:   c.facultyId,
      facultyName: c.faculty?.name ?? null,
      sections:    c.sections.map(s => ({ id: s.id, name: s.name })),
    })),
  )

  // KPI calculations
  const studentsInFilter = rows.reduce((s, r) => s + (sectionStudentCount.get(r.id) ?? 0), 0)
  const avgPerSection = rows.length > 0 ? Math.round(studentsInFilter / rows.length) : 0
  const hasFilter = facultyIds.length > 0 || classIds.length > 0
  const distinctClasses = new Set(rows.map(r => r.classId)).size

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Student-facing groupings within a class (e.g. 10-A, 10-B).
            Each student belongs to exactly one section per academic year.
          </p>
        </div>
        <SectionDrawer schoolId={school.id} classes={classesForDrawer} />
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={hasFilter ? "Sections (filtered)" : "Sections"} value={rows.length}   sub="In scope" tone="sky" icon={Users} />
        <Kpi label="Students in scope" value={studentsInFilter}         sub={hasFilter ? "Match current filter" : `${studentsTotal} school-wide`} tone="emerald" icon={Users} />
        <Kpi label="Avg per section"   value={avgPerSection}            sub={rows.length === 0 ? "No sections" : "Students per group"}            tone="primary" icon={Users} />
        <Kpi label="Distinct classes"  value={distinctClasses}          sub={hasFilter ? "Across filtered sections" : "Spanned by sections"}      tone="amber"   icon={GraduationCap} />
      </div>

      <GlobalFiltersBar
        show={["facultyId", "classId"]}
        faculties={faculties}
        classes={classesForFilter}
      />

      {classes.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            <strong>No classes found.</strong> Create classes first before adding sections.{" "}
            <Link href="/academics/classes" className="underline font-bold hover:text-amber-950">Go to Classes →</Link>
          </p>
        </div>
      )}

      {rows.length === 0 && classes.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white/60 p-8 text-center">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-600">
            {hasFilter ? "No sections match the current filters." : "No sections yet."}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {hasFilter ? "Try clearing the filters above." : "Click \"Add section\" to create your first."}
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <SectionsTable rows={rows} schoolId={school.id} classes={classesForDrawer} />
        </div>
      )}

      {/* Subject hint */}
      {rows.length > 0 && rows.every(r => r.subjects.length === 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
          <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>No subjects attached to classes yet.</strong> Sections inherit subjects from their class.
            Add subjects in <Link href="/academics/subjects" className="underline font-bold">/academics/subjects</Link> to enable gradebook on these sections.
          </p>
        </div>
      )}
    </div>
  )
}

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: number; sub: string
  tone: "sky" | "emerald" | "primary" | "amber"
  icon: React.ElementType
}) {
  const palette = {
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",         value: "text-sky-700" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",     value: "text-amber-700" },
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
