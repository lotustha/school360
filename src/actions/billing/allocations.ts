"use server"

import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

const D = Prisma.Decimal

type Tx = Prisma.TransactionClient

export interface AllocationProposal {
  studentFeeId:   string
  label:          string  // "Bhadra · Tuition Fee"
  periodLabel:    string
  feeHeadName:    string
  priority:       number
  finalAmount:    string
  alreadyPaid:    string
  thisPayment:    string  // amount this payment would allocate
  remainAfter:    string
  dueDateBS:      string
  fiscalYearName: string
  isPriorFy:      boolean  // true when the row's FY isn't the current one
}

export interface AllocationPreview {
  studentName:      string
  paymentAmount:    string
  totalDue:         string
  allocated:        string
  residual:         string     // payment - allocated (becomes advance credit)
  proposals:        AllocationProposal[]
  hasUnpaidPriorFy: boolean
}

/**
 * Compute a FIFO allocation across all outstanding StudentFee rows for a student.
 * Read-only. Caller decides whether to apply.
 */
export async function previewAllocation(studentId: string, amountStr: string): Promise<AllocationPreview> {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { fullName: true } } },
  })
  if (!student || student.schoolId !== schoolId) throw new Error("Student not found")

  const amount = new D(amountStr)
  if (amount.lessThanOrEqualTo(0)) throw new Error("Amount must be > 0")

  const outstanding = await prisma.studentFee.findMany({
    where: {
      schoolId, studentId,
      // PLANNED rows are also collectable — paying against one just applies the
      // payment. Cash-basis: income is recognized on the receipt (RV), not at
      // billing time, so no BL voucher is involved.
      status: { in: ["PLANNED", "BILLED", "PARTIAL"] },
    },
    include: {
      fiscalYear: { select: { id: true, name: true, isCurrent: true } },
      feeHead:    { select: { name: true, priority: true } },
    },
    orderBy: [
      { feeHead: { priority: "asc" } },  // 1=highest priority paid first
      { dueDateAD: "asc" },
      { createdAt: "asc" },
    ],
  })

  let remaining = amount
  let totalDue = new D(0)
  let allocated = new D(0)
  let hasUnpaidPriorFy = false
  const proposals: AllocationProposal[] = []

  for (const r of outstanding) {
    const balance = r.finalAmount.minus(r.paidAmount)
    totalDue = totalDue.plus(balance)
    if (!r.fiscalYear.isCurrent) hasUnpaidPriorFy = true

    let thisPayment = new D(0)
    if (remaining.greaterThan(0)) {
      thisPayment = D.min(remaining, balance)
      remaining = remaining.minus(thisPayment)
      allocated = allocated.plus(thisPayment)
    }

    proposals.push({
      studentFeeId:   r.id,
      label:          `${r.periodLabel} · ${r.feeHead.name}`,
      periodLabel:    r.periodLabel,
      feeHeadName:    r.feeHead.name,
      priority:       r.feeHead.priority,
      finalAmount:    r.finalAmount.toFixed(2),
      alreadyPaid:    r.paidAmount.toFixed(2),
      thisPayment:    thisPayment.toFixed(2),
      remainAfter:    balance.minus(thisPayment).toFixed(2),
      dueDateBS:      r.dueDateBS,
      fiscalYearName: r.fiscalYear.name,
      isPriorFy:      !r.fiscalYear.isCurrent,
    })
  }

  return {
    studentName:      student.user.fullName,
    paymentAmount:    amount.toFixed(2),
    totalDue:         totalDue.toFixed(2),
    allocated:        allocated.toFixed(2),
    residual:         remaining.toFixed(2),
    proposals,
    hasUnpaidPriorFy,
  }
}

/**
 * Apply allocations to a payment. Run INSIDE a transaction supplied by the
 * caller. Writes FeePaymentAllocation rows and updates StudentFee.paidAmount
 * + status. Allocations are silently capped per-row at the row's balance.
 *
 * Cash-basis: no GL posting happens here. Income is recognized on the receipt
 * (RV) voucher built by recordFeePayment; this function only updates the
 * billing-side bookkeeping (paidAmount / status).
 */
export async function applyAllocations(
  tx: Tx,
  schoolId: string,
  feePaymentId: string,
  allocations: Array<{ studentFeeId: string; amount: string | Prisma.Decimal }>,
): Promise<{ allocatedTotal: Prisma.Decimal; touchedFeeIds: string[] }> {
  if (allocations.length === 0) return { allocatedTotal: new D(0), touchedFeeIds: [] }

  const ids = Array.from(new Set(allocations.map(a => a.studentFeeId)))
  const rows = await tx.studentFee.findMany({
    where: { id: { in: ids }, schoolId },
  })
  const byId = new Map(rows.map(r => [r.id, r]))
  if (rows.length !== ids.length) throw new Error("One or more fee rows not found or out of school scope")

  let allocatedTotal = new D(0)
  const touched: string[] = []

  for (const a of allocations) {
    const row = byId.get(a.studentFeeId)!
    if (row.status === "CANCELLED") throw new Error(`Row "${row.periodLabel}" is cancelled`)
    if (row.status === "PAID")      throw new Error(`Row "${row.periodLabel}" is already PAID`)

    const balance = row.finalAmount.minus(row.paidAmount)
    const desired = new D(a.amount as string)
    if (desired.lessThanOrEqualTo(0)) continue
    const apply = D.min(desired, balance)

    await tx.feePaymentAllocation.create({
      data: {
        feePaymentId,
        studentFeeId: a.studentFeeId,
        amount:       apply,
      },
    })

    const nextPaid = row.paidAmount.plus(apply)
    const nextStatus = nextPaid.greaterThanOrEqualTo(row.finalAmount) ? "PAID"
      : nextPaid.greaterThan(0) ? "PARTIAL"
      : row.status
    await tx.studentFee.update({
      where: { id: a.studentFeeId },
      data:  { paidAmount: nextPaid, status: nextStatus },
    })

    allocatedTotal = allocatedTotal.plus(apply)
    touched.push(a.studentFeeId)
  }

  return { allocatedTotal, touchedFeeIds: touched }
}

/**
 * Resolve a FIFO plan from a payment amount inside a transaction.
 * Returns the same shape applyAllocations expects.
 */
export async function planFifoAllocations(
  tx: Tx,
  schoolId: string,
  studentId: string,
  amount: Prisma.Decimal,
): Promise<Array<{ studentFeeId: string; amount: Prisma.Decimal }>> {
  const outstanding = await tx.studentFee.findMany({
    where: { schoolId, studentId, status: { in: ["PLANNED", "BILLED", "PARTIAL"] } },
    orderBy: [
      { feeHead: { priority: "asc" } },  // 1=highest paid first
      { dueDateAD: "asc" },
      { createdAt: "asc" },
    ],
    select: { id: true, finalAmount: true, paidAmount: true },
  })
  let remaining = amount
  const plan: Array<{ studentFeeId: string; amount: Prisma.Decimal }> = []
  for (const r of outstanding) {
    if (remaining.lessThanOrEqualTo(0)) break
    const balance = r.finalAmount.minus(r.paidAmount)
    if (balance.lessThanOrEqualTo(0)) continue
    const take = D.min(remaining, balance)
    plan.push({ studentFeeId: r.id, amount: take })
    remaining = remaining.minus(take)
  }
  return plan
}
