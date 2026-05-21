"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { currentBSYear } from "@/lib/nepali-date"

// Required (per user spec): fullName, rollNumber, academicYearId.
// Everything else is optional; the action substitutes nulls / auto-generated
// values for blanks and coerces empty-string FK ids to null to avoid PG FK errors.
const EnrollSchema = z.object({
  // Identity
  fullName:         z.string().min(2, "Student name is required"),
  fullNameNepali:   z.string().optional(),
  avatarUrl:        z.string().optional(),
  email:            z.string().email().optional().or(z.literal("")),
  dobBS:            z.string().optional(),
  gender:           z.string().optional(),
  bloodGroup:       z.string().optional(),
  nationality:      z.string().optional(),
  // Identity documents
  birthCertNo:      z.string().optional(),
  nationalIdNo:     z.string().optional(),
  emisNumber:       z.string().optional(),
  // Demographics (EMIS)
  religion:         z.string().optional(),
  ethnicity:        z.string().optional(),
  motherTongue:     z.string().optional(),
  // Nepal address
  province:         z.string().optional(),
  district:         z.string().optional(),
  municipality:     z.string().optional(),
  wardNo:           z.string().optional(),
  street:           z.string().optional(),
  temporaryAddress: z.string().optional(),
  // Academic
  classId:          z.string().optional(),
  sectionId:        z.string().optional(),
  academicYearId:   z.string().min(1, "Session (academic year) is required"),
  rollNumber:       z.string().min(1, "Roll number is required"),
  nebRegistrationNo:z.string().optional(),
  symbolNumber:     z.string().optional(),
  previousSchool:   z.string().optional(),
  transferCertNo:   z.string().optional(),
  // EMIS indicators
  disabilityStatus: z.string().optional(),
  isResidential:    z.boolean().optional(),
  scholarshipType:  z.string().optional(),
  distanceKm:       z.number().optional(),
  freeTextbook:     z.boolean().optional(),
  // Father
  fatherName:       z.string().optional(),
  fatherPhone:      z.string().optional(),
  fatherOccupation: z.string().optional(),
  fatherEducation:  z.string().optional(),
  // Mother
  motherName:       z.string().optional(),
  motherPhone:      z.string().optional(),
  motherOccupation: z.string().optional(),
  motherEducation:  z.string().optional(),
  // Primary guardian (if different from father/mother)
  guardianName:     z.string().optional(),
  guardianPhone:    z.string().optional(),
  guardianRelation: z.string().optional(),
})

async function nextAdmissionNo(schoolId: string, slug: string): Promise<string> {
  const year  = currentBSYear()
  const count = await prisma.student.count({ where: { schoolId } })
  const seq   = String(count + 1).padStart(4, "0")
  return `${slug}-${year}-${seq}`
}

/** Coerce empty / placeholder strings to null so FK columns don't reference "" */
function nullIfBlank(v: string | undefined | null): string | null {
  if (v == null) return null
  const t = v.trim()
  if (t === "" || t === "none" || t === "NONE") return null
  return t
}

export async function enrollStudent(schoolId: string, slug: string, rawData: unknown) {
  const data = EnrollSchema.parse(rawData)

  const admissionNo = await nextAdmissionNo(schoolId, slug)
  // Auto-generate email if blank so User.email (unique) always has a value
  const emailIn = nullIfBlank(data.email ?? "")
  const email   = emailIn ?? `${admissionNo.toLowerCase()}@${slug}.local`

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return { success: false, error: "Email already in use." }

  const hashedPw = await bcrypt.hash("student123", 10)

  // Required Prisma fields that the form may leave blank — fall back to placeholders.
  const dobBS  = nullIfBlank(data.dobBS) ?? ""
  const gender = nullIfBlank(data.gender) ?? "UNSPECIFIED"
  // classId is required on Student. Bail with a clear error rather than FK-violate.
  const classId = nullIfBlank(data.classId)
  if (!classId) return { success: false, error: "Class is required to enroll a student." }

  const formattedAddress = [
    data.street,
    data.wardNo && `Ward ${data.wardNo}`,
    data.municipality,
    data.district,
    data.province,
  ].filter(Boolean).join(", ")

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName:  data.fullName,
        email,
        password:  hashedPw,
        role:      "STUDENT",
        schoolId,
        avatarUrl: nullIfBlank(data.avatarUrl ?? ""),
      },
    })

    const student = await tx.student.create({
      data: {
        userId:            user.id,
        schoolId,
        admissionNo,
        classId,
        sectionId:         nullIfBlank(data.sectionId),
        academicYearId:    nullIfBlank(data.academicYearId),
        rollNumber:        nullIfBlank(data.rollNumber),
        dobBS,
        gender,
        bloodGroup:        data.bloodGroup        ?? null,
        nationality:       data.nationality       ?? "Nepali",
        fullNameNepali:    data.fullNameNepali    ?? null,
        birthCertNo:       data.birthCertNo       ?? null,
        nationalIdNo:      data.nationalIdNo      ?? null,
        emisNumber:        data.emisNumber        ?? null,
        nebRegistrationNo: data.nebRegistrationNo ?? null,
        symbolNumber:      data.symbolNumber      ?? null,
        religion:          data.religion          ?? null,
        caste:             data.ethnicity         ?? null,
        ethnicity:         data.ethnicity         ?? null,
        motherTongue:      data.motherTongue      ?? null,
        province:          data.province          ?? null,
        district:          data.district          ?? null,
        municipality:      data.municipality      ?? null,
        wardNo:            data.wardNo            ?? null,
        street:            data.street            ?? null,
        permanentAddress:  formattedAddress       || null,
        temporaryAddress:  data.temporaryAddress  ?? null,
        previousSchool:    data.previousSchool    ?? null,
        transferCertNo:    data.transferCertNo    ?? null,
        disabilityStatus:  data.disabilityStatus  ?? "NONE",
        isResidential:     data.isResidential     ?? false,
        scholarshipType:   data.scholarshipType   ?? "NONE",
        distanceKm:        data.distanceKm        ?? null,
        freeTextbook:      data.freeTextbook      ?? false,
      },
    })

    // Create guardian records
    const guardiansToCreate: {
      name: string; phone: string; relation: string; occupation?: string | null;
      educationLevel?: string | null; isPrimary: boolean
    }[] = []

    if (data.fatherName) {
      guardiansToCreate.push({
        name:           data.fatherName,
        phone:          data.fatherPhone   ?? "",
        relation:       "Father",
        occupation:     data.fatherOccupation ?? null,
        educationLevel: data.fatherEducation  ?? null,
        isPrimary:      !data.motherName && !data.guardianName,
      })
    }
    if (data.motherName) {
      guardiansToCreate.push({
        name:           data.motherName,
        phone:          data.motherPhone   ?? "",
        relation:       "Mother",
        occupation:     data.motherOccupation ?? null,
        educationLevel: data.motherEducation  ?? null,
        isPrimary:      !data.fatherName && !data.guardianName,
      })
    }
    if (data.guardianName && data.guardianRelation !== "Father" && data.guardianRelation !== "Mother") {
      guardiansToCreate.push({
        name:      data.guardianName,
        phone:     data.guardianPhone   ?? "",
        relation:  data.guardianRelation ?? "Guardian",
        isPrimary: true,
      })
    }
    // Ensure exactly one primary
    if (guardiansToCreate.length > 0 && !guardiansToCreate.some(g => g.isPrimary)) {
      guardiansToCreate[0].isPrimary = true
    }

    if (guardiansToCreate.length > 0) {
      await tx.studentGuardian.createMany({
        data: guardiansToCreate.map(g => ({ ...g, studentId: student.id })),
      })
    }
  })

  revalidatePath("/students")
  return { success: true, admissionNo }
}

export async function getStudents(
  schoolId: string,
  filters?: { classId?: string; sectionId?: string; status?: string; search?: string }
) {
  return prisma.student.findMany({
    where: {
      schoolId,
      ...(filters?.classId   && { classId:   filters.classId }),
      ...(filters?.sectionId && { sectionId: filters.sectionId }),
      ...(filters?.status    && { status:    filters.status }),
      ...(filters?.search    && {
        OR: [
          { user:             { fullName: { contains: filters.search, mode: "insensitive" } } },
          { admissionNo:      { contains: filters.search, mode: "insensitive" } },
          { nebRegistrationNo:{ contains: filters.search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      user:      { select: { fullName: true, email: true, avatarUrl: true } },
      class:     { select: { name: true } },
      section:   { select: { name: true } },
      guardians: { orderBy: { isPrimary: "desc" }, take: 2 },
    },
    orderBy: { admissionNo: "asc" },
  })
}

export async function getStudentById(schoolId: string, studentId: string) {
  return prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      user:         { select: { fullName: true, email: true, avatarUrl: true } },
      class:        { select: { name: true } },
      section:      { select: { name: true } },
      academicYear: { select: { name: true } },
      guardians:    { orderBy: { isPrimary: "desc" } },
      documents:    true,
    },
  })
}

export async function updateStudentStatus(
  schoolId: string,
  studentId: string,
  status: string
) {
  await prisma.student.update({
    where: { id: studentId, schoolId },
    data:  { status },
  })
  revalidatePath("/students")
}

/** Returns the next sequential roll number for a class/section. */
export async function getNextRollNumber(
  schoolId:   string,
  classId:    string,
  sectionId?: string
): Promise<string> {
  const count = await prisma.student.count({
    where: {
      schoolId,
      classId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      ...(sectionId ? { sectionId } : {}),
    },
  })
  return String(count + 1).padStart(2, "0")
}

/**
 * Suggest the next symbol number for a class by inspecting existing students.
 * Works only when every assigned symbol number in the class is pure numeric —
 * if any are alphanumeric, returns "" so the teacher enters the format manually.
 *
 * Returned suggestion is zero-padded to the longest existing length.
 */
export async function getNextSymbolNumber(schoolId: string, classId: string): Promise<string> {
  const rows = await prisma.student.findMany({
    where:  { schoolId, classId, symbolNumber: { not: null } },
    select: { symbolNumber: true },
  })
  if (rows.length === 0) return ""

  let maxN = 0
  let maxLen = 0
  for (const r of rows) {
    const s = (r.symbolNumber ?? "").trim()
    if (!/^\d+$/.test(s)) return ""  // any non-numeric → bail
    const n = parseInt(s, 10)
    if (n > maxN) maxN = n
    if (s.length > maxLen) maxLen = s.length
  }
  return String(maxN + 1).padStart(maxLen, "0")
}

export async function updateStudent(
  schoolId: string,
  studentId: string,
  data: Partial<{
    fullNameNepali: string
    nebRegistrationNo: string
    rollNumber: string
    classId: string
    sectionId: string
    disabilityStatus: string
    isResidential: boolean
    scholarshipType: string
    distanceKm: number
    freeTextbook: boolean
  }>
) {
  await prisma.student.update({
    where: { id: studentId, schoolId },
    data,
  })
  revalidatePath("/students")
}

// ─── Inline field update (used by the profile page double-click edit) ───────
//
// Whitelists which fields can be inline-edited; routes to the correct
// Prisma model (Student vs. User) and coerces values appropriately.

const STUDENT_STR_FIELDS = new Set([
  "fullNameNepali", "dobBS", "gender", "bloodGroup", "nationality", "religion",
  "caste", "ethnicity", "motherTongue", "birthCertNo", "nationalIdNo",
  "nebRegistrationNo", "symbolNumber", "rollNumber", "previousSchool",
  "transferCertNo", "permanentAddress", "temporaryAddress", "province",
  "district", "municipality", "wardNo", "street", "status",
  "disabilityStatus", "scholarshipType",
])
const STUDENT_NUM_FIELDS = new Set(["distanceKm"])
const STUDENT_BOOL_FIELDS = new Set(["isResidential", "freeTextbook"])
const USER_STR_FIELDS = new Set(["fullName", "email", "avatarUrl"])

export async function updateStudentField(
  schoolId:  string,
  studentId: string,
  field:     string,
  value:     string | null,
) {
  if (STUDENT_STR_FIELDS.has(field)) {
    await prisma.student.update({
      where: { id: studentId, schoolId },
      data:  { [field]: value || null },
    })
  } else if (STUDENT_NUM_FIELDS.has(field)) {
    const num = value && value.trim() ? parseFloat(value) : null
    if (num !== null && Number.isNaN(num)) throw new Error("Invalid number")
    await prisma.student.update({
      where: { id: studentId, schoolId },
      data:  { [field]: num },
    })
  } else if (STUDENT_BOOL_FIELDS.has(field)) {
    await prisma.student.update({
      where: { id: studentId, schoolId },
      data:  { [field]: value === "true" || value === "1" },
    })
  } else if (USER_STR_FIELDS.has(field)) {
    if (field === "fullName" && (!value || value.trim().length < 2)) {
      throw new Error("Full name must be at least 2 characters")
    }
    const stu = await prisma.student.findFirst({
      where:  { id: studentId, schoolId },
      select: { userId: true },
    })
    if (!stu) throw new Error("Student not found")
    await prisma.user.update({
      where: { id: stu.userId },
      data:  { [field]: value || null },
    })
  } else {
    throw new Error(`Field "${field}" is not editable inline`)
  }
  revalidatePath(`/students/${studentId}`)
  revalidatePath(`/students`)
}

// ─── Guardian CRUD ──────────────────────────────────────────────────────────

const GUARDIAN_STR_FIELDS = new Set([
  "name", "relation", "phone", "email", "occupation", "educationLevel",
])
const GUARDIAN_BOOL_FIELDS = new Set(["isPrimary"])

async function assertGuardianOwnership(
  schoolId: string,
  guardianId: string,
): Promise<{ studentId: string }> {
  const g = await prisma.studentGuardian.findUnique({
    where:  { id: guardianId },
    select: { studentId: true, student: { select: { schoolId: true } } },
  })
  if (!g || g.student.schoolId !== schoolId) {
    throw new Error("Guardian not found")
  }
  return { studentId: g.studentId }
}

export async function updateGuardianField(
  schoolId:    string,
  guardianId:  string,
  field:       string,
  value:       string | null,
) {
  const { studentId } = await assertGuardianOwnership(schoolId, guardianId)

  if (GUARDIAN_STR_FIELDS.has(field)) {
    if (field === "name" && (!value || value.trim().length < 2)) {
      throw new Error("Name must be at least 2 characters")
    }
    if (field === "phone" && value && value.trim().length < 7) {
      throw new Error("Phone looks too short")
    }
    await prisma.studentGuardian.update({
      where: { id: guardianId },
      data:  { [field]: value || (field === "phone" || field === "name" ? "" : null) },
    })
  } else if (GUARDIAN_BOOL_FIELDS.has(field)) {
    const next = value === "true" || value === "1"
    if (field === "isPrimary" && next) {
      // Only one primary per student — demote everyone else first
      await prisma.$transaction([
        prisma.studentGuardian.updateMany({
          where: { studentId, NOT: { id: guardianId } },
          data:  { isPrimary: false },
        }),
        prisma.studentGuardian.update({
          where: { id: guardianId },
          data:  { isPrimary: true },
        }),
      ])
    } else {
      await prisma.studentGuardian.update({
        where: { id: guardianId },
        data:  { [field]: next },
      })
    }
  } else {
    throw new Error(`Field "${field}" is not editable`)
  }

  revalidatePath(`/students/${studentId}`)
}

export async function addGuardian(
  schoolId:  string,
  studentId: string,
  data: { name: string; relation: string; phone?: string },
) {
  // Authorize student belongs to school
  const stu = await prisma.student.findFirst({
    where:  { id: studentId, schoolId },
    select: { id: true },
  })
  if (!stu) throw new Error("Student not found")

  if (!data.name.trim() || data.name.trim().length < 2) {
    throw new Error("Name is required")
  }

  const existingCount = await prisma.studentGuardian.count({ where: { studentId } })

  const created = await prisma.studentGuardian.create({
    data: {
      studentId,
      name:      data.name.trim(),
      relation:  data.relation.trim() || "Guardian",
      phone:     (data.phone ?? "").trim(),
      isPrimary: existingCount === 0,    // First guardian becomes primary automatically
    },
  })
  revalidatePath(`/students/${studentId}`)
  return created.id
}

export async function deleteGuardian(schoolId: string, guardianId: string) {
  const { studentId } = await assertGuardianOwnership(schoolId, guardianId)
  await prisma.studentGuardian.delete({ where: { id: guardianId } })
  // Ensure at least one remaining guardian is primary
  const remaining = await prisma.studentGuardian.findMany({
    where:  { studentId },
    select: { id: true, isPrimary: true },
    orderBy: { id: "asc" },
  })
  if (remaining.length > 0 && !remaining.some(g => g.isPrimary)) {
    await prisma.studentGuardian.update({
      where: { id: remaining[0].id },
      data:  { isPrimary: true },
    })
  }
  revalidatePath(`/students/${studentId}`)
}

export async function deleteStudent(schoolId: string, studentId: string) {
  const stu = await prisma.student.findFirst({
    where:  { id: studentId, schoolId },
    select: { userId: true },
  })
  if (!stu) throw new Error("Student not found")
  // Student row cascades to dependents (marks, attendance, fees) per schema.
  await prisma.student.delete({ where: { id: studentId } })
  // User is separate; only delete if not referenced elsewhere
  const stillReferenced = await prisma.student.findFirst({ where: { userId: stu.userId } })
  if (!stillReferenced) {
    await prisma.user.delete({ where: { id: stu.userId } }).catch(() => {
      // If other relations exist (e.g. teaching), leave the user record intact.
    })
  }
  revalidatePath("/students")
}
