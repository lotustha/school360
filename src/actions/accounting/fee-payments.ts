"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { toAD } from "@/lib/nepali-date"
import { resolveFiscalYearForDate } from "@/actions/accounting/fiscal-years"

const D = Prisma.Decimal

const PAYMENT_METHODS = ["CASH", "BANK", "CHEQUE", "ONLINE"] as const

const recordSchema = z.object({
  studentId:      z.string().min(1),
  feeStructureId: z.string().nullable().optional(),
  feeAccountId:   z.string().min(1),
  amount:         z.string().regex(/^\d+(\.\d{1,2})?$/),
  method:         z.enum(PAYMENT_METHODS),
  bankAccountId:  z.string().nullable().optional(),
  dateBS:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks:        z.string().max(500).nullable().optional(),
})

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
export async function recordFeePayment(input: z.infer<typeof recordSchema>): Promise<RecordFeePaymentResult> {
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

  // Validate the income head
  const feeAccount = await prisma.account.findUnique({ where: { id: data.feeAccountId } })
  if (!feeAccount || feeAccount.schoolId !== schoolId) throw new Error("Invalid fee account")
  if (feeAccount.type !== "INCOME") throw new Error("Fee account must be INCOME type")

  // Pull the student's display name for the voucher narration
  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    include: { user: { select: { fullName: true } }, class: { select: { name: true } }, section: { select: { name: true } } },
  })
  if (!student || student.schoolId !== schoolId) throw new Error("Student not found")

  const amount = new D(data.amount)
  if (amount.lessThanOrEqualTo(0)) throw new Error("Amount must be greater than zero")

  const result = await prisma.$transaction(async (tx) => {
    // Allocate receipt number (FR-FYNAME-NNNN)
    const rc = await tx.voucherCounter.upsert({
      where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: fy.id, type: "FR" } },
      create: { schoolId, fiscalYearId: fy.id, type: "FR", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const receiptNumber = `FR-${fy.name}-${String(rc.lastNumber).padStart(4, "0")}`

    // Allocate RV voucher number
    const vc = await tx.voucherCounter.upsert({
      where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: fy.id, type: "RV" } },
      create: { schoolId, fiscalYearId: fy.id, type: "RV", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const voucherNumber = `RV-${fy.name}-${String(vc.lastNumber).padStart(4, "0")}`

    // Post the Receipt Voucher
    const studentLabel = student.class
      ? `${student.user.fullName} · ${student.class.name}${student.section ? "-" + student.section.name : ""}`
      : student.user.fullName
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
        totalAmount:  amount,
        postedAt:     new Date(),
        postedById:   session.user.id,
        createdById:  session.user.id,
        lines: {
          create: [
            {
              schoolId, accountId: sourceAccountId, lineNo: 1,
              debit: amount, credit: new D(0),
              partyType: "STUDENT", partyId: data.studentId,
            },
            {
              schoolId, accountId: data.feeAccountId, lineNo: 2,
              debit: new D(0), credit: amount,
              partyType: "STUDENT", partyId: data.studentId,
              narration: feeAccount.name,
            },
          ],
        },
      },
      select: { id: true, number: true },
    })

    // Create the FeePayment row linked to the voucher
    const fp = await tx.feePayment.create({
      data: {
        schoolId,
        receiptNumber,
        studentId:      data.studentId,
        feeStructureId: data.feeStructureId ?? null,
        feeAccountId:   data.feeAccountId,
        amount,
        method:         data.method,
        bankAccountId:  data.method === "CASH" ? null : data.bankAccountId,
        dateBS:         data.dateBS,
        dateAD,
        remarks:        data.remarks ?? null,
        voucherId:      voucher.id,
        collectedById:  session.user.id,
      },
      select: { id: true, receiptNumber: true },
    })

    return {
      id:            fp.id,
      receiptNumber: fp.receiptNumber,
      voucherId:     voucher.id,
      voucherNumber: voucher.number!,
    }
  })

  revalidatePath("/finance")
  revalidatePath("/finance/history")
  revalidatePath("/accounting")
  revalidatePath("/accounting/vouchers")
  revalidatePath("/accounting/cash-book")
  revalidatePath("/accounting/bank-book")
  revalidatePath("/accounting/reports/trial-balance")
  return result
}

// ─── Queries ────────────────────────────────────────────────────────────────

export interface FeePaymentRow {
  id:            string
  receiptNumber: string
  studentName:   string
  className:     string | null
  feeAccountCode: string
  feeAccountName: string
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
      voucher:     { select: { id: true, number: true } },
      bankAccount: { select: { bankName: true } },
    },
    orderBy: [{ dateAD: "desc" }, { createdAt: "desc" }],
    take: 500,
  })

  return rows.map(r => ({
    id:            r.id,
    receiptNumber: r.receiptNumber,
    studentName:   r.student.user.fullName,
    className:     r.student.class
      ? `${r.student.class.name}${r.student.section ? "-" + r.student.section.name : ""}`
      : null,
    feeAccountCode: r.feeAccount.code,
    feeAccountName: r.feeAccount.name,
    amount:        r.amount.toFixed(2),
    method:        r.method,
    bankName:      r.bankAccount?.bankName ?? null,
    dateBS:        r.dateBS,
    voucherNumber: r.voucher?.number ?? null,
    voucherId:     r.voucher?.id ?? null,
    remarks:       r.remarks,
  }))
}

export interface FeePaymentReceipt {
  id:             string
  receiptNumber:  string
  dateBS:         string
  studentName:    string
  admissionNo:    string | null
  className:      string | null
  feeAccountName: string
  amount:         string
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
      voucher:     { select: { number: true } },
      bankAccount: { select: { bankName: true } },
    },
  })
  if (!r || r.schoolId !== session.user.schoolId) return null

  const collector = r.collectedById
    ? await prisma.user.findUnique({ where: { id: r.collectedById }, select: { fullName: true } })
    : null

  return {
    id:             r.id,
    receiptNumber:  r.receiptNumber,
    dateBS:         r.dateBS,
    studentName:    r.student.user.fullName,
    admissionNo:    r.student.admissionNo,
    className:      r.student.class
      ? `${r.student.class.name}${r.student.section ? "-" + r.student.section.name : ""}`
      : null,
    feeAccountName: r.feeAccount.name,
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
      },
    }),
  ])

  return {
    todayTotal:    (today._sum.amount ?? new D(0)).toFixed(2),
    todayCount:    today._count,
    monthTotal:    (month._sum.amount ?? new D(0)).toFixed(2),
    monthCount:    month._count,
    recent: recent.map(r => ({
      id:            r.id,
      receiptNumber: r.receiptNumber,
      studentName:   r.student.user.fullName,
      feeAccountName: r.feeAccount.name,
      amount:        r.amount.toFixed(2),
      method:        r.method,
      dateBS:        r.dateBS,
    })),
  }
}
