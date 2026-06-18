"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { gateLmsRead, gateLmsManage } from "@/lib/lms-guard"
import { recomputeProgress, countPublishedLessons } from "./progress-core"

export interface EnrollmentRow {
  studentId: string
  enrollmentId: string
  name: string
  rollNumber: string | null
  className: string
  sectionName: string | null
  progress: number
  enrolledAt: string
  lastAccess: string | null
  completedAt: string | null
}

async function assertCourse(schoolId: string, courseId: string) {
  const course = await prisma.lMSCourse.findFirst({ where: { id: courseId, schoolId }, select: { id: true } })
  if (!course) throw new Error("Course not found")
}

export async function listEnrollments(courseId: string): Promise<EnrollmentRow[]> {
  const session = await gateLmsRead()
  await assertCourse(session.user.schoolId!, courseId)

  const rows = await prisma.lMSEnrollment.findMany({
    where: { courseId },
    include: {
      student: {
        select: {
          id: true, rollNumber: true,
          user:    { select: { fullName: true } },
          class:   { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: [{ student: { class: { name: "asc" } } }, { student: { rollNumber: "asc" } }],
  })

  return rows.map(r => ({
    studentId:    r.studentId,
    enrollmentId: r.id,
    name:         r.student.user.fullName,
    rollNumber:   r.student.rollNumber,
    className:    r.student.class.name,
    sectionName:  r.student.section?.name ?? null,
    progress:     r.progress,
    enrolledAt:   r.enrolledAt.toISOString(),
    lastAccess:   r.lastAccess?.toISOString() ?? null,
    completedAt:  r.completedAt?.toISOString() ?? null,
  }))
}

/** Classes/sections + un-enrolled active students, for the enroll picker. */
export async function getEnrollableStudents(courseId: string) {
  const session = await gateLmsManage()
  const schoolId = session.user.schoolId!
  await assertCourse(schoolId, courseId)

  const enrolled = await prisma.lMSEnrollment.findMany({ where: { courseId }, select: { studentId: true } })
  const enrolledIds = new Set(enrolled.map(e => e.studentId))

  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where:  { schoolId, status: "ACTIVE" },
      select: {
        id: true, rollNumber: true, classId: true, sectionId: true,
        user:    { select: { fullName: true } },
        class:   { select: { name: true } },
        section: { select: { name: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }],
    }),
    prisma.class.findMany({
      where:  { schoolId },
      select: { id: true, name: true, sections: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ])

  return {
    classes,
    students: students
      .filter(s => !enrolledIds.has(s.id))
      .map(s => ({
        id: s.id, name: s.user.fullName, rollNumber: s.rollNumber,
        classId: s.classId, sectionId: s.sectionId,
        className: s.class.name, sectionName: s.section?.name ?? null,
      })),
  }
}

const enrollSchema = z.object({
  courseId:   z.string().min(1),
  studentIds: z.array(z.string().min(1)).min(1, "Select at least one student"),
})

export async function enrollStudents(input: z.infer<typeof enrollSchema>) {
  const session = await gateLmsManage()
  const data = enrollSchema.parse(input)
  const schoolId = session.user.schoolId!
  await assertCourse(schoolId, data.courseId)

  // Only enroll students that belong to this school.
  const valid = await prisma.student.findMany({
    where:  { id: { in: data.studentIds }, schoolId },
    select: { id: true },
  })

  const result = await prisma.lMSEnrollment.createMany({
    data: valid.map(s => ({ courseId: data.courseId, studentId: s.id })),
    skipDuplicates: true,
  })

  revalidatePath(`/lms/courses/${data.courseId}/students`)
  revalidatePath(`/lms/courses/${data.courseId}`)
  return { enrolled: result.count }
}

const byClassSchema = z.object({
  courseId:  z.string().min(1),
  classId:   z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
})

export async function enrollByClass(input: z.infer<typeof byClassSchema>) {
  const session = await gateLmsManage()
  const data = byClassSchema.parse(input)
  const schoolId = session.user.schoolId!
  await assertCourse(schoolId, data.courseId)

  const students = await prisma.student.findMany({
    where: {
      schoolId, status: "ACTIVE", classId: data.classId,
      ...(data.sectionId ? { sectionId: data.sectionId } : {}),
    },
    select: { id: true },
  })

  const result = await prisma.lMSEnrollment.createMany({
    data: students.map(s => ({ courseId: data.courseId, studentId: s.id })),
    skipDuplicates: true,
  })

  revalidatePath(`/lms/courses/${data.courseId}/students`)
  revalidatePath(`/lms/courses/${data.courseId}`)
  return { enrolled: result.count }
}

export async function unenrollStudent(courseId: string, studentId: string) {
  const session = await gateLmsManage()
  await assertCourse(session.user.schoolId!, courseId)

  await prisma.lMSEnrollment.deleteMany({ where: { courseId, studentId } })
  // Completions remain harmless; clean them so re-enroll starts fresh.
  await prisma.lessonCompletion.deleteMany({
    where: { studentId, lesson: { module: { courseId } } },
  })

  revalidatePath(`/lms/courses/${courseId}/students`)
  revalidatePath(`/lms/courses/${courseId}`)
  return { ok: true }
}

/** Recompute progress for every enrollment of a course (e.g. after curriculum edits). */
export async function resyncCourseProgress(courseId: string) {
  const session = await gateLmsManage()
  await assertCourse(session.user.schoolId!, courseId)

  const total = await countPublishedLessons(courseId)
  const enrollments = await prisma.lMSEnrollment.findMany({ where: { courseId }, select: { studentId: true } })
  for (const e of enrollments) {
    await recomputeProgress(courseId, e.studentId, total)
  }

  revalidatePath(`/lms/courses/${courseId}/students`)
  return { ok: true, updated: enrollments.length }
}
