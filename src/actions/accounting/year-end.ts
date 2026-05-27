"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

const D = Prisma.Decimal
const ZERO = new D(0)

const CAPITAL_FUND_SURPLUS_CODE = "3200" // Current Year Surplus / (Deficit)

// ─── Preview ───────────────────────────────────────────────────────────────

export interface ClosingLine {
  accountId: string
  code:      string
  name:      string
  type:      string
  debit:     string
  credit:    string
}

export interface OpeningRollForward {
  accountId: string
  code:      string
  name:      string
  type:      string
  debit:     string
  credit:    string
}

export interface YearEndPreview {
  fiscalYearId:    string
  fiscalYearName:  string
  status:          string

  /** The closing-JV lines that will be created when executing. */
  closingLines:    ClosingLine[]
  /** Surplus (positive) or deficit (negative) for the FY. */
  surplusSigned:   string
  isSurplus:       boolean
  closingTotalDr:  string
  closingTotalCr:  string

  /** Asset / Liability / Capital Fund balances that will roll forward. */
  rollForward:     OpeningRollForward[]
  rollForwardTotalDr: string
  rollForwardTotalCr: string

  /** Outstanding Accounts Receivable from unpaid StudentFee rows in THIS FY. */
  arOutstanding:      string
  arUnpaidRowCount:   number

  /** The next FY (if it exists). */
  nextFiscalYearId:   string | null
  nextFiscalYearName: string | null

  /** Will the 3200 account exist for the surplus transfer? */
  capitalFundAccountId: string | null
}

export async function previewYearEndClose(fiscalYearId: string): Promise<YearEndPreview> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")

  const [accounts, openings, jeAgg, nextFy, surplusAcc] = await Promise.all([
    prisma.account.findMany({
      where:  { schoolId, isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.openingBalance.findMany({ where: { schoolId, fiscalYearId } }),
    prisma.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        schoolId,
        voucher: { fiscalYearId, status: { in: ["POSTED", "REVERSED"] } },
      },
      _sum: { debit: true, credit: true },
    }),
    // Resolve the next FY — the one starting right after this FY's endAD
    prisma.fiscalYear.findFirst({
      where: { schoolId, startAD: { gt: fy.endAD } },
      orderBy: { startAD: "asc" },
    }),
    prisma.account.findFirst({ where: { schoolId, code: CAPITAL_FUND_SURPLUS_CODE, isActive: true } }),
  ])

  const opMap = new Map(openings.map(o => [o.accountId, { dr: o.debit, cr: o.credit }]))
  const acMap = new Map(jeAgg.map(g => [g.accountId, { dr: g._sum.debit ?? ZERO, cr: g._sum.credit ?? ZERO }]))

  // Closing JV: Dr each Income, Cr each Expense, balancing line to Capital Fund.
  const closingLines: ClosingLine[] = []
  let closeDr = ZERO, closeCr = ZERO
  let totalIncome = ZERO, totalExpense = ZERO

  for (const acc of accounts) {
    const op = opMap.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    const ac = acMap.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    const net = op.dr.add(ac.dr).minus(op.cr).minus(ac.cr) // signed: + = Dr

    if (acc.type === "INCOME") {
      // Income natural balance is Cr — net should be < 0. We Dr it by the absolute amount.
      const cr = net.neg()
      if (cr.greaterThan(0)) {
        closingLines.push({
          accountId: acc.id, code: acc.code, name: acc.name, type: acc.type,
          debit: cr.toFixed(2), credit: "0.00",
        })
        closeDr = closeDr.add(cr)
        totalIncome = totalIncome.add(cr)
      }
    } else if (acc.type === "EXPENSE") {
      // Expense natural balance is Dr — net should be > 0. We Cr it by that amount.
      const dr = net
      if (dr.greaterThan(0)) {
        closingLines.push({
          accountId: acc.id, code: acc.code, name: acc.name, type: acc.type,
          debit: "0.00", credit: dr.toFixed(2),
        })
        closeCr = closeCr.add(dr)
        totalExpense = totalExpense.add(dr)
      }
    }
  }

  const surplusSigned = totalIncome.minus(totalExpense)
  // Balancing line: Capital Fund (3200) takes the surplus/deficit
  if (!surplusSigned.equals(0) && surplusAcc) {
    if (surplusSigned.greaterThan(0)) {
      // Surplus → Cr 3200
      closingLines.push({
        accountId: surplusAcc.id, code: surplusAcc.code, name: surplusAcc.name, type: "EQUITY",
        debit: "0.00", credit: surplusSigned.toFixed(2),
      })
      closeCr = closeCr.add(surplusSigned)
    } else {
      // Deficit → Dr 3200
      const absDef = surplusSigned.neg()
      closingLines.push({
        accountId: surplusAcc.id, code: surplusAcc.code, name: surplusAcc.name, type: "EQUITY",
        debit: absDef.toFixed(2), credit: "0.00",
      })
      closeDr = closeDr.add(absDef)
    }
  }

  // Roll-forward opening balances for next FY:
  // For each Asset/Liability/Equity account, carry over its net balance.
  // After the closing JV is posted, 3200 (Capital Fund Surplus) will already reflect the surplus,
  // so we need to compute the post-closing balance for accuracy.
  const rollForward: OpeningRollForward[] = []
  let rfDr = ZERO, rfCr = ZERO
  for (const acc of accounts) {
    if (acc.type !== "ASSET" && acc.type !== "LIABILITY" && acc.type !== "EQUITY") continue
    const op = opMap.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    const ac = acMap.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    let net = op.dr.add(ac.dr).minus(op.cr).minus(ac.cr) // signed

    // Apply the closing JV's effect to the Capital Fund surplus account
    if (acc.id === surplusAcc?.id && !surplusSigned.equals(0)) {
      // Cr to 3200 if surplus, Dr if deficit. net is current (signed); apply delta:
      net = net.minus(surplusSigned) // because Cr increases liability/equity → net (Dr-Cr) decreases
    }

    if (net.equals(0)) continue

    if (acc.type === "ASSET") {
      // Asset natural Dr — net > 0 means a Dr balance to carry
      rollForward.push({
        accountId: acc.id, code: acc.code, name: acc.name, type: acc.type,
        debit: net.greaterThan(0) ? net.toFixed(2) : "0.00",
        credit: net.lessThan(0)  ? net.neg().toFixed(2) : "0.00",
      })
      if (net.greaterThan(0)) rfDr = rfDr.add(net); else rfCr = rfCr.add(net.neg())
    } else {
      // Liability / Equity natural Cr — flip sign
      const cr = net.neg()
      rollForward.push({
        accountId: acc.id, code: acc.code, name: acc.name, type: acc.type,
        debit: cr.lessThan(0) ? cr.neg().toFixed(2) : "0.00",
        credit: cr.greaterThan(0) ? cr.toFixed(2) : "0.00",
      })
      if (cr.greaterThan(0)) rfCr = rfCr.add(cr); else rfDr = rfDr.add(cr.neg())
    }
  }

  // AR outstanding from the StudentFee data side. We use this as a warning,
  // not a hard gate — the AR balance carries forward as a balance-sheet
  // account regardless, but the school should know it's there before closing.
  const arAgg = await prisma.studentFee.aggregate({
    // AR = issued-but-unpaid only (BILLED/PARTIAL). PLANNED isn't a receivable.
    where: { schoolId, fiscalYearId: fy.id, status: { in: ["BILLED", "PARTIAL"] } },
    _sum:  { finalAmount: true, paidAmount: true },
    _count: true,
  })
  const arOutstanding = (arAgg._sum.finalAmount ?? ZERO).minus(arAgg._sum.paidAmount ?? ZERO)

  return {
    fiscalYearId:    fy.id,
    fiscalYearName:  fy.name,
    status:          fy.status,
    closingLines,
    surplusSigned:   surplusSigned.abs().toFixed(2),
    isSurplus:       surplusSigned.greaterThanOrEqualTo(0),
    closingTotalDr:  closeDr.toFixed(2),
    closingTotalCr:  closeCr.toFixed(2),
    rollForward,
    rollForwardTotalDr: rfDr.toFixed(2),
    rollForwardTotalCr: rfCr.toFixed(2),
    arOutstanding:      arOutstanding.lessThan(0) ? "0.00" : arOutstanding.toFixed(2),
    arUnpaidRowCount:   arAgg._count,
    nextFiscalYearId:   nextFy?.id ?? null,
    nextFiscalYearName: nextFy?.name ?? null,
    capitalFundAccountId: surplusAcc?.id ?? null,
  }
}

// ─── Execute ───────────────────────────────────────────────────────────────

export interface YearEndExecuteResult {
  closingVoucherId:     string
  closingVoucherNumber: string
  surplus:              string
  isSurplus:            boolean
  openingBalancesWritten: number
}

export async function executeYearEndClose(fiscalYearId: string): Promise<YearEndExecuteResult> {
  const session = await requirePermission("finance:manage")
  const schoolId = session.user.schoolId!

  // Re-compute the preview inside the action (cheap, ensures consistency)
  const preview = await previewYearEndClose(fiscalYearId)

  if (preview.status !== "OPEN") throw new Error(`Fiscal year is already ${preview.status}`)
  if (!preview.nextFiscalYearId) throw new Error("Create the next fiscal year before closing this one")
  if (preview.closingLines.length === 0 && preview.rollForward.length === 0) {
    throw new Error("Nothing to close — no income, expense, or balance carry-forward.")
  }
  if (preview.surplusSigned !== "0.00" && !preview.capitalFundAccountId) {
    throw new Error(`Capital Fund Surplus account (${CAPITAL_FUND_SURPLUS_CODE}) is required but missing`)
  }

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")

  return prisma.$transaction(async (tx) => {
    // Allocate closing JV number
    const vc = await tx.voucherCounter.upsert({
      where:  { schoolId_fiscalYearId_type: { schoolId, fiscalYearId: fy.id, type: "JV" } },
      create: { schoolId, fiscalYearId: fy.id, type: "JV", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const voucherNumber = `JV-${fy.name}-${String(vc.lastNumber).padStart(4, "0")}`

    // Sum totals from preview lines (already string-formatted)
    let total = ZERO
    for (const l of preview.closingLines) total = total.add(new D(l.debit))

    // Post the closing JV — dated on fy.endAD/fy.endBS
    const voucher = await tx.voucher.create({
      data: {
        schoolId,
        fiscalYearId: fy.id,
        type:         "JV",
        number:       voucherNumber,
        dateBS:       fy.endBS,
        dateAD:       fy.endAD,
        narration:    `Year-end closing entry — FY ${fy.name}. ${preview.isSurplus ? "Surplus" : "Deficit"} Rs. ${preview.surplusSigned} transferred to Capital Fund.`,
        status:       "POSTED",
        totalAmount:  total,
        postedAt:     new Date(),
        postedById:   session.user.id,
        createdById:  session.user.id,
        lines: {
          create: preview.closingLines.map((l, i) => ({
            schoolId,
            accountId: l.accountId,
            lineNo:    i + 1,
            debit:     new D(l.debit),
            credit:    new D(l.credit),
            narration: l.type === "EQUITY"
              ? (preview.isSurplus ? "Net surplus" : "Net deficit")
              : `Close ${l.code} · ${l.name}`,
          })),
        },
      },
      select: { id: true, number: true },
    })

    // Write OpeningBalance rows for the next FY (skip rows already present)
    let written = 0
    for (const r of preview.rollForward) {
      await tx.openingBalance.upsert({
        where: {
          schoolId_fiscalYearId_accountId: {
            schoolId,
            fiscalYearId: preview.nextFiscalYearId!,
            accountId:    r.accountId,
          },
        },
        create: {
          schoolId,
          fiscalYearId: preview.nextFiscalYearId!,
          accountId:    r.accountId,
          debit:        new D(r.debit),
          credit:       new D(r.credit),
        },
        update: {
          debit:  new D(r.debit),
          credit: new D(r.credit),
        },
      })
      written++
    }

    // Mark FY as CLOSED
    await tx.fiscalYear.update({ where: { id: fy.id }, data: { status: "CLOSED" } })

    // Audit log
    await tx.auditLog.create({
      data: {
        schoolId,
        userId:   session.user.id,
        entity:   "FiscalYear",
        entityId: fy.id,
        action:   "CLOSE_FY",
        after: {
          closingVoucherNumber: voucher.number,
          surplus:              preview.surplusSigned,
          isSurplus:            preview.isSurplus,
          openingBalancesWritten: written,
          nextFiscalYearId:     preview.nextFiscalYearId,
        } as Prisma.InputJsonValue,
      },
    })

    return {
      closingVoucherId:       voucher.id,
      closingVoucherNumber:   voucher.number!,
      surplus:                preview.surplusSigned,
      isSurplus:              preview.isSurplus,
      openingBalancesWritten: written,
    }
  }).then((res) => {
    revalidatePath("/accounting")
    revalidatePath("/accounting/fiscal-years")
    revalidatePath("/accounting/vouchers")
    revalidatePath("/accounting/reports/trial-balance")
    revalidatePath("/accounting/reports/balance-sheet")
    revalidatePath("/accounting/reports/income-expenditure")
    return res
  })
}
