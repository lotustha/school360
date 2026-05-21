import { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { GraduationCap, Layers } from "lucide-react"
import { Prisma } from "../../../../generated/prisma/client"
import { Button } from "@/components/ui/button"
import { StudentDrawer } from "./student-drawer"
import { StudentsToolbar } from "./students-toolbar"
import { StudentsTabular } from "./students-tabular"
import { StudentsPagination } from "./students-pagination"
import type { StudentRow } from "./students-table"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"

export const metadata: Metadata = { title: "Students" }

const DEFAULT_PAGE_SIZE = 25

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{
    q?:              string
    facultyId?:      string
    classId?:        string
    sectionId?:      string
    status?:         string
    academicYearId?: string
    page?:           string
    pageSize?:       string
    sort?:           string
  }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

function mapSortField(field: string, dir: "asc" | "desc"): Prisma.StudentOrderByWithRelationInput | null {
  switch (field) {
    case "admissionNo":       return { admissionNo:       dir }
    case "rollNumber":        return { rollNumber:        dir }
    case "name":              return { user: { fullName:  dir } }
    case "className":         return { class: { name:     dir } }
    case "gender":            return { gender:            dir }
    case "status":            return { status:            dir }
    case "nebRegistrationNo": return { nebRegistrationNo: dir }
    case "symbolNumber":      return { symbolNumber:      dir }
    default:                  return null
  }
}

export default async function StudentsPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const {
    q = "", page: pageStr = "1", pageSize: pageSizeStr = "25", sort = "",
  } = sp
  const facultyIds      = parseList(sp.facultyId)
  const classIds        = parseList(sp.classId)
  const sectionIds      = parseList(sp.sectionId)
  const statuses        = parseList(sp.status)
  const academicYearIds = parseList(sp.academicYearId)

  const page = Math.max(1, parseInt(pageStr, 10) || 1)
  const pageSizeParam = ["25", "50", "100", "all"].includes(pageSizeStr) ? pageSizeStr : "25"
  const isAll = pageSizeParam === "all"
  const pageSize = isAll ? 0 : parseInt(pageSizeParam, 10) || DEFAULT_PAGE_SIZE

  // Multi-sort
  const orderBy: Prisma.StudentOrderByWithRelationInput[] = []
  if (sort) {
    for (const part of sort.split(",")) {
      const [field, dirRaw] = part.split(":")
      const dir: "asc" | "desc" = dirRaw === "desc" ? "desc" : "asc"
      const clause = mapSortField(field, dir)
      if (clause) orderBy.push(clause)
    }
  }
  orderBy.push({ class: { name: "asc" } }, { rollNumber: "asc" }, { admissionNo: "asc" })

  const school = await prisma.school.findUnique({
    where:   { slug: domain },
    include: {
      faculties: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      classes: {
        orderBy: { name: "asc" },
        include: {
          faculty:  { select: { name: true } },
          sections: { orderBy: { name: "asc" } },
        },
      },
      academicYears: {
        orderBy: [{ isCurrent: "desc" }, { startDateBS: "desc" }],
        select:  { id: true, name: true, isCurrent: true, facultyId: true, startDateBS: true },
      },
    },
  })
  if (!school) notFound()

  // Faculty filter: handle "none" sentinel mixed with real IDs
  const facultyNone = facultyIds.includes("none")
  const realFacultyIds = facultyIds.filter(id => id !== "none")
  const facultyClassFilter: Prisma.ClassWhereInput | undefined =
    realFacultyIds.length > 0 && facultyNone
      ? { OR: [{ facultyId: { in: realFacultyIds } }, { facultyId: null }] }
      : realFacultyIds.length > 0
        ? { facultyId: { in: realFacultyIds } }
        : facultyNone
          ? { facultyId: null }
          : undefined

  const where: Prisma.StudentWhereInput = {
    schoolId: school.id,
    ...(statuses.length        > 0 && { status:         { in: statuses } }),
    ...(academicYearIds.length > 0 && { academicYearId: { in: academicYearIds } }),
    ...(sectionIds.length > 0
      ? { sectionId: { in: sectionIds } }
      : classIds.length > 0
        ? { classId: { in: classIds } }
        : facultyClassFilter
          ? { class: facultyClassFilter }
          : {}),
    ...(q && {
      OR: [
        { user:              { fullName:           { contains: q, mode: "insensitive" } } },
        { admissionNo:                             { contains: q, mode: "insensitive" } },
        { fullNameNepali:                          { contains: q, mode: "insensitive" } },
        { nebRegistrationNo:                       { contains: q, mode: "insensitive" } },
        { rollNumber:                              { contains: q, mode: "insensitive" } },
      ],
    }),
  }

  const [totalCount, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      include: {
        user:      { select: { fullName: true, email: true, avatarUrl: true } },
        class:     { select: { name: true } },
        section:   { select: { name: true } },
        guardians: { orderBy: { isPrimary: "desc" }, take: 1 },
      },
      orderBy,
      ...(isAll ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    }),
  ])

  const rows: StudentRow[] = students.map(s => ({
    id:                s.id,
    admissionNo:       s.admissionNo,
    rollNumber:        s.rollNumber,
    name:              s.user.fullName,
    avatarUrl:         s.user.avatarUrl,
    fullNameNepali:    s.fullNameNepali,
    email:             s.user.email,
    className:         s.class.name,
    sectionName:       s.section?.name ?? null,
    gender:            s.gender,
    status:            s.status,
    nebRegistrationNo: s.nebRegistrationNo,
    symbolNumber:      s.symbolNumber,
    dobBS:             s.dobBS,
    disabilityStatus:  s.disabilityStatus,
    scholarshipType:   s.scholarshipType,
    guardian:          s.guardians[0]?.name      ?? null,
    guardianPhone:     s.guardians[0]?.phone     ?? null,
    guardianRelation:  s.guardians[0]?.relation  ?? null,
  }))

  const pageOffset = isAll ? 0 : (page - 1) * pageSize
  const paginationSize = isAll ? Math.max(1, totalCount) : pageSize

  // Auto-hide class column when narrowed to a single class or section
  const narrowedToClass = classIds.length === 1 || sectionIds.length === 1

  // Year filter list: keep the latest session per faculty (null faculty bucket
  // included). When two latest sessions across faculties share the same name,
  // collapse to one entry so the dropdown shows distinct names only.
  const filterAcademicYears = (() => {
    const latestByFaculty = new Map<string, typeof school.academicYears[number]>()
    for (const y of school.academicYears) {
      const key = y.facultyId ?? "__general__"
      const prev = latestByFaculty.get(key)
      if (!prev) { latestByFaculty.set(key, y); continue }
      if (prev.isCurrent && !y.isCurrent) continue
      if (!prev.isCurrent && y.isCurrent) { latestByFaculty.set(key, y); continue }
      if ((y.startDateBS ?? "") > (prev.startDateBS ?? "")) latestByFaculty.set(key, y)
    }
    const seenNames = new Set<string>()
    const out: typeof school.academicYears = []
    for (const y of latestByFaculty.values()) {
      if (seenNames.has(y.name)) continue
      seenNames.add(y.name)
      out.push(y)
    }
    return out.sort((a, b) => (b.startDateBS ?? "").localeCompare(a.startDateBS ?? ""))
  })()

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Students</h2>
            <p className="text-sm text-muted-foreground">Browse, search, sort and print student records</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/students/bulk">
            <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer bg-white">
              <Layers className="w-4 h-4" /> Bulk edit
            </Button>
          </Link>
          <StudentDrawer
            schoolId={school.id}
            slug={school.slug}
            faculties={school.faculties}
            classes={sortClassesByFacultyThenName(school.classes.map(c => ({
              id:          c.id,
              name:        c.name,
              facultyId:   c.facultyId,
              facultyName: c.faculty?.name ?? null,
              sections:    c.sections.map(s => ({ id: s.id, name: s.name })),
            })))}
            academicYears={school.academicYears}
          />
        </div>
      </div>

      <StudentsToolbar
        faculties={school.faculties}
        academicYears={filterAcademicYears}
        classes={sortClassesByFacultyThenName(school.classes.map(c => ({
          id:        c.id,
          name:      c.name,
          facultyId:   c.facultyId,
          facultyName: c.faculty?.name ?? null,
          sections:    c.sections.map(s => ({ id: s.id, name: s.name })),
        })))}
        initialQuery={q}
        initialFacultyIds={facultyIds}
        initialClassIds={classIds}
        initialSectionIds={sectionIds}
        initialStatuses={statuses}
        initialAcademicYearIds={academicYearIds}
        totalCount={totalCount}
      />

      <StudentsTabular
        schoolId={school.id}
        rows={rows}
        pageOffset={pageOffset}
        narrowedToClass={narrowedToClass}
      />

      <StudentsPagination
        page={page}
        pageSize={paginationSize}
        pageSizeParam={pageSizeParam}
        totalCount={totalCount}
      />
    </div>
  )
}
