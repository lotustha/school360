"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

const vendorSchema = z.object({
  name:      z.string().min(1).max(120),
  panNumber: z.string().regex(/^\d{9}$/).nullable().optional().or(z.literal("").transform(() => null)),
  address:   z.string().max(255).nullable().optional(),
  phone:     z.string().max(50).nullable().optional(),
  email:     z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  notes:     z.string().max(500).nullable().optional(),
})

const SUNDRY_CREDITORS_CODE = "2110"

export interface VendorRow {
  id:        string
  name:      string
  panNumber: string | null
  address:   string | null
  phone:     string | null
  email:     string | null
  isActive:  boolean
  payableAccountId: string
  payableAccountCode: string
  notes:     string | null
}

export async function listVendors(): Promise<VendorRow[]> {
  const session = await requirePermission("finance:view")
  const rows = await prisma.vendor.findMany({
    where:   { schoolId: session.user.schoolId! },
    include: { payableAccount: { select: { code: true } } },
    orderBy: { name: "asc" },
  })
  return rows.map(v => ({
    id:        v.id,
    name:      v.name,
    panNumber: v.panNumber,
    address:   v.address,
    phone:     v.phone,
    email:     v.email,
    isActive:  v.isActive,
    payableAccountId:   v.payableAccountId,
    payableAccountCode: v.payableAccount.code,
    notes:     v.notes,
  }))
}

/**
 * Creates a Vendor + a dedicated child account under Sundry Creditors (2110).
 * The child account becomes the payable subsidiary ledger for this vendor.
 */
export async function createVendor(input: z.infer<typeof vendorSchema>) {
  const session = await requirePermission("finance:manage")
  const data = vendorSchema.parse(input)
  const schoolId = session.user.schoolId!

  return prisma.$transaction(async (tx) => {
    // Locate the parent control account (Sundry Creditors)
    const parent = await tx.account.findFirst({
      where: { schoolId, code: SUNDRY_CREDITORS_CODE, isActive: true },
    })
    if (!parent) throw new Error("Sundry Creditors account (2110) not found. Seed the default Chart of Accounts first.")

    // Compute the next code under the parent (211001, 211002, ...)
    const existing = await tx.account.findMany({
      where: { schoolId, parentId: parent.id },
      select: { code: true },
    })
    const used = new Set(existing.map(e => e.code))
    let n = 1
    while (used.has(`${SUNDRY_CREDITORS_CODE}${String(n).padStart(2, "0")}`)) n++
    const childCode = `${SUNDRY_CREDITORS_CODE}${String(n).padStart(2, "0")}`

    const account = await tx.account.create({
      data: {
        schoolId,
        code:     childCode,
        name:     `Payable — ${data.name}`,
        type:     "LIABILITY",
        subType:  "PAYABLE",
        parentId: parent.id,
        isSystem: false,
        notes:    "Auto-created for vendor",
      },
    })

    return tx.vendor.create({
      data: {
        schoolId,
        name:             data.name,
        panNumber:        data.panNumber ?? null,
        address:          data.address ?? null,
        phone:            data.phone ?? null,
        email:            data.email ?? null,
        notes:            data.notes ?? null,
        payableAccountId: account.id,
      },
    })
  }).then(v => {
    revalidatePath("/accounting/vendors")
    revalidatePath("/accounting/accounts")
    return { id: v.id, name: v.name }
  })
}

export async function updateVendor(id: string, input: Partial<z.infer<typeof vendorSchema>>) {
  await requirePermission("finance:manage")
  await prisma.vendor.update({
    where: { id },
    data: {
      ...(input.name      !== undefined && { name:      input.name }),
      ...(input.panNumber !== undefined && { panNumber: input.panNumber }),
      ...(input.address   !== undefined && { address:   input.address }),
      ...(input.phone     !== undefined && { phone:     input.phone }),
      ...(input.email     !== undefined && { email:     input.email }),
      ...(input.notes     !== undefined && { notes:     input.notes }),
    },
  })
  revalidatePath("/accounting/vendors")
}

export async function deactivateVendor(id: string) {
  await requirePermission("finance:manage")
  await prisma.vendor.update({ where: { id }, data: { isActive: false } })
  revalidatePath("/accounting/vendors")
}

export async function reactivateVendor(id: string) {
  await requirePermission("finance:manage")
  await prisma.vendor.update({ where: { id }, data: { isActive: true } })
  revalidatePath("/accounting/vendors")
}
