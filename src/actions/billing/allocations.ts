"use server"

import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

const D = Prisma.Decimal

type Tx = Prisma.TransactionClient

/**
 * Resolve the school's Accounts Receivable control account (Student Fee
 * Receivable, seeded as code "1130"). Throws a clear setup error if missing.
 */
export async function resolveReceivableAccountId(tx: Tx | typeof prisma, schoolId: string): Promise<string> {
  const ar = await tx.account.findFirst({
    where: { schoolId, type: "ASSET", subType: "RECEIVABLE", isControl: true, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true },
  })
  if (!ar) throw new Error("No Accounts Receivable account configured. Seed the chart of accounts (a control ASSET with subType RECEIVABLE is required).")
  return ar.id
}

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
      // PLANNED rows are also considered outstanding for collection — when a
      // payment is recorded against them, applyAllocations (with accrualCtx)
      // auto-promotes the row to BILLED and posts a real BL voucher in the
      // same transaction. Pre-billed PLANNED rows just stay PLANNED if the
      // caller skips accrualCtx (legacy / cash-basis path).
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
 * When `accrualCtx` is supplied, PLANNED rows being allocated against will
 * also have a BL Voucher created (DR AR / CR Income) for their full
 * finalAmount — that's the accrual recognition that complements the
 * DR Cash / CR AR voucher created by recordFeePayment.
 */
export async function applyAllocations(
  tx: Tx,
  schoolId: string,
  feePaymentId: string,
  allocations: Array<{ studentFeeId: string; amount: string | Prisma.Decimal }>,
  accrualCtx?: {
    fiscalYearId: string  // payment's FY — auto-billed BL posts here
    fyName:       string
    dateBS:       string
    dateAD:       Date
    userId:       string
  },
): Promise<{ allocatedTotal: Prisma.Decimal; touchedFeeIds: string[] }> {
  if (allocations.length === 0) return { allocatedTotal: new D(0), touchedFeeIds: [] }

  const ids = Array.from(new Set(allocations.map(a => a.studentFeeId)))
  const rows = await tx.studentFee.findMany({
    where:   { id: { in: ids }, schoolId },
    include: { feeHead: { include: { feeAccount: { select: { id: true, name: true } } } } },
  })
  const byId = new Map(rows.map(r => [r.id, r]))
  if (rows.length !== ids.length) throw new Error("One or more fee rows not found or out of school scope")

  // Snapshot of student name for BL voucher narration (only needed in accrual mode)
  let studentName: string | null = null
  async function getStudentName(studentId: string): Promise<string> {
    if (studentName) return studentName
    const s = await tx.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { fullName: true } } },
    })
    studentName = s?.user.fullName ?? "Student"
    return studentName
  }

  // Cache FY names for BL voucher minting (auto-bill PLANNED rows on collection)
  const fyNameCache = new Map<string, string>()
  async function getFyName(fyId: string): Promise<string> {
    const cached = fyNameCache.get(fyId)
    if (cached) return cached
    const fy = await tx.fiscalYear.findUnique({ where: { id: fyId }, select: { name: true } })
    if (!fy) throw new Error("Fiscal year not found for fee row")
    fyNameCache.set(fyId, fy.name)
    return fy.name
  }

  // Resolve AR account once — used for accrual BL postings (DR AR / CR Income)
  let arAccountId: string | null = null
  async function getArAccountId(): Promise<string> {
    if (!arAccountId) arAccountId = await resolveReceivableAccountId(tx, schoolId)
    return arAccountId
  }

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

    // Auto-bill PLANNED rows at the moment of collection: mint a BL voucher
    // number so the row gets a proper audit trail without requiring a separate
    // "bill period" run upstream.
    //
    // When accrualCtx is provided, ALSO post a real BL Voucher record
    // (DR AR / CR Income) so the GL reflects the income at billing time, not
    // at payment time. The BL voucher posts in the PAYMENT's FY (passed via
    // accrualCtx) — same FY as the RV that follows — keeping all related
    // postings in one period.
    let billVoucherNumber: string | null = row.billVoucherNumber
    let billVoucherId: string | null = row.billVoucherId
    if (row.status === "PLANNED") {
      const fyForCounter = accrualCtx?.fiscalYearId ?? row.fiscalYearId
      const fyName = accrualCtx?.fyName ?? await getFyName(row.fiscalYearId)
      const counter = await tx.voucherCounter.upsert({
        where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: fyForCounter, type: "BL" } },
        create: { schoolId, fiscalYearId: fyForCounter, type: "BL", lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      })
      billVoucherNumber = `BL-${fyName}-${String(counter.lastNumber).padStart(4, "0")}`

      if (accrualCtx) {
        const arId = await getArAccountId()
        const incomeId = row.feeHead.feeAccount.id
        const studentLabel = await getStudentName(row.studentId)
        const billVoucher = await tx.voucher.create({
          data: {
            schoolId,
            fiscalYearId: accrualCtx.fiscalYearId,
            type:         "BL",
            number:       billVoucherNumber,
            dateBS:       accrualCtx.dateBS,
            dateAD:       accrualCtx.dateAD,
            narration:    `Bill — ${studentLabel} · ${row.periodLabel} · ${row.feeHead.feeAccount.name}`,
            status:       "POSTED",
            partyType:    "STUDENT",
            partyId:      row.studentId,
            partyName:    studentLabel,
            totalAmount:  row.finalAmount,
            postedAt:     new Date(),
            postedById:   accrualCtx.userId,
            createdById:  accrualCtx.userId,
            lines: {
              create: [
                {
                  schoolId, accountId: arId, lineNo: 1,
                  debit: row.finalAmount, credit: new D(0),
                  partyType: "STUDENT", partyId: row.studentId,
                  narration: `${row.feeHead.feeAccount.name} — ${row.periodLabel}`,
                },
                {
                  schoolId, accountId: incomeId, lineNo: 2,
                  debit: new D(0), credit: row.finalAmount,
                  partyType: "STUDENT", partyId: row.studentId,
                  narration: row.periodLabel,
                },
              ],
            },
          },
          select: { id: true },
        })
        billVoucherId = billVoucher.id
      }
    }

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
      : "BILLED"
    await tx.studentFee.update({
      where: { id: a.studentFeeId },
      data:  {
        paidAmount: nextPaid,
        status:     nextStatus,
        ...(billVoucherNumber !== row.billVoucherNumber && { billVoucherNumber }),
        ...(billVoucherId !== row.billVoucherId && { billVoucherId }),
      },
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
