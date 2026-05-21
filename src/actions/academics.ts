"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// --- Faculties ---

export async function getFaculties(schoolId: string) {
  return await prisma.faculty.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { classes: true } },
    },
  })
}

export async function createFaculty(
  schoolId:    string,
  name:        string,
  workingDays: number[] = [],
) {
  const faculty = await prisma.faculty.create({
    data: { name, schoolId, workingDays },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/faculties")
  return faculty
}

export async function updateFaculty(
  id:           string,
  name:         string,
  workingDays?: number[],
) {
  await prisma.faculty.update({
    where: { id },
    data:  {
      name,
      ...(workingDays !== undefined && { workingDays }),
    },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/faculties")
  revalidatePath("/academics/routine")
}

export async function deleteFaculty(id: string) {
  await prisma.faculty.delete({ where: { id } })
  revalidatePath("/academics")
  revalidatePath("/academics/faculties")
}

// --- Classes ---

export async function getClasses(schoolId: string) {
  return await prisma.class.findMany({
    where: { schoolId },
    include: {
      faculty: true,
      _count: { select: { sections: true, subjects: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function createClass(
  schoolId: string,
  name:     string,
  opts?: {
    facultyId?:      string | null
    classTeacherId?: string | null
    roomId?:         string | null
    classroom?:      string | null   // legacy free text; cleared automatically when roomId is set
    workingDays?:    number[]
  },
) {
  const roomLinked = opts?.roomId != null
  const newClass = await prisma.class.create({
    data: {
      name,
      schoolId,
      facultyId:      opts?.facultyId      ?? null,
      classTeacherId: opts?.classTeacherId ?? null,
      roomId:         opts?.roomId         ?? null,
      // When a Room is linked, drop the legacy free text so they don't drift.
      classroom:      roomLinked ? null : (opts?.classroom ?? null),
      workingDays:    opts?.workingDays    ?? [],
    },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/classes")
  return newClass
}

export async function updateClass(
  id:   string,
  name: string,
  opts?: {
    facultyId?:      string | null
    classTeacherId?: string | null
    roomId?:         string | null
    classroom?:      string | null
    workingDays?:    number[]
  },
) {
  const roomTouched = opts?.roomId !== undefined
  await prisma.class.update({
    where: { id },
    data: {
      name,
      ...(opts?.facultyId      !== undefined && { facultyId:      opts.facultyId      }),
      ...(opts?.classTeacherId !== undefined && { classTeacherId: opts.classTeacherId }),
      ...(roomTouched           && {
        roomId:    opts!.roomId,
        // When linking to a Room, blank the legacy text. When unlinking (null), leave classroom alone.
        ...(opts!.roomId != null && { classroom: null }),
      }),
      ...(!roomTouched && opts?.classroom !== undefined && { classroom: opts.classroom }),
      ...(opts?.workingDays    !== undefined && { workingDays:    opts.workingDays    }),
    },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/classes")
  revalidatePath("/academics/routine")
}

export async function deleteClass(id: string) {
  await prisma.class.delete({ where: { id } })
  revalidatePath("/academics")
  revalidatePath("/academics/classes")
}

// --- Sections ---

export async function getSections(schoolId: string) {
  return await prisma.section.findMany({
    where: { schoolId },
    include: {
      class: { include: { faculty: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  })
}

export async function createSection(schoolId: string, classId: string, name: string) {
  const section = await prisma.section.create({
    data: { name, classId, schoolId },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/sections")
  return section
}

export async function updateSection(id: string, name: string, classId: string) {
  await prisma.section.update({ where: { id }, data: { name, classId } })
  revalidatePath("/academics")
  revalidatePath("/academics/sections")
}

export async function deleteSection(id: string) {
  await prisma.section.delete({ where: { id } })
  revalidatePath("/academics")
  revalidatePath("/academics/sections")
}

// --- Subjects ---

export async function getSubjects(schoolId: string) {
  return await prisma.subject.findMany({
    where: { schoolId },
    include: { class: true },
    orderBy: { name: "asc" },
  })
}

export type SubjectTypeInput = "REGULAR" | "OPTIONAL" | "EXTRA"

export async function createSubject(
  schoolId: string,
  classId: string,
  name: string,
  code: string,
  creditHours?: number,
  shortName?: string | null,
  type: SubjectTypeInput = "REGULAR",
  internalCreditHours?: number | null,
  externalCreditHours?: number | null,
) {
  const subject = await prisma.subject.create({
    data: {
      name, code, classId, schoolId, type,
      creditHours:         creditHours || null,
      internalCreditHours: internalCreditHours ?? null,
      externalCreditHours: externalCreditHours ?? null,
      shortName:           shortName?.trim() || null,
    },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/subjects")
  return subject
}

export async function updateSubject(
  id: string,
  name: string,
  code: string,
  classId: string,
  creditHours?: number | null,
  shortName?: string | null,
  type?: SubjectTypeInput,
  internalCreditHours?: number | null,
  externalCreditHours?: number | null,
) {
  await prisma.subject.update({
    where: { id },
    data: {
      name, code, classId,
      creditHours:         creditHours ?? null,
      internalCreditHours: internalCreditHours ?? null,
      externalCreditHours: externalCreditHours ?? null,
      shortName:           shortName !== undefined ? (shortName?.trim() || null) : undefined,
      ...(type && { type }),
    },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/subjects")
}

export async function deleteSubject(id: string) {
  await prisma.subject.delete({ where: { id } })
  revalidatePath("/academics")
  revalidatePath("/academics/subjects")
}

// --- Subjects: bulk create / clone / per-year status ---

/**
 * Create many subjects under one class in a single transaction.
 * Skips rows with empty name. Returns { created } count.
 */
export async function bulkCreateSubjects(
  schoolId: string,
  classId:  string,
  rows: { name: string; code: string; creditHours?: number | null }[],
) {
  const clean = rows
    .map(r => ({ name: r.name.trim(), code: r.code.trim(), creditHours: r.creditHours ?? null }))
    .filter(r => r.name.length > 0)
  if (clean.length === 0) return { created: 0, subjects: [] as { id: string; code: string }[] }

  // Returns the newly-created rows so callers can chain per-subject side
  // effects (e.g. stamping a per-year CH config when a session is selected).
  const created = await prisma.$transaction(
    clean.map(r =>
      prisma.subject.create({
        data: { schoolId, classId, name: r.name, code: r.code, creditHours: r.creditHours },
        select: { id: true, code: true },
      })
    )
  )
  revalidatePath("/academics")
  revalidatePath("/academics/subjects")
  return { created: created.length, subjects: created }
}

/**
 * Copy subjects from one class to another. Skips rows where the destination
 * class already has a subject with the same code (so re-running is idempotent).
 * Returns { cloned, skipped } counts.
 */
export async function cloneSubjectsFromClass(args: {
  fromClassId: string
  toClassId:   string
  subjectIds?: string[]   // Optional whitelist; if omitted, clones all
}) {
  const toClass = await prisma.class.findUnique({
    where:  { id: args.toClassId },
    select: { schoolId: true, subjects: { select: { code: true } } },
  })
  if (!toClass) throw new Error("Destination class not found")
  const existingCodes = new Set(toClass.subjects.map(s => s.code))

  const sourceSubjects = await prisma.subject.findMany({
    where: {
      classId: args.fromClassId,
      ...(args.subjectIds && args.subjectIds.length > 0 && { id: { in: args.subjectIds } }),
    },
    select: { name: true, code: true, creditHours: true },
  })

  const toCreate = sourceSubjects.filter(s => !existingCodes.has(s.code))
  const skipped  = sourceSubjects.length - toCreate.length

  if (toCreate.length > 0) {
    await prisma.$transaction(
      toCreate.map(s =>
        prisma.subject.create({
          data: {
            schoolId:    toClass.schoolId,
            classId:     args.toClassId,
            name:        s.name,
            code:        s.code,
            creditHours: s.creditHours,
          },
        })
      )
    )
  }
  revalidatePath("/academics")
  revalidatePath("/academics/subjects")
  return { cloned: toCreate.length, skipped }
}

/**
 * Toggle a subject's active state for a specific academic year.
 * Absence of a row = active by default; we only persist explicit overrides.
 * Calling with isActive=true on a subject that has no row stays absent (active).
 */
export async function setSubjectYearStatus(
  subjectId:      string,
  academicYearId: string,
  isActive:       boolean,
) {
  await prisma.subjectAcademicYearStatus.upsert({
    where: {
      subjectId_academicYearId: { subjectId, academicYearId },
    },
    create: { subjectId, academicYearId, isActive },
    update: { isActive },
  })
  revalidatePath("/academics/subjects")
}

/**
 * Read all override rows for a list of subjects. Returns
 * `Record<subjectId, Record<academicYearId, isActive>>`. Missing entries mean
 * "active by default".
 */
// --- Subject ↔ Teacher mapping ---

export async function listSubjectTeachers(subjectId: string) {
  return prisma.subjectTeacher.findMany({
    where:   { subjectId },
    include: { teacher: { select: { id: true, fullName: true, role: true, email: true, avatarUrl: true } } },
    orderBy: [{ isPrimary: "desc" }, { teacher: { fullName: "asc" } }],
  })
}

/**
 * Quick-create a teacher user and immediately assign them to a subject.
 * Used by the routine teacher picker so users don't have to leave the page
 * to add a missing teacher. For full payroll / HR fields, the regular
 * StaffDrawer at /hr/staff is still the path.
 */
export async function createTeacherQuick(args: {
  schoolId:    string
  fullName:    string
  email:       string
  password:    string
  role:        "TEACHER" | "STAFF" | "SCHOOL_ADMIN"
  avatarUrl?:  string | null
  subjectId:   string
  makePrimary?: boolean
}) {
  const bcrypt = await import("bcryptjs")
  const hashed = await bcrypt.hash(args.password, 10)

  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.create({
      data: {
        fullName:  args.fullName.trim(),
        email:     args.email.trim().toLowerCase(),
        password:  hashed,
        role:      args.role,
        avatarUrl: args.avatarUrl ?? null,
        schoolId:  args.schoolId,
      },
    })
    if (args.makePrimary) {
      await tx.subjectTeacher.updateMany({
        where: { subjectId: args.subjectId, isPrimary: true },
        data:  { isPrimary: false },
      })
    }
    const link = await tx.subjectTeacher.create({
      data: {
        subjectId:     args.subjectId,
        teacherUserId: user.id,
        isPrimary:     args.makePrimary ?? false,
      },
    })
    return { user, link }
  })

  revalidatePath("/academics/subjects")
  revalidatePath("/hr/staff")
  return result
}

export async function assignSubjectTeacher(args: {
  subjectId:     string
  teacherUserId: string
  isPrimary?:    boolean
}) {
  await prisma.$transaction(async tx => {
    if (args.isPrimary) {
      // Demote any current primary for this subject
      await tx.subjectTeacher.updateMany({
        where: { subjectId: args.subjectId, isPrimary: true },
        data:  { isPrimary: false },
      })
    }
    await tx.subjectTeacher.upsert({
      where:  { subjectId_teacherUserId: { subjectId: args.subjectId, teacherUserId: args.teacherUserId } },
      create: { subjectId: args.subjectId, teacherUserId: args.teacherUserId, isPrimary: args.isPrimary ?? false },
      update: { isPrimary: args.isPrimary ?? false },
    })
  })
  revalidatePath("/academics/subjects")
}

export async function removeSubjectTeacher(id: string) {
  await prisma.subjectTeacher.delete({ where: { id } })
  revalidatePath("/academics/subjects")
}

// --- Working days (school-level) ---

export async function setWorkingDays(schoolId: string, days: number[]) {
  // Sanitize: keep 0..6, dedupe, sort
  const clean = Array.from(new Set(days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b)
  await prisma.school.update({
    where: { id: schoolId },
    data:  { workingDays: clean },
  })
  revalidatePath("/academics/routine")
  revalidatePath("/academics/faculties")
}

export async function getSubjectYearStatuses(subjectIds: string[]) {
  if (subjectIds.length === 0) return {}
  const rows = await prisma.subjectAcademicYearStatus.findMany({
    where:  { subjectId: { in: subjectIds } },
    select: { subjectId: true, academicYearId: true, isActive: true },
  })
  const out: Record<string, Record<string, boolean>> = {}
  for (const r of rows) {
    if (!out[r.subjectId]) out[r.subjectId] = {}
    out[r.subjectId][r.academicYearId] = r.isActive
  }
  return out
}

/** Per-year CH config for a list of subjects, scoped to ONE academic year.
 *  Returns Record<subjectId, { creditHours, internalCreditHours, externalCreditHours }>.
 *  Missing subjects = no year-specific override (fall back to Subject defaults). */
export type SubjectYearCH = {
  creditHours:         number | null
  internalCreditHours: number | null
  externalCreditHours: number | null
}
export async function getSubjectYearConfigs(
  subjectIds:     string[],
  academicYearId: string,
): Promise<Record<string, SubjectYearCH>> {
  if (subjectIds.length === 0) return {}
  const rows = await prisma.subjectAcademicYearStatus.findMany({
    where:  { subjectId: { in: subjectIds }, academicYearId },
    select: {
      subjectId:           true,
      creditHours:         true,
      internalCreditHours: true,
      externalCreditHours: true,
    },
  })
  const out: Record<string, SubjectYearCH> = {}
  for (const r of rows) {
    out[r.subjectId] = {
      creditHours:         r.creditHours,
      internalCreditHours: r.internalCreditHours,
      externalCreditHours: r.externalCreditHours,
    }
  }
  return out
}

/** Write per-year CH override for a subject in a specific academic year.
 *  Set a CH field to null to clear (the resolver will fall back to Subject
 *  defaults, then to proportional split). isActive defaults to true so this
 *  doesn't accidentally deactivate the subject. */
export async function upsertSubjectYearConfig(args: {
  subjectId:            string
  academicYearId:       string
  creditHours?:         number | null
  internalCreditHours?: number | null
  externalCreditHours?: number | null
}) {
  await prisma.subjectAcademicYearStatus.upsert({
    where: {
      subjectId_academicYearId: {
        subjectId:      args.subjectId,
        academicYearId: args.academicYearId,
      },
    },
    create: {
      subjectId:           args.subjectId,
      academicYearId:      args.academicYearId,
      isActive:            true,
      creditHours:         args.creditHours         ?? null,
      internalCreditHours: args.internalCreditHours ?? null,
      externalCreditHours: args.externalCreditHours ?? null,
    },
    update: {
      creditHours:         args.creditHours         ?? null,
      internalCreditHours: args.internalCreditHours ?? null,
      externalCreditHours: args.externalCreditHours ?? null,
    },
  })
  revalidatePath("/academics/subjects")
}
