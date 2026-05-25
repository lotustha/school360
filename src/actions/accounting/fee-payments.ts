"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { toAD } from "@/lib/nepali-date"
import { resolveFiscalYearForDate } from "@/actions/accounting/fiscal-years"
import { applyAllocations, planFifoAllocations } from "@/actions/billing/allocations"

const D = Prisma.Decimal

const PAYMENT_METHODS = ["CASH", "BANK", "CHEQUE", "ONLINE"] as const

const lineSchema = z.object({
  feeAccountId: z.string().min(1),
  amount:       z.string().regex(/^\d+(\.\d{1,2})?$/),
  remarks:      z.string().max(300).nullable().optional(),
})

const allocationSchema = z.object({
  studentFeeId: z.string().min(1),
  amount:       z.string().regex(/^\d+(\.\d{1,2})?$/),
})

const recordSchema = z.object({
  studentId:      z.string().min(1),
  feeStructureId: z.string().nullable().optional(),
  /** Optional when allocations[] is supplied — the server derives lines per fee head from the allocated bills. */
  lines:          z.array(lineSchema).optional(),
  method:         z.enum(PAYMENT_METHODS),
  bankAccountId:  z.string().nullable().optional(),
  dateBS:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks:        z.string().max(500).nullable().optional(),
  /** Explicit per-bill allocations. If absent and autoAllocate=true, FIFO is computed inside the tx. */
  allocations:    z.array(allocationSchema).optional(),
  /** When true (and allocations absent): auto-allocate FIFO. Default false. */
  autoAllocate:   z.boolean().optional(),
}).refine(
  d => (d.lines && d.lines.length > 0) || (d.allocations && d.allocations.length > 0) || d.autoAllocate,
  { message: "Must supply lines[], allocations[], or set autoAllocate=true" },
)

export type RecordFeePaymentInput = z.infer<typeof recordSchema>

export interface RecordFeePaymentResult {
  id:            string
  receiptNumber: string
  voucherId:     string
  voucherNumber: string
}

/**
 * Atomically records a student fee payment AND posts a Receipt Voucher.
 * Allocates a receipt number (FR-FYNAME-NNNN) and a voucher number
 * (RV-FYNAME-NNNN). All-or-nothing in a single Postgres transaction.
 */
export async function recordFeePayment(input: RecordFeePaymentInput): Promise<RecordFeePaymentResult> {
  const session = await requirePermission("finance:manage")
  const schoolId = session.user.schoolId!
  const data = recordSchema.parse(input)
  const dateAD = toAD(data.dateBS)

  // Resolve the FY this date belongs to
  const fy = await resolveFiscalYearForDate(schoolId, data.dateBS)
  if (!fy) throw new Error("No fiscal year covers this date — create one in /accounting/fiscal-years")
  if (fy.status !== "OPEN") throw new Error("Fiscal year is not open for posting")

  // Resolve the source GL account (Cash or specific Bank)
  let sourceAccountId: string
  if (data.method === "CASH") {
    const cash = await prisma.account.findFirst({
      where: { schoolId, subType: "CASH", isActive: true },
      orderBy: { code: "asc" },
    })
    if (!cash) throw new Error("No CASH account in Chart of Accounts")
    sourceAccountId = cash.id
  } else {
    if (!data.bankAccountId) throw new Error(`Bank account required for ${data.method} payments`)
    const bank = await prisma.bankAccount.findUnique({ where: { id: data.bankAccountId }, select: { schoolId: true, accountId: true } })
    if (!bank || bank.schoolId !== schoolId) throw new Error("Invalid bank account")
    sourceAccountId = bank.accountId
  }

  // Pull the student's display name for the voucher narration
  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    include: { user: { select: { fullName: true } }, class: { select: { name: true } }, section: { select: { name: true } } },
  })
  if (!student || student.schoolId !== schoolId) throw new Error("Student not found")

  // If client supplied explicit lines, validate up-front (fast-fail before tx)
  if (data.lines && data.lines.length > 0) {
    const accountIds = Array.from(new Set(data.lines.map(l => l.feeAccountId)))
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, schoolId },
      select: { id: true, name: true, type: true },
    })
    const byId = new Map(accounts.map(a => [a.id, a]))
    for (const line of data.lines) {
      const acc = byId.get(line.feeAccountId)
      if (!acc) throw new Error("Invalid fee account on one of the lines")
      if (acc.type !== "INCOME") throw new Error(`Fee head "${acc.name}" must be INCOME type`)
      if (new D(line.amount).lessThanOrEqualTo(0)) throw new Error(`Line for "${acc.name}" must be greater than zero`)
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Step 1: resolve final allocations (explicit, FIFO from explicit total, or full FIFO)
    let allocations: Array<{ studentFeeId: string; amount: Prisma.Decimal }> = []
    if (data.allocations && data.allocations.length > 0) {
      allocations = data.allocations.map(a => ({ studentFeeId: a.studentFeeId, amount: new D(a.amount) }))
    } else if (data.autoAllocate) {
      const fifoTotal = data.lines && data.lines.length > 0
        ? data.lines.reduce((sum, l) => sum.plus(new D(l.amount)), new D(0))
        : null
      if (fifoTotal) {
        allocations = await planFifoAllocations(tx, schoolId, data.studentId, fifoTotal)
      }
    }

    // Step 2: derive per-head lines so GL credits the right INCOME heads
    let derivedLines: Array<{ feeAccountId: string; accountName: string; amount: Prisma.Decimal; remarks: string | null }>

    if (data.lines && data.lines.length > 0) {
      const accIds = Array.from(new Set(data.lines.map(l => l.feeAccountId)))
      const accs = await tx.account.findMany({ where: { id: { in: accIds }, schoolId }, select: { id: true, name: true } })
      const nameById = new Map(accs.map(a => [a.id, a.name]))
      derivedLines = data.lines.map(l => ({
        feeAccountId: l.feeAccountId,
        accountName:  nameById.get(l.feeAccountId) ?? "Fee",
        amount:       new D(l.amount),
        remarks:      l.remarks?.trim() || null,
      }))
    } else if (allocations.length > 0) {
      // Each StudentFee row carries exactly one feeHead → exactly one income account.
      // The allocation amount goes 1:1 to that account (no proration needed).
      const ids = allocations.map(a => a.studentFeeId)
      const rows = await tx.studentFee.findMany({
        where: { id: { in: ids }, schoolId },
        include: { feeHead: { include: { feeAccount: { select: { id: true, name: true } } } } },
      })
      const rowById = new Map(rows.map(r => [r.id, r]))

      const perHead = new Map<string, { name: string; amount: Prisma.Decimal }>()
      for (const a of allocations) {
        const row = rowById.get(a.studentFeeId)
        if (!row) throw new Error("Fee row not found during line derivation")
        const acc = row.feeHead.feeAccount
        const existing = perHead.get(acc.id)
        if (existing) existing.amount = existing.amount.plus(a.amount)
        else perHead.set(acc.id, { name: acc.name, amount: new D(a.amount) })
      }

      derivedLines = Array.from(perHead.entries()).map(([id, v]) => ({
        feeAccountId: id,
        accountName:  v.name,
        amount:       v.amount,
        remarks:      null,
      }))
    } else {
      throw new Error("Cannot record payment: no lines and no allocations resolved")
    }

    const total = derivedLines.reduce((s, l) => s.plus(l.amount), new D(0))
    if (total.lessThanOrEqualTo(0)) throw new Error("Total must be greater than zero")

    // Step 3: allocate counters
    const rc = await tx.voucherCounter.upsert({
      where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: fy.id, type: "FR" } },
      create: { schoolId, fiscalYearId: fy.id, type: "FR", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const receiptNumber = `FR-${fy.name}-${String(rc.lastNumber).padStart(4, "0")}`

    const vc = await tx.voucherCounter.upsert({
      where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: fy.id, type: "RV" } },
      create: { schoolId, fiscalYearId: fy.id, type: "RV", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const voucherNumber = `RV-${fy.name}-${String(vc.lastNumber).padStart(4, "0")}`

    const studentLabel = student.class
      ? `${student.user.fullName} · ${student.class.name}${student.section ? "-" + student.section.name : ""}`
      : student.user.fullName

    // Step 4: voucher lines (1 debit, N credits)
    const voucherLines = [
      {
        schoolId, accountId: sourceAccountId, lineNo: 1,
        debit: total, credit: new D(0),
        partyType: "STUDENT", partyId: data.studentId,
      },
      ...derivedLines.map((line, i) => ({
        schoolId, accountId: line.feeAccountId, lineNo: i + 2,
        debit: new D(0), credit: line.amount,
        partyType: "STUDENT", partyId: data.studentId,
        narration: line.remarks ? `${line.accountName} — ${line.remarks}` : line.accountName,
      })),
    ]

    const voucher = await tx.voucher.create({
      data: {
        schoolId,
        fiscalYearId: fy.id,
        type:         "RV",
        number:       voucherNumber,
        dateBS:       data.dateBS,
        dateAD,
        narration:    data.remarks?.trim() || `Fee — ${studentLabel} (${receiptNumber})`,
        status:       "POSTED",
        partyType:    "STUDENT",
        partyId:      data.studentId,
        partyName:    student.user.fullName,
        totalAmount:  total,
        postedAt:     new Date(),
        postedById:   session.user.id,
        createdById:  session.user.id,
        lines: { create: voucherLines },
      },
      select: { id: true, number: true },
    })

    // Step 5: FeePayment + FeePaymentLine rows (per head)
    const fp = await tx.feePayment.create({
      data: {
        schoolId,
        receiptNumber,
        studentId:      data.studentId,
        feeStructureId: data.feeStructureId ?? null,
        feeAccountId:   null,
        amount:         total,
        method:         data.method,
        bankAccountId:  data.method === "CASH" ? null : data.bankAccountId,
        dateBS:         data.dateBS,
        dateAD,
        remarks:        data.remarks ?? null,
        voucherId:      voucher.id,
        collectedById:  session.user.id,
        lines: {
          create: derivedLines.map((line, i) => ({
            feeAccountId: line.feeAccountId,
            amount:       line.amount,
            remarks:      line.remarks,
            lineNo:       i + 1,
          })),
        },
      },
      select: { id: true, receiptNumber: true },
    })

    // Step 6: write allocation rows + update bill paidAmount/status
    if (allocations.length > 0) {
      await applyAllocations(tx, schoolId, fp.id, allocations)
    }

    return {
      id:            fp.id,
      receiptNumber: fp.receiptNumber,
      voucherId:     voucher.id,
      voucherNumber: voucher.number!,
    }
  })

  revalidatePath("/finance")
  revalidatePath("/finance/history")
  revalidatePath("/finance/classes")
  revalidatePath(`/finance/students/${input.studentId}`)
  revalidatePath("/accounting")
  revalidatePath("/accounting/vouchers")
  revalidatePath("/accounting/cash-book")
  revalidatePath("/accounting/bank-book")
  revalidatePath("/accounting/reports/trial-balance")
  return result
}

// ─── Queries ────────────────────────────────────────────────────────────────

export interface FeePaymentLineView {
  feeAccountCode: string
  feeAccountName: string
  amount:         string
  remarks:        string | null
}

export interface FeePaymentRow {
  id:            string
  receiptNumber: string
  studentName:   string
  className:     string | null
  /** First fee head (for compact display); use `lines` for full breakdown. */
  feeAccountCode: string
  feeAccountName: string
  /** Total fee heads on this receipt — used to show a "+N more" badge. */
  lineCount:     number
  lines:         FeePaymentLineView[]
  amount:        string
  method:        string
  bankName:      string | null
  dateBS:        string
  voucherNumber: string | null
  voucherId:     string | null
  remarks:       string | null
}

export interface FeePaymentFilters {
  fromBS?:   string
  toBS?:     string
  studentId?: string
  method?:    string
}

export async function listFeePayments(filters: FeePaymentFilters = {}): Promise<FeePaymentRow[]> {
  const session = await requirePermission("finance:view")
  const rows = await prisma.feePayment.findMany({
    where: {
      schoolId: session.user.schoolId!,
      ...(filters.studentId && { studentId: filters.studentId }),
      ...(filters.method    && { method:    filters.method }),
      ...(filters.fromBS && { dateAD: { gte: toAD(filters.fromBS) } }),
      ...(filters.toBS   && { dateAD: { lte: toAD(filters.toBS) } }),
    },
    include: {
      student:     { include: { user: { select: { fullName: true } }, class: { select: { name: true } }, section: { select: { name: true } } } },
      feeAccount:  { select: { code: true, name: true } },
      lines:       { include: { feeAccount: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } },
      voucher:     { select: { id: true, number: true } },
      bankAccount: { select: { bankName: true } },
    },
    orderBy: [{ dateAD: "desc" }, { createdAt: "desc" }],
    take: 500,
  })

  return rows.map(r => {
    // Multi-line rows: read FeePaymentLine. Legacy rows: synthesize from header feeAccount.
    const lines: FeePaymentLineView[] = r.lines.length > 0
      ? r.lines.map(l => ({
          feeAccountCode: l.feeAccount.code,
          feeAccountName: l.feeAccount.name,
          amount:         l.amount.toFixed(2),
          remarks:        l.remarks,
        }))
      : r.feeAccount
        ? [{
            feeAccountCode: r.feeAccount.code,
            feeAccountName: r.feeAccount.name,
            amount:         r.amount.toFixed(2),
            remarks:        r.remarks,
          }]
        : []

    const first = lines[0]
    return {
      id:            r.id,
      receiptNumber: r.receiptNumber,
      studentName:   r.student.user.fullName,
      className:     r.student.class
        ? `${r.student.class.name}${r.student.section ? "-" + r.student.section.name : ""}`
        : null,
      feeAccountCode: first?.feeAccountCode ?? "",
      feeAccountName: first?.feeAccountName ?? "(no head)",
      lineCount:     lines.length,
      lines,
      amount:        r.amount.toFixed(2),
      method:        r.method,
      bankName:      r.bankAccount?.bankName ?? null,
      dateBS:        r.dateBS,
      voucherNumber: r.voucher?.number ?? null,
      voucherId:     r.voucher?.id ?? null,
      remarks:       r.remarks,
    }
  })
}

export interface FeePaymentReceiptLine {
  feeAccountName: string
  amount:         string
  remarks:        string | null
}

export interface FeePaymentReceipt {
  id:             string
  receiptNumber:  string
  dateBS:         string
  studentName:    string
  admissionNo:    string | null
  className:      string | null
  lines:          FeePaymentReceiptLine[]
  amount:         string  // total
  method:         string
  bankName:       string | null
  remarks:        string | null
  voucherNumber:  string | null
  collectedBy:    string | null
}

export async function getFeePayment(id: string): Promise<FeePaymentReceipt | null> {
  const session = await requirePermission("finance:view")
  const r = await prisma.feePayment.findUnique({
    where: { id },
    include: {
      student:     { include: { user: { select: { fullName: true } }, class: { select: { name: true } }, section: { select: { name: true } } } },
      feeAccount:  { select: { name: true } },
      lines:       { include: { feeAccount: { select: { name: true } } }, orderBy: { lineNo: "asc" } },
      voucher:     { select: { number: true } },
      bankAccount: { select: { bankName: true } },
    },
  })
  if (!r || r.schoolId !== session.user.schoolId) return null

  const collector = r.collectedById
    ? await prisma.user.findUnique({ where: { id: r.collectedById }, select: { fullName: true } })
    : null

  const lines: FeePaymentReceiptLine[] = r.lines.length > 0
    ? r.lines.map(l => ({
        feeAccountName: l.feeAccount.name,
        amount:         l.amount.toFixed(2),
        remarks:        l.remarks,
      }))
    : r.feeAccount
      ? [{ feeAccountName: r.feeAccount.name, amount: r.amount.toFixed(2), remarks: null }]
      : []

  return {
    id:             r.id,
    receiptNumber:  r.receiptNumber,
    dateBS:         r.dateBS,
    studentName:    r.student.user.fullName,
    admissionNo:    r.student.admissionNo,
    className:      r.student.class
      ? `${r.student.class.name}${r.student.section ? "-" + r.student.section.name : ""}`
      : null,
    lines,
    amount:         r.amount.toFixed(2),
    method:         r.method,
    bankName:       r.bankAccount?.bankName ?? null,
    remarks:        r.remarks,
    voucherNumber:  r.voucher?.number ?? null,
    collectedBy:    collector?.fullName ?? null,
  }
}

/** Quick-search students by name / admission no for the collection form. */
export async function searchStudents(q: string): Promise<Array<{
  id: string; name: string; admissionNo: string; className: string | null; avatarUrl: string | null
}>> {
  const session = await requirePermission("finance:view")
  const query = q.trim()
  if (query.length < 2) return []

  const rows = await prisma.student.findMany({
    where: {
      schoolId: session.user.schoolId!,
      OR: [
        { user:        { fullName: { contains: query, mode: "insensitive" } } },
        { admissionNo: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      user:    { select: { fullName: true, avatarUrl: true } },
      class:   { select: { name: true } },
      section: { select: { name: true } },
    },
    take: 10,
    orderBy: { user: { fullName: "asc" } },
  })

  return rows.map(r => ({
    id:          r.id,
    name:        r.user.fullName,
    admissionNo: r.admissionNo,
    className:   r.class
      ? `${r.class.name}${r.section ? "-" + r.section.name : ""}`
      : null,
    avatarUrl:   r.user.avatarUrl,
  }))
}

/** Dashboard summary for /finance. */
export async function getFinanceDashboard() {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  // Today's BS date in AD
  const todayAD = new Date()
  const startOfDay = new Date(todayAD); startOfDay.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(todayAD); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

  const [today, month, recent] = await Promise.all([
    prisma.feePayment.aggregate({
      where: { schoolId, dateAD: { gte: startOfDay } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.feePayment.aggregate({
      where: { schoolId, dateAD: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.feePayment.findMany({
      where:   { schoolId },
      orderBy: { createdAt: "desc" },
      take:    5,
      include: {
        student:    { include: { user: { select: { fullName: true } } } },
        feeAccount: { select: { name: true } },
        lines:      { include: { feeAccount: { select: { name: true } } }, orderBy: { lineNo: "asc" }, take: 1 },
        _count:     { select: { lines: true } },
      },
    }),
  ])

  return {
    todayTotal:    (today._sum.amount ?? new D(0)).toFixed(2),
    todayCount:    today._count,
    monthTotal:    (month._sum.amount ?? new D(0)).toFixed(2),
    monthCount:    month._count,
    recent: recent.map(r => {
      const headName = r.lines[0]?.feeAccount.name ?? r.feeAccount?.name ?? "(no head)"
      const extras = Math.max(0, r._count.lines - 1)
      return {
        id:            r.id,
        receiptNumber: r.receiptNumber,
        studentName:   r.student.user.fullName,
        feeAccountName: extras > 0 ? `${headName} + ${extras} more` : headName,
        amount:        r.amount.toFixed(2),
        method:        r.method,
        dateBS:        r.dateBS,
      }
    }),
  }
}
