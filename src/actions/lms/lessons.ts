"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { gateLmsManage } from "@/lib/lms-guard"

export type LessonType = "VIDEO" | "PDF" | "SLIDES" | "LINK" | "TEXT" | "EMBED"
const LESSON_TYPES = ["VIDEO", "PDF", "SLIDES", "LINK", "TEXT", "EMBED"] as const

async function loadModule(schoolId: string, moduleId: string) {
  const mod = await prisma.lMSModule.findFirst({
    where: { id: moduleId, course: { schoolId } },
    select: { id: true, courseId: true },
  })
  if (!mod) throw new Error("Module not found")
  return mod
}

async function loadLesson(schoolId: string, lessonId: string) {
  const lesson = await prisma.lMSLesson.findFirst({
    where:  { id: lessonId, module: { course: { schoolId } } },
    select: { id: true, order: true, moduleId: true, module: { select: { courseId: true } } },
  })
  if (!lesson) throw new Error("Lesson not found")
  return { ...lesson, courseId: lesson.module.courseId }
}

const createSchema = z.object({
  moduleId:      z.string().min(1),
  title:         z.string().min(1, "Title is required").max(200),
  type:          z.enum(LESSON_TYPES),
  content:       z.string().max(50_000).nullable().optional(),
  fileUrl:       z.string().url().max(500).nullable().optional(),
  videoUrl:      z.string().url().max(500).nullable().optional(),
  videoDuration: z.number().int().nonnegative().nullable().optional(),
  isFree:        z.boolean().default(false),
})

const updateSchema = createSchema.partial().omit({ moduleId: true }).extend({ id: z.string().min(1) })

export async function createLesson(input: z.infer<typeof createSchema>) {
  const session = await gateLmsManage()
  const data = createSchema.parse(input)
  const mod = await loadModule(session.user.schoolId!, data.moduleId)

  const last = await prisma.lMSLesson.findFirst({
    where:   { moduleId: data.moduleId },
    orderBy: { order: "desc" },
    select:  { order: true },
  })

  const lesson = await prisma.lMSLesson.create({
    data: {
      moduleId:      data.moduleId,
      title:         data.title.trim(),
      type:          data.type,
      content:       data.content?.trim() || null,
      fileUrl:       data.fileUrl ?? null,
      videoUrl:      data.videoUrl ?? null,
      videoDuration: data.videoDuration ?? null,
      isFree:        data.isFree,
      order:         (last?.order ?? 0) + 1,
    },
  })

  revalidatePath(`/lms/courses/${mod.courseId}`)
  return { id: lesson.id }
}

export async function updateLesson(input: z.infer<typeof updateSchema>) {
  const session = await gateLmsManage()
  const data = updateSchema.parse(input)
  const lesson = await loadLesson(session.user.schoolId!, data.id)

  await prisma.lMSLesson.update({
    where: { id: data.id },
    data: {
      ...(data.title         !== undefined && { title: data.title.trim() }),
      ...(data.type          !== undefined && { type: data.type }),
      ...(data.content       !== undefined && { content: data.content?.trim() || null }),
      ...(data.fileUrl       !== undefined && { fileUrl: data.fileUrl ?? null }),
      ...(data.videoUrl      !== undefined && { videoUrl: data.videoUrl ?? null }),
      ...(data.videoDuration !== undefined && { videoDuration: data.videoDuration ?? null }),
      ...(data.isFree        !== undefined && { isFree: data.isFree }),
    },
  })

  revalidatePath(`/lms/courses/${lesson.courseId}`)
  return { ok: true }
}

export async function toggleLessonPublished(id: string, isPublished: boolean) {
  const session = await gateLmsManage()
  const lesson = await loadLesson(session.user.schoolId!, id)
  await prisma.lMSLesson.update({ where: { id }, data: { isPublished } })
  revalidatePath(`/lms/courses/${lesson.courseId}`)
  return { ok: true }
}

export async function deleteLesson(id: string) {
  const session = await gateLmsManage()
  const lesson = await loadLesson(session.user.schoolId!, id)
  await prisma.lMSLesson.delete({ where: { id } })
  revalidatePath(`/lms/courses/${lesson.courseId}`)
  return { ok: true }
}

export async function moveLesson(id: string, direction: "up" | "down") {
  const session = await gateLmsManage()
  const lesson = await loadLesson(session.user.schoolId!, id)

  const neighbour = await prisma.lMSLesson.findFirst({
    where:   { moduleId: lesson.moduleId, order: direction === "up" ? { lt: lesson.order } : { gt: lesson.order } },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select:  { id: true, order: true },
  })
  if (!neighbour) return { ok: true }

  await prisma.$transaction([
    prisma.lMSLesson.update({ where: { id: lesson.id },    data: { order: neighbour.order } }),
    prisma.lMSLesson.update({ where: { id: neighbour.id }, data: { order: lesson.order } }),
  ])

  revalidatePath(`/lms/courses/${lesson.courseId}`)
  return { ok: true }
}
