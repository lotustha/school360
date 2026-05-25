"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { writeAuditEntry } from "./audit"
import { toAD, generatePlanPeriods } from "@/lib/nepali-date"

const D = Prisma.Decimal

const CALENDAR_SYSTEMS = ["BS", "AD"] as const

// ─── Schemas ────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  id:        z.string().optional(),          // present on update
  feeHeadId: z.string().min(1),
  amount:    z.string().regex(/^\d+(\.\d{1,2})?$/),
  periods:   z.string().min(1),              // "1,2,..,12" or "0"
  dueDay:    z.number().int().min(1).max(32),
  notes:     z.string().max(300).nullable().optional(),
})

const createSchema = z.object({
  fiscalYearId:   z.string().min(1),
  name:           z.string().min(1).max(120),
  description:    z.string().max(500).nullable().optional(),
  calendarSystem: z.enum(CALENDAR_SYSTEMS).default("BS"),
  startMonth:     z.number().int().min(1).max(12).default(4),
  startYear:      z.number().int().min(2000).max(2100),
  items:          z.array(itemSchema).min(1),
})

const updateSchema = z.object({
  id:             z.string().min(1),
  name:           z.string().min(1).max(120).optional(),
  description:    z.string().max(500).nullable().optional(),
  isActive:       z.boolean().optional(),
  calendarSystem: z.enum(CALENDAR_SYSTEMS).optional(),
  startMonth:     z.number().int().min(1).max(12).optional(),
  startYear:      z.number().int().min(2000).max(2100).optional(),
  items:          z.array(itemSchema).optional(),  // replace-all semantics
})

const applyTargetSchema = z.object({
  planId: z.string().min(1),
  /** Multi-mode target. Provide one of these. classId/sectionId expand to enrolled students. */
  classId:    z.string().optional(),
  sectionId:  z.string().optional(),
  studentIds: z.array(z.string()).optional(),
}).refine(
  t => t.classId || t.sectionId || (t.studentIds && t.studentIds.length > 0),
  { message: "Provide classId, sectionId, or studentIds[]" },
)

// ─── Queries ────────────────────────────────────────────────────────────────

export interface FeePlanRow {
  id:             string
  name:           string
  description:    string | null
  fiscalYearId:   string
  fiscalYearName: string
  calendarSystem: string
  startMonth:     number
  startYear:      number
  isActive:       boolean
  itemCount:      number
  generatedCount: number  // how many StudentFee rows reference this plan
  createdAt:      string
}

export async function listFeePlans(): Promise<FeePlanRow[]> {
  const session = await requirePermission("finance:billing:view")
  const plans = await prisma.feePlan.findMany({
    where: { schoolId: session.user.schoolId! },
    include: {
      fiscalYear: { select: { name: true } },
      _count:     { select: { items: true, studentFees: true } },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  })
  return plans.map(p => ({
    id:             p.id,
    name:           p.name,
    description:    p.description,
    fiscalYearId:   p.fiscalYearId,
    fiscalYearName: p.fiscalYear.name,
    calendarSystem: p.calendarSystem,
    startMonth:     p.startMonth,
    startYear:      p.startYear,
    isActive:       p.isActive,
    itemCount:      p._count.items,
    generatedCount: p._count.studentFees,
    createdAt:      p.createdAt.toISOString(),
  }))
}

export interface FeePlanDetail extends FeePlanRow {
  items: Array<{
    id:           string
    feeHeadId:    string
    feeHeadName:  string
    frequency:    string
    amount:       string
    periods:      string
    dueDay:       number
    notes:        string | null
  }>
}

export async function getFeePlan(id: string): Promise<FeePlanDetail | null> {
  const session = await requirePermission("finance:billing:view")
  const p = await prisma.feePlan.findUnique({
    where: { id },
    include: {
      fiscalYear: { select: { name: true } },
      items:      { include: { feeHead: { select: { name: true, frequency: true } } }, orderBy: { feeHead: { name: "asc" } } },
      _count:     { select: { items: true, studentFees: true } },
    },
  })
  if (!p || p.schoolId !== session.user.schoolId) return null
  return {
    id:             p.id,
    name:           p.name,
    description:    p.description,
    fiscalYearId:   p.fiscalYearId,
    fiscalYearName: p.fiscalYear.name,
    calendarSystem: p.calendarSystem,
    startMonth:     p.startMonth,
    startYear:      p.startYear,
    isActive:       p.isActive,
    itemCount:      p._count.items,
    generatedCount: p._count.studentFees,
    createdAt:      p.createdAt.toISOString(),
    items: p.items.map(it => ({
      id:          it.id,
      feeHeadId:   it.feeHeadId,
      feeHeadName: it.feeHead.name,
      frequency:   it.feeHead.frequency,
      amount:      it.amount.toFixed(2),
      periods:     it.periods,
      dueDay:      it.dueDay,
      notes:       it.notes,
    })),
  }
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function createFeePlan(input: z.infer<typeof createSchema>) {
  const session = await requirePermission("finance:billing")
  const data = createSchema.parse(input)
  const schoolId = session.user.schoolId!

  const fy = await prisma.fiscalYear.findUnique({ where: { id: data.fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")

  const headIds = Array.from(new Set(data.items.map(i => i.feeHeadId)))
  const heads = await prisma.feeHead.findMany({ where: { id: { in: headIds }, schoolId } })
  if (heads.length !== headIds.length) throw new Error("One or more fee heads not found")

  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.feePlan.create({
      data: {
        schoolId,
        fiscalYearId:   data.fiscalYearId,
        name:           data.name.trim(),
        description:    data.description ?? null,
        calendarSystem: data.calendarSystem,
        startMonth:     data.startMonth,
        startYear:      data.startYear,
        createdById:    session.user.id,
        items: {
          create: data.items.map(it => ({
            feeHeadId: it.feeHeadId,
            amount:    new D(it.amount),
            periods:   it.periods,
            dueDay:    it.dueDay,
            notes:     it.notes ?? null,
          })),
        },
      },
    })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "FeePlan", entityId: plan.id, action: "CREATE",
      after: { name: plan.name, fiscalYearId: data.fiscalYearId, items: data.items.length },
    })
    return { id: plan.id, name: plan.name }
  })

  revalidatePath("/finance/plans")
  return result
}

export async function updateFeePlan(input: z.infer<typeof updateSchema>) {
  const session = await requirePermission("finance:billing")
  const data = updateSchema.parse(input)
  const schoolId = session.user.schoolId!

  const existing = await prisma.feePlan.findUnique({ where: { id: data.id } })
  if (!existing || existing.schoolId !== schoolId) throw new Error("Plan not found")

  await prisma.$transaction(async (tx) => {
    if (data.items) {
      // replace-all
      await tx.planItem.deleteMany({ where: { feePlanId: data.id } })
      await tx.planItem.createMany({
        data: data.items.map(it => ({
          feePlanId: data.id,
          feeHeadId: it.feeHeadId,
          amount:    new D(it.amount),
          periods:   it.periods,
          dueDay:    it.dueDay,
          notes:     it.notes ?? null,
        })),
      })
    }
    const next = await tx.feePlan.update({
      where: { id: data.id },
      data: {
        ...(data.name           !== undefined && { name: data.name.trim() }),
        ...(data.description    !== undefined && { description: data.description }),
        ...(data.isActive       !== undefined && { isActive: data.isActive }),
        ...(data.calendarSystem !== undefined && { calendarSystem: data.calendarSystem }),
        ...(data.startMonth     !== undefined && { startMonth: data.startMonth }),
        ...(data.startYear      !== undefined && { startYear: data.startYear }),
      },
    })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "FeePlan", entityId: data.id, action: "UPDATE",
      before: { name: existing.name, isActive: existing.isActive },
      after:  { name: next.name,     isActive: next.isActive, itemsReplaced: !!data.items },
    })
  })

  revalidatePath("/finance/plans")
  revalidatePath(`/finance/plans/${data.id}`)
  return { ok: true }
}

export async function deleteFeePlan(id: string) {
  const session = await requirePermission("finance:billing")
  const p = await prisma.feePlan.findUnique({ where: { id }, include: { _count: { select: { studentFees: true } } } })
  if (!p || p.schoolId !== session.user.schoolId) throw new Error("Plan not found")
  // Refuse to delete if rows are linked? — sourcePlanId is SetNull on delete, so safe.
  await prisma.$transaction(async (tx) => {
    await tx.feePlan.delete({ where: { id } })
    await writeAuditEntry(tx, {
      schoolId: p.schoolId, userId: session.user.id,
      entity: "FeePlan", entityId: id, action: "DELETE",
      before: { name: p.name, generatedRowsOrphaned: p._count.studentFees },
    })
  })
  revalidatePath("/finance/plans")
  return { ok: true }
}

// ─── Apply plan → generate StudentFee rows ─────────────────────────────────

export interface ApplyPlanResult {
  studentsTouched: number
  rowsCreated:     number
  rowsSkipped:     number  // existed already (idempotency unique constraint)
}

export async function applyPlanToTarget(input: z.infer<typeof applyTargetSchema>): Promise<ApplyPlanResult> {
  const session = await requirePermission("finance:billing")
  const data = applyTargetSchema.parse(input)
  const schoolId = session.user.schoolId!

  const plan = await prisma.feePlan.findUnique({
    where: { id: data.planId },
    include: {
      items:      { include: { feeHead: { select: { name: true, frequency: true } } } },
      fiscalYear: true,
    },
  })
  if (!plan || plan.schoolId !== schoolId) throw new Error("Plan not found")
  if (!plan.isActive) throw new Error("Plan is archived — re-activate before applying")
  if (plan.items.length === 0) throw new Error("Plan has no items")

  // Resolve target student IDs
  const studentFilter: Prisma.StudentWhereInput = { schoolId, status: "ACTIVE" }
  if (data.studentIds && data.studentIds.length > 0) {
    studentFilter.id = { in: data.studentIds }
  } else if (data.sectionId) {
    studentFilter.sectionId = data.sectionId
  } else if (data.classId) {
    studentFilter.classId = data.classId
  }
  const students = await prisma.student.findMany({
    where: studentFilter,
    select: { id: true },
  })
  if (students.length === 0) throw new Error("No students matched the target")

  // Build candidate rows. Use createMany skipDuplicates for idempotency.
  type Row = Prisma.StudentFeeCreateManyInput
  const rows: Row[] = []

  for (const it of plan.items) {
    const periodList = it.periods.split(",").map(s => s.trim()).filter(Boolean).map(Number)
    // Pre-compute the 12 monthly periods using plan's calendar/startMonth/startYear.
    const periods = generatePlanPeriods({
      calendar:   plan.calendarSystem as "BS" | "AD",
      startMonth: plan.startMonth,
      startYear:  plan.startYear,
      dueDay:     it.dueDay,
    })
    const periodByIndex = new Map(periods.map(p => [p.periodIndex, p]))

    for (const studentId of students.map(s => s.id)) {
      for (const periodIndex of periodList) {
        let periodLabel: string
        let dueDateBS: string
        if (it.feeHead.frequency === "MONTHLY") {
          const p = periodByIndex.get(periodIndex)
          if (!p) continue
          periodLabel = p.label
          dueDateBS   = p.dueDateBS
        } else {
          // ANNUAL / ONE_TIME / EVENT → single row at periodIndex=0, due at plan's start month
          const first = periods[0]
          periodLabel = `${it.feeHead.name} ${first.label.split(" ").pop()}`
          dueDateBS   = first.dueDateBS
        }
        rows.push({
          schoolId,
          studentId,
          fiscalYearId:  plan.fiscalYearId,
          feeHeadId:     it.feeHeadId,
          periodIndex:   it.feeHead.frequency === "MONTHLY" ? periodIndex : 0,
          periodLabel,
          baseAmount:    it.amount,
          scholarshipPct: new D(0),
          finalAmount:   it.amount,
          dueDateBS,
          dueDateAD:     toAD(dueDateBS),
          status:        "PLANNED",
          sourcePlanId:  plan.id,
        })
      }
    }
  }

  const before = await prisma.studentFee.count({
    where: { sourcePlanId: plan.id, studentId: { in: students.map(s => s.id) } },
  })

  await prisma.$transaction(async (tx) => {
    await tx.studentFee.createMany({ data: rows, skipDuplicates: true })
    await writeAuditEntry(tx, {
      schoolId, userId: session.user.id,
      entity: "FeePlan", entityId: plan.id, action: "APPLY",
      after: {
        studentCount: students.length,
        rowsAttempted: rows.length,
        target: data.studentIds ? "studentIds" : data.sectionId ? "section" : "class",
      },
    })
  }, { timeout: 60_000 })

  const after = await prisma.studentFee.count({
    where: { sourcePlanId: plan.id, studentId: { in: students.map(s => s.id) } },
  })
  const created = after - before
  const skipped = rows.length - created

  revalidatePath("/finance/plans")
  revalidatePath(`/finance/plans/${plan.id}`)
  revalidatePath("/finance/classes")
  revalidatePath("/finance/students")
  return { studentsTouched: students.length, rowsCreated: created, rowsSkipped: skipped }
}
