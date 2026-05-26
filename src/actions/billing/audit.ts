"use server"

import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

type Tx = Prisma.TransactionClient | typeof prisma

export interface AuditEntry {
  schoolId: string
  userId?:  string | null
  entity:   string  // "FeeHead" | "FeePlan" | "PlanItem" | "StudentFee" | ...
  entityId: string
  action:   string  // CREATE | UPDATE | CANCEL | APPROVE | GENERATE
  before?:  unknown
  after?:   unknown
}

/** Write one audit row. Pass the active tx when inside a transaction. */
export async function writeAuditEntry(tx: Tx, e: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      schoolId: e.schoolId,
      userId:   e.userId ?? null,
      entity:   e.entity,
      entityId: e.entityId,
      action:   e.action,
      before:   e.before === undefined ? undefined : (e.before as Prisma.InputJsonValue),
      after:    e.after  === undefined ? undefined : (e.after  as Prisma.InputJsonValue),
    },
  })
}

const BILLING_ENTITIES = [
  "FeeHead", "FeePlan", "PlanItem", "StudentFee", "FeePaymentAllocation", "Voucher",
] as const

export interface AuditFilters {
  entity?: string
  action?: string
  userId?: string
  fromAt?: Date
  toAt?:   Date
  limit?:  number
}

/** Read billing-scoped audit entries. */
export async function listBillingAuditLog(filters: AuditFilters = {}) {
  const session = await requirePermission("finance:billing:view")
  const rows = await prisma.auditLog.findMany({
    where: {
      schoolId: session.user.schoolId!,
      entity:   filters.entity ?? { in: [...BILLING_ENTITIES] },
      ...(filters.action && { action: filters.action }),
      ...(filters.userId && { userId: filters.userId }),
      ...((filters.fromAt || filters.toAt) && {
        at: {
          ...(filters.fromAt && { gte: filters.fromAt }),
          ...(filters.toAt   && { lte: filters.toAt }),
        },
      }),
    },
    orderBy: { at: "desc" },
    take: filters.limit ?? 500,
  })
  return rows
}
