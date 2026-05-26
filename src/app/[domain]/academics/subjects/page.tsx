import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Prisma } from "../../../../../generated/prisma/client"
import { SubjectDrawer } from "./subject-drawer"
import { SubjectsSubNav } from "./subjects-subnav"
import { SubjectsToolbar } from "./subjects-toolbar"
import { SubjectsTable, type SubjectRow } from "./subjects-table"
import { SubjectsPagination } from "./subjects-pagination"
import { getSubjectYearStatuses, getSubjectYearConfigs } from "@/actions/academics"
import { BookOpen, Info, GraduationCap, UserCheck, AlertCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"

export const metadata: Metadata = { title: "Subjects" }

const PAGE_SIZE = 25

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{
    q?:              string
    facultyId?:      string
    classId?:        string
    academicYearId?: string
    page?:           string
    sort?:           string
  }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

function mapSortField(field: string, dir: "asc" | "desc"): Prisma.SubjectOrderByWithRelationInput | null {
  switch (field) {
    case "name":      return { name: dir }
    case "code":      return { code: dir }
    case "className": return { class: { name: dir } }
    case "credit":    return { creditHours: dir }
    default:          return null
  }
}

export default async function SubjectsPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const { q = "", page: pageStr = "1", sort = "" } = sp
  const facultyIds      = parseList(sp.facultyId)
  const classIds        = parseList(sp.classId)
  const academicYearIds = parseList(sp.academicYearId)

  const page = Math.max(1, parseInt(pageStr, 10) || 1)

  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  // Faculty filter ("none" sentinel = classes without a faculty)
  const facultyNone     = facultyIds.includes("none")
  const realFacultyIds  = facultyIds.filter(id => id !== "none")
  const facultyClassFilter: Prisma.ClassWhereInput | undefined =
    realFacultyIds.length > 0 && facultyNone
      ? { OR: [{ facultyId: { in: realFacultyIds } }, { facultyId: null }] }
      : realFacultyIds.length > 0
        ? { facultyId: { in: realFacultyIds } }
        : facultyNone
          ? { facultyId: null }
          : undefined

  // Build sort
  const orderBy: Prisma.SubjectOrderByWithRelationInput[] = []
  if (sort) {
    for (const part of sort.split(",")) {
      const [field, dirRaw] = part.split(":")
      const dir: "asc" | "desc" = dirRaw === "desc" ? "desc" : "asc"
      const clause = mapSortField(field, dir)
      if (clause) orderBy.push(clause)
    }
  }
  orderBy.push({ class: { name: "asc" } }, { name: "asc" })

  // Academic years are faculty-scoped: a year with facultyId=X applies only to
  // classes under faculty X; facultyId=null applies only to General-bucket
  // classes (class.facultyId=null). Pre-fetch the selected years so we can
  // enforce the (subject.class.facultyId == year.facultyId) precondition
  // alongside the per-year active/inactive override.
  const selectedYears = academicYearIds.length > 0
    ? await prisma.academicYear.findMany({
        where:  { id: { in: academicYearIds }, schoolId: school.id },
        select: { id: true, facultyId: true },
      })
    : []

  const where: Prisma.SubjectWhereInput = {
    schoolId: school.id,
    ...(classIds.length > 0
      ? { classId: { in: classIds } }
      : facultyClassFilter
        ? { class: facultyClassFilter }
        : {}),
    // For each selected year: subject's class must belong to that year's
    // faculty AND not be explicitly deactivated for that year.
    ...(selectedYears.length > 0 && {
      AND: selectedYears.map(y => ({
        class: y.facultyId
          ? { facultyId: y.facultyId }
          : { facultyId: null },
        OR: [
          { yearStatuses: { none: { academicYearId: y.id } } }, // default = active
          { yearStatuses: { some: { academicYearId: y.id, isActive: true } } },
        ],
      })),
    }),
    ...(q && {
      OR: [
        { name:      { contains: q, mode: "insensitive" } },
        { shortName: { contains: q, mode: "insensitive" } },
        { code:      { contains: q, mode: "insensitive" } },
        { teachers:  { some: { teacher: { fullName: { contains: q, mode: "insensitive" } } } } },
      ],
    }),
  }

  const [totalCount, withoutTeacherCount, distinctClassesWithSubjects, subjects, classes, faculties, academicYears, teachers] = await Promise.all([
    prisma.subject.count({ where }),
    prisma.subject.count({ where: { ...where, teachers: { none: {} } } }),
    prisma.subject.findMany({
      where,
      select: { classId: true },
      distinct: ["classId"],
    }).then(rows => rows.length),
    prisma.subject.findMany({
      where,
      include: {
        class:    { include: { faculty: { select: { name: true } } } },
        teachers: {
          include: { teacher: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: [{ isPrimary: "desc" }, { teacher: { fullName: "asc" } }],
        },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.class.findMany({
      where: { schoolId: school.id },
      include: {
        faculty: true,
        sections: { select: { id: true, name: true } },
        subjects: { select: { id: true, name: true, code: true, creditHours: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, isCurrent: true, facultyId: true },
      orderBy: { name: "desc" },
    }),
    prisma.user.findMany({
      where:   { schoolId: school.id, role: { in: ["TEACHER", "STAFF", "SCHOOL_ADMIN"] } },
      select:  { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    }),
  ])

  const yearStatuses = await getSubjectYearStatuses(subjects.map(s => s.id))

  // Edit-context year: the year whose per-year CH overrides the drawer will
  // edit. Priority:
  //   1. Exactly one academicYearId selected in URL filter → use it.
  //   2. Else: the school's current year (prefer school-wide, fallback any).
  // null → drawer falls back to editing Subject-level defaults.
  const editContextYear: { id: string; name: string } | null =
    academicYearIds.length === 1
      ? (academicYears.find(y => y.id === academicYearIds[0]) ?? null)
      : (academicYears.find(y => y.isCurrent && y.facultyId === null)
         ?? academicYears.find(y => y.isCurrent)
         ?? null)
  const yearConfigsByEditYear = editContextYear
    ? await getSubjectYearConfigs(subjects.map(s => s.id), editContextYear.id)
    : {}

  const rows: SubjectRow[] = subjects.map(s => {
    const cfg = yearConfigsByEditYear[s.id]
    return {
      id:                  s.id,
      name:                s.name,
      shortName:           s.shortName,
      code:                s.code,
      classId:             s.classId,
      className:           s.class.name,
      facultyId:           s.class.facultyId ?? null,
      facultyName:         s.class.faculty?.name ?? null,
      creditHours:         s.creditHours,
      internalCreditHours: s.internalCreditHours,
      externalCreditHours: s.externalCreditHours,
      // Per-year overrides for the edit-context year (null = no override stored).
      yearCreditHours:         cfg?.creditHours         ?? null,
      yearInternalCreditHours: cfg?.internalCreditHours ?? null,
      yearExternalCreditHours: cfg?.externalCreditHours ?? null,
      type:                s.type,
      yearStatuses:        yearStatuses[s.id] ?? {},
      assignedTeachers:    s.teachers.map(t => ({
        id:        t.teacher.id,
        fullName:  t.teacher.fullName,
        avatarUrl: t.teacher.avatarUrl,
        isPrimary: t.isPrimary,
      })),
    }
  })

  const classesForDrawer = sortClassesByFacultyThenName(
    classes.map(c => ({
      id: c.id, name: c.name,
      facultyName: c.faculty?.name ?? null,
      facultyId:   c.facultyId ?? null,
    })),
  )
  const sourceClasses = sortClassesByFacultyThenName(
    classes.map(c => ({
      id: c.id, name: c.name,
      facultyName: c.faculty?.name ?? null,
      facultyId:   c.facultyId ?? null,
      subjects: c.subjects,
    })),
  )

  const withTeacherCount = totalCount - withoutTeacherCount
  const hasFilter = !!q || facultyIds.length > 0 || classIds.length > 0 || academicYearIds.length > 0

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <SubjectsSubNav />

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            School-wide subject catalog. Search, filter by stream / class / session,
            and assign teachers. Each subject belongs to exactly one class.
            {hasFilter && <span className="text-primary font-bold"> · filtered</span>}
          </p>
        </div>
        <SubjectDrawer
          schoolId={school.id}
          classes={classesForDrawer}
          faculties={faculties}
          academicYears={academicYears}
          sourceClasses={sourceClasses}
        />
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={hasFilter ? "Subjects (filtered)" : "Total subjects"} value={totalCount}                  sub="In current scope"          tone="amber"  icon={BookOpen} />
        <Kpi label="Classes covered"   value={distinctClassesWithSubjects}                                   sub={classes.length > 0 ? `of ${classes.length} class${classes.length === 1 ? "" : "es"}` : "Add classes first"} tone="primary" icon={GraduationCap} />
        <Kpi label="With teachers"     value={withTeacherCount}                                              sub={totalCount > 0 ? `${Math.round((withTeacherCount / totalCount) * 100)}% staffed` : "No subjects yet"}     tone="emerald" icon={UserCheck} />
        <Kpi label="No teacher yet"    value={withoutTeacherCount}                                           sub={withoutTeacherCount > 0 ? "Won't show in gradebook" : "All staffed"}                                       tone={withoutTeacherCount > 0 ? "rose" : "slate"} icon={AlertCircle} />
      </div>

      {/* Class-missing setup callout */}
      {classes.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            <strong>No classes found.</strong> Create classes before adding subjects.{" "}
            <Link href="/academics/classes" className="underline font-bold hover:text-amber-950">
              Go to Classes →
            </Link>
          </p>
        </div>
      )}

      {/* Unstaffed subjects callout */}
      {totalCount > 0 && withoutTeacherCount > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-900">
              {withoutTeacherCount} subject{withoutTeacherCount === 1 ? "" : "s"} ha{withoutTeacherCount === 1 ? "s" : "ve"} no teacher assigned
            </p>
            <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
              Unstaffed subjects don&apos;t appear in routine, gradebook, or marks entry.
              Open a subject row and pick a teacher to make it usable.
            </p>
          </div>
        </div>
      )}

      <SubjectsToolbar
        faculties={faculties}
        academicYears={academicYears}
        classes={sortClassesByFacultyThenName(classes.map(c => ({
          id: c.id, name: c.name, facultyId: c.facultyId,
          facultyName: c.faculty?.name ?? null,
          sections: c.sections.map(s => ({ id: s.id, name: s.name })),
        })))}
        initialQuery={q}
        totalCount={totalCount}
      />

      <SubjectsTable
        rows={rows}
        schoolId={school.id}
        classes={classesForDrawer}
        academicYears={academicYears}
        sourceClasses={sourceClasses}
        teachers={teachers}
        editContextYearId={editContextYear?.id ?? null}
        editContextYearName={editContextYear?.name ?? null}
      />

      <SubjectsPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} />
    </div>
  )
}

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: number; sub: string
  tone: "amber" | "primary" | "emerald" | "rose" | "slate"
  icon: React.ElementType
}) {
  const palette = {
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",     value: "text-amber-700" },
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    rose:    { ring: "ring-rose-100",    icon: "text-rose-600 bg-rose-50",       value: "text-rose-700" },
    slate:   { ring: "ring-slate-100",   icon: "text-slate-500 bg-slate-50",     value: "text-slate-700" },
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
      <p className="text-[10px] text-slate-500 mt-0.5 truncate" title={sub}>{sub}</p>
    </div>
  )
}
