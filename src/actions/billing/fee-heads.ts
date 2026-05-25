"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { writeAuditEntry } from "./audit"

const D = Prisma.Decimal

const FREQUENCY = ["MONTHLY", "ANNUAL", "ONE_TIME", "EVENT"] as const

const createSchema = z.object({
  name:          z.string().min(1).max(120),
  feeAccountId:  z.string().min(1),
  frequency:     z.enum(FREQUENCY),
  defaultAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  defaultDueDay: z.number().int().min(1).max(32).nullable().optional(),
  priority:      z.number().int().min(1).max(99).default(50),
  notes:         z.string().max(500).nullable().optional(),
})

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) })

// ─── Queries ────────────────────────────────────────────────────────────────

export interface FeeHeadRow {
  id:             string
  name:           string
  feeAccountId:   string
  feeAccountCode: string
  feeAccountName: string
  frequency:      string
  defaultAmount:  string
  defaultDueDay:  number | null
  priority:       number
  isActive:       boolean
  notes:          string | null
  usageCount:     number  // how many StudentFee rows reference this head
}

export async function listFeeHeads(): Promise<FeeHeadRow[]> {
  const session = await requirePermission("finance:billing:view")
  const heads = await prisma.feeHead.findMany({
    where: { schoolId: session.user.schoolId! },
    include: {
      feeAccount: { select: { code: true, name: true } },
      _count: { select: { studentFees: true } },
    },
    orderBy: [{ isActive: "desc" }, { priority: "asc" }, { name: "asc" }],
  })
  return heads.map(h => ({
    id:             h.id,
    name:           h.name,
    feeAccountId:   h.feeAccountId,
    feeAccountCode: h.feeAccount.code,
    feeAccountName: h.feeAccount.name,
    frequency:      h.frequency,
    defaultAmount:  h.defaultAmount.toFixed(2),
    defaultDueDay:  h.defaultDueDay,
    priority:       h.priority,
    isActive:       h.isActive,
    notes:          h.notes,
    usageCount:     h._count.studentFees,
  }))
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function createFeeHead(input: z.infer<typeof createSchema>) {
  const session = await requirePermission("finance:billing")
  const data = createSchema.parse(input)
  const schoolId = session.user.schoolId!

  const account = await prisma.account.findUnique({
    where: { id: data.feeAccountId },
    select: { schoolId: true, type: true, name: true },
  })
  if (!account || account.schoolId !== schoolId) throw new Error("Fee account not found")
  if (account.type !== "INCOME") throw new Error(`"${account.name}" must be INCOME type`)

  const result = await prisma.$transaction(async (tx) => {
    const head = await tx.feeHead.create({
      data: {
        schoolId,
        name:          data.name.trim(),
        feeAccountId:  data.feeAccountId,
        frequency:     data.frequency,
        defaultAmount: new D(data.defaultAmount),
        defaultDueDay: data.defaultDueDay ?? null,
        priority:      data.priority,
        notes:         data.notes ?? null,
      },
    })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "FeeHead", entityId: head.id, action: "CREATE",
      after: { name: head.name, frequency: head.frequency, defaultAmount: head.defaultAmount.toFixed(2) },
    })
    return { id: head.id, name: head.name }
  })

  revalidatePath("/finance/heads")
  revalidatePath("/finance")
  return result
}

export async function updateFeeHead(input: z.infer<typeof updateSchema>) {
  const session = await requirePermission("finance:billing")
  const data = updateSchema.parse(input)
  const schoolId = session.user.schoolId!

  const existing = await prisma.feeHead.findUnique({ where: { id: data.id } })
  if (!existing || existing.schoolId !== schoolId) throw new Error("Fee head not found")

  if (data.feeAccountId && data.feeAccountId !== existing.feeAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.feeAccountId } })
    if (!acc || acc.schoolId !== schoolId) throw new Error("Fee account not found")
    if (acc.type !== "INCOME") throw new Error(`"${acc.name}" must be INCOME`)
  }

  await prisma.$transaction(async (tx) => {
    const next = await tx.feeHead.update({
      where: { id: data.id },
      data: {
        ...(data.name           !== undefined && { name: data.name.trim() }),
        ...(data.feeAccountId   !== undefined && { feeAccountId: data.feeAccountId }),
        ...(data.frequency      !== undefined && { frequency: data.frequency }),
        ...(data.defaultAmount  !== undefined && { defaultAmount: new D(data.defaultAmount) }),
        ...(data.defaultDueDay  !== undefined && { defaultDueDay: data.defaultDueDay }),
        ...(data.priority       !== undefined && { priority: data.priority }),
        ...(data.notes          !== undefined && { notes: data.notes }),
      },
    })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "FeeHead", entityId: data.id, action: "UPDATE",
      before: { name: existing.name, frequency: existing.frequency, defaultAmount: existing.defaultAmount.toFixed(2) },
      after:  { name: next.name,     frequency: next.frequency,     defaultAmount: next.defaultAmount.toFixed(2) },
    })
  })

  revalidatePath("/finance/heads")
  return { ok: true }
}

export async function toggleFeeHeadActive(id: string) {
  const session = await requirePermission("finance:billing")
  const h = await prisma.feeHead.findUnique({ where: { id } })
  if (!h || h.schoolId !== session.user.schoolId) throw new Error("Fee head not found")
  await prisma.$transaction(async (tx) => {
    await tx.feeHead.update({ where: { id }, data: { isActive: !h.isActive } })
    await writeAuditEntry(tx, {
      schoolId: h.schoolId, userId: session.user.id,
      entity: "FeeHead", entityId: id, action: "UPDATE",
      before: { isActive: h.isActive }, after: { isActive: !h.isActive },
    })
  })
  revalidatePath("/finance/heads")
  return { isActive: !h.isActive }
}
