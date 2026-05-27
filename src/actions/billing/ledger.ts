"use server"

import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

const D = Prisma.Decimal

// ─── Student ledger (cross-FY aware) ────────────────────────────────────────
//
// Re-platformed onto StudentFee. Each row is a single student × fee head ×
// period. "Outstanding" = BILLED or PARTIAL; "Paid" = PAID; PLANNED rows are
// drafts the admin has not yet billed and are not surfaced here.

export interface LedgerRowView {
  id:                string
  /** Composite display key, e.g. "Bhadra Tuition" */
  label:             string
  feeHeadName:       string
  periodLabel:       string
  dueDateBS:         string
  baseAmount:        string
  scholarshipPct:    string
  scholarshipReason: string | null
  finalAmount:       string
  paidAmount:        string
  balance:           string
  status:            string
  fiscalYearId:      string
  fiscalYearName:    string
  isCurrentFY:       boolean
  isOverdue:         boolean
}

export interface LedgerPaymentView {
  id:            string
  receiptNumber: string
  dateBS:        string
  method:        string
  amount:        string
  allocatedTo:   string[]  // labels of StudentFee rows it settled
  residual:      string    // payment - sum(allocations) = advance amount
}

export interface StudentLedger {
  studentId:       string
  studentName:     string
  className:       string | null
  admissionNo:     string

  totalBilled:     string  // sum of finalAmount across issued rows (BILLED/PARTIAL/PAID)
  totalPaid:       string  // sum of paidAmount
  totalPlanned:    string  // sum of finalAmount across PLANNED rows (scheduled, not yet issued)
  balance:         string  // totalBilled − totalPaid (excludes PLANNED)

  /** Brought-forward summary: unpaid balance from prior fiscal years only. */
  carryForward: {
    balance:     string
    rowCount:    number
    oldestLabel: string | null
  }

  outstanding:    LedgerRowView[]
  paid:           LedgerRowView[]
  upcomingPlanned: LedgerRowView[]  // future PLANNED rows (preview only)

  recentPayments: LedgerPaymentView[]

  currentFiscalYearId:   string | null
  currentFiscalYearName: string | null
}

export async function getStudentLedger(studentId: string): Promise<StudentLedger | null> {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user:    { select: { fullName: true } },
      class:   { select: { name: true } },
      section: { select: { name: true } },
    },
  })
  if (!student || student.schoolId !== schoolId) return null

  const currentFY = await prisma.fiscalYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true, name: true },
  })

  const rows = await prisma.studentFee.findMany({
    where: { schoolId, studentId, status: { not: "CANCELLED" } },
    include: {
      fiscalYear: { select: { id: true, name: true, isCurrent: true } },
      feeHead:    { select: { name: true } },
    },
    orderBy: [{ dueDateAD: "asc" }, { createdAt: "asc" }],
  })

  const now = new Date()
  let totalBilled = new D(0)
  let totalPaid = new D(0)
  let totalPlanned = new D(0)
  let cfBalance = new D(0)
  let cfCount = 0
  let cfOldest: string | null = null

  const rowViews: LedgerRowView[] = rows.map(r => {
    // Billed/outstanding count issued rows only (BILLED/PARTIAL/PAID). PLANNED is
    // scheduled-but-not-yet-issued, so it's tracked separately and never inflates dues.
    if (r.status === "PLANNED") {
      totalPlanned = totalPlanned.plus(r.finalAmount)
    } else {
      totalBilled = totalBilled.plus(r.finalAmount)
      totalPaid = totalPaid.plus(r.paidAmount)
    }
    const balance = r.finalAmount.minus(r.paidAmount)
    const isCurrentFY = r.fiscalYear.isCurrent
    if (!isCurrentFY && balance.greaterThan(0) && r.status !== "PLANNED") {
      cfBalance = cfBalance.plus(balance)
      cfCount++
      const label = `${r.periodLabel} · ${r.feeHead.name}`
      if (!cfOldest || r.dueDateBS < (cfOldest ?? "9999")) cfOldest = label
    }
    return {
      id:                r.id,
      label:             `${r.periodLabel} · ${r.feeHead.name}`,
      feeHeadName:       r.feeHead.name,
      periodLabel:       r.periodLabel,
      dueDateBS:         r.dueDateBS,
      baseAmount:        r.baseAmount.toFixed(2),
      scholarshipPct:    r.scholarshipPct.toFixed(2),
      scholarshipReason: r.scholarshipReason,
      finalAmount:       r.finalAmount.toFixed(2),
      paidAmount:        r.paidAmount.toFixed(2),
      balance:           balance.toFixed(2),
      status:            r.status,
      fiscalYearId:      r.fiscalYearId,
      fiscalYearName:    r.fiscalYear.name,
      isCurrentFY,
      isOverdue:         (r.status === "BILLED" || r.status === "PARTIAL") && r.dueDateAD < now,
    }
  })

  const outstanding = rowViews.filter(r => r.status === "BILLED" || r.status === "PARTIAL")
  const paid = rowViews.filter(r => r.status === "PAID").sort((a, b) => b.dueDateBS.localeCompare(a.dueDateBS))
  const upcomingPlanned = rowViews.filter(r => r.status === "PLANNED")

  // Recent payments
  const payments = await prisma.feePayment.findMany({
    where: { schoolId, studentId },
    include: {
      allocations: {
        include: {
          studentFee: {
            include: { feeHead: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })
  const recentPayments: LedgerPaymentView[] = payments.map(p => {
    const allocated = p.allocations.reduce((sum, a) => sum.plus(a.amount), new D(0))
    return {
      id:            p.id,
      receiptNumber: p.receiptNumber,
      dateBS:        p.dateBS,
      method:        p.method,
      amount:        p.amount.toFixed(2),
      allocatedTo:   p.allocations.map(a => `${a.studentFee.periodLabel} · ${a.studentFee.feeHead.name}`),
      residual:      p.amount.minus(allocated).toFixed(2),
    }
  })

  return {
    studentId:       student.id,
    studentName:     student.user.fullName,
    className:       student.class ? `${student.class.name}${student.section ? "-" + student.section.name : ""}` : null,
    admissionNo:     student.admissionNo,
    totalBilled:     totalBilled.toFixed(2),
    totalPaid:       totalPaid.toFixed(2),
    totalPlanned:    totalPlanned.toFixed(2),
    balance:         totalBilled.minus(totalPaid).toFixed(2),
    carryForward: {
      balance:     cfBalance.toFixed(2),
      rowCount:    cfCount,
      oldestLabel: cfOldest,
    },
    outstanding,
    paid,
    upcomingPlanned,
    recentPayments,
    currentFiscalYearId:   currentFY?.id ?? null,
    currentFiscalYearName: currentFY?.name ?? null,
  }
}

// ─── Billing dashboard summary ──────────────────────────────────────────────

export async function getBillingDashboard() {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  const currentFY = await prisma.fiscalYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true, name: true },
  })

  const [outstandingAgg, paidAgg, overdueCount, recentRows, plannedCount] = await Promise.all([
    prisma.studentFee.aggregate({
      where: { schoolId, status: { in: ["BILLED", "PARTIAL"] } },
      _sum: { finalAmount: true, paidAmount: true },
      _count: true,
    }),
    prisma.studentFee.aggregate({
      where: { schoolId, status: "PAID" },
      _sum: { finalAmount: true },
      _count: true,
    }),
    prisma.studentFee.count({
      where: {
        schoolId,
        status: { in: ["BILLED", "PARTIAL"] },
        dueDateAD: { lt: new Date() },
      },
    }),
    prisma.studentFee.findMany({
      where: { schoolId, status: { in: ["BILLED", "PARTIAL", "PAID"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        student: { include: { user: { select: { fullName: true } }, class: { select: { name: true } } } },
        feeHead: { select: { name: true } },
      },
    }),
    prisma.studentFee.count({ where: { schoolId, status: "PLANNED" } }),
  ])

  const outstandingTotal = (outstandingAgg._sum.finalAmount ?? new D(0))
    .minus(outstandingAgg._sum.paidAmount ?? new D(0))

  const cfAgg = await prisma.studentFee.aggregate({
    where: {
      schoolId,
      status: { in: ["BILLED", "PARTIAL"] },
      ...(currentFY && { fiscalYearId: { not: currentFY.id } }),
    },
    _sum: { finalAmount: true, paidAmount: true },
    _count: true,
  })
  const cfBalance = (cfAgg._sum.finalAmount ?? new D(0)).minus(cfAgg._sum.paidAmount ?? new D(0))

  return {
    currentFiscalYearName: currentFY?.name ?? null,
    outstandingTotal:      outstandingTotal.toFixed(2),
    outstandingCount:      outstandingAgg._count,
    overdueCount,
    paidTotal:             (paidAgg._sum.finalAmount ?? new D(0)).toFixed(2),
    paidCount:             paidAgg._count,
    plannedCount,
    carryForwardBalance:   cfBalance.toFixed(2),
    carryForwardCount:     cfAgg._count,
    recent: recentRows.map(r => ({
      id:          r.id,
      label:       `${r.periodLabel} · ${r.feeHead.name}`,
      studentName: r.student.user.fullName,
      className:   r.student.class?.name ?? null,
      periodLabel: r.periodLabel,
      total:       r.finalAmount.toFixed(2),
      paid:        r.paidAmount.toFixed(2),
      status:      r.status,
    })),
  }
}

// Bill Book removed 2026-05-26 — the per-class outstanding rollup was folded
// into the Classes landing page (/finance/classes).
