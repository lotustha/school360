"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import type { AccountType, AccountSubType } from "@/lib/accounting"

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const

const createSchema = z.object({
  code:      z.string().min(1).max(20),
  name:      z.string().min(1).max(120),
  type:      z.enum(ACCOUNT_TYPES),
  subType:   z.string().nullable().optional(),
  parentId:  z.string().nullable().optional(),
  isControl: z.boolean().optional(),
  notes:     z.string().nullable().optional(),
})

export async function listAccounts() {
  const session = await requirePermission("finance:view")
  return prisma.account.findMany({
    where:   { schoolId: session.user.schoolId! },
    orderBy: { code: "asc" },
  })
}

export async function createAccount(input: z.infer<typeof createSchema>) {
  const session = await requirePermission("finance:manage")
  const data = createSchema.parse(input)
  const created = await prisma.account.create({
    data: {
      schoolId:  session.user.schoolId!,
      code:      data.code,
      name:      data.name,
      type:      data.type,
      subType:   data.subType ?? null,
      parentId:  data.parentId ?? null,
      isControl: data.isControl ?? false,
      notes:     data.notes ?? null,
    },
  })
  revalidatePath("/accounting/accounts")
  return created
}

export async function updateAccount(id: string, input: Partial<z.infer<typeof createSchema>>) {
  const session = await requirePermission("finance:manage")
  const existing = await prisma.account.findUnique({ where: { id }, select: { schoolId: true } })
  if (!existing || existing.schoolId !== session.user.schoolId) throw new Error("Account not found")
  const updated = await prisma.account.update({
    where: { id },
    data:  {
      ...(input.code      !== undefined && { code:      input.code }),
      ...(input.name      !== undefined && { name:      input.name }),
      ...(input.type      !== undefined && { type:      input.type }),
      ...(input.subType   !== undefined && { subType:   input.subType }),
      ...(input.parentId  !== undefined && { parentId:  input.parentId }),
      ...(input.isControl !== undefined && { isControl: input.isControl }),
      ...(input.notes     !== undefined && { notes:     input.notes }),
    },
  })
  revalidatePath("/accounting/accounts")
  return updated
}

/** Reactivate a soft-disabled account. */
export async function reactivateAccount(id: string) {
  const session = await requirePermission("finance:manage")
  const existing = await prisma.account.findUnique({ where: { id }, select: { schoolId: true } })
  if (!existing || existing.schoolId !== session.user.schoolId) throw new Error("Account not found")
  await prisma.account.update({ where: { id }, data: { isActive: true } })
  revalidatePath("/accounting/accounts")
}

/** Soft-disable. Hard delete blocked if any JE exists. */
export async function deactivateAccount(id: string) {
  const session = await requirePermission("finance:manage")
  const existing = await prisma.account.findUnique({ where: { id }, select: { schoolId: true } })
  if (!existing || existing.schoolId !== session.user.schoolId) throw new Error("Account not found")
  const used = await prisma.journalEntry.count({ where: { accountId: id } })
  if (used > 0) {
    await prisma.account.update({ where: { id }, data: { isActive: false } })
  } else {
    // No postings yet — allow hard delete (and only if no children either)
    const kids = await prisma.account.count({ where: { parentId: id } })
    if (kids > 0) {
      await prisma.account.update({ where: { id }, data: { isActive: false } })
    } else {
      await prisma.account.delete({ where: { id } })
    }
  }
  revalidatePath("/accounting/accounts")
}

// ─── DEFAULT CHART OF ACCOUNTS (Nepal school template) ─────────────────────
// Seeded once per school via the setup wizard. All marked isSystem=true.
// Editable by the accountant (rename/add/disable) — code uniqueness enforced.

interface SeedNode {
  code:     string
  name:     string
  type:     AccountType
  subType?: NonNullable<AccountSubType>
  isControl?: boolean
  children?: SeedNode[]
}

const COA_SEED: SeedNode[] = [
  {
    code: "1000", name: "Assets", type: "ASSET", children: [
      { code: "1100", name: "Current Assets", type: "ASSET", children: [
        { code: "1110", name: "Cash in Hand",         type: "ASSET", subType: "CASH" },
        { code: "1120", name: "Bank Accounts",        type: "ASSET", subType: "BANK" },
        { code: "1130", name: "Student Fee Receivable", type: "ASSET", subType: "RECEIVABLE", isControl: true },
        { code: "1140", name: "Staff Advances",       type: "ASSET", subType: "RECEIVABLE", isControl: true },
        { code: "1150", name: "Prepaid Expenses",     type: "ASSET", subType: "CURRENT_ASSET" },
      ]},
      { code: "1500", name: "Fixed Assets", type: "ASSET", children: [
        { code: "1510", name: "Land & Building",      type: "ASSET", subType: "FIXED_ASSET" },
        { code: "1520", name: "Furniture & Fixtures", type: "ASSET", subType: "FIXED_ASSET" },
        { code: "1530", name: "Lab & IT Equipment",   type: "ASSET", subType: "FIXED_ASSET" },
        { code: "1540", name: "Vehicles",             type: "ASSET", subType: "FIXED_ASSET" },
        { code: "1590", name: "Accumulated Depreciation", type: "ASSET", subType: "FIXED_ASSET" },
      ]},
    ],
  },
  {
    code: "2000", name: "Liabilities", type: "LIABILITY", children: [
      { code: "2100", name: "Current Liabilities", type: "LIABILITY", children: [
        { code: "2110", name: "Sundry Creditors",  type: "LIABILITY", subType: "PAYABLE", isControl: true },
        { code: "2120", name: "Salary Payable",    type: "LIABILITY", subType: "PAYABLE" },
        { code: "2130", name: "TDS Payable",       type: "LIABILITY", subType: "TAX_PAYABLE" },
        { code: "2140", name: "SSF Payable",       type: "LIABILITY", subType: "TAX_PAYABLE" },
        { code: "2150", name: "VAT Payable",       type: "LIABILITY", subType: "TAX_PAYABLE" },
        { code: "2160", name: "Advance Fee Received", type: "LIABILITY", subType: "CURRENT_LIABILITY" },
      ]},
      { code: "2500", name: "Long-term Loans",     type: "LIABILITY", subType: "LONG_TERM_LIABILITY" },
    ],
  },
  {
    code: "3000", name: "Capital Fund", type: "EQUITY", subType: "CAPITAL_FUND", children: [
      { code: "3100", name: "Accumulated Fund",    type: "EQUITY", subType: "CAPITAL_FUND" },
      { code: "3200", name: "Current Year Surplus / (Deficit)", type: "EQUITY", subType: "CAPITAL_FUND" },
    ],
  },
  {
    code: "4000", name: "Income", type: "INCOME", children: [
      { code: "4100", name: "Tuition Fee",     type: "INCOME", subType: "OPERATING_INCOME" },
      { code: "4200", name: "Admission Fee",   type: "INCOME", subType: "OPERATING_INCOME" },
      { code: "4300", name: "Exam Fee",        type: "INCOME", subType: "OPERATING_INCOME" },
      { code: "4400", name: "Transport Fee",   type: "INCOME", subType: "OPERATING_INCOME" },
      { code: "4500", name: "Hostel Fee",      type: "INCOME", subType: "OPERATING_INCOME" },
      { code: "4600", name: "Donations & Grants", type: "INCOME", subType: "OTHER_INCOME" },
      { code: "4700", name: "Interest Income", type: "INCOME", subType: "OTHER_INCOME" },
      { code: "4900", name: "Other Income",    type: "INCOME", subType: "OTHER_INCOME" },
    ],
  },
  {
    code: "5000", name: "Expenses", type: "EXPENSE", children: [
      { code: "5100", name: "Salaries & Allowances",   type: "EXPENSE", subType: "OPERATING_EXPENSE" },
      { code: "5200", name: "Rent",                    type: "EXPENSE", subType: "OPERATING_EXPENSE" },
      { code: "5300", name: "Utilities (Electricity, Water, Internet)", type: "EXPENSE", subType: "OPERATING_EXPENSE" },
      { code: "5400", name: "Teaching Materials",      type: "EXPENSE", subType: "OPERATING_EXPENSE" },
      { code: "5500", name: "Repairs & Maintenance",   type: "EXPENSE", subType: "OPERATING_EXPENSE" },
      { code: "5600", name: "Depreciation",            type: "EXPENSE", subType: "OPERATING_EXPENSE" },
      { code: "5700", name: "Bank Charges",            type: "EXPENSE", subType: "OPERATING_EXPENSE" },
      { code: "5800", name: "Transport & Travel",      type: "EXPENSE", subType: "OPERATING_EXPENSE" },
      { code: "5900", name: "Other Expenses",          type: "EXPENSE", subType: "OTHER_EXPENSE" },
    ],
  },
]

/** Idempotent: only inserts accounts whose `code` doesn't already exist. */
export async function seedDefaultCOA() {
  const session = await requirePermission("finance:manage")
  const schoolId = session.user.schoolId!

  const existing = await prisma.account.findMany({
    where:  { schoolId },
    select: { code: true },
  })
  const existingCodes = new Set(existing.map(a => a.code))

  // Two-pass: insert parents first so we can set parentId on children.
  // We map code → newly-created id as we go.
  const codeToId = new Map<string, string>()

  async function insertNode(node: SeedNode, parentCode: string | null) {
    if (!existingCodes.has(node.code)) {
      const created = await prisma.account.create({
        data: {
          schoolId,
          code:      node.code,
          name:      node.name,
          type:      node.type,
          subType:   node.subType ?? null,
          parentId:  parentCode ? codeToId.get(parentCode) ?? null : null,
          isControl: node.isControl ?? false,
          isSystem:  true,
        },
      })
      codeToId.set(node.code, created.id)
    } else {
      // Already exists — fetch its id so children can use it as parent
      const row = await prisma.account.findFirst({
        where:  { schoolId, code: node.code },
        select: { id: true },
      })
      if (row) codeToId.set(node.code, row.id)
    }

    if (node.children) {
      for (const child of node.children) await insertNode(child, node.code)
    }
  }

  for (const root of COA_SEED) await insertNode(root, null)

  revalidatePath("/accounting/accounts")
  revalidatePath("/accounting")
  return { inserted: codeToId.size - existingCodes.size, total: codeToId.size }
}

/** Look up a system account by code for the current school. Used by setup wizard. */
export async function findAccountByCode(code: string) {
  const session = await requirePermission("finance:view")
  return prisma.account.findFirst({
    where:  { schoolId: session.user.schoolId!, code },
  })
}
