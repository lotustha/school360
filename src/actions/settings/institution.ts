"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { AFFILIATING_UNIVERSITIES } from "@/lib/institution"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstitutionSettings {
  institutionType: "SCHOOL" | "COLLEGE" | "UNIVERSITY"
  affiliatedTo: string | null
  affiliationCode: string | null
  moeRegNo: string | null
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_AFFILIATIONS = new Set(AFFILIATING_UNIVERSITIES.map((u) => u.code))

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v

const updateSchema = z.object({
  institutionType: z.enum(["SCHOOL", "COLLEGE", "UNIVERSITY"]),
  affiliatedTo: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(10)
      .refine((v) => VALID_AFFILIATIONS.has(v), "Unknown affiliating university")
      .nullable()
      .optional()
  ),
  affiliationCode: z.preprocess(emptyToNull, z.string().trim().max(50).nullable().optional()),
  moeRegNo: z.preprocess(emptyToNull, z.string().trim().max(50).nullable().optional()),
})

export type UpdateInstitutionInput = z.input<typeof updateSchema>

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getInstitutionSettings(): Promise<InstitutionSettings> {
  const session = await requirePermission("settings:view")

  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId! },
    select: {
      institutionType: true,
      affiliatedTo: true,
      affiliationCode: true,
      moeRegNo: true,
    },
  })
  if (!school) throw new Error("School not found")

  const type =
    school.institutionType === "COLLEGE" || school.institutionType === "UNIVERSITY"
      ? school.institutionType
      : "SCHOOL"

  return {
    institutionType: type,
    affiliatedTo: school.affiliatedTo,
    affiliationCode: school.affiliationCode,
    moeRegNo: school.moeRegNo,
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updateInstitutionSettings(input: UpdateInstitutionInput) {
  const session = await requirePermission("settings:manage")
  const schoolId = session.user.schoolId!

  const data = updateSchema.parse(input)

  const existing = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true },
  })
  if (!existing) throw new Error("School not found")

  // Affiliation only applies to higher-education institutions; clear it when
  // the tenant is (or reverts to) a plain SCHOOL so stale values never linger.
  const isHEType = data.institutionType === "COLLEGE" || data.institutionType === "UNIVERSITY"

  await prisma.school.update({
    where: { id: schoolId },
    data: {
      institutionType: data.institutionType,
      affiliatedTo: isHEType ? (data.affiliatedTo ?? null) : null,
      affiliationCode: isHEType ? (data.affiliationCode ?? null) : null,
      moeRegNo: data.moeRegNo ?? null,
    },
  })

  revalidatePath("/settings/institution")
  // institutionType gates layout-level nav, so refresh the tenant shell too
  revalidatePath("/", "layout")

  return { ok: true as const }
}
