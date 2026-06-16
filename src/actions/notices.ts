"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission, getSchoolSession } from "@/lib/permissions"
import { toBS, formatBS } from "@/lib/nepali-date"
import { NOTICE_TARGET_TYPES, type NoticeTargetType } from "@/lib/notice-targets"

export type { NoticeTargetType } from "@/lib/notice-targets"

// ─── Constants ──────────────────────────────────────────────────────────────

export type NoticeAudience = "ALL" | "STUDENTS" | "STAFF" | "PARENTS"
export type NoticePriority = "NORMAL" | "HIGH" | "URGENT"

const AUDIENCES = ["ALL", "STUDENTS", "STAFF", "PARENTS"] as const
const PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const

// Fine-grained targeting (vocabulary in @/lib/notice-targets). The coarse
// `audience` + legacy `targetRole` fields are derived from this and kept in sync
// so the mobile teacher app and any audience-filtered reads keep working.
const STAFF_TARGETS: ReadonlySet<NoticeTargetType> = new Set(["STAFF_ALL", "STAFF"])

/** Coarse audience bucket for a target type (back-compat + audience filters). */
function audienceFor(t: NoticeTargetType): NoticeAudience {
  if (t === "SCHOOL") return "ALL"
  if (STAFF_TARGETS.has(t)) return "STAFF"
  return "STUDENTS"
}

/**
 * Legacy compatibility: the mobile teacher app filters on `targetRole`
 * (ALL | TEACHER | STUDENT | null).
 */
const AUDIENCE_TO_TARGET_ROLE: Record<NoticeAudience, string> = {
  ALL:      "ALL",
  STAFF:    "TEACHER",
  STUDENTS: "STUDENT",
  PARENTS:  "PARENT",
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const targetSchema = z.object({
  targetType: z.enum(NOTICE_TARGET_TYPES).default("SCHOOL"),
  targetIds:  z.array(z.string().min(1)).default([]),
})

const createSchema = z.object({
  title:     z.string().min(1, "Title is required").max(200),
  body:      z.string().min(1, "Body is required").max(10_000),
  priority:  z.enum(PRIORITIES).default("NORMAL"),
  // "YYYY-MM-DD" (AD) — notice expires at end of that day; null = never
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).merge(targetSchema)

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) })

function parseExpiry(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T23:59:59`)
  if (isNaN(d.getTime())) throw new Error("Invalid expiry date")
  return d
}

function safeBS(date: Date | null): string | null {
  if (!date) return null
  try { return formatBS(toBS(date)) } catch { return null }
}

/** Reject a person-list target with nobody selected (the publish footgun). */
function assertRecipients(targetType: NoticeTargetType, targetIds: string[]) {
  if ((targetType === "STUDENTS" || targetType === "STAFF") && targetIds.length === 0) {
    throw new Error("Select at least one recipient")
  }
}

/** An entity-scoped target with no entity chosen falls back to "all students". */
function normalizeTarget(targetType: NoticeTargetType, targetIds: string[]) {
  const entityScoped = ["CLASS", "SECTION", "FACULTY", "GROUP"].includes(targetType)
  if (entityScoped && targetIds.length === 0) {
    return { targetType: "STUDENTS_ALL" as NoticeTargetType, targetIds: [] }
  }
  return { targetType, targetIds }
}

// ─── Per-user delivery (who actually sees a notice) ────────────────────────────

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN"])
const STAFF_ROLES = new Set(["TEACHER", "STAFF"])

interface NoticeReach {
  seeAll:        boolean
  isStaff:       boolean
  isStudentSide: boolean
  userId:        string
  studentIds:    Set<string>
  classIds:      Set<string>
  sectionIds:    Set<string>
  facultyIds:    Set<string>
  groupIds:      Set<string>
}

/** Resolve which targeting scopes the session user belongs to. */
async function getUserNoticeReach(
  session: Awaited<ReturnType<typeof getSchoolSession>>,
): Promise<NoticeReach> {
  const role = session.user.role ?? ""
  const userId = session.user.id ?? ""
  const schoolId = session.user.schoolId!

  const reach: NoticeReach = {
    seeAll: ADMIN_ROLES.has(role),
    isStaff: STAFF_ROLES.has(role),
    isStudentSide: role === "STUDENT" || role === "PARENT",
    userId,
    studentIds: new Set(), classIds: new Set(), sectionIds: new Set(),
    facultyIds: new Set(), groupIds: new Set(),
  }
  if (reach.seeAll || reach.isStaff || !reach.isStudentSide) return reach

  // STUDENT → own record; PARENT → linked children's records.
  const where = role === "PARENT"
    ? { schoolId, guardians: { some: { userId } } }
    : { schoolId, userId }

  const students = await prisma.student.findMany({
    where,
    select: {
      id: true, classId: true, sectionId: true,
      class: { select: { facultyId: true } },
      groupMemberships: { select: { groupId: true } },
    },
  })
  for (const s of students) {
    reach.studentIds.add(s.id)
    if (s.classId) reach.classIds.add(s.classId)
    if (s.sectionId) reach.sectionIds.add(s.sectionId)
    if (s.class?.facultyId) reach.facultyIds.add(s.class.facultyId)
    for (const m of s.groupMemberships) reach.groupIds.add(m.groupId)
  }
  return reach
}

function noticeVisibleTo(n: { targetType: string; targetIds: unknown }, r: NoticeReach): boolean {
  if (r.seeAll) return true
  const ids = asIdArray(n.targetIds)
  const hits = (set: Set<string>) => ids.some(i => set.has(i))
  switch (n.targetType) {
    case "SCHOOL":       return true
    case "STAFF_ALL":    return r.isStaff
    case "STAFF":        return ids.includes(r.userId)
    case "STUDENTS_ALL": return r.isStudentSide
    case "CLASS":        return hits(r.classIds)
    case "SECTION":      return hits(r.sectionIds)
    case "FACULTY":      return hits(r.facultyIds)
    case "GROUP":        return hits(r.groupIds)
    case "STUDENTS":     return hits(r.studentIds)
    default:             return false
  }
}

// ─── Targets (for the compose picker) ─────────────────────────────────────────

export interface NoticeTargetOptions {
  classes:   { id: string; name: string; sections: { id: string; name: string }[] }[]
  faculties: { id: string; name: string }[]
  groups:    { id: string; name: string }[]
  students:  { id: string; name: string; className: string }[]
  staff:     { id: string; name: string; role: string }[]
}

/** Pickable recipients for the notice compose form. notice:manage only. */
export async function getNoticeTargets(): Promise<NoticeTargetOptions> {
  const session = await requirePermission("notice:manage")
  const schoolId = session.user.schoolId!

  const [classes, faculties, groups, students, staff] = await Promise.all([
    prisma.class.findMany({
      where:   { schoolId },
      select:  { id: true, name: true, sections: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" },
    }),
    prisma.studentGroup.findMany({
      where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where:   { schoolId, status: "ACTIVE" },
      select:  { id: true, user: { select: { fullName: true } }, class: { select: { name: true } } },
      orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }],
    }),
    prisma.user.findMany({
      where:   { schoolId, role: { in: ["TEACHER", "STAFF", "SCHOOL_ADMIN"] } },
      select:  { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    }),
  ])

  return {
    classes,
    faculties,
    groups,
    students: students.map(s => ({ id: s.id, name: s.user.fullName, className: s.class?.name ?? "" })),
    staff:    staff.map(u => ({ id: u.id, name: u.fullName, role: u.role })),
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

export interface NoticeRow {
  id:              string
  title:           string
  body:            string
  audience:        string
  targetType:      string
  targetIds:       string[]
  targetLabel:     string        // human-readable recipient summary
  priority:        string
  publishedAt:     string        // ISO
  publishedAtBS:   string | null // "Jestha 29, 2083"
  expiresAt:       string | null // ISO
  expiresAtBS:     string | null
  expiryDate:      string | null // "YYYY-MM-DD" (AD) for edit forms
  isActive:        boolean
  isExpired:       boolean
  createdByName:   string | null
  attachmentCount: number
}

interface NoticeRecord {
  id: string; title: string; content: string; audience: string
  targetType: string; targetIds: unknown; priority: string
  publishedAt: Date; expiresAt: Date | null; isActive: boolean
  createdBy: { fullName: string | null } | null
  _count: { attachments: number }
}

function asIdArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

function toRow(n: NoticeRecord, targetLabel: string): NoticeRow {
  return {
    id:              n.id,
    title:           n.title,
    body:            n.content,
    audience:        n.audience,
    targetType:      n.targetType,
    targetIds:       asIdArray(n.targetIds),
    targetLabel,
    priority:        n.priority,
    publishedAt:     n.publishedAt.toISOString(),
    publishedAtBS:   safeBS(n.publishedAt),
    expiresAt:       n.expiresAt ? n.expiresAt.toISOString() : null,
    expiresAtBS:     safeBS(n.expiresAt),
    expiryDate:      n.expiresAt ? n.expiresAt.toISOString().slice(0, 10) : null,
    isActive:        n.isActive,
    isExpired:       n.expiresAt !== null && n.expiresAt < new Date(),
    createdByName:   n.createdBy?.fullName ?? null,
    attachmentCount: n._count.attachments,
  }
}

const NOTICE_INCLUDE = {
  createdBy: { select: { fullName: true } },
  _count:    { select: { attachments: true } },
} as const

/**
 * Resolve a human-readable recipient label per notice in one batched pass —
 * gathers every referenced id across all rows, looks the names up once, then
 * formats. Keeps toRow synchronous and avoids N+1 queries.
 */
async function buildTargetLabels(schoolId: string, rows: NoticeRecord[]): Promise<Map<string, string>> {
  const classIds = new Set<string>(), sectionIds = new Set<string>(), facultyIds = new Set<string>()
  const groupIds = new Set<string>(), studentIds = new Set<string>(), userIds = new Set<string>()

  for (const n of rows) {
    const ids = asIdArray(n.targetIds)
    switch (n.targetType) {
      case "CLASS":    ids.forEach(i => classIds.add(i)); break
      case "SECTION":  ids.forEach(i => sectionIds.add(i)); break
      case "FACULTY":  ids.forEach(i => facultyIds.add(i)); break
      case "GROUP":    ids.forEach(i => groupIds.add(i)); break
      case "STUDENTS": ids.forEach(i => studentIds.add(i)); break
      case "STAFF":    ids.forEach(i => userIds.add(i)); break
    }
  }

  const [classes, sections, faculties, groups, students, users] = await Promise.all([
    classIds.size   ? prisma.class.findMany({ where: { id: { in: [...classIds] } }, select: { id: true, name: true } }) : [],
    sectionIds.size ? prisma.section.findMany({ where: { id: { in: [...sectionIds] } }, select: { id: true, name: true, class: { select: { name: true } } } }) : [],
    facultyIds.size ? prisma.faculty.findMany({ where: { id: { in: [...facultyIds] } }, select: { id: true, name: true } }) : [],
    groupIds.size   ? prisma.studentGroup.findMany({ where: { id: { in: [...groupIds] } }, select: { id: true, name: true } }) : [],
    studentIds.size ? prisma.student.findMany({ where: { id: { in: [...studentIds] } }, select: { id: true, user: { select: { fullName: true } } } }) : [],
    userIds.size    ? prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, fullName: true } }) : [],
  ])

  const classMap   = new Map(classes.map(c => [c.id, c.name]))
  const sectionMap  = new Map(sections.map(s => [s.id, `${s.class?.name ?? "Class"} – ${s.name}`]))
  const facultyMap  = new Map(faculties.map(f => [f.id, f.name]))
  const groupMap    = new Map(groups.map(g => [g.id, g.name]))
  const studentMap  = new Map(students.map(s => [s.id, s.user.fullName]))
  const userMap     = new Map(users.map(u => [u.id, u.fullName]))

  const summarize = (names: string[]) =>
    names.length === 0 ? "—"
      : names.length <= 2 ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} +${names.length - 2}`

  const out = new Map<string, string>()
  for (const n of rows) {
    const ids = asIdArray(n.targetIds)
    let label: string
    switch (n.targetType) {
      case "STUDENTS_ALL": label = "All students"; break
      case "STAFF_ALL":    label = "All staff"; break
      case "CLASS":        label = ids.map(i => classMap.get(i) ?? "Class").join(", ") || "Class"; break
      case "SECTION":      label = ids.map(i => sectionMap.get(i) ?? "Section").join(", ") || "Section"; break
      case "FACULTY":      label = `Faculty: ${ids.map(i => facultyMap.get(i) ?? "—").join(", ")}`; break
      case "GROUP":        label = `Group: ${ids.map(i => groupMap.get(i) ?? "—").join(", ")}`; break
      case "STUDENTS":     label = `${ids.length} student${ids.length === 1 ? "" : "s"}: ${summarize(ids.map(i => studentMap.get(i) ?? "?"))}`; break
      case "STAFF":        label = `${ids.length} staff: ${summarize(ids.map(i => userMap.get(i) ?? "?"))}`; break
      default:             label = "Whole school"
    }
    out.set(n.id, label)
  }
  return out
}

async function decorate(schoolId: string, rows: NoticeRecord[]): Promise<NoticeRow[]> {
  const labels = await buildTargetLabels(schoolId, rows)
  return rows.map(r => toRow(r, labels.get(r.id) ?? "Whole school"))
}

export async function getNotices(opts?: {
  audience?: NoticeAudience
  activeOnly?: boolean
}): Promise<NoticeRow[]> {
  const session = await requirePermission("notice:view")
  const schoolId = session.user.schoolId!
  const notices = await prisma.notice.findMany({
    where: {
      schoolId,
      ...(opts?.audience && { audience: opts.audience }),
      ...(opts?.activeOnly && {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      }),
    },
    include: NOTICE_INCLUDE,
    orderBy: [{ isActive: "desc" }, { publishedAt: "desc" }],
  })
  return decorate(schoolId, notices)
}

/**
 * Lightweight read for the dashboard widget — any authenticated tenant user may
 * see notices, but only the ones actually addressed to them (their role, class,
 * section, faculty, groups, or an explicit person-list). No notice:view gate.
 */
export async function getDashboardNotices(limit = 4): Promise<NoticeRow[]> {
  const session = await getSchoolSession()
  const schoolId = session.user.schoolId!
  const reach = await getUserNoticeReach(session)

  // Pull a window of recent live notices, then filter to those visible to the
  // user before slicing — targeting is on a JSON column, so we filter in app code.
  const candidates = await prisma.notice.findMany({
    where: {
      schoolId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    include: NOTICE_INCLUDE,
    orderBy: { publishedAt: "desc" },
    take: 60,
  })
  const visible = candidates.filter(n => noticeVisibleTo(n, reach)).slice(0, limit)
  return decorate(schoolId, visible)
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function createNotice(input: z.infer<typeof createSchema>) {
  const session = await requirePermission("notice:manage")
  const data = createSchema.parse(input)
  const schoolId = session.user.schoolId!

  assertRecipients(data.targetType, data.targetIds)
  const { targetType, targetIds } = normalizeTarget(data.targetType, data.targetIds)
  const audience = audienceFor(targetType)

  const notice = await prisma.notice.create({
    data: {
      schoolId,
      title:       data.title.trim(),
      content:     data.body.trim(),
      audience,
      targetType,
      targetIds:   targetIds.length ? targetIds : undefined,
      priority:    data.priority,
      expiresAt:   parseExpiry(data.expiresAt),
      isActive:    true,
      createdById: session.user.id,
      targetRole:  AUDIENCE_TO_TARGET_ROLE[audience], // legacy mobile-API field
    },
  })

  revalidatePath("/notices")
  revalidatePath("/")
  return { id: notice.id, title: notice.title }
}

export async function updateNotice(input: z.infer<typeof updateSchema>) {
  const session = await requirePermission("notice:manage")
  const data = updateSchema.parse(input)
  const schoolId = session.user.schoolId!

  const existing = await prisma.notice.findUnique({ where: { id: data.id } })
  if (!existing || existing.schoolId !== schoolId) throw new Error("Notice not found")

  // Re-target only when the form sends a targetType.
  let targeting: { audience: string; targetType: string; targetIds: string[] } | null = null
  if (data.targetType !== undefined) {
    assertRecipients(data.targetType, data.targetIds ?? [])
    const norm = normalizeTarget(data.targetType, data.targetIds ?? [])
    targeting = { audience: audienceFor(norm.targetType), targetType: norm.targetType, targetIds: norm.targetIds }
  }

  await prisma.notice.update({
    where: { id: data.id },
    data: {
      ...(data.title     !== undefined && { title: data.title.trim() }),
      ...(data.body      !== undefined && { content: data.body.trim() }),
      ...(targeting && {
        audience:   targeting.audience,
        targetType: targeting.targetType,
        targetIds:  targeting.targetIds.length ? targeting.targetIds : Prisma.DbNull,
        targetRole: AUDIENCE_TO_TARGET_ROLE[targeting.audience as NoticeAudience],
      }),
      ...(data.priority  !== undefined && { priority: data.priority }),
      ...(data.expiresAt !== undefined && { expiresAt: parseExpiry(data.expiresAt) }),
    },
  })

  revalidatePath("/notices")
  revalidatePath("/")
  return { ok: true }
}

/** Deactivate (take down) or reactivate a notice without losing history. */
export async function toggleNoticeActive(id: string) {
  const session = await requirePermission("notice:manage")
  const existing = await prisma.notice.findUnique({ where: { id } })
  if (!existing || existing.schoolId !== session.user.schoolId) throw new Error("Notice not found")

  await prisma.notice.update({
    where: { id },
    data: { isActive: !existing.isActive },
  })

  revalidatePath("/notices")
  revalidatePath("/")
  return { isActive: !existing.isActive }
}

/** Permanently delete a notice (attachments cascade). */
export async function deleteNotice(id: string) {
  const session = await requirePermission("notice:manage")
  const existing = await prisma.notice.findUnique({ where: { id } })
  if (!existing || existing.schoolId !== session.user.schoolId) throw new Error("Notice not found")

  await prisma.notice.delete({ where: { id } })

  revalidatePath("/notices")
  revalidatePath("/")
  return { ok: true }
}
