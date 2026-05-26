"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { writeAuditEntry } from "./audit"
import { resolveReceivableAccountId } from "./allocations"
import { toAD, generatePlanPeriods } from "@/lib/nepali-date"

const D = Prisma.Decimal

// ─── Helpers ────────────────────────────────────────────────────────────────

/** finalAmount = baseAmount × (1 - scholarshipPct/100), rounded 2dp. */
function computeFinal(base: Prisma.Decimal, pct: Prisma.Decimal): Prisma.Decimal {
  const factor = new D(100).minus(pct).dividedBy(100)
  return new D(base.times(factor).toFixed(2))
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const editOneSchema = z.object({
  id:                z.string().min(1),
  baseAmount:        z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  scholarshipPct:    z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  scholarshipReason: z.string().max(300).nullable().optional(),
  dueDateBS:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:             z.string().max(500).nullable().optional(),
})

const bulkEditSchema = z.object({
  ids:               z.array(z.string()).min(1),
  baseAmount:        z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  scholarshipPct:    z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  scholarshipReason: z.string().max(300).nullable().optional(),
  dueDateBS:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** When true, only rows where status != "PAID" are touched. */
  skipPaid:          z.boolean().default(true),
})

const billPeriodSchema = z.object({
  fiscalYearId: z.string().min(1),
  periodIndex:  z.number().int().min(0).max(12),
  classId:      z.string().optional(),
  sectionId:    z.string().optional(),
  studentIds:   z.array(z.string()).optional(),
}).refine(
  t => t.classId || t.sectionId || (t.studentIds && t.studentIds.length > 0),
  { message: "Provide classId, sectionId, or studentIds[]" },
)

const adhocSchema = z.object({
  studentId:         z.string().min(1),
  fiscalYearId:      z.string().min(1),
  feeHeadId:         z.string().min(1),
  periodIndex:       z.number().int().min(0).max(12),
  periodLabel:       z.string().min(1).max(100),
  baseAmount:        z.string().regex(/^\d+(\.\d{1,2})?$/),
  scholarshipPct:    z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  scholarshipReason: z.string().max(300).nullable().optional(),
  dueDateBS:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:             z.string().max(500).nullable().optional(),
})

// ─── Queries ────────────────────────────────────────────────────────────────

export interface StudentFeeRow {
  id:                string
  studentId:         string
  studentName:       string
  className:         string | null
  feeHeadId:         string
  feeHeadName:       string
  periodIndex:       number
  periodLabel:       string
  baseAmount:        string
  scholarshipPct:    string
  scholarshipReason: string | null
  finalAmount:       string
  paidAmount:        string
  balance:           string
  status:            string
  dueDateBS:         string
  isOverdue:         boolean
  notes:             string | null
  billVoucherNumber: string | null
  sourcePlanId:      string | null
}

export interface StudentScheduleFilters {
  studentId:     string
  fiscalYearId?: string  // defaults to current
}

/** Per-student schedule: all StudentFee rows for a student in one FY (or current). */
export async function getStudentSchedule(filters: StudentScheduleFilters): Promise<StudentFeeRow[]> {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  let fiscalYearId = filters.fiscalYearId
  if (!fiscalYearId) {
    const cur = await prisma.fiscalYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } })
    if (!cur) return []
    fiscalYearId = cur.id
  }

  const now = new Date()
  const rows = await prisma.studentFee.findMany({
    where: { schoolId, studentId: filters.studentId, fiscalYearId },
    include: {
      feeHead: { select: { name: true } },
      student: {
        include: {
          user:    { select: { fullName: true } },
          class:   { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: [{ feeHead: { name: "asc" } }, { periodIndex: "asc" }],
  })

  return rows.map(r => ({
    id:                r.id,
    studentId:         r.studentId,
    studentName:       r.student.user.fullName,
    className:         r.student.class
      ? `${r.student.class.name}${r.student.section ? "-" + r.student.section.name : ""}`
      : null,
    feeHeadId:         r.feeHeadId,
    feeHeadName:       r.feeHead.name,
    periodIndex:       r.periodIndex,
    periodLabel:       r.periodLabel,
    baseAmount:        r.baseAmount.toFixed(2),
    scholarshipPct:    r.scholarshipPct.toFixed(2),
    scholarshipReason: r.scholarshipReason,
    finalAmount:       r.finalAmount.toFixed(2),
    paidAmount:        r.paidAmount.toFixed(2),
    balance:           r.finalAmount.minus(r.paidAmount).toFixed(2),
    status:            r.status,
    dueDateBS:         r.dueDateBS,
    isOverdue:         r.status !== "PAID" && r.status !== "CANCELLED" && r.dueDateAD < now,
    notes:             r.notes,
    billVoucherNumber: r.billVoucherNumber,
    sourcePlanId:      r.sourcePlanId,
  }))
}

export interface ClassScheduleFilters {
  classId:       string
  fiscalYearId?: string
  periodIndex?:  number  // 0 (all) or specific period
}

/** Per-class roster of StudentFee rows for the given period (or all). */
export async function getClassSchedule(filters: ClassScheduleFilters): Promise<StudentFeeRow[]> {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  let fiscalYearId = filters.fiscalYearId
  if (!fiscalYearId) {
    const cur = await prisma.fiscalYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } })
    if (!cur) return []
    fiscalYearId = cur.id
  }

  const now = new Date()
  const rows = await prisma.studentFee.findMany({
    where: {
      schoolId, fiscalYearId,
      student: { classId: filters.classId },
      ...(filters.periodIndex !== undefined && { periodIndex: filters.periodIndex }),
    },
    include: {
      feeHead: { select: { name: true } },
      student: {
        include: {
          user:    { select: { fullName: true } },
          class:   { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: [{ student: { user: { fullName: "asc" } } }, { feeHead: { name: "asc" } }, { periodIndex: "asc" }],
  })

  return rows.map(r => ({
    id:                r.id,
    studentId:         r.studentId,
    studentName:       r.student.user.fullName,
    className:         r.student.class
      ? `${r.student.class.name}${r.student.section ? "-" + r.student.section.name : ""}`
      : null,
    feeHeadId:         r.feeHeadId,
    feeHeadName:       r.feeHead.name,
    periodIndex:       r.periodIndex,
    periodLabel:       r.periodLabel,
    baseAmount:        r.baseAmount.toFixed(2),
    scholarshipPct:    r.scholarshipPct.toFixed(2),
    scholarshipReason: r.scholarshipReason,
    finalAmount:       r.finalAmount.toFixed(2),
    paidAmount:        r.paidAmount.toFixed(2),
    balance:           r.finalAmount.minus(r.paidAmount).toFixed(2),
    status:            r.status,
    dueDateBS:         r.dueDateBS,
    isOverdue:         r.status !== "PAID" && r.status !== "CANCELLED" && r.dueDateAD < now,
    notes:             r.notes,
    billVoucherNumber: r.billVoucherNumber,
    sourcePlanId:      r.sourcePlanId,
  }))
}

/** Outstanding rows for a student — used by collect-fee preview. */
export async function getStudentOutstanding(studentId: string): Promise<StudentFeeRow[]> {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  const now = new Date()
  const rows = await prisma.studentFee.findMany({
    where: {
      schoolId, studentId,
      // PLANNED is collectable too — Collect Fee auto-promotes it to BILLED on payment.
      status: { in: ["PLANNED", "BILLED", "PARTIAL"] },
    },
    include: {
      feeHead: { select: { name: true } },
      student: {
        include: {
          user:    { select: { fullName: true } },
          class:   { select: { name: true } },
          section: { select: { name: true } },
        },
      },
      fiscalYear: { select: { isCurrent: true } },
    },
    orderBy: [{ dueDateAD: "asc" }, { createdAt: "asc" }],
  })

  return rows.map(r => ({
    id:                r.id,
    studentId:         r.studentId,
    studentName:       r.student.user.fullName,
    className:         r.student.class
      ? `${r.student.class.name}${r.student.section ? "-" + r.student.section.name : ""}`
      : null,
    feeHeadId:         r.feeHeadId,
    feeHeadName:       r.feeHead.name,
    periodIndex:       r.periodIndex,
    periodLabel:       r.periodLabel,
    baseAmount:        r.baseAmount.toFixed(2),
    scholarshipPct:    r.scholarshipPct.toFixed(2),
    scholarshipReason: r.scholarshipReason,
    finalAmount:       r.finalAmount.toFixed(2),
    paidAmount:        r.paidAmount.toFixed(2),
    balance:           r.finalAmount.minus(r.paidAmount).toFixed(2),
    status:            r.status,
    dueDateBS:         r.dueDateBS,
    isOverdue:         r.dueDateAD < now,
    notes:             r.notes,
    billVoucherNumber: r.billVoucherNumber,
    sourcePlanId:      r.sourcePlanId,
  }))
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function editStudentFee(input: z.infer<typeof editOneSchema>) {
  const session = await requirePermission("finance:billing")
  const data = editOneSchema.parse(input)
  const schoolId = session.user.schoolId!

  const existing = await prisma.studentFee.findUnique({ where: { id: data.id } })
  if (!existing || existing.schoolId !== schoolId) throw new Error("Fee row not found")
  if (existing.status === "PAID") throw new Error("Cannot edit a PAID row")
  if (existing.status === "CANCELLED") throw new Error("Cannot edit a CANCELLED row")

  const nextBase = data.baseAmount     !== undefined ? new D(data.baseAmount)     : existing.baseAmount
  const nextPct  = data.scholarshipPct !== undefined ? new D(data.scholarshipPct) : existing.scholarshipPct
  if (nextPct.greaterThan(100)) throw new Error("Scholarship % cannot exceed 100")
  const nextFinal = computeFinal(nextBase, nextPct)
  if (nextFinal.lessThan(existing.paidAmount)) {
    throw new Error("Final amount cannot fall below already-paid amount")
  }

  await prisma.$transaction(async (tx) => {
    const next = await tx.studentFee.update({
      where: { id: data.id },
      data: {
        baseAmount:        nextBase,
        scholarshipPct:    nextPct,
        finalAmount:       nextFinal,
        ...(data.scholarshipReason !== undefined && { scholarshipReason: data.scholarshipReason }),
        ...(data.dueDateBS !== undefined && { dueDateBS: data.dueDateBS, dueDateAD: toAD(data.dueDateBS) }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "StudentFee", entityId: data.id, action: "UPDATE",
      before: {
        baseAmount:     existing.baseAmount.toFixed(2),
        scholarshipPct: existing.scholarshipPct.toFixed(2),
        finalAmount:    existing.finalAmount.toFixed(2),
        dueDateBS:      existing.dueDateBS,
      },
      after: {
        baseAmount:     next.baseAmount.toFixed(2),
        scholarshipPct: next.scholarshipPct.toFixed(2),
        finalAmount:    next.finalAmount.toFixed(2),
        dueDateBS:      next.dueDateBS,
        scholarshipReason: next.scholarshipReason,
      },
    })
  })

  revalidatePath("/finance/students")
  revalidatePath(`/finance/students/${existing.studentId}`)
  revalidatePath("/finance/classes")
  return { ok: true }
}

export interface BulkEditResult {
  matched: number
  updated: number
  skipped: number  // PAID/CANCELLED rows excluded when skipPaid=true
}

export async function bulkEditStudentFees(input: z.infer<typeof bulkEditSchema>): Promise<BulkEditResult> {
  const session = await requirePermission("finance:billing")
  const data = bulkEditSchema.parse(input)
  const schoolId = session.user.schoolId!

  const rows = await prisma.studentFee.findMany({ where: { id: { in: data.ids }, schoolId } })
  if (rows.length === 0) throw new Error("No matching rows")

  const candidates = data.skipPaid
    ? rows.filter(r => r.status !== "PAID" && r.status !== "CANCELLED")
    : rows
  const skipped = rows.length - candidates.length

  if (data.scholarshipPct !== undefined && new D(data.scholarshipPct).greaterThan(100)) {
    throw new Error("Scholarship % cannot exceed 100")
  }

  await prisma.$transaction(async (tx) => {
    for (const r of candidates) {
      const nextBase = data.baseAmount     !== undefined ? new D(data.baseAmount)     : r.baseAmount
      const nextPct  = data.scholarshipPct !== undefined ? new D(data.scholarshipPct) : r.scholarshipPct
      const nextFinal = computeFinal(nextBase, nextPct)
      if (nextFinal.lessThan(r.paidAmount)) continue
      await tx.studentFee.update({
        where: { id: r.id },
        data: {
          baseAmount:     nextBase,
          scholarshipPct: nextPct,
          finalAmount:    nextFinal,
          ...(data.scholarshipReason !== undefined && { scholarshipReason: data.scholarshipReason }),
          ...(data.dueDateBS !== undefined && { dueDateBS: data.dueDateBS, dueDateAD: toAD(data.dueDateBS) }),
        },
      })
    }
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "StudentFee", entityId: candidates[0]?.id ?? "BULK", action: "BULK_UPDATE",
      after: {
        ids:    candidates.map(c => c.id),
        fields: {
          baseAmount:        data.baseAmount,
          scholarshipPct:    data.scholarshipPct,
          scholarshipReason: data.scholarshipReason,
          dueDateBS:         data.dueDateBS,
        },
      },
    })
  }, { timeout: 60_000 })

  revalidatePath("/finance/students")
  revalidatePath("/finance/classes")
  return { matched: rows.length, updated: candidates.length, skipped }
}

/** Flip PLANNED rows of the given target to BILLED, assigning a per-FY voucher number. */
export interface BillPeriodResult {
  billed:      number
  skipped:     number
  voucherPrefix: string
}

export async function billPeriod(input: z.infer<typeof billPeriodSchema>): Promise<BillPeriodResult> {
  const session = await requirePermission("finance:billing")
  const data = billPeriodSchema.parse(input)
  const schoolId = session.user.schoolId!

  const fy = await prisma.fiscalYear.findUnique({ where: { id: data.fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")

  // Resolve target students
  const studentFilter: Prisma.StudentWhereInput = { schoolId, status: "ACTIVE" }
  if (data.studentIds && data.studentIds.length > 0) studentFilter.id = { in: data.studentIds }
  else if (data.sectionId) studentFilter.sectionId = data.sectionId
  else if (data.classId)   studentFilter.classId   = data.classId

  const targetStudents = await prisma.student.findMany({ where: studentFilter, select: { id: true } })
  if (targetStudents.length === 0) throw new Error("No students matched")

  const candidates = await prisma.studentFee.findMany({
    where: {
      schoolId,
      fiscalYearId: data.fiscalYearId,
      studentId:    { in: targetStudents.map(s => s.id) },
      periodIndex:  data.periodIndex,
      status:       "PLANNED",
    },
    include: {
      student: { include: { user: { select: { fullName: true } } } },
      feeHead: { include: { feeAccount: { select: { id: true, name: true } } } },
    },
  })

  if (candidates.length === 0) {
    return { billed: 0, skipped: 0, voucherPrefix: `BL-${fy.name}` }
  }

  // Frequency / period-index sanity check (defensive — data model should already enforce):
  // - periodIndex 0      → ANNUAL / ONE_TIME / EVENT
  // - periodIndex 1..12  → MONTHLY
  for (const c of candidates) {
    const monthly = c.feeHead.frequency === "MONTHLY"
    if (data.periodIndex === 0 && monthly) {
      throw new Error(`Row "${c.periodLabel}" is MONTHLY but periodIndex=0 was supplied`)
    }
    if (data.periodIndex >= 1 && !monthly) {
      throw new Error(`Row "${c.periodLabel}" is ${c.feeHead.frequency} but periodIndex=${data.periodIndex} (use 0 for non-monthly frequencies)`)
    }
  }

  // Resolve AR account up-front (throws clearly if chart of accounts isn't seeded)
  const arAccountId = await resolveReceivableAccountId(prisma, schoolId)
  // Bills are dated to the FY start so they're guaranteed to land inside the
  // target fiscal year regardless of when the user clicks "bill period".
  const billDateAD = toAD(fy.startBS)
  const billDateBS = fy.startBS

  let billed = 0
  await prisma.$transaction(async (tx) => {
    // Reserve a per-FY counter range
    const counter = await tx.voucherCounter.upsert({
      where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: data.fiscalYearId, type: "BL" } },
      create: { schoolId, fiscalYearId: data.fiscalYearId, type: "BL", lastNumber: candidates.length },
      update: { lastNumber: { increment: candidates.length } },
    })
    const start = counter.lastNumber - candidates.length + 1

    for (let i = 0; i < candidates.length; i++) {
      const row = candidates[i]
      const num = `BL-${fy.name}-${String(start + i).padStart(4, "0")}`
      const studentLabel = row.student.user.fullName
      // Post a real BL Voucher: DR AR / CR Income for the row's finalAmount.
      const bv = await tx.voucher.create({
        data: {
          schoolId,
          fiscalYearId: data.fiscalYearId,
          type:         "BL",
          number:       num,
          dateBS:       billDateBS,
          dateAD:       billDateAD,
          narration:    `Bill — ${studentLabel} · ${row.periodLabel} · ${row.feeHead.feeAccount.name}`,
          status:       "POSTED",
          partyType:    "STUDENT",
          partyId:      row.studentId,
          partyName:    studentLabel,
          totalAmount:  row.finalAmount,
          postedAt:     new Date(),
          postedById:   session.user.id,
          createdById:  session.user.id,
          lines: {
            create: [
              {
                schoolId, accountId: arAccountId, lineNo: 1,
                debit: row.finalAmount, credit: new D(0),
                partyType: "STUDENT", partyId: row.studentId,
                narration: `${row.feeHead.feeAccount.name} — ${row.periodLabel}`,
              },
              {
                schoolId, accountId: row.feeHead.feeAccount.id, lineNo: 2,
                debit: new D(0), credit: row.finalAmount,
                partyType: "STUDENT", partyId: row.studentId,
                narration: row.periodLabel,
              },
            ],
          },
        },
        select: { id: true },
      })

      await tx.studentFee.update({
        where: { id: row.id },
        data:  { status: "BILLED", billVoucherNumber: num, billVoucherId: bv.id },
      })
      billed++
    }

    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "StudentFee", entityId: candidates[0].id, action: "BILL_PERIOD",
      after: {
        fiscalYearId: data.fiscalYearId,
        periodIndex:  data.periodIndex,
        count:        billed,
        prefix:       `BL-${fy.name}`,
      },
    })
  }, { timeout: 60_000 })

  revalidatePath("/finance/classes")
  revalidatePath("/finance/students")
  revalidatePath("/finance/collect")
  return { billed, skipped: 0, voucherPrefix: `BL-${fy.name}` }
}

/** Create an ad-hoc StudentFee row (e.g. one-time charge for a single student). */
export async function createAdhocStudentFee(input: z.infer<typeof adhocSchema>) {
  const session = await requirePermission("finance:billing")
  const data = adhocSchema.parse(input)
  const schoolId = session.user.schoolId!

  const [student, head, fy] = await Promise.all([
    prisma.student.findUnique({ where: { id: data.studentId } }),
    prisma.feeHead.findUnique({ where: { id: data.feeHeadId } }),
    prisma.fiscalYear.findUnique({ where: { id: data.fiscalYearId } }),
  ])
  if (!student || student.schoolId !== schoolId) throw new Error("Student not found")
  if (!head || head.schoolId !== schoolId)         throw new Error("Fee head not found")
  if (!fy || fy.schoolId !== schoolId)             throw new Error("Fiscal year not found")

  const base = new D(data.baseAmount)
  const pct  = new D(data.scholarshipPct)
  if (pct.greaterThan(100)) throw new Error("Scholarship % cannot exceed 100")
  const finalAmt = computeFinal(base, pct)

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.studentFee.create({
      data: {
        schoolId,
        studentId:         data.studentId,
        fiscalYearId:      data.fiscalYearId,
        feeHeadId:         data.feeHeadId,
        periodIndex:       data.periodIndex,
        periodLabel:       data.periodLabel,
        baseAmount:        base,
        scholarshipPct:    pct,
        scholarshipReason: data.scholarshipReason ?? null,
        finalAmount:       finalAmt,
        dueDateBS:         data.dueDateBS,
        dueDateAD:         toAD(data.dueDateBS),
        status:            "PLANNED",
        notes:             data.notes ?? null,
      },
    })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "StudentFee", entityId: row.id, action: "CREATE",
      after: {
        studentId: row.studentId,
        feeHead:   head.name,
        period:    row.periodLabel,
        amount:    row.finalAmount.toFixed(2),
      },
    })
    return { id: row.id, finalAmount: row.finalAmount.toFixed(2) }
  })

  revalidatePath(`/finance/students/${data.studentId}`)
  revalidatePath("/finance/classes")
  return result
}

/**
 * Forgive the unpaid balance on a BILLED or PARTIAL row. Unlike cancelStudentFee
 * (which is for "this should never have been billed"), write-off accepts that
 * the bill was legitimate but the school is releasing the student from the
 * remaining obligation (e.g. uncollectable debt, hardship waiver).
 *
 * Flips status to CANCELLED with a "WRITTEN_OFF: " reason prefix so it's
 * distinguishable in audit logs. Any payment already collected stays applied;
 * only the unpaid balance is forgiven.
 *
 * GL impact: none in cash-basis. When accrual is enabled, this should also
 * post a JV (DR Bad Debt Expense / CR Student Fee Receivable) for the unpaid
 * balance — TODO once accrual lands.
 */
export async function writeOffStudentFee(id: string, reason: string) {
  const session = await requirePermission("finance:billing")
  if (!reason.trim()) throw new Error("Reason required to write off")
  const schoolId = session.user.schoolId!

  const r = await prisma.studentFee.findUnique({ where: { id } })
  if (!r || r.schoolId !== schoolId) throw new Error("Fee row not found")
  if (r.status === "PAID")      throw new Error("Row is already PAID — nothing to write off")
  if (r.status === "CANCELLED") throw new Error("Row is already cancelled")
  if (r.status === "PLANNED")   throw new Error("Row was never billed — use Cancel instead")

  const writeOffAmount = r.finalAmount.minus(r.paidAmount)

  await prisma.$transaction(async (tx) => {
    await tx.studentFee.update({
      where: { id },
      data:  {
        status:           "CANCELLED",
        cancelledAt:      new Date(),
        cancelledReason:  `WRITTEN_OFF: ${reason.trim()}`,
      },
    })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "StudentFee", entityId: id, action: "WRITE_OFF",
      before: { status: r.status, paidAmount: r.paidAmount.toFixed(2) },
      after:  { status: "CANCELLED", writtenOffAmount: writeOffAmount.toFixed(2), reason: reason.trim() },
    })
  })

  revalidatePath(`/finance/students/${r.studentId}`)
  revalidatePath("/finance/classes")
  revalidatePath("/finance/collect")
  return { ok: true, writtenOffAmount: writeOffAmount.toFixed(2) }
}

export async function cancelStudentFee(id: string, reason: string) {
  const session = await requirePermission("finance:billing")
  if (!reason.trim()) throw new Error("Reason required to cancel")
  const schoolId = session.user.schoolId!

  const r = await prisma.studentFee.findUnique({ where: { id } })
  if (!r || r.schoolId !== schoolId) throw new Error("Fee row not found")
  if (r.status === "PAID") throw new Error("Cannot cancel a PAID row — issue a refund instead")
  if (r.paidAmount.greaterThan(0)) throw new Error("Cannot cancel a row with partial payment")

  await prisma.$transaction(async (tx) => {
    await tx.studentFee.update({
      where: { id },
      data:  { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: reason.trim() },
    })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "StudentFee", entityId: id, action: "CANCEL",
      before: { status: r.status }, after: { status: "CANCELLED", reason: reason.trim() },
    })
  })

  revalidatePath(`/finance/students/${r.studentId}`)
  revalidatePath("/finance/classes")
  return { ok: true }
}

