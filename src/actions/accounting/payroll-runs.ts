"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { toAD } from "@/lib/nepali-date"
import { resolveFiscalYearForDate } from "@/actions/accounting/fiscal-years"

const D = Prisma.Decimal

const lineSchema = z.object({
  employeeId: z.string().min(1),
  gross:      z.string().regex(/^\d+(\.\d{1,2})?$/),
  tds:        z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  ssf:        z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  remarks:    z.string().max(255).nullable().optional(),
})

const runSchema = z.object({
  periodLabel:    z.string().min(1).max(60),
  dateBS:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod:  z.enum(["CASH", "BANK"]),
  bankAccountId:  z.string().nullable().optional(),
  notes:          z.string().max(500).nullable().optional(),
  lines:          z.array(lineSchema).min(1, "At least one employee line is required"),
})

const SALARY_CODE      = "5100"
const TDS_PAYABLE_CODE = "2130"
const SSF_PAYABLE_CODE = "2140"

export interface RunPayrollResult {
  id:            string
  runNumber:     string
  voucherId:     string
  voucherNumber: string
  totalGross:    string
  totalTds:      string
  totalSsf:      string
  totalNet:      string
}

/**
 * Atomically:
 *  1) Allocate PR-FY-NNNN and RV/PV/CV/JV (PV here)
 *  2) Post the PV (Dr Salary, Cr TDS Payable, Cr SSF Payable, Cr Cash/Bank)
 *  3) Create PayrollRun + per-employee PayrollRunLine rows
 */
export async function runPayroll(input: z.infer<typeof runSchema>): Promise<RunPayrollResult> {
  const session = await requirePermission("payroll:manage")
  const schoolId = session.user.schoolId!
  const data = runSchema.parse(input)
  const dateAD = toAD(data.dateBS)

  // Resolve FY for the date
  const fy = await resolveFiscalYearForDate(schoolId, data.dateBS)
  if (!fy) throw new Error("No fiscal year covers this date")
  if (fy.status !== "OPEN") throw new Error("Fiscal year is not open for posting")

  // Resolve required GL accounts
  const [salary, tdsPay, ssfPay] = await Promise.all([
    prisma.account.findFirst({ where: { schoolId, code: SALARY_CODE,      isActive: true } }),
    prisma.account.findFirst({ where: { schoolId, code: TDS_PAYABLE_CODE, isActive: true } }),
    prisma.account.findFirst({ where: { schoolId, code: SSF_PAYABLE_CODE, isActive: true } }),
  ])
  if (!salary) throw new Error(`Account ${SALARY_CODE} (Salaries & Allowances) not found`)
  if (!tdsPay) throw new Error(`Account ${TDS_PAYABLE_CODE} (TDS Payable) not found`)
  if (!ssfPay) throw new Error(`Account ${SSF_PAYABLE_CODE} (SSF Payable) not found`)

  // Resolve source (Cash or specific Bank)
  let sourceAccountId: string
  let sourceBankAccountId: string | null = null
  if (data.paymentMethod === "CASH") {
    const cash = await prisma.account.findFirst({
      where: { schoolId, subType: "CASH", isActive: true }, orderBy: { code: "asc" },
    })
    if (!cash) throw new Error("No CASH account in Chart of Accounts")
    sourceAccountId = cash.id
  } else {
    if (!data.bankAccountId) throw new Error("Bank account required when paying via BANK")
    const bank = await prisma.bankAccount.findUnique({ where: { id: data.bankAccountId } })
    if (!bank || bank.schoolId !== schoolId) throw new Error("Invalid bank account")
    sourceAccountId = bank.accountId
    sourceBankAccountId = bank.id
  }

  // Aggregate totals from lines
  let totalGross = new D(0), totalTds = new D(0), totalSsf = new D(0)
  const computedLines = data.lines.map(l => {
    const g = new D(l.gross), t = new D(l.tds), s = new D(l.ssf)
    const n = g.minus(t).minus(s)
    if (n.lessThan(0)) throw new Error("Net cannot be negative — check TDS/SSF for an employee")
    totalGross = totalGross.add(g)
    totalTds   = totalTds.add(t)
    totalSsf   = totalSsf.add(s)
    return { ...l, grossD: g, tdsD: t, ssfD: s, netD: n }
  })
  const totalNet = totalGross.minus(totalTds).minus(totalSsf)
  if (totalGross.lessThanOrEqualTo(0)) throw new Error("Total gross must be > 0")

  // Verify employee IDs belong to school (and dedupe)
  const employeeIds = [...new Set(computedLines.map(l => l.employeeId))]
  if (employeeIds.length !== computedLines.length) throw new Error("Duplicate employee in lines")
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, schoolId },
    select: { id: true },
  })
  if (employees.length !== employeeIds.length) throw new Error("One or more employees not found in this school")

  const result = await prisma.$transaction(async (tx) => {
    // Allocate run number
    const rc = await tx.voucherCounter.upsert({
      where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: fy.id, type: "PR" } },
      create: { schoolId, fiscalYearId: fy.id, type: "PR", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const runNumber = `PR-${fy.name}-${String(rc.lastNumber).padStart(4, "0")}`

    // Allocate PV voucher number
    const vc = await tx.voucherCounter.upsert({
      where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: fy.id, type: "PV" } },
      create: { schoolId, fiscalYearId: fy.id, type: "PV", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const voucherNumber = `PV-${fy.name}-${String(vc.lastNumber).padStart(4, "0")}`

    // Build voucher lines
    const voucherLines: Prisma.JournalEntryCreateManyVoucherInput[] = [
      {
        schoolId, accountId: salary.id, lineNo: 1,
        debit: totalGross, credit: new D(0),
        narration: `Salaries — ${data.periodLabel}`,
      },
    ]
    let lineNo = 2
    if (totalTds.greaterThan(0)) {
      voucherLines.push({
        schoolId, accountId: tdsPay.id, lineNo: lineNo++,
        debit: new D(0), credit: totalTds,
        narration: "TDS withheld",
      })
    }
    if (totalSsf.greaterThan(0)) {
      voucherLines.push({
        schoolId, accountId: ssfPay.id, lineNo: lineNo++,
        debit: new D(0), credit: totalSsf,
        narration: "SSF withheld",
      })
    }
    voucherLines.push({
      schoolId, accountId: sourceAccountId, lineNo: lineNo++,
      debit: new D(0), credit: totalNet,
      narration: `Net paid via ${data.paymentMethod}`,
    })

    // Post the PV
    const voucher = await tx.voucher.create({
      data: {
        schoolId,
        fiscalYearId: fy.id,
        type:         "PV",
        number:       voucherNumber,
        dateBS:       data.dateBS,
        dateAD,
        narration:    data.notes?.trim() || `Salary payroll — ${data.periodLabel} (${runNumber})`,
        status:       "POSTED",
        partyType:    null,
        totalAmount:  totalGross,
        tdsBase:      totalTds.greaterThan(0) ? totalGross : null,
        tdsAmount:    totalTds.greaterThan(0) ? totalTds   : null,
        postedAt:     new Date(),
        postedById:   session.user.id,
        createdById:  session.user.id,
        lines:        { create: voucherLines },
      },
      select: { id: true, number: true },
    })

    // Create the PayrollRun + lines
    const run = await tx.payrollRun.create({
      data: {
        schoolId,
        runNumber,
        periodLabel:   data.periodLabel,
        dateBS:        data.dateBS,
        dateAD,
        status:        "POSTED",
        totalGross,
        totalTds,
        totalSsf,
        totalNet,
        voucherId:     voucher.id,
        bankAccountId: sourceBankAccountId,
        paymentMethod: data.paymentMethod,
        notes:         data.notes ?? null,
        createdById:   session.user.id,
        postedAt:      new Date(),
        postedById:    session.user.id,
        lines: {
          create: computedLines.map(l => ({
            employeeId: l.employeeId,
            gross:      l.grossD,
            tds:        l.tdsD,
            ssf:        l.ssfD,
            net:        l.netD,
            remarks:    l.remarks ?? null,
          })),
        },
      },
      select: { id: true, runNumber: true },
    })

    return {
      id:            run.id,
      runNumber:     run.runNumber,
      voucherId:     voucher.id,
      voucherNumber: voucher.number!,
      totalGross:    totalGross.toFixed(2),
      totalTds:      totalTds.toFixed(2),
      totalSsf:      totalSsf.toFixed(2),
      totalNet:      totalNet.toFixed(2),
    }
  })

  revalidatePath("/hr/payroll")
  revalidatePath("/accounting/vouchers")
  revalidatePath("/accounting/cash-book")
  revalidatePath("/accounting/bank-book")
  revalidatePath("/accounting/reports/trial-balance")
  return result
}

// ─── Queries ────────────────────────────────────────────────────────────────

export interface PayrollRunRow {
  id:            string
  runNumber:     string
  periodLabel:   string
  dateBS:        string
  status:        string
  totalGross:    string
  totalTds:      string
  totalSsf:      string
  totalNet:      string
  voucherId:     string | null
  voucherNumber: string | null
  employeeCount: number
}

export async function listPayrollRuns(): Promise<PayrollRunRow[]> {
  const session = await requirePermission("payroll:view")
  const rows = await prisma.payrollRun.findMany({
    where:   { schoolId: session.user.schoolId! },
    include: {
      voucher: { select: { id: true, number: true } },
      _count:  { select: { lines: true } },
    },
    orderBy: { dateAD: "desc" },
    take: 200,
  })
  return rows.map(r => ({
    id:            r.id,
    runNumber:     r.runNumber,
    periodLabel:   r.periodLabel,
    dateBS:        r.dateBS,
    status:        r.status,
    totalGross:    r.totalGross.toFixed(2),
    totalTds:      r.totalTds.toFixed(2),
    totalSsf:      r.totalSsf.toFixed(2),
    totalNet:      r.totalNet.toFixed(2),
    voucherId:     r.voucher?.id ?? null,
    voucherNumber: r.voucher?.number ?? null,
    employeeCount: r._count.lines,
  }))
}

export interface PayrollRunDetail {
  id:            string
  runNumber:     string
  periodLabel:   string
  dateBS:        string
  status:        string
  paymentMethod: string
  totalGross:    string
  totalTds:      string
  totalSsf:      string
  totalNet:      string
  notes:         string | null
  voucherId:     string | null
  voucherNumber: string | null
  bankName:      string | null
  lines: Array<{
    employeeId:  string
    employeeName: string
    panNumber:    string | null
    role:         string
    gross:        string
    tds:          string
    ssf:          string
    net:          string
    remarks:      string | null
  }>
}

export async function getPayrollRun(id: string): Promise<PayrollRunDetail | null> {
  const session = await requirePermission("payroll:view")
  const r = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      voucher:     { select: { id: true, number: true } },
      bankAccount: { select: { bankName: true } },
      lines: {
        include: {
          employee: {
            include: { user: { select: { fullName: true, role: true } } },
          },
        },
      },
    },
  })
  if (!r || r.schoolId !== session.user.schoolId) return null
  return {
    id:            r.id,
    runNumber:     r.runNumber,
    periodLabel:   r.periodLabel,
    dateBS:        r.dateBS,
    status:        r.status,
    paymentMethod: r.paymentMethod,
    totalGross:    r.totalGross.toFixed(2),
    totalTds:      r.totalTds.toFixed(2),
    totalSsf:      r.totalSsf.toFixed(2),
    totalNet:      r.totalNet.toFixed(2),
    notes:         r.notes,
    voucherId:     r.voucher?.id ?? null,
    voucherNumber: r.voucher?.number ?? null,
    bankName:      r.bankAccount?.bankName ?? null,
    lines: r.lines.map(l => ({
      employeeId:   l.employeeId,
      employeeName: l.employee.user.fullName,
      panNumber:    l.employee.panNumber,
      role:         l.employee.user.role,
      gross:        l.gross.toFixed(2),
      tds:          l.tds.toFixed(2),
      ssf:          l.ssf.toFixed(2),
      net:          l.net.toFixed(2),
      remarks:      l.remarks,
    })),
  }
}

/** Active employees with their default salary, for the run form. */
export async function getPayrollRoster(): Promise<Array<{
  employeeId:   string
  name:         string
  role:         string
  panNumber:    string | null
  baseSalary:   string
  tdsPercent:   string
  ssfEnabled:   boolean
}>> {
  const session = await requirePermission("payroll:view")
  const employees = await prisma.employee.findMany({
    where: { schoolId: session.user.schoolId! },
    include: {
      user:    { select: { fullName: true, role: true } },
      payroll: { select: { baseSalary: true, tdsPercentage: true, ssfEnabled: true } },
    },
    orderBy: { user: { fullName: "asc" } },
  })
  return employees.map(e => ({
    employeeId: e.id,
    name:       e.user.fullName,
    role:       e.user.role,
    panNumber:  e.panNumber,
    baseSalary: (e.payroll?.baseSalary ?? 0).toFixed(2),
    tdsPercent: (e.payroll?.tdsPercentage ?? 0).toFixed(2),
    ssfEnabled: e.payroll?.ssfEnabled ?? false,
  }))
}
