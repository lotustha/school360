"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { gateLmsRead as gateRead, gateLmsManage as gateManage } from "@/lib/lms-guard"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"

export interface CourseRow {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  status: CourseStatus
  instructorId: string
  instructorName: string
  subjectId: string | null
  subjectName: string | null
  moduleCount: number
  lessonCount: number
  enrollmentCount: number
  updatedAt: string
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const

const createSchema = z.object({
  title:         z.string().min(1, "Title is required").max(200),
  description:   z.string().max(5000).nullable().optional(),
  instructorId:  z.string().min(1, "An instructor is required"),
  subjectId:     z.string().min(1).nullable().optional(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
  status:        z.enum(STATUSES).default("DRAFT"),
})

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) })

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listCourses(): Promise<CourseRow[]> {
  const session = await gateRead()
  const schoolId = session.user.schoolId!

  const courses = await prisma.lMSCourse.findMany({
    where: { schoolId },
    include: {
      instructor: { select: { fullName: true } },
      subject:    { select: { name: true } },
      _count:     { select: { enrollments: true, modules: true } },
      modules:    { select: { _count: { select: { lessons: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  })

  return courses.map(c => ({
    id:              c.id,
    title:           c.title,
    description:     c.description,
    coverImageUrl:   c.coverImageUrl,
    status:          c.status as CourseStatus,
    instructorId:    c.instructorId,
    instructorName:  c.instructor.fullName,
    subjectId:       c.subjectId,
    subjectName:     c.subject?.name ?? null,
    moduleCount:     c._count.modules,
    lessonCount:     c.modules.reduce((n, m) => n + m._count.lessons, 0),
    enrollmentCount: c._count.enrollments,
    updatedAt:       c.updatedAt.toISOString(),
  }))
}

/** Full course tree for the builder: modules → lessons, ordered. */
export async function getCourse(id: string) {
  const session = await gateRead()
  const schoolId = session.user.schoolId!

  const course = await prisma.lMSCourse.findFirst({
    where: { id, schoolId },
    include: {
      instructor: { select: { id: true, fullName: true } },
      subject:    { select: { id: true, name: true } },
      _count:     { select: { enrollments: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
    },
  })
  if (!course) throw new Error("Course not found")
  return course
}

/** Teachers/admins selectable as a course instructor. */
export async function listInstructors() {
  const session = await gateRead()
  return prisma.user.findMany({
    where:   { schoolId: session.user.schoolId!, role: { in: ["TEACHER", "STAFF", "SCHOOL_ADMIN"] } },
    select:  { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  })
}

/** Subjects (with class label) for optionally linking a course to the K-12 syllabus. */
export async function listCourseSubjects() {
  const session = await gateRead()
  const subjects = await prisma.subject.findMany({
    where:   { schoolId: session.user.schoolId! },
    select:  { id: true, name: true, class: { select: { name: true } } },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  })
  return subjects.map(s => ({ id: s.id, name: s.name, className: s.class.name }))
}

// ─── Writes ───────────────────────────────────────────────────────────────────

async function assertInstructor(schoolId: string, instructorId: string) {
  const u = await prisma.user.findFirst({ where: { id: instructorId, schoolId }, select: { id: true } })
  if (!u) throw new Error("Instructor not found")
}

async function assertSubject(schoolId: string, subjectId: string) {
  const s = await prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } })
  if (!s) throw new Error("Subject not found")
}

export async function createCourse(input: z.infer<typeof createSchema>) {
  const session = await gateManage()
  const data = createSchema.parse(input)
  const schoolId = session.user.schoolId!

  await assertInstructor(schoolId, data.instructorId)
  if (data.subjectId) await assertSubject(schoolId, data.subjectId)

  const course = await prisma.lMSCourse.create({
    data: {
      schoolId,
      title:         data.title.trim(),
      description:   data.description?.trim() || null,
      instructorId:  data.instructorId,
      subjectId:     data.subjectId ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      status:        data.status,
    },
  })

  revalidatePath("/lms")
  return { id: course.id }
}

export async function updateCourse(input: z.infer<typeof updateSchema>) {
  const session = await gateManage()
  const data = updateSchema.parse(input)
  const schoolId = session.user.schoolId!

  const existing = await prisma.lMSCourse.findFirst({ where: { id: data.id, schoolId }, select: { id: true } })
  if (!existing) throw new Error("Course not found")

  if (data.instructorId) await assertInstructor(schoolId, data.instructorId)
  if (data.subjectId) await assertSubject(schoolId, data.subjectId)

  await prisma.lMSCourse.update({
    where: { id: data.id },
    data: {
      ...(data.title         !== undefined && { title: data.title.trim() }),
      ...(data.description   !== undefined && { description: data.description?.trim() || null }),
      ...(data.instructorId  !== undefined && { instructorId: data.instructorId }),
      ...(data.subjectId     !== undefined && { subjectId: data.subjectId ?? null }),
      ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl ?? null }),
      ...(data.status        !== undefined && { status: data.status }),
    },
  })

  revalidatePath("/lms")
  revalidatePath(`/lms/courses/${data.id}`)
  return { ok: true }
}

export async function setCourseStatus(id: string, status: CourseStatus) {
  const session = await gateManage()
  const existing = await prisma.lMSCourse.findFirst({ where: { id, schoolId: session.user.schoolId! }, select: { id: true } })
  if (!existing) throw new Error("Course not found")

  await prisma.lMSCourse.update({ where: { id }, data: { status } })
  revalidatePath("/lms")
  revalidatePath(`/lms/courses/${id}`)
  return { ok: true }
}

export async function deleteCourse(id: string) {
  const session = await gateManage()
  const existing = await prisma.lMSCourse.findFirst({
    where: { id, schoolId: session.user.schoolId! },
    select: { id: true, _count: { select: { enrollments: true } } },
  })
  if (!existing) throw new Error("Course not found")
  if (existing._count.enrollments > 0) {
    throw new Error("Cannot delete a course with enrolled students — archive it instead")
  }

  // Modules/lessons cascade via schema onDelete: Cascade.
  await prisma.lMSCourse.delete({ where: { id } })
  revalidatePath("/lms")
  return { ok: true }
}
