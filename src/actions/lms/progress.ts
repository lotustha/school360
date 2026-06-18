"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { gateLmsLearner } from "@/lib/lms-guard"
import { recomputeProgress } from "./progress-core"

export interface MyCourseRow {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  instructorName: string
  subjectName: string | null
  progress: number
  completedAt: string | null
  lessonCount: number
}

/** Courses the current learner is enrolled in. */
export async function getMyEnrolledCourses(): Promise<MyCourseRow[]> {
  const { studentId } = await gateLmsLearner()

  const enrollments = await prisma.lMSEnrollment.findMany({
    where: { studentId, course: { status: { not: "ARCHIVED" } } },
    include: {
      course: {
        include: {
          instructor: { select: { fullName: true } },
          subject:    { select: { name: true } },
          modules: {
            where:  { isPublished: true },
            select: { _count: { select: { lessons: true } } },
          },
        },
      },
    },
    orderBy: { lastAccess: "desc" },
  })

  return enrollments.map(e => ({
    id:             e.course.id,
    title:          e.course.title,
    description:    e.course.description,
    coverImageUrl:  e.course.coverImageUrl,
    instructorName: e.course.instructor.fullName,
    subjectName:    e.course.subject?.name ?? null,
    progress:       e.progress,
    completedAt:    e.completedAt?.toISOString() ?? null,
    lessonCount:    e.course.modules.reduce((n, m) => n + m._count.lessons, 0),
  }))
}

/**
 * Learner view of a course: published curriculum only, plus the set of lessons
 * this student has completed. Throws FORBIDDEN if not enrolled.
 */
export async function getLearnerCourse(courseId: string) {
  const { studentId, session } = await gateLmsLearner()
  const schoolId = session.user.schoolId!

  const enrollment = await prisma.lMSEnrollment.findFirst({
    where:  { courseId, studentId, course: { schoolId } },
    select: { id: true, progress: true, completedAt: true },
  })
  if (!enrollment) throw new Error("FORBIDDEN")

  const course = await prisma.lMSCourse.findFirst({
    where: { id: courseId, schoolId },
    include: {
      instructor: { select: { fullName: true } },
      subject:    { select: { name: true } },
      modules: {
        where:   { isPublished: true },
        orderBy: { order: "asc" },
        include: {
          lessons: { where: { isPublished: true }, orderBy: { order: "asc" } },
        },
      },
    },
  })
  if (!course) throw new Error("Course not found")

  const completions = await prisma.lessonCompletion.findMany({
    where:  { studentId, lesson: { module: { courseId } } },
    select: { lessonId: true },
  })

  return {
    course,
    enrollment,
    completedLessonIds: completions.map(c => c.lessonId),
  }
}

async function loadEnrolledLesson(studentId: string, schoolId: string, lessonId: string) {
  const lesson = await prisma.lMSLesson.findFirst({
    where: {
      id: lessonId,
      isPublished: true,
      module: { isPublished: true, course: { schoolId } },
    },
    select: { id: true, module: { select: { courseId: true } } },
  })
  if (!lesson) throw new Error("Lesson not found")
  const courseId = lesson.module.courseId

  const enrolled = await prisma.lMSEnrollment.findFirst({
    where:  { courseId, studentId },
    select: { id: true },
  })
  if (!enrolled) throw new Error("FORBIDDEN")

  return { courseId }
}

export async function markLessonComplete(lessonId: string, timeSpent?: number) {
  const { studentId, session } = await gateLmsLearner()
  const { courseId } = await loadEnrolledLesson(studentId, session.user.schoolId!, lessonId)

  await prisma.lessonCompletion.upsert({
    where:  { lessonId_studentId: { lessonId, studentId } },
    update: { ...(timeSpent != null ? { timeSpent } : {}) },
    create: { lessonId, studentId, timeSpent: timeSpent ?? null },
  })
  await prisma.lMSEnrollment.updateMany({
    where: { courseId, studentId },
    data:  { lastAccess: new Date() },
  })
  const progress = await recomputeProgress(courseId, studentId)

  revalidatePath(`/lms/learn/${courseId}`)
  revalidatePath("/lms")
  return { ok: true, progress }
}

export async function markLessonIncomplete(lessonId: string) {
  const { studentId, session } = await gateLmsLearner()
  const { courseId } = await loadEnrolledLesson(studentId, session.user.schoolId!, lessonId)

  await prisma.lessonCompletion.deleteMany({ where: { lessonId, studentId } })
  const progress = await recomputeProgress(courseId, studentId)

  revalidatePath(`/lms/learn/${courseId}`)
  revalidatePath("/lms")
  return { ok: true, progress }
}

/** Touch lastAccess when a learner opens a course (no completion change). */
export async function touchCourseAccess(courseId: string) {
  const { studentId } = await gateLmsLearner()
  await prisma.lMSEnrollment.updateMany({
    where: { courseId, studentId },
    data:  { lastAccess: new Date() },
  })
  return { ok: true }
}
