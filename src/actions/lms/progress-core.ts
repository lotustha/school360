// Internal progress helpers (NOT a "use server" module — plain functions reused
// by the LMS server actions). A lesson only counts toward progress when BOTH it
// and its parent module are published.

import { prisma } from "@/lib/prisma"

/** Number of published lessons (in published modules) for a course. */
export async function countPublishedLessons(courseId: string): Promise<number> {
  return prisma.lMSLesson.count({
    where: { isPublished: true, module: { courseId, isPublished: true } },
  })
}

/**
 * Recompute and persist an enrollment's progress percentage. `total` may be
 * passed in to avoid recounting when recomputing many students for one course.
 * No-op (returns 0) if the student has no enrollment row.
 */
export async function recomputeProgress(
  courseId: string,
  studentId: string,
  total?: number,
): Promise<number> {
  const totalLessons = total ?? (await countPublishedLessons(courseId))

  const done = await prisma.lessonCompletion.count({
    where: {
      studentId,
      lesson: { isPublished: true, module: { courseId, isPublished: true } },
    },
  })

  const progress = totalLessons === 0 ? 0 : Math.round((done / totalLessons) * 100)
  const completedAt = totalLessons > 0 && done >= totalLessons ? new Date() : null

  await prisma.lMSEnrollment.updateMany({
    where: { courseId, studentId },
    data: { progress, completedAt },
  })

  return progress
}
