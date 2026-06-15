import { prisma } from "@/lib/prisma"

/**
 * Institution Type Architecture (Phase 12)
 *
 * One `institutionType` field on School controls which modules, routes and UI
 * elements activate:
 *
 *   SCHOOL     → Grades 1–12 only (Class/Section/CAS/NEB routes)
 *   COLLEGE    → K-12 + Bachelor's programmes (adds Department/Programme/Semester/LMS)
 *   UNIVERSITY → K-12 + Bachelor's + Master's + PhD (adds Thesis/Research)
 */

export type InstitutionType = "SCHOOL" | "COLLEGE" | "UNIVERSITY"

export const INSTITUTION_TYPES: {
  value: InstitutionType
  label: string
  description: string
}[] = [
  {
    value: "SCHOOL",
    label: "School",
    description: "Grades 1–12 only. Class/Section structure, CAS & NEB evaluation.",
  },
  {
    value: "COLLEGE",
    label: "College",
    description: "K-12 plus Bachelor's programmes. Departments, semesters & credit GPA.",
  },
  {
    value: "UNIVERSITY",
    label: "University",
    description: "Full higher education: Bachelor's, Master's, PhD, thesis & research.",
  },
]

/** Affiliating universities for COLLEGE-type institutions (per roadmap spec). */
export const AFFILIATING_UNIVERSITIES: { code: string; name: string }[] = [
  { code: "TU", name: "Tribhuvan University" },
  { code: "KU", name: "Kathmandu University" },
  { code: "PU", name: "Pokhara University" },
  { code: "PUF", name: "Purbanchal University" },
  { code: "FWU", name: "Far Western University" },
  { code: "MU", name: "Mid-West University" },
]

function normalize(type: string | null | undefined): InstitutionType {
  return type === "COLLEGE" || type === "UNIVERSITY" ? type : "SCHOOL"
}

/**
 * Resolve a school's institution type. Unknown/legacy values fall back to
 * "SCHOOL" so existing tenants are never accidentally shown HE routes.
 */
export async function getInstitutionType(schoolId: string): Promise<InstitutionType> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { institutionType: true },
  })
  return normalize(school?.institutionType)
}

/** Same lookup but by tenant slug (the `domain` route param). */
export async function getInstitutionTypeBySlug(slug: string): Promise<InstitutionType> {
  const school = await prisma.school.findUnique({
    where: { slug },
    select: { institutionType: true },
  })
  return normalize(school?.institutionType)
}

/** Higher-education institution? (COLLEGE or UNIVERSITY) */
export function isHE(type: string): boolean {
  return type === "COLLEGE" || type === "UNIVERSITY"
}

/** Thesis / PhD / Research routes active? (UNIVERSITY only) */
export function hasThesis(type: string): boolean {
  return type === "UNIVERSITY"
}
