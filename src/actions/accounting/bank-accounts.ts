"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

const bankSchema = z.object({
  bankName:      z.string().min(1).max(120),
  accountNumber: z.string().max(50).nullable().optional(),
  branch:        z.string().max(120).nullable().optional(),
  code:          z.string().min(1).max(20),  // GL code for the auto-created Account
  accountLabel:  z.string().min(1).max(120), // GL display name
})

const BANK_PARENT_CODE = "1120"  // "Bank Accounts" parent

export interface BankAccountRow {
  id:            string
  bankName:      string
  accountNumber: string | null
  branch:        string | null
  isActive:      boolean
  glAccountId:   string
  glCode:        string
  glName:        string
}

export async function listBankAccountsAll(): Promise<BankAccountRow[]> {
  const session = await requirePermission("finance:view")
  const rows = await prisma.bankAccount.findMany({
    where:   { schoolId: session.user.schoolId! },
    include: { account: { select: { id: true, code: true, name: true } } },
    orderBy: { bankName: "asc" },
  })
  return rows.map(b => ({
    id:            b.id,
    bankName:      b.bankName,
    accountNumber: b.accountNumber,
    branch:        b.branch,
    isActive:      b.isActive,
    glAccountId:   b.account.id,
    glCode:        b.account.code,
    glName:        b.account.name,
  }))
}

/**
 * Atomically creates a Bank GL Account (subType=BANK) + the BankAccount row
 * that holds the bank-specific metadata (name, account #, branch).
 */
export async function createBankAccount(input: z.infer<typeof bankSchema>) {
  const session = await requirePermission("finance:manage")
  const data = bankSchema.parse(input)
  const schoolId = session.user.schoolId!

  return prisma.$transaction(async (tx) => {
    const parent = await tx.account.findFirst({
      where: { schoolId, code: BANK_PARENT_CODE, isActive: true },
    })
    if (!parent) throw new Error("Bank Accounts parent (1120) not found. Seed the default COA first.")

    // Reject duplicate code under this school
    const existing = await tx.account.findFirst({ where: { schoolId, code: data.code } })
    if (existing) throw new Error(`Account code ${data.code} is already in use`)

    const account = await tx.account.create({
      data: {
        schoolId,
        code:     data.code,
        name:     data.accountLabel,
        type:     "ASSET",
        subType:  "BANK",
        parentId: parent.id,
        notes:    "Bank account",
      },
    })

    return tx.bankAccount.create({
      data: {
        schoolId,
        accountId:     account.id,
        bankName:      data.bankName,
        accountNumber: data.accountNumber ?? null,
        branch:        data.branch ?? null,
      },
    })
  }).then(b => {
    revalidatePath("/accounting/bank-accounts")
    revalidatePath("/accounting/accounts")
    revalidatePath("/accounting/bank-book")
    return { id: b.id }
  })
}

export async function updateBankAccount(id: string, input: {
  bankName?:      string
  accountNumber?: string | null
  branch?:        string | null
}) {
  await requirePermission("finance:manage")
  await prisma.bankAccount.update({
    where: { id },
    data: {
      ...(input.bankName      !== undefined && { bankName:      input.bankName }),
      ...(input.accountNumber !== undefined && { accountNumber: input.accountNumber }),
      ...(input.branch        !== undefined && { branch:        input.branch }),
    },
  })
  revalidatePath("/accounting/bank-accounts")
}

export async function deactivateBankAccount(id: string) {
  await requirePermission("finance:manage")
  const ba = await prisma.bankAccount.findUnique({ where: { id }, select: { accountId: true } })
  if (!ba) throw new Error("Bank account not found")
  // Soft-disable both the metadata row and the underlying GL account
  await prisma.$transaction([
    prisma.bankAccount.update({ where: { id }, data: { isActive: false } }),
    prisma.account.update({ where: { id: ba.accountId }, data: { isActive: false } }),
  ])
  revalidatePath("/accounting/bank-accounts")
  revalidatePath("/accounting/accounts")
}

export async function reactivateBankAccount(id: string) {
  await requirePermission("finance:manage")
  const ba = await prisma.bankAccount.findUnique({ where: { id }, select: { accountId: true } })
  if (!ba) throw new Error("Bank account not found")
  await prisma.$transaction([
    prisma.bankAccount.update({ where: { id }, data: { isActive: true } }),
    prisma.account.update({ where: { id: ba.accountId }, data: { isActive: true } }),
  ])
  revalidatePath("/accounting/bank-accounts")
  revalidatePath("/accounting/accounts")
}
