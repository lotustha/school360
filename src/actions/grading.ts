"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  resolveGradingSettings,
  type GradingSettings,
  type ResolvedGradingSettings,
} from "@/lib/grading-config"

// ─── Grading settings ────────────────────────────────────────────────────────

export async function getGradingSettings(schoolId: string): Promise<ResolvedGradingSettings> {
  const school = await prisma.school.findUnique({
    where:  { id: schoolId },
    select: { gradingSettings: true },
  })
  return resolveGradingSettings(school?.gradingSettings)
}

export async function saveGradingSettings(schoolId: string, settings: GradingSettings) {
  await prisma.school.update({
    where: { id: schoolId },
    data:  { gradingSettings: settings },
  })
  revalidatePath("/academics/grading")
}
