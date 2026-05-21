"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ──────────────────────────────────────────────────────────────────────────────
// Academic Year CRUD (faculty-scoped)
// ──────────────────────────────────────────────────────────────────────────────

export interface AcademicYearWithFaculty {
  id:          string
  name:        string
  startDateBS: string
  endDateBS:   string
  isCurrent:   boolean
  schoolId:    string
  facultyId:   string | null
  faculty:     { id: string; name: string } | null
  _counts:     {
    students:    number
    exams:       number
    evaluations: number
  }
}

export async function listAcademicYears(schoolId: string): Promise<AcademicYearWithFaculty[]> {
  const rows = await prisma.academicYear.findMany({
    where:   { schoolId },
    include: {
      faculty: { select: { id: true, name: true } },
      _count:  { select: { students: true, exams: true, evaluations: true } },
    },
    orderBy: [{ faculty: { name: "asc" } }, { isCurrent: "desc" }, { name: "desc" }],
  })
  return rows.map(r => ({
    id:          r.id,
    name:        r.name,
    startDateBS: r.startDateBS,
    endDateBS:   r.endDateBS,
    isCurrent:   r.isCurrent,
    schoolId:    r.schoolId,
    facultyId:   r.facultyId,
    faculty:     r.faculty,
    _counts: {
      students:    r._count.students,
      exams:       r._count.exams,
      evaluations: r._count.evaluations,
    },
  }))
}

export async function createAcademicYear(args: {
  schoolId:    string
  name:        string
  startDateBS: string
  endDateBS:   string
  facultyId:   string | null
  isCurrent:   boolean
}): Promise<{ id: string }> {
  const name = args.name.trim()
  if (!name) throw new Error("Name is required")
  if (!args.startDateBS.trim() || !args.endDateBS.trim()) {
    throw new Error("Start and end dates are required")
  }

  // If faculty is set, verify it belongs to the school
  if (args.facultyId) {
    const f = await prisma.faculty.findFirst({
      where:  { id: args.facultyId, schoolId: args.schoolId },
      select: { id: true },
    })
    if (!f) throw new Error("Faculty not found in this school")
  }

  // Name uniqueness within (school, faculty) group
  const dup = await prisma.academicYear.findFirst({
    where:  {
      schoolId:  args.schoolId,
      facultyId: args.facultyId,
      name,
    },
    select: { id: true },
  })
  if (dup) throw new Error(`"${name}" already exists for this faculty`)

  const result = await prisma.$transaction(async (tx) => {
    if (args.isCurrent) {
      await tx.academicYear.updateMany({
        where: { schoolId: args.schoolId, facultyId: args.facultyId, isCurrent: true },
        data:  { isCurrent: false },
      })
    }
    return await tx.academicYear.create({
      data: {
        schoolId:    args.schoolId,
        name,
        startDateBS: args.startDateBS.trim(),
        endDateBS:   args.endDateBS.trim(),
        facultyId:   args.facultyId,
        isCurrent:   args.isCurrent,
      },
      select: { id: true },
    })
  })

  revalidatePath("/academics/years")
  return result
}

export async function updateAcademicYear(
  id:   string,
  data: {
    name?:        string
    startDateBS?: string
    endDateBS?:   string
    facultyId?:   string | null
    isCurrent?:   boolean
  },
): Promise<void> {
  const existing = await prisma.academicYear.findUnique({
    where:  { id },
    select: { schoolId: true, facultyId: true, isCurrent: true },
  })
  if (!existing) throw new Error("Academic year not found")

  // If moving to a new faculty, validate faculty belongs to school
  if (data.facultyId !== undefined && data.facultyId !== null) {
    const f = await prisma.faculty.findFirst({
      where:  { id: data.facultyId, schoolId: existing.schoolId },
      select: { id: true },
    })
    if (!f) throw new Error("Faculty not found in this school")
  }

  const nextFacultyId = data.facultyId !== undefined ? data.facultyId : existing.facultyId
  const willBeCurrent = data.isCurrent !== undefined ? data.isCurrent : existing.isCurrent

  await prisma.$transaction(async (tx) => {
    // Peer demotion in the (possibly new) faculty group
    if (willBeCurrent) {
      await tx.academicYear.updateMany({
        where: {
          schoolId:  existing.schoolId,
          facultyId: nextFacultyId,
          isCurrent: true,
          NOT:       { id },
        },
        data: { isCurrent: false },
      })
    }
    await tx.academicYear.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name:        data.name.trim()        }),
        ...(data.startDateBS !== undefined && { startDateBS: data.startDateBS.trim() }),
        ...(data.endDateBS   !== undefined && { endDateBS:   data.endDateBS.trim()   }),
        ...(data.facultyId   !== undefined && { facultyId:   data.facultyId          }),
        ...(data.isCurrent   !== undefined && { isCurrent:   data.isCurrent          }),
      },
    })
  })

  revalidatePath("/academics/years")
  revalidatePath("/students")
  revalidatePath("/academics/routine")
}

/** Promote `id` to current; demote all peers in the same faculty group. */
export async function setCurrentAcademicYear(id: string): Promise<void> {
  const target = await prisma.academicYear.findUnique({
    where:  { id },
    select: { schoolId: true, facultyId: true },
  })
  if (!target) throw new Error("Academic year not found")

  await prisma.$transaction([
    prisma.academicYear.updateMany({
      where: {
        schoolId:  target.schoolId,
        facultyId: target.facultyId,
        isCurrent: true,
        NOT:       { id },
      },
      data: { isCurrent: false },
    }),
    prisma.academicYear.update({
      where: { id },
      data:  { isCurrent: true },
    }),
  ])

  revalidatePath("/academics/years")
  revalidatePath("/students")
  revalidatePath("/academics/routine")
}

/**
 * Find the most recent prior academic year inside the same (school, faculty)
 * group as `toYearId`. Returns the year row (id + name) or null if there are
 * no eligible peers (e.g. first year for this faculty).
 *
 * Eligibility: same schoolId, same facultyId, NOT the toYear itself, and
 * whose `startDateBS` precedes `toYear.startDateBS` when both are present
 * (BS dates sort lexicographically when zero-padded to YYYY-MM-DD).
 */
export async function getPreviousAcademicYear(
  toYearId: string,
): Promise<{ id: string; name: string } | null> {
  const toYear = await prisma.academicYear.findUnique({
    where:  { id: toYearId },
    select: { schoolId: true, facultyId: true, startDateBS: true },
  })
  if (!toYear) return null

  const prev = await prisma.academicYear.findFirst({
    where: {
      schoolId:    toYear.schoolId,
      facultyId:   toYear.facultyId,
      NOT:         { id: toYearId },
      startDateBS: { lt: toYear.startDateBS },
    },
    orderBy: { startDateBS: "desc" },
    select:  { id: true, name: true },
  })
  return prev
}

/**
 * Copy per-year subject config (isActive + CH split) from one academic year to
 * another. Skips subjects that already have a config row in the target year
 * (treats target as authoritative). Useful right after creating a new year so
 * teachers don't redo NEB weightages from scratch.
 *
 * Returns the count of rows actually created.
 */
export async function copySubjectYearConfigs(
  fromYearId: string,
  toYearId:   string,
): Promise<{ copied: number; skipped: number }> {
  if (fromYearId === toYearId) throw new Error("Source and target year must differ")

  // Confirm both years belong to the same school (and faculty group) before
  // copying — prevents bleeding config between unrelated faculties.
  const [fromYear, toYear] = await Promise.all([
    prisma.academicYear.findUnique({
      where:  { id: fromYearId },
      select: { schoolId: true, facultyId: true },
    }),
    prisma.academicYear.findUnique({
      where:  { id: toYearId },
      select: { schoolId: true, facultyId: true },
    }),
  ])
  if (!fromYear || !toYear) throw new Error("Academic year not found")
  if (fromYear.schoolId !== toYear.schoolId) {
    throw new Error("Years must belong to the same school")
  }
  if (fromYear.facultyId !== toYear.facultyId) {
    throw new Error("Years must belong to the same faculty group")
  }

  const [sourceRows, existingTargetRows] = await Promise.all([
    prisma.subjectAcademicYearStatus.findMany({
      where:  { academicYearId: fromYearId },
      select: {
        subjectId:           true,
        isActive:            true,
        creditHours:         true,
        internalCreditHours: true,
        externalCreditHours: true,
      },
    }),
    prisma.subjectAcademicYearStatus.findMany({
      where:  { academicYearId: toYearId },
      select: { subjectId: true },
    }),
  ])
  const alreadyPresent = new Set(existingTargetRows.map(r => r.subjectId))

  const toCreate = sourceRows.filter(r => !alreadyPresent.has(r.subjectId))
  if (toCreate.length === 0) {
    return { copied: 0, skipped: sourceRows.length }
  }

  await prisma.subjectAcademicYearStatus.createMany({
    data: toCreate.map(r => ({
      academicYearId:      toYearId,
      subjectId:           r.subjectId,
      isActive:            r.isActive,
      creditHours:         r.creditHours,
      internalCreditHours: r.internalCreditHours,
      externalCreditHours: r.externalCreditHours,
    })),
    skipDuplicates: true,
  })

  revalidatePath("/academics/years")
  revalidatePath("/academics/subjects")
  return { copied: toCreate.length, skipped: sourceRows.length - toCreate.length }
}

export async function deleteAcademicYear(id: string): Promise<void> {
  const ay = await prisma.academicYear.findUnique({
    where:  { id },
    include: {
      _count: { select: { students: true, exams: true, evaluations: true, subjectYearStatuses: true } },
    },
  })
  if (!ay) throw new Error("Academic year not found")

  const c = ay._count
  if (c.students > 0 || c.exams > 0 || c.evaluations > 0 || c.subjectYearStatuses > 0) {
    throw new Error(
      `Cannot delete — still referenced by ` +
      [
        c.students    > 0 && `${c.students} student${c.students === 1 ? "" : "s"}`,
        c.exams       > 0 && `${c.exams} exam${c.exams === 1 ? "" : "s"}`,
        c.evaluations > 0 && `${c.evaluations} evaluation${c.evaluations === 1 ? "" : "s"}`,
        c.subjectYearStatuses > 0 && `${c.subjectYearStatuses} subject status${c.subjectYearStatuses === 1 ? "" : "es"}`,
      ].filter(Boolean).join(", "),
    )
  }

  await prisma.academicYear.delete({ where: { id } })
  revalidatePath("/academics/years")
}
