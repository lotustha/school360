"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { fiscalYearOf, toAD } from "@/lib/nepali-date"

const fySchema = z.object({
  startBS: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function listFiscalYears() {
  const session = await requirePermission("finance:view")
  return prisma.fiscalYear.findMany({
    where: { schoolId: session.user.schoolId! },
    orderBy: { startAD: "desc" },
  })
}

export async function getCurrentFiscalYear() {
  const session = await requirePermission("finance:view")
  return prisma.fiscalYear.findFirst({
    where: { schoolId: session.user.schoolId!, isCurrent: true },
  })
}

/** Create a FY from any BS date that falls within it (we snap to Shrawan 1 → Asar end). */
export async function createFiscalYear(input: { startBS: string }) {
  const session = await requirePermission("finance:manage")
  const parsed = fySchema.parse(input)
  const fy = fiscalYearOf(parsed.startBS)

  return prisma.fiscalYear.create({
    data: {
      schoolId: session.user.schoolId!,
      name:     fy.name,
      startBS:  fy.startBS,
      endBS:    fy.endBS,
      startAD:  fy.startAD,
      endAD:    fy.endAD,
    },
  }).then(async (created) => {
    revalidatePath("/accounting/fiscal-years")
    revalidatePath("/accounting")
    return created
  })
}

export async function setCurrentFiscalYear(id: string) {
  const session = await requirePermission("finance:manage")
  await prisma.$transaction([
    prisma.fiscalYear.updateMany({
      where: { schoolId: session.user.schoolId!, isCurrent: true },
      data:  { isCurrent: false },
    }),
    prisma.fiscalYear.update({
      where: { id },
      data:  { isCurrent: true },
    }),
  ])
  revalidatePath("/accounting/fiscal-years")
  revalidatePath("/accounting")
}

export async function lockFiscalYear(id: string) {
  await requirePermission("finance:manage")
  await prisma.fiscalYear.update({ where: { id }, data: { status: "LOCKED" } })
  revalidatePath("/accounting/fiscal-years")
}

/**
 * Resolve which fiscal year a given BS date falls into for the current school.
 * Returns null if no matching open FY exists yet.
 */
export async function resolveFiscalYearForDate(schoolId: string, dateBS: string) {
  const ad = toAD(dateBS)
  return prisma.fiscalYear.findFirst({
    where: {
      schoolId,
      startAD: { lte: ad },
      endAD:   { gte: ad },
    },
  })
}
