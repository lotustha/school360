"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { gateLmsManage } from "@/lib/lms-guard"

// All module mutations are scoped through the parent course's school to keep
// tenant isolation: we never trust a bare courseId/moduleId without confirming
// it belongs to the caller's school.

async function assertCourse(schoolId: string, courseId: string) {
  const course = await prisma.lMSCourse.findFirst({ where: { id: courseId, schoolId }, select: { id: true } })
  if (!course) throw new Error("Course not found")
}

async function loadModule(schoolId: string, moduleId: string) {
  const mod = await prisma.lMSModule.findFirst({
    where: { id: moduleId, course: { schoolId } },
    select: { id: true, courseId: true, order: true },
  })
  if (!mod) throw new Error("Module not found")
  return mod
}

const createSchema = z.object({
  courseId:    z.string().min(1),
  title:       z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
})

const updateSchema = z.object({
  id:          z.string().min(1),
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
})

export async function createModule(input: z.infer<typeof createSchema>) {
  const session = await gateLmsManage()
  const data = createSchema.parse(input)
  const schoolId = session.user.schoolId!

  await assertCourse(schoolId, data.courseId)

  const last = await prisma.lMSModule.findFirst({
    where:   { courseId: data.courseId },
    orderBy: { order: "desc" },
    select:  { order: true },
  })

  const mod = await prisma.lMSModule.create({
    data: {
      courseId:    data.courseId,
      title:       data.title.trim(),
      description: data.description?.trim() || null,
      order:       (last?.order ?? 0) + 1,
    },
  })

  revalidatePath(`/lms/courses/${data.courseId}`)
  return { id: mod.id }
}

export async function updateModule(input: z.infer<typeof updateSchema>) {
  const session = await gateLmsManage()
  const data = updateSchema.parse(input)
  const mod = await loadModule(session.user.schoolId!, data.id)

  await prisma.lMSModule.update({
    where: { id: data.id },
    data: {
      ...(data.title       !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
    },
  })

  revalidatePath(`/lms/courses/${mod.courseId}`)
  return { ok: true }
}

export async function toggleModulePublished(id: string, isPublished: boolean) {
  const session = await gateLmsManage()
  const mod = await loadModule(session.user.schoolId!, id)
  await prisma.lMSModule.update({ where: { id }, data: { isPublished } })
  revalidatePath(`/lms/courses/${mod.courseId}`)
  return { ok: true }
}

export async function deleteModule(id: string) {
  const session = await gateLmsManage()
  const mod = await loadModule(session.user.schoolId!, id)
  await prisma.lMSModule.delete({ where: { id } }) // lessons cascade
  revalidatePath(`/lms/courses/${mod.courseId}`)
  return { ok: true }
}

/** Swap a module's order with its neighbour in the given direction. */
export async function moveModule(id: string, direction: "up" | "down") {
  const session = await gateLmsManage()
  const mod = await loadModule(session.user.schoolId!, id)

  const neighbour = await prisma.lMSModule.findFirst({
    where:   { courseId: mod.courseId, order: direction === "up" ? { lt: mod.order } : { gt: mod.order } },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select:  { id: true, order: true },
  })
  if (!neighbour) return { ok: true } // already at the edge

  await prisma.$transaction([
    prisma.lMSModule.update({ where: { id: mod.id },        data: { order: neighbour.order } }),
    prisma.lMSModule.update({ where: { id: neighbour.id },  data: { order: mod.order } }),
  ])

  revalidatePath(`/lms/courses/${mod.courseId}`)
  return { ok: true }
}
