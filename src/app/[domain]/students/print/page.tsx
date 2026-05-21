import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Prisma } from "../../../../../generated/prisma/client"
import { PrintView, type PrintMode, type PrintRow } from "./print-view"

export const metadata: Metadata = { title: "Print Students" }

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{
    q?:              string
    facultyId?:      string
    classId?:        string
    sectionId?:      string
    status?:         string
    academicYearId?: string
    sort?:           string
    mode?:           string
    cols?:           string
    title?:          string
    date?:           string
  }>
}

const VALID_MODES = ["ptm", "tour", "roster", "current"] as const

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

export default async function StudentsPrintPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const {
    q = "", sort = "",
    mode: modeRaw = "roster", cols: colsRaw = "", title = "", date = "",
  } = sp
  const facultyIds      = parseList(sp.facultyId)
  const classIds        = parseList(sp.classId)
  const sectionIds      = parseList(sp.sectionId)
  const statuses        = parseList(sp.status)
  const academicYearIds = parseList(sp.academicYearId)

  const mode: PrintMode = (VALID_MODES as readonly string[]).includes(modeRaw) ? modeRaw as PrintMode : "roster"
  const cols = colsRaw ? colsRaw.split(",").filter(Boolean) : []

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, name: true, slug: true, logoUrl: true, address: true },
  })
  if (!school) notFound()

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

  const students = await prisma.student.findMany({
    where,
    include: {
      user:      { select: { fullName: true, email: true } },
      class:     { select: { name: true } },
      section:   { select: { name: true } },
      guardians: { orderBy: { isPrimary: "desc" }, take: 1 },
    },
    orderBy,
  })

  // Header scope info — only narrow class/section labels when exactly one is selected
  let scopeClassName:   string | null = null
  let scopeSectionName: string | null = null
  let scopeLabel = "All Students"
  const narrowedToClass = classIds.length === 1 || sectionIds.length === 1

  if (sectionIds.length === 1) {
    const sec = await prisma.section.findUnique({ where: { id: sectionIds[0] }, include: { class: true } })
    if (sec) {
      scopeClassName   = sec.class.name
      scopeSectionName = sec.name
      scopeLabel       = `${sec.class.name} · ${sec.name}`
    }
  } else if (classIds.length === 1) {
    const cls = await prisma.class.findUnique({ where: { id: classIds[0] } })
    if (cls) {
      scopeClassName = cls.name
      scopeLabel     = cls.name
    }
  } else if (classIds.length > 1) {
    const cls = await prisma.class.findMany({ where: { id: { in: classIds } }, orderBy: { name: "asc" } })
    scopeLabel = `Classes: ${cls.map(c => c.name).join(", ")}`
  } else if (sectionIds.length > 1) {
    const secs = await prisma.section.findMany({ where: { id: { in: sectionIds } }, include: { class: true } })
    scopeLabel = `Sections: ${secs.map(s => `${s.class.name} ${s.name}`).join(", ")}`
  } else if (facultyNone && realFacultyIds.length === 0) {
    scopeLabel = "General"
  } else if (realFacultyIds.length > 0) {
    const facs = await prisma.faculty.findMany({ where: { id: { in: realFacultyIds } }, orderBy: { name: "asc" } })
    scopeLabel = facs.map(f => f.name).join(", ")
    if (facultyNone) scopeLabel += ", General"
  }

  // Academic year label for header (concat if multiple)
  let academicYearLabel: string | null = null
  if (academicYearIds.length > 0) {
    const ays = await prisma.academicYear.findMany({
      where:  { id: { in: academicYearIds } },
      select: { name: true },
      orderBy: { name: "desc" },
    })
    academicYearLabel = ays.map(y => y.name).join(", ") || null
  }

  const rows: PrintRow[] = students.map(s => ({
    id:                s.id,
    admissionNo:       s.admissionNo,
    rollNumber:        s.rollNumber,
    name:              s.user.fullName,
    fullNameNepali:    s.fullNameNepali,
    className:         s.class.name,
    sectionName:       s.section?.name ?? null,
    gender:            s.gender,
    status:            s.status,
    nebRegistrationNo: s.nebRegistrationNo,
    symbolNumber:      s.symbolNumber,
    dobBS:             s.dobBS,
    guardian:          s.guardians[0]?.name      ?? null,
    guardianPhone:     s.guardians[0]?.phone     ?? null,
    guardianRelation:  s.guardians[0]?.relation  ?? null,
  }))

  return (
    <PrintView
      mode={mode}
      cols={cols}
      title={title}
      date={date}
      scopeLabel={scopeLabel}
      narrowedToClass={narrowedToClass}
      className={scopeClassName}
      sectionName={scopeSectionName}
      academicYearLabel={academicYearLabel}
      school={{ name: school.name, address: school.address, logoUrl: school.logoUrl }}
      rows={rows}
    />
  )
}
