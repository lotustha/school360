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
import { BookOpen, Info } from "lucide-react"
import Link from "next/link"
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

  const [totalCount, subjects, classes, faculties, academicYears, teachers] = await Promise.all([
    prisma.subject.count({ where }),
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

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <SubjectsSubNav />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Subjects</h2>
            <p className="text-sm text-muted-foreground">Browse, search and manage your school&apos;s subjects</p>
          </div>
        </div>
        <SubjectDrawer
          schoolId={school.id}
          classes={classesForDrawer}
          faculties={faculties}
          academicYears={academicYears}
          sourceClasses={sourceClasses}
        />
      </div>

      {classes.length === 0 && (
        <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-xl p-4">
          <div className="flex gap-2.5">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>No classes found.</strong> Create classes before adding subjects.{" "}
              <Link href="/academics/classes" className="underline font-semibold hover:text-blue-900 transition-colors">
                Go to Classes →
              </Link>
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
