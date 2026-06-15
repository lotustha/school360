"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission, getSchoolSession } from "@/lib/permissions"
import { toBS, formatBS } from "@/lib/nepali-date"

// ─── Constants ──────────────────────────────────────────────────────────────

export type NoticeAudience = "ALL" | "STUDENTS" | "STAFF" | "PARENTS"
export type NoticePriority = "NORMAL" | "HIGH" | "URGENT"

const AUDIENCES = ["ALL", "STUDENTS", "STAFF", "PARENTS"] as const
const PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const

/**
 * Legacy compatibility: the mobile teacher app filters on `targetRole`
 * (ALL | TEACHER | null). Keep it in sync with `audience` so notices created
 * here keep surfacing correctly on mobile.
 */
const AUDIENCE_TO_TARGET_ROLE: Record<NoticeAudience, string> = {
  ALL:      "ALL",
  STAFF:    "TEACHER",
  STUDENTS: "STUDENT",
  PARENTS:  "PARENT",
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  title:     z.string().min(1, "Title is required").max(200),
  body:      z.string().min(1, "Body is required").max(10_000),
  audience:  z.enum(AUDIENCES).default("ALL"),
  priority:  z.enum(PRIORITIES).default("NORMAL"),
  // "YYYY-MM-DD" (AD) — notice expires at end of that day; null = never
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

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

// ─── Queries ────────────────────────────────────────────────────────────────

export interface NoticeRow {
  id:              string
  title:           string
  body:            string
  audience:        string
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

function toRow(n: {
  id: string; title: string; content: string; audience: string; priority: string
  publishedAt: Date; expiresAt: Date | null; isActive: boolean
  createdBy: { name: string | null } | null
  _count: { attachments: number }
}): NoticeRow {
  return {
    id:              n.id,
    title:           n.title,
    body:            n.content,
    audience:        n.audience,
    priority:        n.priority,
    publishedAt:     n.publishedAt.toISOString(),
    publishedAtBS:   safeBS(n.publishedAt),
    expiresAt:       n.expiresAt ? n.expiresAt.toISOString() : null,
    expiresAtBS:     safeBS(n.expiresAt),
    expiryDate:      n.expiresAt ? n.expiresAt.toISOString().slice(0, 10) : null,
    isActive:        n.isActive,
    isExpired:       n.expiresAt !== null && n.expiresAt < new Date(),
    createdByName:   n.createdBy?.name ?? null,
    attachmentCount: n._count.attachments,
  }
}

const NOTICE_INCLUDE = {
  createdBy: { select: { name: true } },
  _count:    { select: { attachments: true } },
} as const

export async function getNotices(opts?: {
  audience?: NoticeAudience
  activeOnly?: boolean
}): Promise<NoticeRow[]> {
  const session = await requirePermission("notice:view")
  const notices = await prisma.notice.findMany({
    where: {
      schoolId: session.user.schoolId!,
      ...(opts?.audience && { audience: opts.audience }),
      ...(opts?.activeOnly && {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      }),
    },
    include: NOTICE_INCLUDE,
    orderBy: [{ isActive: "desc" }, { publishedAt: "desc" }],
  })
  return notices.map(toRow)
}

/**
 * Lightweight read for the dashboard widget — any authenticated tenant user
 * may see active notices (announcements are broadcast by nature), no
 * notice:view permission required.
 */
export async function getDashboardNotices(limit = 4): Promise<NoticeRow[]> {
  const session = await getSchoolSession()
  const notices = await prisma.notice.findMany({
    where: {
      schoolId: session.user.schoolId!,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    include: NOTICE_INCLUDE,
    orderBy: { publishedAt: "desc" },
    take: limit,
  })
  return notices.map(toRow)
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function createNotice(input: z.infer<typeof createSchema>) {
  const session = await requirePermission("notice:manage")
  const data = createSchema.parse(input)
  const schoolId = session.user.schoolId!

  const notice = await prisma.notice.create({
    data: {
      schoolId,
      title:       data.title.trim(),
      content:     data.body.trim(),
      audience:    data.audience,
      priority:    data.priority,
      expiresAt:   parseExpiry(data.expiresAt),
      isActive:    true,
      createdById: session.user.id,
      targetRole:  AUDIENCE_TO_TARGET_ROLE[data.audience], // legacy mobile-API field
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

  await prisma.notice.update({
    where: { id: data.id },
    data: {
      ...(data.title     !== undefined && { title: data.title.trim() }),
      ...(data.body      !== undefined && { content: data.body.trim() }),
      ...(data.audience  !== undefined && {
        audience:   data.audience,
        targetRole: AUDIENCE_TO_TARGET_ROLE[data.audience],
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
