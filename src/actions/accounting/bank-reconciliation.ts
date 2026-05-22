"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { toAD } from "@/lib/nepali-date"

const D = Prisma.Decimal
const ZERO = new D(0)

export interface ReconRow {
  id:            string   // JournalEntry id
  dateBS:        string
  dateAD:        Date
  voucherId:     string
  voucherNumber: string | null
  voucherType:   string
  narration:     string
  debit:         string   // deposit Dr
  credit:        string   // withdrawal Cr
  cleared:       boolean
  clearedAt:     Date | null
}

export interface BankReconciliationResult {
  accountId:     string
  accountCode:   string
  accountName:   string
  bankName:      string | null
  asOfBS:        string
  asOfAD:        Date

  bookBalance:           string   // sum of all Dr − Cr through asOf (whether cleared or not)
  clearedBookBalance:    string   // sum of cleared Dr − Cr through asOf
  unclearedDeposits:     string   // sum of uncleared Dr through asOf
  unclearedWithdrawals:  string   // sum of uncleared Cr through asOf

  /** Bank statement balance you'd expect given uncleared = book − unclearedDr + unclearedCr. */
  expectedStatementBalance: string

  rows: ReconRow[]
}

export async function getBankReconciliation(
  accountId: string,
  asOfBS?: string,
): Promise<BankReconciliationResult> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { bankAccount: { select: { bankName: true } } },
  })
  if (!account || account.schoolId !== schoolId) throw new Error("Account not found")
  if (account.subType !== "BANK") throw new Error("Reconciliation is only for BANK-subtype accounts")

  const asOfAD = asOfBS ? toAD(asOfBS) : new Date()

  // Opening balance (from OpeningBalance for current FY) + period activity up to asOf
  // We don't constrain to a single FY here — show full history up to date.
  const [openings, lines] = await Promise.all([
    prisma.openingBalance.findMany({ where: { schoolId, accountId } }),
    prisma.journalEntry.findMany({
      where: {
        schoolId,
        accountId,
        voucher: { status: { in: ["POSTED", "REVERSED"] }, dateAD: { lte: asOfAD } },
      },
      include: {
        voucher: { select: { id: true, number: true, type: true, dateAD: true, dateBS: true, narration: true, createdAt: true } },
      },
      orderBy: [{ voucher: { dateAD: "desc" } }, { voucher: { createdAt: "desc" } }, { lineNo: "asc" }],
    }),
  ])

  // Aggregate
  let openingDr = ZERO, openingCr = ZERO
  for (const o of openings) {
    openingDr = openingDr.add(o.debit)
    openingCr = openingCr.add(o.credit)
  }

  let book = openingDr.minus(openingCr)
  let clearedBook = openingDr.minus(openingCr)  // opening balances treated as already cleared
  let unclearedDr = ZERO
  let unclearedCr = ZERO

  for (const l of lines) {
    book = book.add(l.debit).minus(l.credit)
    if (l.clearedAt) {
      clearedBook = clearedBook.add(l.debit).minus(l.credit)
    } else {
      unclearedDr = unclearedDr.add(l.debit)
      unclearedCr = unclearedCr.add(l.credit)
    }
  }

  const expectedStatementBalance = book.minus(unclearedDr).add(unclearedCr)

  const rows: ReconRow[] = lines.map(l => ({
    id:            l.id,
    dateBS:        l.voucher.dateBS,
    dateAD:        l.voucher.dateAD,
    voucherId:     l.voucher.id,
    voucherNumber: l.voucher.number,
    voucherType:   l.voucher.type,
    narration:     l.voucher.narration,
    debit:         l.debit.toFixed(2),
    credit:        l.credit.toFixed(2),
    cleared:       !!l.clearedAt,
    clearedAt:     l.clearedAt,
  }))

  return {
    accountId,
    accountCode:   account.code,
    accountName:   account.name,
    bankName:      account.bankAccount?.bankName ?? null,
    asOfBS:        asOfBS ?? "",
    asOfAD,
    bookBalance:                book.toFixed(2),
    clearedBookBalance:         clearedBook.toFixed(2),
    unclearedDeposits:          unclearedDr.toFixed(2),
    unclearedWithdrawals:       unclearedCr.toFixed(2),
    expectedStatementBalance:   expectedStatementBalance.toFixed(2),
    rows,
  }
}

// ─── Toggle ────────────────────────────────────────────────────────────────

const toggleSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1).max(500),
  cleared:  z.boolean(),
})

export async function toggleClearedEntries(input: z.infer<typeof toggleSchema>) {
  const session = await requirePermission("finance:manage")
  const data = toggleSchema.parse(input)

  // Verify all entries belong to this school AND are on a BANK account
  const lines = await prisma.journalEntry.findMany({
    where:  { id: { in: data.entryIds } },
    select: { id: true, schoolId: true, account: { select: { subType: true } } },
  })
  for (const l of lines) {
    if (l.schoolId !== session.user.schoolId) throw new Error("Entry not in your school")
    if (l.account.subType !== "BANK") throw new Error("Only BANK lines can be reconciled")
  }
  if (lines.length !== data.entryIds.length) throw new Error("Some entries not found")

  await prisma.journalEntry.updateMany({
    where: { id: { in: data.entryIds } },
    data: data.cleared
      ? { clearedAt: new Date(), clearedById: session.user.id }
      : { clearedAt: null, clearedById: null },
  })

  revalidatePath("/accounting/bank-reconciliation")
  return { updated: lines.length, cleared: data.cleared }
}
