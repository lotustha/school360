"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { currentBSYear } from "@/lib/nepali-date"
import type { ImportField, ImportRow, ImportRowResult } from "@/lib/student-import-schema"

// ──────────────────────────────────────────────────────────────────────────────
// Bulk field update (spreadsheet edit grid)
// ──────────────────────────────────────────────────────────────────────────────
//
// Whitelisted per-field, routed to Student / User / StudentGuardian tables.
// Each row is its own transaction — a bad row only fails itself, never poisons
// neighbours. Class/section transfers validate scope; primary guardian fields
// upsert by `(studentId, isPrimary: true)`.

const STUDENT_STR_FIELDS = new Set([
  // Core identity
  "fullNameNepali", "dobBS", "gender", "bloodGroup", "rollNumber",
  "symbolNumber", "nebRegistrationNo", "status",
  // Demographics
  "religion", "caste", "ethnicity", "motherTongue",
  // Address
  "province", "district", "municipality", "wardNo", "street",
  "permanentAddress", "temporaryAddress",
  // EMIS identity
  "nationalIdNo", "birthCertNo", "nationality",
  // Academic history
  "previousSchool", "transferCertNo",
])
const USER_STR_FIELDS    = new Set(["fullName", "email", "avatarUrl"])
const GUARDIAN_FIELDS    = new Set(["name", "relation", "phone", "email", "occupation"])
const GUARDIAN_REQUIRED  = new Set(["name", "relation", "phone"])
const GUARDIAN_PREFIX    = "guardian."

export type BulkStudentUpdate = {
  studentId: string
  fields:    Record<string, string | null>
}

export interface BulkUpdateResult {
  ok:     string[]          // studentIds that succeeded
  failed: { studentId: string; error: string }[]
}

export async function bulkUpdateStudents(
  schoolId: string,
  updates:  BulkStudentUpdate[],
): Promise<BulkUpdateResult> {
  const result: BulkUpdateResult = { ok: [], failed: [] }

  // Pre-fetch this school's classes + sections once for transfer validation
  const allClasses = await prisma.class.findMany({
    where:   { schoolId },
    include: { sections: { select: { id: true } } },
  })
  const classMap = new Map(allClasses.map(c => [c.id, c]))

  for (const u of updates) {
    try {
      const studentData:  Record<string, string | null> = {}
      const userData:     Record<string, string | null> = {}
      const guardianData: Record<string, string | null> = {}
      let touchesClass   = false
      let touchesSection = false

      for (const [k, v] of Object.entries(u.fields)) {
        if (STUDENT_STR_FIELDS.has(k))             studentData[k] = v
        else if (USER_STR_FIELDS.has(k))           userData[k]    = v
        else if (k === "classId")                  { studentData.classId   = v; touchesClass   = true }
        else if (k === "sectionId")                { studentData.sectionId = v; touchesSection = true }
        else if (k.startsWith(GUARDIAN_PREFIX)) {
          const gk = k.slice(GUARDIAN_PREFIX.length)
          if (!GUARDIAN_FIELDS.has(gk)) throw new Error(`Guardian field "${gk}" is not editable`)
          guardianData[gk] = v
        }
        else throw new Error(`Field "${k}" is not bulk-editable`)
      }

      // ─── Class transfer validation ───────────────────────────────────────
      if (touchesClass) {
        if (!studentData.classId) throw new Error("Class cannot be cleared")
        if (!classMap.has(studentData.classId)) throw new Error("Class is not in this school")
      }
      if (touchesSection && studentData.sectionId) {
        // sectionId must belong to the new class (if set in same payload) or
        // the student's current class.
        let referenceClassId = studentData.classId as string | undefined
        if (!referenceClassId) {
          const cur = await prisma.student.findFirst({
            where:  { id: u.studentId, schoolId },
            select: { classId: true },
          })
          if (!cur) throw new Error("Student not found")
          referenceClassId = cur.classId
        }
        const cls = classMap.get(referenceClassId)
        if (!cls || !cls.sections.some(s => s.id === studentData.sectionId)) {
          throw new Error("Section does not belong to the selected class")
        }
      }
      // Class changed but section not in payload → silently clear stale sectionId
      if (touchesClass && !touchesSection) {
        const cur = await prisma.student.findFirst({
          where:  { id: u.studentId, schoolId },
          select: { sectionId: true },
        })
        if (cur?.sectionId) {
          const newCls = classMap.get(studentData.classId as string)
          if (!newCls?.sections.some(s => s.id === cur.sectionId)) {
            studentData.sectionId = null
          }
        }
      }

      // ─── Persist ────────────────────────────────────────────────────────
      await prisma.$transaction(async (tx) => {
        if (Object.keys(studentData).length > 0) {
          await tx.student.update({
            where: { id: u.studentId, schoolId },
            data:  studentData,
          })
        }
        if (Object.keys(userData).length > 0) {
          const stu = await tx.student.findFirst({
            where:  { id: u.studentId, schoolId },
            select: { userId: true },
          })
          if (!stu) throw new Error("Student not found")
          await tx.user.update({
            where: { id: stu.userId },
            data:  userData,
          })
        }
        if (Object.keys(guardianData).length > 0) {
          const existing = await tx.studentGuardian.findFirst({
            where: { studentId: u.studentId, isPrimary: true },
          })
          if (existing) {
            // Required fields can't be cleared via grid — drop nulls/empties.
            const data: Record<string, string | null> = {}
            for (const [k, v] of Object.entries(guardianData)) {
              if (GUARDIAN_REQUIRED.has(k) && (v === null || v === "")) continue
              data[k] = v
            }
            if (Object.keys(data).length > 0) {
              await tx.studentGuardian.update({ where: { id: existing.id }, data })
            }
          } else {
            // Create only when minimum required fields are present
            const name  = guardianData.name?.trim()
            const phone = guardianData.phone?.trim()
            if (name && phone) {
              await tx.studentGuardian.create({
                data: {
                  studentId:  u.studentId,
                  name,
                  phone,
                  relation:   guardianData.relation?.trim() || "Guardian",
                  email:      guardianData.email      ?? null,
                  occupation: guardianData.occupation ?? null,
                  isPrimary:  true,
                },
              })
            }
          }
        }
      })
      result.ok.push(u.studentId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed"
      result.failed.push({ studentId: u.studentId, error: msg })
    }
  }

  revalidatePath("/students")
  return result
}

// ──────────────────────────────────────────────────────────────────────────────
// Bulk roll / symbol number assignment
// ──────────────────────────────────────────────────────────────────────────────
//
// Operates within a class (+ optional section) scope only. Caller computes the
// desired (studentId, value) pairs client-side after previewing the diff; this
// action just persists them, but re-validates that:
//   1. Every studentId belongs to the requested schoolId + classId scope.
//   2. No two assignments share the same value within the scope.
//   3. No assigned value collides with an existing student (in scope) that is
//      NOT being reassigned — would silently create duplicates otherwise since
//      rollNumber has no DB-level unique constraint.
//
// All-or-nothing inside a single transaction.

export type AssignField = "rollNumber" | "symbolNumber"

export interface BulkNumberAssignment {
  studentId: string
  value:     string   // pre-formatted (prefix + padded number)
}

export async function bulkAssignNumbers(
  schoolId:     string,
  classId:      string,
  sectionId:    string | null,
  field:        AssignField,
  assignments:  BulkNumberAssignment[],
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  if (assignments.length === 0) {
    return { success: false, error: "Nothing to assign." }
  }

  // 1) In-payload duplicates (case-insensitive)
  const seen = new Map<string, number>()
  for (const a of assignments) {
    const k = a.value.trim().toLowerCase()
    if (!k) {
      return { success: false, error: "Assignments may not have empty values." }
    }
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  const dupe = [...seen.entries()].find(([, n]) => n > 1)
  if (dupe) {
    return { success: false, error: `Duplicate value "${dupe[0]}" appears ${dupe[1]} times in this batch.` }
  }

  // 2) Verify every student is in scope
  const ids = assignments.map(a => a.studentId)
  const scoped = await prisma.student.findMany({
    where:  {
      id:       { in: ids },
      schoolId,
      classId,
      ...(sectionId ? { sectionId } : {}),
    },
    select: { id: true },
  })
  if (scoped.length !== ids.length) {
    return { success: false, error: "One or more students are outside the chosen class/section." }
  }

  // 3) External collisions — any student in scope NOT being reassigned that
  //    already holds one of the new values?
  const newValues = assignments.map(a => a.value.trim())
  const collision = await prisma.student.findFirst({
    where: {
      schoolId,
      classId,
      ...(sectionId ? { sectionId } : {}),
      id:       { notIn: ids },
      [field]:  { in: newValues },
    },
    select: {
      id:           true,
      rollNumber:   true,
      symbolNumber: true,
      user:         { select: { fullName: true } },
    },
  })
  if (collision) {
    const conflictVal = field === "rollNumber" ? collision.rollNumber : collision.symbolNumber
    return {
      success: false,
      error: `"${conflictVal}" is already held by ${collision.user.fullName} in this class/section. Pick a different start or extend the range.`,
    }
  }

  // 4) Persist atomically
  await prisma.$transaction(
    assignments.map(a => prisma.student.update({
      where: { id: a.studentId },
      data:  { [field]: a.value.trim() },
    })),
  )

  revalidatePath("/students")
  return { success: true, count: assignments.length }
}

// ──────────────────────────────────────────────────────────────────────────────
// xlsx Import / Export — round-trippable subset
// ──────────────────────────────────────────────────────────────────────────────
//
// Field list + types live in src/lib/student-import-schema.ts so the
// importer client component can read them directly. `"use server"` modules
// may only export async functions, so we keep schema constants out of here.

interface ResolveCtx {
  schoolId: string
  slug:     string
  classMap: Map<string, { id: string; name: string; sections: { id: string; name: string }[] }>
}

function norm(s: string | undefined | null): string {
  return (s ?? "").trim()
}

function looseKey(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

function resolveClass(ctx: ResolveCtx, className: string): { id: string; name: string; sections: { id: string; name: string }[] } | null {
  const k = looseKey(className)
  for (const v of ctx.classMap.values()) {
    if (looseKey(v.name) === k) return v
  }
  return null
}

function classifyRow(
  ctx: ResolveCtx,
  row: ImportRow,
): { result: ImportRowResult; resolved?: { classId: string; sectionId: string | null; admissionNo?: string } } {
  const errors:   string[] = []
  const warnings: string[] = []

  const admissionNo = norm(row.admissionNo)
  const className   = norm(row.className)
  const sectionName = norm(row.sectionName)
  const fullName    = norm(row.fullName)

  let classId: string | null = null
  let sectionId: string | null = null

  if (className) {
    const cls = resolveClass(ctx, className)
    if (!cls) {
      errors.push(`Class "${className}" not found in this school`)
    } else {
      classId = cls.id
      if (sectionName) {
        const sec = cls.sections.find(s => looseKey(s.name) === looseKey(sectionName))
        if (!sec) errors.push(`Section "${sectionName}" not found in class "${cls.name}"`)
        else      sectionId = sec.id
      }
    }
  }

  const action: "create" | "update" = admissionNo ? "update" : "create"

  if (action === "create") {
    if (!fullName)  errors.push("Full Name is required to create a new student")
    if (!classId)   errors.push("Class is required to create a new student")
  }

  // Gender normalization warning (we don't fail on unknown — schema accepts strings)
  const gender = norm(row.gender)
  if (gender && !["Male", "Female", "Other", "UNSPECIFIED"].includes(gender)) {
    warnings.push(`Gender "${gender}" is non-standard`)
  }

  // Status enum check (warn only)
  const status = norm(row.status)
  if (status && !["ACTIVE", "LEFT", "GRADUATED", "SUSPENDED"].includes(status)) {
    warnings.push(`Status "${status}" is non-standard`)
  }

  return {
    result: {
      rowIndex:    0,
      action:      errors.length ? "skip" : action,
      admissionNo: admissionNo || undefined,
      errors,
      warnings,
    },
    resolved: errors.length ? undefined : {
      classId:   classId!,
      sectionId,
      admissionNo: admissionNo || undefined,
    },
  }
}

/**
 * Dry-run: classify every row without writing. Used to render the preview
 * step of the import wizard.
 */
export async function validateStudentImport(
  schoolId: string,
  slug:     string,
  rows:     ImportRow[],
): Promise<ImportRowResult[]> {
  const school = await prisma.school.findUnique({
    where:   { id: schoolId },
    include: { classes: { include: { sections: true } } },
  })
  if (!school) throw new Error("School not found")

  const ctx: ResolveCtx = {
    schoolId, slug,
    classMap: new Map(school.classes.map(c => [c.id, {
      id: c.id, name: c.name,
      sections: c.sections.map(s => ({ id: s.id, name: s.name })),
    }])),
  }

  // Pre-check admission # existence for updates
  const wantedAdm = rows
    .map(r => norm(r.admissionNo))
    .filter(Boolean)
  const existing = wantedAdm.length > 0
    ? await prisma.student.findMany({
        where: { schoolId, admissionNo: { in: wantedAdm } },
        select: { admissionNo: true },
      })
    : []
  const existSet = new Set(existing.map(e => e.admissionNo))

  return rows.map((row, i) => {
    const { result } = classifyRow(ctx, row)
    result.rowIndex = i
    const adm = norm(row.admissionNo)
    if (adm && !existSet.has(adm)) {
      result.warnings.push(`Admission # "${adm}" doesn't exist — will create new instead of updating`)
      if (result.action === "update") result.action = "create"
      // Re-check create-required fields now that action flipped.
      if (!norm(row.fullName))  result.errors.push("Full Name is required to create a new student")
      if (!norm(row.className)) result.errors.push("Class is required to create a new student")
      if (result.errors.length) result.action = "skip"
    }
    return result
  })
}

/**
 * Commit the parsed + (preferably) validated rows. Each row succeeds or fails
 * independently — partial success is normal for spreadsheet imports.
 */
export async function commitStudentImport(
  schoolId: string,
  slug:     string,
  rows:     ImportRow[],
): Promise<{ created: number; updated: number; failed: { rowIndex: number; error: string }[] }> {
  const school = await prisma.school.findUnique({
    where:   { id: schoolId },
    include: { classes: { include: { sections: true } } },
  })
  if (!school) throw new Error("School not found")

  const ctx: ResolveCtx = {
    schoolId, slug,
    classMap: new Map(school.classes.map(c => [c.id, {
      id: c.id, name: c.name,
      sections: c.sections.map(s => ({ id: s.id, name: s.name })),
    }])),
  }

  let created = 0
  let updated = 0
  const failed: { rowIndex: number; error: string }[] = []

  // Pre-fetch existing admissionNos to choose create vs. update path
  const wantedAdm = rows.map(r => norm(r.admissionNo)).filter(Boolean)
  const existing = wantedAdm.length > 0
    ? await prisma.student.findMany({
        where:  { schoolId, admissionNo: { in: wantedAdm } },
        select: { id: true, admissionNo: true, userId: true },
      })
    : []
  const existMap = new Map(existing.map(e => [e.admissionNo, e]))

  let createSeq = await prisma.student.count({ where: { schoolId } })

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const { result, resolved } = classifyRow(ctx, row)
      if (result.errors.length || !resolved) {
        failed.push({ rowIndex: i, error: result.errors[0] ?? "Row not classifiable" })
        continue
      }
      const adm = norm(row.admissionNo)

      // Build write payload (only non-empty cells)
      const studentData: Record<string, string | null> = {}
      const userData:    Record<string, string | null> = {}
      const v = (k: ImportField) => { const x = norm(row[k]); return x === "" ? null : x }

      const stuFields: ImportField[] = [
        "fullNameNepali", "rollNumber", "symbolNumber", "nebRegistrationNo",
        "dobBS", "gender", "bloodGroup", "status",
        "religion", "ethnicity", "motherTongue",
        "province", "district", "municipality", "wardNo", "street",
      ]
      for (const k of stuFields) {
        const val = v(k)
        if (val !== null) studentData[k] = val
      }
      studentData.classId   = resolved.classId
      studentData.sectionId = resolved.sectionId
      if (v("fullName")) userData.fullName = v("fullName")!
      if (v("email"))    userData.email    = v("email")!

      if (adm && existMap.has(adm)) {
        // ─ Update path ─
        const ex = existMap.get(adm)!
        await prisma.$transaction(async (tx) => {
          if (Object.keys(studentData).length > 0) {
            await tx.student.update({ where: { id: ex.id }, data: studentData })
          }
          if (Object.keys(userData).length > 0) {
            await tx.user.update({ where: { id: ex.userId }, data: userData })
          }
        })
        updated++
      } else {
        // ─ Create path ─
        createSeq++
        const seq = String(createSeq).padStart(4, "0")
        const newAdm = `${slug}-${currentBSYear()}-${seq}`
        const email = v("email") || `${newAdm.toLowerCase()}@${slug}.local`

        const dobBS  = v("dobBS")  ?? ""
        const gender = v("gender") ?? "UNSPECIFIED"
        const hashed = await bcrypt.hash("student123", 10)
        const fullName = v("fullName")!

        await prisma.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: {
              fullName,
              email,
              password: hashed,
              role:     "STUDENT",
              schoolId,
            },
          })
          await tx.student.create({
            data: {
              userId:        u.id,
              schoolId,
              admissionNo:   newAdm,
              classId:       resolved.classId,
              sectionId:     resolved.sectionId,
              dobBS,
              gender,
              fullNameNepali:    v("fullNameNepali"),
              rollNumber:        v("rollNumber"),
              symbolNumber:      v("symbolNumber"),
              nebRegistrationNo: v("nebRegistrationNo"),
              bloodGroup:        v("bloodGroup"),
              religion:          v("religion"),
              ethnicity:         v("ethnicity"),
              motherTongue:      v("motherTongue"),
              province:          v("province"),
              district:          v("district"),
              municipality:      v("municipality"),
              wardNo:            v("wardNo"),
              street:            v("street"),
              status:            v("status") ?? "ACTIVE",
            },
          })
        })
        created++
      }
    } catch (err) {
      failed.push({ rowIndex: i, error: err instanceof Error ? err.message : "Write failed" })
    }
  }

  revalidatePath("/students")
  return { created, updated, failed }
}

// ──────────────────────────────────────────────────────────────────────────────
// Export — fetches the rows; client serializes to xlsx via SheetJS
// ──────────────────────────────────────────────────────────────────────────────

export interface ExportFilters {
  classIds?:   string[]
  sectionIds?: string[]
  statuses?:   string[]
}

export async function exportStudentRows(
  schoolId: string,
  filters:  ExportFilters,
): Promise<Record<ImportField, string>[]> {
  const rows = await prisma.student.findMany({
    where: {
      schoolId,
      ...(filters.classIds?.length   ? { classId:   { in: filters.classIds   } } : {}),
      ...(filters.sectionIds?.length ? { sectionId: { in: filters.sectionIds } } : {}),
      ...(filters.statuses?.length   ? { status:    { in: filters.statuses   } } : {}),
    },
    include: {
      user:    { select: { fullName: true, email: true } },
      class:   { select: { name: true } },
      section: { select: { name: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }, { admissionNo: "asc" }],
  })

  return rows.map(s => ({
    admissionNo:       s.admissionNo,
    fullName:          s.user.fullName,
    fullNameNepali:    s.fullNameNepali ?? "",
    email:             s.user.email,
    className:         s.class.name,
    sectionName:       s.section?.name ?? "",
    rollNumber:        s.rollNumber ?? "",
    symbolNumber:      s.symbolNumber ?? "",
    nebRegistrationNo: s.nebRegistrationNo ?? "",
    dobBS:             s.dobBS ?? "",
    gender:            s.gender,
    bloodGroup:        s.bloodGroup ?? "",
    status:            s.status,
    religion:          s.religion ?? "",
    ethnicity:         s.ethnicity ?? "",
    motherTongue:      s.motherTongue ?? "",
    province:          s.province ?? "",
    district:          s.district ?? "",
    municipality:      s.municipality ?? "",
    wardNo:            s.wardNo ?? "",
    street:            s.street ?? "",
  }))
}

// ──────────────────────────────────────────────────────────────────────────────
// NEB Excel — position-pair matching
// ──────────────────────────────────────────────────────────────────────────────
//
// NEB supplies an xlsx with (name, NEB reg, DOB) per student. Match strategy:
//
//   1. Caller picks one or more Classes (optionally narrowed by Faculty/ies)
//   2. Both DB students AND Excel rows get sorted alphabetically by name
//   3. If counts match, pair row-by-row positionally
//   4. Caller applies the resolved (studentId → fields) mapping here
//
// All actual sorting / alignment / preview lives in the client wizard. The
// server actions below just fetch the scope and persist the resolved
// mapping after re-verifying scope membership.

export interface NebScopeStudent {
  id:                 string
  fullName:           string
  admissionNo:        string
  classId:            string
  className:          string
  sectionName:        string | null
  avatarUrl:          string | null
  rollNumber:         string | null
  nebRegistrationNo:  string | null
  dobBS:              string
}

export async function getStudentsForNebScope(args: {
  schoolId:   string
  classIds:   string[]
  facultyIds?: string[]   // optional defense-in-depth filter
}): Promise<NebScopeStudent[]> {
  if (args.classIds.length === 0) return []

  // Verify every requested class belongs to the school. When facultyIds is
  // provided, also require the class's faculty falls within that set.
  const classes = await prisma.class.findMany({
    where:  {
      id:       { in: args.classIds },
      schoolId: args.schoolId,
      ...(args.facultyIds && args.facultyIds.length > 0
        ? { facultyId: { in: args.facultyIds } }
        : {}),
    },
    select: { id: true },
  })
  if (classes.length !== args.classIds.length) return []

  const students = await prisma.student.findMany({
    where:   {
      schoolId: args.schoolId,
      classId:  { in: args.classIds },
      status:   { in: ["ACTIVE", "SUSPENDED"] },
    },
    include: {
      user:    { select: { fullName: true, avatarUrl: true } },
      class:   { select: { name: true } },
      section: { select: { name: true } },
    },
    orderBy: { admissionNo: "asc" },
  })

  return students.map(s => ({
    id:                s.id,
    fullName:          s.user.fullName,
    admissionNo:       s.admissionNo,
    classId:           s.classId,
    className:         s.class.name,
    sectionName:       s.section?.name ?? null,
    avatarUrl:         s.user.avatarUrl ?? null,
    rollNumber:        s.rollNumber,
    nebRegistrationNo: s.nebRegistrationNo,
    dobBS:             s.dobBS,
  }))
}

export interface NebApplyItem {
  studentId:          string
  nebRegistrationNo?: string | null   // omit / null → leave NEB reg untouched
  dobAD?:             Date    | null  // omit / null → leave DOB untouched
  dobBS?:             string  | null  // ditto
}

export interface NebApplyResult {
  ok:     string[]
  failed: { studentId: string; error: string }[]
}

const NEB_CHUNK_SIZE = 50

export async function applyNebImport(
  schoolId: string,
  scope:    { classIds: string[]; facultyIds?: string[] },
  items:    NebApplyItem[],
): Promise<NebApplyResult> {
  const out: NebApplyResult = { ok: [], failed: [] }
  if (items.length === 0) return out

  // ─── Re-verify scope membership before any write ─────────────────────────
  const ids = items.map(i => i.studentId)
  const scoped = await prisma.student.findMany({
    where: {
      id:       { in: ids },
      schoolId,
      classId:  { in: scope.classIds },
      ...(scope.facultyIds && scope.facultyIds.length > 0
        ? { class: { facultyId: { in: scope.facultyIds } } }
        : {}),
    },
    select: { id: true },
  })
  const scopedIds = new Set(scoped.map(s => s.id))
  const invalid = ids.filter(id => !scopedIds.has(id))
  if (invalid.length > 0) {
    for (const id of invalid) {
      out.failed.push({ studentId: id, error: "Student not in selected scope" })
    }
    // Continue with the valid items rather than failing the whole batch.
  }
  const validItems = items.filter(i => scopedIds.has(i.studentId))

  // ─── Apply in chunks ──────────────────────────────────────────────────────
  for (let i = 0; i < validItems.length; i += NEB_CHUNK_SIZE) {
    const chunk = validItems.slice(i, i + NEB_CHUNK_SIZE)
    try {
      await prisma.$transaction(async (tx) => {
        for (const it of chunk) {
          const data: Record<string, string | Date | null> = {}

          // Only set fields that are explicitly present + non-empty.
          // dobBS is NOT NULL — guard against overwriting a real value
          // with an empty string when the Excel row was blank.
          if (it.nebRegistrationNo != null && it.nebRegistrationNo.trim() !== "") {
            data.nebRegistrationNo = it.nebRegistrationNo.trim()
          }
          if (it.dobAD instanceof Date && !Number.isNaN(it.dobAD.getTime())) {
            data.dobAD = it.dobAD
          }
          if (it.dobBS != null && it.dobBS.trim() !== "") {
            data.dobBS = it.dobBS.trim()
          }

          if (Object.keys(data).length === 0) continue

          await tx.student.update({
            where: { id: it.studentId, schoolId },
            data,
          })
        }
      })
      out.ok.push(...chunk.map(it => it.studentId))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed"
      for (const it of chunk) out.failed.push({ studentId: it.studentId, error: msg })
    }
  }

  revalidatePath("/students")
  return out
}
