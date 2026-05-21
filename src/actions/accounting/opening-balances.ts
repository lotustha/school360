"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

const D = Prisma.Decimal
const ZERO = new D(0)

const rowSchema = z.object({
  accountId: z.string().min(1),
  debit:     z.string().regex(/^-?\d+(\.\d{1,2})?$/).default("0"),
  credit:    z.string().regex(/^-?\d+(\.\d{1,2})?$/).default("0"),
})

export async function getOpeningBalances(fiscalYearId: string) {
  const session = await requirePermission("finance:view")
  return prisma.openingBalance.findMany({
    where: { schoolId: session.user.schoolId!, fiscalYearId },
    include: { account: true },
    orderBy: { account: { code: "asc" } },
  })
}

/** Upsert one or many opening-balance rows. Does NOT validate balance — that's at finalize. */
export async function upsertOpeningBalances(input: {
  fiscalYearId: string
  rows: { accountId: string; debit: string; credit: string }[]
}) {
  const session = await requirePermission("finance:manage")
  const schoolId = session.user.schoolId!
  const rows = z.array(rowSchema).parse(input.rows)

  await prisma.$transaction(rows.map(r =>
    prisma.openingBalance.upsert({
      where: {
        schoolId_fiscalYearId_accountId: {
          schoolId, fiscalYearId: input.fiscalYearId, accountId: r.accountId,
        },
      },
      create: {
        schoolId,
        fiscalYearId: input.fiscalYearId,
        accountId:    r.accountId,
        debit:        new D(r.debit),
        credit:       new D(r.credit),
      },
      update: {
        debit:  new D(r.debit),
        credit: new D(r.credit),
      },
    })
  ))

  revalidatePath("/accounting/setup")
  revalidatePath(`/accounting/reports/trial-balance`)
}

/**
 * Validates that Σdebit = Σcredit across all opening-balance rows for the FY.
 * Returns { balanced, totalDebit, totalCredit }. Does NOT write a JV — opening
 * balances are read directly by reports (see reports.ts). Keeping them as
 * first-class rows rather than a hidden JV makes them easy to edit.
 */
export async function finalizeOpeningBalances(fiscalYearId: string) {
  const session = await requirePermission("finance:manage")

  const rows = await prisma.openingBalance.findMany({
    where: { schoolId: session.user.schoolId!, fiscalYearId },
    select: { debit: true, credit: true },
  })

  const totalDebit  = rows.reduce<Prisma.Decimal>((a, r) => a.add(r.debit), ZERO)
  const totalCredit = rows.reduce<Prisma.Decimal>((a, r) => a.add(r.credit), ZERO)

  if (!totalDebit.equals(totalCredit)) {
    throw new Error(
      `Opening balances are not balanced: Dr ${totalDebit.toString()} ≠ Cr ${totalCredit.toString()}`
    )
  }

  revalidatePath("/accounting/setup")
  revalidatePath("/accounting/reports/trial-balance")
  return {
    balanced:    true,
    totalDebit:  totalDebit.toString(),
    totalCredit: totalCredit.toString(),
  }
}
