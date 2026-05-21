"use server"

import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { toAD } from "@/lib/nepali-date"

const D = Prisma.Decimal
const ZERO = new D(0)

export interface TrialBalanceRow {
  accountId:  string
  code:       string
  name:       string
  type:       string
  debit:      string   // formatted Decimal string
  credit:     string
}

export interface TrialBalance {
  fiscalYearId: string
  asOfBS:       string
  rows:         TrialBalanceRow[]
  totalDebit:   string
  totalCredit:  string
  balanced:     boolean
}

/**
 * Trial Balance as of a BS date (inclusive). Combines OpeningBalance with
 * posted journal-entry activity. Returns net Dr/Cr per account.
 */
export async function getTrialBalance(fiscalYearId: string, asOfBS?: string): Promise<TrialBalance> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")

  const dateCutoff = asOfBS ? toAD(asOfBS) : fy.endAD

  const [accounts, openings, jeAgg] = await Promise.all([
    prisma.account.findMany({
      where:  { schoolId },
      orderBy: { code: "asc" },
    }),
    prisma.openingBalance.findMany({
      where: { schoolId, fiscalYearId },
    }),
    prisma.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        schoolId,
        voucher: {
          fiscalYearId,
          status:  { in: ["POSTED", "REVERSED"] },
          dateAD:  { lte: dateCutoff },
        },
      },
      _sum: { debit: true, credit: true },
    }),
  ])

  const openingByAcc = new Map(openings.map(o => [o.accountId, { dr: o.debit, cr: o.credit }]))
  const activityByAcc = new Map(jeAgg.map(g => [
    g.accountId,
    { dr: g._sum.debit ?? ZERO, cr: g._sum.credit ?? ZERO },
  ]))

  const rows: TrialBalanceRow[] = []
  let totalDr = ZERO, totalCr = ZERO

  for (const acc of accounts) {
    const op = openingByAcc.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    const ac = activityByAcc.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    const dr = op.dr.add(ac.dr)
    const cr = op.cr.add(ac.cr)
    if (dr.equals(0) && cr.equals(0)) continue

    // Net: keep the larger side, zero the smaller — typical Nepali TB presentation
    const net = dr.minus(cr)
    const netDr = net.greaterThan(0) ? net      : ZERO
    const netCr = net.lessThan(0)    ? net.neg() : ZERO

    rows.push({
      accountId: acc.id,
      code:      acc.code,
      name:      acc.name,
      type:      acc.type,
      debit:     netDr.toFixed(2),
      credit:    netCr.toFixed(2),
    })
    totalDr = totalDr.add(netDr)
    totalCr = totalCr.add(netCr)
  }

  return {
    fiscalYearId,
    asOfBS:      asOfBS ?? fy.endBS,
    rows,
    totalDebit:  totalDr.toFixed(2),
    totalCredit: totalCr.toFixed(2),
    balanced:    totalDr.equals(totalCr),
  }
}

export interface LedgerRow {
  date:    Date
  dateBS:  string
  voucherId:     string
  voucherNumber: string | null
  voucherType:   string
  narration:     string
  debit:         string
  credit:        string
  running:       string
}

export interface AccountLedger {
  accountId: string
  code:      string
  name:      string
  type:      string
  openingDebit:  string
  openingCredit: string
  rows:          LedgerRow[]
  closingBalance: string  // signed: positive = Dr balance
}

export async function getAccountLedger(
  accountId: string,
  fiscalYearId: string,
  fromBS?: string,
  toBS?:   string,
): Promise<AccountLedger> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const acc = await prisma.account.findUnique({ where: { id: accountId } })
  if (!acc || acc.schoolId !== schoolId) throw new Error("Account not found")

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")

  const fromAD = fromBS ? toAD(fromBS) : fy.startAD
  const toADate = toBS   ? toAD(toBS)   : fy.endAD

  const [opening, lines] = await Promise.all([
    prisma.openingBalance.findUnique({
      where: { schoolId_fiscalYearId_accountId: { schoolId, fiscalYearId, accountId } },
    }),
    prisma.journalEntry.findMany({
      where: {
        schoolId,
        accountId,
        voucher: {
          fiscalYearId,
          status: { in: ["POSTED", "REVERSED"] },
          dateAD: { gte: fromAD, lte: toADate },
        },
      },
      include: { voucher: { select: { id: true, number: true, type: true, dateAD: true, dateBS: true, narration: true } } },
      orderBy: [{ voucher: { dateAD: "asc" } }, { voucher: { createdAt: "asc" } }, { lineNo: "asc" }],
    }),
  ])

  const openingDr = opening?.debit  ?? ZERO
  const openingCr = opening?.credit ?? ZERO
  let running = openingDr.minus(openingCr)

  const rows: LedgerRow[] = lines.map(l => {
    running = running.add(l.debit).minus(l.credit)
    return {
      date:          l.voucher.dateAD,
      dateBS:        l.voucher.dateBS,
      voucherId:     l.voucher.id,
      voucherNumber: l.voucher.number,
      voucherType:   l.voucher.type,
      narration:     l.voucher.narration,
      debit:         l.debit.toFixed(2),
      credit:        l.credit.toFixed(2),
      running:       running.toFixed(2),
    }
  })

  return {
    accountId,
    code:           acc.code,
    name:           acc.name,
    type:           acc.type,
    openingDebit:   openingDr.toFixed(2),
    openingCredit:  openingCr.toFixed(2),
    rows,
    closingBalance: running.toFixed(2),
  }
}

export interface DayBookEntry {
  voucherId:     string
  voucherNumber: string | null
  voucherType:   string
  narration:     string
  partyName:     string | null
  status:        string
  lines: {
    accountCode: string
    accountName: string
    debit:       string
    credit:      string
  }[]
  totalDebit:  string
  totalCredit: string
}

export async function getDayBook(fiscalYearId: string, dateBS: string): Promise<DayBookEntry[]> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const vouchers = await prisma.voucher.findMany({
    where: {
      schoolId,
      fiscalYearId,
      dateBS,
      status: { in: ["POSTED", "REVERSED"] },
    },
    include: {
      lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } },
    },
    orderBy: [{ type: "asc" }, { number: "asc" }],
  })

  return vouchers.map(v => {
    let dr = ZERO, cr = ZERO
    const lines = v.lines.map(l => {
      dr = dr.add(l.debit); cr = cr.add(l.credit)
      return {
        accountCode: l.account.code,
        accountName: l.account.name,
        debit:       l.debit.toFixed(2),
        credit:      l.credit.toFixed(2),
      }
    })
    return {
      voucherId:     v.id,
      voucherNumber: v.number,
      voucherType:   v.type,
      narration:     v.narration,
      partyName:     v.partyName,
      status:        v.status,
      lines,
      totalDebit:    dr.toFixed(2),
      totalCredit:   cr.toFixed(2),
    }
  })
}

/** Lightweight dashboard summary: current FY snapshot. */
export async function getAccountingSnapshot() {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const fy = await prisma.fiscalYear.findFirst({ where: { schoolId, isCurrent: true } })
  if (!fy) return null

  const [voucherCounts, recent, tb, ie] = await Promise.all([
    prisma.voucher.groupBy({
      by: ["type", "status"],
      where: { schoolId, fiscalYearId: fy.id },
      _count: true,
    }),
    prisma.voucher.findMany({
      where: { schoolId, fiscalYearId: fy.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, number: true, dateBS: true, narration: true, status: true, totalAmount: true },
    }),
    getTrialBalance(fy.id, fy.endBS).catch(() => null),
    getIncomeExpenditure(fy.id, fy.endBS).catch(() => null),
  ])

  return {
    fiscalYear: {
      id:      fy.id,
      name:    fy.name,
      status:  fy.status,
      startBS: fy.startBS,
      endBS:   fy.endBS,
    },
    voucherCounts: voucherCounts.map(g => ({
      type:   g.type,
      status: g.status,
      count:  typeof g._count === "number" ? g._count : 0,
    })),
    recent: recent.map(r => ({
      id:          r.id,
      type:        r.type,
      number:      r.number,
      dateBS:      r.dateBS,
      narration:   r.narration,
      status:      r.status,
      totalAmount: r.totalAmount.toFixed(2),
    })),
    trialBalance: tb
      ? { totalDebit: tb.totalDebit, totalCredit: tb.totalCredit, balanced: tb.balanced }
      : null,
    ieSummary: ie
      ? {
          totalIncome:      ie.totalIncome,
          totalExpense:     ie.totalExpense,
          surplusOrDeficit: ie.surplusOrDeficit,
          isSurplus:        ie.isSurplus,
          topExpenses: [...ie.expense]
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
            .slice(0, 5)
            .map(e => ({ name: e.name, code: e.code, amount: e.amount })),
          topIncome: [...ie.income]
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
            .slice(0, 5)
            .map(e => ({ name: e.name, code: e.code, amount: e.amount })),
        }
      : null,
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  PHASE B — Cash Book, Bank Book, Income & Expenditure, R&P, Balance Sheet
// ════════════════════════════════════════════════════════════════════════════

export interface BookRow {
  dateBS:        string
  dateAD:        Date
  voucherId:     string
  voucherNumber: string | null
  voucherType:   string
  narration:     string
  receipt:       string   // Dr to the book account
  payment:       string   // Cr to the book account
  balance:       string   // running
}

export interface CashBookResult {
  fiscalYearId:   string
  fromBS:         string
  toBS:           string
  accountId:      string
  accountName:    string
  accountCode:    string
  openingBalance: string
  closingBalance: string
  totalReceipts:  string
  totalPayments:  string
  rows:           BookRow[]
}

async function buildBookFor(
  accountId: string,
  schoolId: string,
  fiscalYearId: string,
  fromBS?: string,
  toBS?: string,
): Promise<CashBookResult> {
  const acc = await prisma.account.findUnique({ where: { id: accountId } })
  if (!acc || acc.schoolId !== schoolId) throw new Error("Account not found")

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")

  const fromAD = fromBS ? toAD(fromBS) : fy.startAD
  const toADate = toBS ? toAD(toBS) : fy.endAD

  // Opening = opening balance (book entry) + all postings BEFORE fromAD
  const [opening, priorActivity, periodLines] = await Promise.all([
    prisma.openingBalance.findUnique({
      where: { schoolId_fiscalYearId_accountId: { schoolId, fiscalYearId, accountId } },
    }),
    prisma.journalEntry.aggregate({
      where: {
        schoolId,
        accountId,
        voucher: { fiscalYearId, status: { in: ["POSTED", "REVERSED"] }, dateAD: { lt: fromAD } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntry.findMany({
      where: {
        schoolId,
        accountId,
        voucher: { fiscalYearId, status: { in: ["POSTED", "REVERSED"] }, dateAD: { gte: fromAD, lte: toADate } },
      },
      include: {
        voucher: { select: { id: true, number: true, type: true, dateAD: true, dateBS: true, narration: true } },
      },
      orderBy: [{ voucher: { dateAD: "asc" } }, { voucher: { createdAt: "asc" } }, { lineNo: "asc" }],
    }),
  ])

  const openingDr = (opening?.debit ?? ZERO).add(priorActivity._sum.debit ?? ZERO)
  const openingCr = (opening?.credit ?? ZERO).add(priorActivity._sum.credit ?? ZERO)
  let running = openingDr.minus(openingCr)

  let totalReceipts = ZERO
  let totalPayments = ZERO

  const rows: BookRow[] = periodLines.map(l => {
    totalReceipts = totalReceipts.add(l.debit)
    totalPayments = totalPayments.add(l.credit)
    running = running.add(l.debit).minus(l.credit)
    return {
      dateBS:        l.voucher.dateBS,
      dateAD:        l.voucher.dateAD,
      voucherId:     l.voucher.id,
      voucherNumber: l.voucher.number,
      voucherType:   l.voucher.type,
      narration:     l.voucher.narration,
      receipt:       l.debit.toFixed(2),
      payment:       l.credit.toFixed(2),
      balance:       running.toFixed(2),
    }
  })

  return {
    fiscalYearId,
    fromBS:         fromBS ?? fy.startBS,
    toBS:           toBS   ?? fy.endBS,
    accountId,
    accountName:    acc.name,
    accountCode:    acc.code,
    openingBalance: openingDr.minus(openingCr).toFixed(2),
    closingBalance: running.toFixed(2),
    totalReceipts:  totalReceipts.toFixed(2),
    totalPayments:  totalPayments.toFixed(2),
    rows,
  }
}

/** Cash Book — date-wise receipts/payments for the Cash account (subType=CASH). */
export async function getCashBook(fiscalYearId: string, fromBS?: string, toBS?: string): Promise<CashBookResult> {
  const session = await requirePermission("finance:view")
  const cash = await prisma.account.findFirst({
    where: { schoolId: session.user.schoolId!, subType: "CASH", isActive: true },
    orderBy: { code: "asc" },
  })
  if (!cash) throw new Error("No Cash account (subType=CASH) found in Chart of Accounts")
  return buildBookFor(cash.id, session.user.schoolId!, fiscalYearId, fromBS, toBS)
}

/** Bank Book — for a specific bank account, or the first Bank account if none specified. */
export async function getBankBook(fiscalYearId: string, fromBS?: string, toBS?: string, accountId?: string): Promise<CashBookResult> {
  const session = await requirePermission("finance:view")
  let bankId = accountId
  if (!bankId) {
    const bank = await prisma.account.findFirst({
      where: { schoolId: session.user.schoolId!, subType: "BANK", isActive: true },
      orderBy: { code: "asc" },
    })
    if (!bank) throw new Error("No Bank account (subType=BANK) found in Chart of Accounts")
    bankId = bank.id
  }
  return buildBookFor(bankId, session.user.schoolId!, fiscalYearId, fromBS, toBS)
}

/** List of all Bank-subtype accounts, so callers can switch between them. */
export async function listBankAccounts() {
  const session = await requirePermission("finance:view")
  return prisma.account.findMany({
    where:   { schoolId: session.user.schoolId!, subType: "BANK", isActive: true },
    select:  { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  })
}

// ─── Income & Expenditure (NPO P&L) ────────────────────────────────────────

export interface IELine { accountId: string; code: string; name: string; amount: string }

export interface IncomeExpenditureResult {
  fiscalYearId:       string
  asOfBS:             string
  income:             IELine[]
  expense:            IELine[]
  totalIncome:        string
  totalExpense:       string
  surplusOrDeficit:   string   // positive = surplus
  isSurplus:          boolean
}

export async function getIncomeExpenditure(fiscalYearId: string, asOfBS?: string): Promise<IncomeExpenditureResult> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")
  const cutoff = asOfBS ? toAD(asOfBS) : fy.endAD

  const [accounts, agg] = await Promise.all([
    prisma.account.findMany({
      where:   { schoolId, type: { in: ["INCOME", "EXPENSE"] }, isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        schoolId,
        voucher: { fiscalYearId, status: { in: ["POSTED", "REVERSED"] }, dateAD: { lte: cutoff } },
      },
      _sum: { debit: true, credit: true },
    }),
  ])

  const sums = new Map(agg.map(g => [g.accountId, { dr: g._sum.debit ?? ZERO, cr: g._sum.credit ?? ZERO }]))

  const income: IELine[] = []
  const expense: IELine[] = []
  let totalI = ZERO, totalE = ZERO

  for (const acc of accounts) {
    const s = sums.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    if (acc.type === "INCOME") {
      const amt = s.cr.minus(s.dr)  // income natural credit
      if (!amt.equals(0)) {
        income.push({ accountId: acc.id, code: acc.code, name: acc.name, amount: amt.toFixed(2) })
        totalI = totalI.add(amt)
      }
    } else {
      const amt = s.dr.minus(s.cr)  // expense natural debit
      if (!amt.equals(0)) {
        expense.push({ accountId: acc.id, code: acc.code, name: acc.name, amount: amt.toFixed(2) })
        totalE = totalE.add(amt)
      }
    }
  }

  const sod = totalI.minus(totalE)
  return {
    fiscalYearId,
    asOfBS:           asOfBS ?? fy.endBS,
    income,
    expense,
    totalIncome:      totalI.toFixed(2),
    totalExpense:     totalE.toFixed(2),
    surplusOrDeficit: sod.abs().toFixed(2),
    isSurplus:        sod.greaterThanOrEqualTo(0),
  }
}

// ─── Receipts & Payments (cash-basis NPO statement) ────────────────────────

export interface RPLine { code: string; name: string; amount: string }

export interface ReceiptsPaymentsResult {
  fiscalYearId: string
  fromBS:       string
  toBS:         string
  openingCash:  string
  openingBank:  string
  receipts:     RPLine[]
  payments:     RPLine[]
  closingCash:  string
  closingBank:  string
  totalReceiptsSide: string  // openingCash+openingBank + Σ receipts
  totalPaymentsSide: string  // Σ payments + closingCash + closingBank
}

export async function getReceiptsPayments(fiscalYearId: string, fromBS?: string, toBS?: string): Promise<ReceiptsPaymentsResult> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")

  const fromAD = fromBS ? toAD(fromBS) : fy.startAD
  const toADate = toBS ? toAD(toBS) : fy.endAD

  // Helper: balance of an account = opening + (sum debits - sum credits) up to a date
  async function balanceAt(accountIds: string[], at: Date): Promise<Map<string, Prisma.Decimal>> {
    const [openings, postings] = await Promise.all([
      prisma.openingBalance.findMany({
        where: { schoolId, fiscalYearId, accountId: { in: accountIds } },
      }),
      prisma.journalEntry.groupBy({
        by: ["accountId"],
        where: {
          schoolId,
          accountId: { in: accountIds },
          voucher:   { fiscalYearId, status: { in: ["POSTED", "REVERSED"] }, dateAD: { lt: at } },
        },
        _sum: { debit: true, credit: true },
      }),
    ])
    const map = new Map<string, Prisma.Decimal>()
    for (const o of openings) map.set(o.accountId, (map.get(o.accountId) ?? ZERO).add(o.debit).minus(o.credit))
    for (const p of postings) {
      const delta = (p._sum.debit ?? ZERO).minus(p._sum.credit ?? ZERO)
      map.set(p.accountId, (map.get(p.accountId) ?? ZERO).add(delta))
    }
    return map
  }

  const [cashAccts, bankAccts] = await Promise.all([
    prisma.account.findMany({ where: { schoolId, subType: "CASH", isActive: true } }),
    prisma.account.findMany({ where: { schoolId, subType: "BANK", isActive: true } }),
  ])
  const cashIds = cashAccts.map(a => a.id)
  const bankIds = bankAccts.map(a => a.id)
  const cashBankIds = new Set([...cashIds, ...bankIds])

  // Opening balances at fromAD
  const openingMap = await balanceAt([...cashIds, ...bankIds], fromAD)
  const openingCash = cashIds.reduce<Prisma.Decimal>((a, id) => a.add(openingMap.get(id) ?? ZERO), ZERO)
  const openingBank = bankIds.reduce<Prisma.Decimal>((a, id) => a.add(openingMap.get(id) ?? ZERO), ZERO)

  // Pull all postings in the period; walk per voucher to classify as receipt/payment
  const rows = await prisma.journalEntry.findMany({
    where: {
      schoolId,
      voucher: { fiscalYearId, status: { in: ["POSTED", "REVERSED"] }, dateAD: { gte: fromAD, lte: toADate } },
    },
    include: { account: true },
  })

  const byVoucher = new Map<string, typeof rows>()
  for (const r of rows) {
    const arr = byVoucher.get(r.voucherId) ?? []
    arr.push(r)
    byVoucher.set(r.voucherId, arr)
  }

  // accountId → { code, name, amount }
  const receipts = new Map<string, { code: string; name: string; amount: Prisma.Decimal }>()
  const payments = new Map<string, { code: string; name: string; amount: Prisma.Decimal }>()

  for (const lines of byVoucher.values()) {
    const cbLines = lines.filter(l => cashBankIds.has(l.accountId))
    if (cbLines.length === 0) continue
    const delta = cbLines.reduce<Prisma.Decimal>((a, l) => a.add(l.debit).minus(l.credit), ZERO)
    if (delta.greaterThan(0)) {
      // Receipt: contra credit lines are the income / source of cash
      for (const l of lines) {
        if (cashBankIds.has(l.accountId)) continue
        if (l.credit.greaterThan(0)) {
          const cur = receipts.get(l.accountId) ?? { code: l.account.code, name: l.account.name, amount: ZERO }
          cur.amount = cur.amount.add(l.credit)
          receipts.set(l.accountId, cur)
        }
      }
    } else if (delta.lessThan(0)) {
      // Payment: contra debit lines are the expense / destination of cash
      for (const l of lines) {
        if (cashBankIds.has(l.accountId)) continue
        if (l.debit.greaterThan(0)) {
          const cur = payments.get(l.accountId) ?? { code: l.account.code, name: l.account.name, amount: ZERO }
          cur.amount = cur.amount.add(l.debit)
          payments.set(l.accountId, cur)
        }
      }
    }
  }

  // Closing = opening + period net (computed similarly to balanceAt but for the period)
  const closingMap = await balanceAt([...cashIds, ...bankIds], new Date(toADate.getTime() + 86_400_000))  // +1 day to include
  const closingCash = cashIds.reduce<Prisma.Decimal>((a, id) => a.add(closingMap.get(id) ?? ZERO), ZERO)
  const closingBank = bankIds.reduce<Prisma.Decimal>((a, id) => a.add(closingMap.get(id) ?? ZERO), ZERO)

  const receiptsList: RPLine[] = [...receipts.entries()]
    .map(([, v]) => ({ code: v.code, name: v.name, amount: v.amount.toFixed(2) }))
    .sort((a, b) => a.code.localeCompare(b.code))
  const paymentsList: RPLine[] = [...payments.entries()]
    .map(([, v]) => ({ code: v.code, name: v.name, amount: v.amount.toFixed(2) }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const totalReceiptsAmount = receiptsList.reduce((a, r) => a + parseFloat(r.amount), 0)
  const totalPaymentsAmount = paymentsList.reduce((a, r) => a + parseFloat(r.amount), 0)

  const leftTotal  = openingCash.toNumber() + openingBank.toNumber() + totalReceiptsAmount
  const rightTotal = totalPaymentsAmount + closingCash.toNumber() + closingBank.toNumber()

  return {
    fiscalYearId,
    fromBS:      fromBS ?? fy.startBS,
    toBS:        toBS   ?? fy.endBS,
    openingCash: openingCash.toFixed(2),
    openingBank: openingBank.toFixed(2),
    receipts:    receiptsList,
    payments:    paymentsList,
    closingCash: closingCash.toFixed(2),
    closingBank: closingBank.toFixed(2),
    totalReceiptsSide: leftTotal.toFixed(2),
    totalPaymentsSide: rightTotal.toFixed(2),
  }
}

// ─── Balance Sheet (with Capital Fund + current-year surplus) ──────────────

export interface BSLine { code: string; name: string; amount: string }

export interface BalanceSheetResult {
  fiscalYearId:        string
  asOfBS:              string
  assets:              BSLine[]
  liabilities:         BSLine[]
  equity:              BSLine[]                 // Capital Fund accounts
  currentYearSurplus:  string                    // positive = surplus
  isSurplus:           boolean
  totalAssets:         string
  totalLiabilitiesAndEquity: string
  balanced:            boolean
}

export async function getBalanceSheet(fiscalYearId: string, asOfBS?: string): Promise<BalanceSheetResult> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Fiscal year not found")
  const cutoff = asOfBS ? toAD(asOfBS) : fy.endAD

  const [accounts, openings, agg, ie] = await Promise.all([
    prisma.account.findMany({
      where:   { schoolId, type: { in: ["ASSET", "LIABILITY", "EQUITY"] }, isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.openingBalance.findMany({
      where: { schoolId, fiscalYearId },
    }),
    prisma.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        schoolId,
        voucher: { fiscalYearId, status: { in: ["POSTED", "REVERSED"] }, dateAD: { lte: cutoff } },
      },
      _sum: { debit: true, credit: true },
    }),
    getIncomeExpenditure(fiscalYearId, asOfBS),
  ])

  const openingMap = new Map(openings.map(o => [o.accountId, { dr: o.debit, cr: o.credit }]))
  const aggMap = new Map(agg.map(g => [g.accountId, { dr: g._sum.debit ?? ZERO, cr: g._sum.credit ?? ZERO }]))

  const assets: BSLine[] = []
  const liabilities: BSLine[] = []
  const equity: BSLine[] = []
  let totalA = ZERO, totalL = ZERO, totalE = ZERO

  for (const acc of accounts) {
    const op = openingMap.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    const ac = aggMap.get(acc.id) ?? { dr: ZERO, cr: ZERO }
    const dr = op.dr.add(ac.dr)
    const cr = op.cr.add(ac.cr)
    const net = dr.minus(cr)  // signed; positive = Dr balance

    if (acc.type === "ASSET") {
      if (!net.equals(0)) {
        assets.push({ code: acc.code, name: acc.name, amount: net.toFixed(2) })
        totalA = totalA.add(net)
      }
    } else if (acc.type === "LIABILITY") {
      const liab = net.neg()  // Cr balance for liability
      if (!liab.equals(0)) {
        liabilities.push({ code: acc.code, name: acc.name, amount: liab.toFixed(2) })
        totalL = totalL.add(liab)
      }
    } else {  // EQUITY
      const eq = net.neg()  // Cr balance for equity
      if (!eq.equals(0)) {
        equity.push({ code: acc.code, name: acc.name, amount: eq.toFixed(2) })
        totalE = totalE.add(eq)
      }
    }
  }

  // Current-year surplus/deficit (signed) adds to equity side
  const sodSigned = new D(ie.surplusOrDeficit).mul(ie.isSurplus ? 1 : -1)
  const totalLE = totalL.add(totalE).add(sodSigned)

  return {
    fiscalYearId,
    asOfBS:                    asOfBS ?? fy.endBS,
    assets,
    liabilities,
    equity,
    currentYearSurplus:        ie.surplusOrDeficit,
    isSurplus:                 ie.isSurplus,
    totalAssets:               totalA.toFixed(2),
    totalLiabilitiesAndEquity: totalLE.toFixed(2),
    balanced:                  totalA.equals(totalLE),
  }
}
