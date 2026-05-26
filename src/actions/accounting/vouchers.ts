"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { toAD } from "@/lib/nepali-date"
import {
  CONTRA_SUBTYPES, formatVoucherNumber,
  type VoucherInput, type VoucherType,
} from "@/lib/accounting"

const D = Prisma.Decimal
const ZERO = new D(0)

const decimalString = z.string().regex(/^-?\d+(\.\d{1,2})?$/).default("0")

const lineSchema = z.object({
  accountId: z.string().min(1),
  debit:     decimalString,
  credit:    decimalString,
  partyType: z.enum(["STUDENT", "EMPLOYEE", "VENDOR", "OTHER"]).nullable().optional(),
  partyId:   z.string().nullable().optional(),
  narration: z.string().nullable().optional(),
})

const voucherSchema = z.object({
  fiscalYearId: z.string().min(1),
  type:         z.enum(["RV", "PV", "CV", "JV"]),
  dateBS:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  narration:    z.string().min(1, "Narration is required").max(500),
  partyType:    z.enum(["STUDENT", "EMPLOYEE", "VENDOR", "OTHER"]).nullable().optional(),
  partyId:      z.string().nullable().optional(),
  partyName:    z.string().nullable().optional(),
  panNumber:    z.string().regex(/^\d{9}$/).nullable().optional().or(z.literal("").transform(() => null)),
  vatTaxable:   decimalString.nullable().optional(),
  vatAmount:    decimalString.nullable().optional(),
  tdsBase:      decimalString.nullable().optional(),
  tdsPercent:   decimalString.nullable().optional(),
  tdsAmount:    decimalString.nullable().optional(),
  lines:        z.array(lineSchema).min(2, "A voucher needs at least two lines"),
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function sumLines(lines: { debit: string; credit: string }[]) {
  let dr = ZERO, cr = ZERO
  for (const l of lines) { dr = dr.add(new D(l.debit)); cr = cr.add(new D(l.credit)) }
  return { dr, cr }
}

function validateLineShape(lines: { debit: string; credit: string }[]) {
  for (const l of lines) {
    const d = new D(l.debit), c = new D(l.credit)
    if (d.lessThan(0) || c.lessThan(0)) throw new Error("Line amounts must be non-negative")
    if (d.greaterThan(0) && c.greaterThan(0)) throw new Error("A line cannot have both debit and credit")
    if (d.equals(0) && c.equals(0)) throw new Error("A line must have either a debit or a credit")
  }
}

async function validateContra(schoolId: string, accountIds: string[]) {
  const accts = await prisma.account.findMany({
    where:  { id: { in: accountIds }, schoolId },
    select: { id: true, subType: true },
  })
  for (const a of accts) {
    if (!a.subType || !CONTRA_SUBTYPES.has(a.subType as never)) {
      throw new Error("Contra vouchers may only use Cash or Bank accounts")
    }
  }
}

// ─── Create / update / delete drafts ────────────────────────────────────────

export async function createDraftVoucher(input: VoucherInput) {
  const session = await requirePermission("finance:manage")
  const data = voucherSchema.parse(input)
  validateLineShape(data.lines)

  if (data.type === "CV") {
    await validateContra(session.user.schoolId!, data.lines.map(l => l.accountId))
  }

  const { dr } = sumLines(data.lines)

  const voucher = await prisma.voucher.create({
    data: {
      schoolId:     session.user.schoolId!,
      fiscalYearId: data.fiscalYearId,
      type:         data.type,
      dateBS:       data.dateBS,
      dateAD:       toAD(data.dateBS),
      narration:    data.narration,
      status:       "DRAFT",
      partyType:    data.partyType ?? null,
      partyId:      data.partyId   ?? null,
      partyName:    data.partyName ?? null,
      panNumber:    data.panNumber ?? null,
      vatTaxable:   data.vatTaxable  ? new D(data.vatTaxable)  : null,
      vatAmount:    data.vatAmount   ? new D(data.vatAmount)   : null,
      tdsBase:      data.tdsBase     ? new D(data.tdsBase)     : null,
      tdsPercent:   data.tdsPercent  ? new D(data.tdsPercent)  : null,
      tdsAmount:    data.tdsAmount   ? new D(data.tdsAmount)   : null,
      totalAmount:  dr,
      createdById:  session.user.id,
      lines: {
        create: data.lines.map((l, i) => ({
          schoolId:  session.user.schoolId!,
          accountId: l.accountId,
          lineNo:    i + 1,
          debit:     new D(l.debit),
          credit:    new D(l.credit),
          partyType: l.partyType ?? null,
          partyId:   l.partyId   ?? null,
          narration: l.narration ?? null,
        })),
      },
    },
  })

  revalidatePath("/accounting/vouchers")
  return voucher
}

export async function updateDraftVoucher(id: string, input: VoucherInput) {
  const session = await requirePermission("finance:manage")
  const data = voucherSchema.parse(input)

  const existing = await prisma.voucher.findUnique({ where: { id }, select: { status: true, schoolId: true } })
  if (!existing || existing.schoolId !== session.user.schoolId) throw new Error("NOT_FOUND")
  if (existing.status !== "DRAFT") throw new Error("Cannot edit a posted or reversed voucher")

  validateLineShape(data.lines)
  if (data.type === "CV") {
    await validateContra(session.user.schoolId!, data.lines.map(l => l.accountId))
  }

  const { dr } = sumLines(data.lines)

  await prisma.$transaction([
    prisma.journalEntry.deleteMany({ where: { voucherId: id } }),
    prisma.voucher.update({
      where: { id },
      data: {
        fiscalYearId: data.fiscalYearId,
        type:         data.type,
        dateBS:       data.dateBS,
        dateAD:       toAD(data.dateBS),
        narration:    data.narration,
        partyType:    data.partyType ?? null,
        partyId:      data.partyId   ?? null,
        partyName:    data.partyName ?? null,
        panNumber:    data.panNumber ?? null,
        vatTaxable:   data.vatTaxable  ? new D(data.vatTaxable)  : null,
        vatAmount:    data.vatAmount   ? new D(data.vatAmount)   : null,
        tdsBase:      data.tdsBase     ? new D(data.tdsBase)     : null,
        tdsPercent:   data.tdsPercent  ? new D(data.tdsPercent)  : null,
        tdsAmount:    data.tdsAmount   ? new D(data.tdsAmount)   : null,
        totalAmount:  dr,
        lines: {
          create: data.lines.map((l, i) => ({
            schoolId:  session.user.schoolId!,
            accountId: l.accountId,
            lineNo:    i + 1,
            debit:     new D(l.debit),
            credit:    new D(l.credit),
            partyType: l.partyType ?? null,
            partyId:   l.partyId   ?? null,
            narration: l.narration ?? null,
          })),
        },
      },
    }),
  ])

  revalidatePath("/accounting/vouchers")
  revalidatePath(`/accounting/vouchers/${id}`)
}

export async function deleteDraftVoucher(id: string) {
  const session = await requirePermission("finance:manage")
  const v = await prisma.voucher.findUnique({ where: { id }, select: { status: true, schoolId: true } })
  if (!v || v.schoolId !== session.user.schoolId) throw new Error("NOT_FOUND")
  if (v.status !== "DRAFT") throw new Error("Cannot delete a posted voucher")
  await prisma.voucher.delete({ where: { id } })
  revalidatePath("/accounting/vouchers")
}

// ─── Post / reverse ─────────────────────────────────────────────────────────

export async function postVoucher(id: string) {
  const session = await requirePermission("finance:manage")
  return prisma.$transaction(async (tx) => {
    const v = await tx.voucher.findUnique({
      where: { id },
      include: { lines: true, fiscalYear: true },
    })
    if (!v || v.schoolId !== session.user.schoolId) throw new Error("NOT_FOUND")
    if (v.status !== "DRAFT") throw new Error("Voucher is not in DRAFT status")
    if (v.fiscalYear.status !== "OPEN") throw new Error("Fiscal year is not open")

    // Cross-FY guard: date must fall inside FY window
    if (v.dateAD < v.fiscalYear.startAD || v.dateAD > v.fiscalYear.endAD) {
      throw new Error("Voucher date is outside the fiscal year window")
    }

    // Balance check
    let dr = ZERO, cr = ZERO
    for (const l of v.lines) { dr = dr.add(l.debit); cr = cr.add(l.credit) }
    if (!dr.equals(cr) || dr.lessThanOrEqualTo(0)) {
      throw new Error(`Voucher is not balanced (Dr ${dr.toString()} vs Cr ${cr.toString()})`)
    }

    // Allocate voucher number
    const counter = await tx.voucherCounter.upsert({
      where: {
        schoolId_fiscalYearId_type: {
          schoolId: v.schoolId, fiscalYearId: v.fiscalYearId, type: v.type,
        },
      },
      create: {
        schoolId: v.schoolId, fiscalYearId: v.fiscalYearId, type: v.type, lastNumber: 1,
      },
      update: { lastNumber: { increment: 1 } },
    })
    const number = formatVoucherNumber(v.type as VoucherType, v.fiscalYear.name, counter.lastNumber)

    const updated = await tx.voucher.update({
      where: { id },
      data: {
        status:     "POSTED",
        number,
        postedAt:   new Date(),
        postedById: session.user.id,
      },
    })

    await tx.auditLog.create({
      data: {
        schoolId: v.schoolId,
        userId:   session.user.id,
        entity:   "Voucher",
        entityId: id,
        action:   "POST",
        after:    { number, status: "POSTED" } as Prisma.InputJsonValue,
      },
    })

    return updated
  }).then((res) => {
    revalidatePath("/accounting/vouchers")
    revalidatePath(`/accounting/vouchers/${id}`)
    revalidatePath("/accounting/reports/trial-balance")
    revalidatePath("/accounting/ledger")
    revalidatePath("/accounting/day-book")
    return res
  })
}

/** Create a reversal voucher (new ID) that exactly negates the source voucher. */
export async function reverseVoucher(id: string, reversalNarration?: string) {
  const session = await requirePermission("finance:manage")
  return prisma.$transaction(async (tx) => {
    const src = await tx.voucher.findUnique({
      where: { id },
      include: { lines: true, fiscalYear: true },
    })
    if (!src || src.schoolId !== session.user.schoolId) throw new Error("NOT_FOUND")
    if (src.status !== "POSTED") throw new Error("Only POSTED vouchers can be reversed")

    // Check there isn't already a reversal pointing at this voucher
    const already = await tx.voucher.findFirst({ where: { reversalOfId: id }, select: { id: true } })
    if (already) throw new Error("Voucher already reversed")

    // Choose the FY for the reversal: today's date should land in the current FY,
    // but for safety we keep the reversal inside the same FY as the source.
    const fy = src.fiscalYear
    if (fy.status !== "OPEN") throw new Error("Source fiscal year is not open")

    const counter = await tx.voucherCounter.upsert({
      where: {
        schoolId_fiscalYearId_type: {
          schoolId: src.schoolId, fiscalYearId: src.fiscalYearId, type: src.type,
        },
      },
      create: {
        schoolId: src.schoolId, fiscalYearId: src.fiscalYearId, type: src.type, lastNumber: 1,
      },
      update: { lastNumber: { increment: 1 } },
    })
    const number = formatVoucherNumber(src.type as VoucherType, fy.name, counter.lastNumber)

    const reversal = await tx.voucher.create({
      data: {
        schoolId:     src.schoolId,
        fiscalYearId: src.fiscalYearId,
        type:         src.type,
        number,
        dateBS:       src.dateBS,
        dateAD:       src.dateAD,
        narration:    reversalNarration?.trim() || `Reversal of ${src.number ?? src.id}`,
        status:       "POSTED",
        partyType:    src.partyType,
        partyId:      src.partyId,
        partyName:    src.partyName,
        totalAmount:  src.totalAmount,
        reversalOfId: src.id,
        postedAt:     new Date(),
        postedById:   session.user.id,
        createdById:  session.user.id,
        lines: {
          create: src.lines.map((l, i) => ({
            schoolId:  src.schoolId,
            accountId: l.accountId,
            lineNo:    i + 1,
            // Swap debit/credit to negate
            debit:     l.credit,
            credit:    l.debit,
            partyType: l.partyType,
            partyId:   l.partyId,
            narration: l.narration ? `Reversal: ${l.narration}` : null,
          })),
        },
      },
    })

    // Mark source as REVERSED for visibility (not strictly necessary for math).
    await tx.voucher.update({ where: { id }, data: { status: "REVERSED" } })

    // If this voucher backs a fee bill (BL), unwind the StudentFee row's
    // BILLED state back to PLANNED — but only if no payment has been applied.
    // (Payments must be reversed first; we can't unbill a row that has cash
    // against it without invalidating receipts.)
    if (src.type === "BL") {
      const billedRows = await tx.studentFee.findMany({
        where:  { billVoucherId: id, schoolId: src.schoolId },
        select: { id: true, paidAmount: true, periodLabel: true },
      })
      for (const r of billedRows) {
        if (r.paidAmount.greaterThan(0)) {
          throw new Error(`Cannot reverse bill — row "${r.periodLabel}" has payment applied. Reverse the receipt first.`)
        }
      }
      await tx.studentFee.updateMany({
        where: { id: { in: billedRows.map(r => r.id) } },
        data:  { status: "PLANNED", billVoucherNumber: null, billVoucherId: null },
      })
    }

    // If this voucher backs a fee receipt (RV with a linked FeePayment), roll
    // back the student-fee bookkeeping so the GL reversal stays consistent with
    // the StudentFee paidAmount / status state.
    if (src.type === "RV") {
      const fp = await tx.feePayment.findFirst({
        where:   { voucherId: id, schoolId: src.schoolId },
        include: { lines: { select: { id: true } } },
      })
      if (fp) {
        const allocations = await tx.feePaymentAllocation.findMany({
          where: { feePaymentId: fp.id },
          include: { studentFee: true },
        })
        for (const alloc of allocations) {
          const sf = alloc.studentFee
          const nextPaid = sf.paidAmount.minus(alloc.amount)
          const nextStatus = nextPaid.lessThanOrEqualTo(0)
            ? (sf.billVoucherNumber ? "BILLED" : "PLANNED")  // billed remains billed even after payment is reversed
            : "PARTIAL"
          await tx.studentFee.update({
            where: { id: sf.id },
            data:  { paidAmount: nextPaid.lessThan(0) ? new Prisma.Decimal(0) : nextPaid, status: nextStatus },
          })
        }
        // Allocations rolled back — keep the FeePayment + Lines as audit record,
        // but unwind the allocations themselves so they don't double-count.
        await tx.feePaymentAllocation.deleteMany({ where: { feePaymentId: fp.id } })
      }
    }

    await tx.auditLog.create({
      data: {
        schoolId: src.schoolId,
        userId:   session.user.id,
        entity:   "Voucher",
        entityId: id,
        action:   "REVERSE",
        after:    { reversalId: reversal.id, reversalNumber: number } as Prisma.InputJsonValue,
      },
    })

    return reversal
  }).then((res) => {
    revalidatePath("/accounting/vouchers")
    revalidatePath(`/accounting/vouchers/${id}`)
    revalidatePath("/accounting/reports/trial-balance")
    revalidatePath("/accounting/ledger")
    revalidatePath("/accounting/day-book")
    return res
  })
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getVoucher(id: string) {
  const session = await requirePermission("finance:view")
  const v = await prisma.voucher.findUnique({
    where: { id },
    include: {
      lines:       { include: { account: true }, orderBy: { lineNo: "asc" } },
      fiscalYear:  true,
      reversalOf:  { select: { id: true, number: true } },
      reversedBy:  { select: { id: true, number: true } },
    },
  })
  if (!v || v.schoolId !== session.user.schoolId) return null
  return v
}

export interface VoucherFilters {
  fiscalYearId?: string
  type?:         VoucherType
  status?:       "DRAFT" | "POSTED" | "REVERSED"
  fromBS?:       string
  toBS?:         string
}

export async function listVouchers(filters: VoucherFilters = {}) {
  const session = await requirePermission("finance:view")
  const rows = await prisma.voucher.findMany({
    where: {
      schoolId: session.user.schoolId!,
      ...(filters.fiscalYearId && { fiscalYearId: filters.fiscalYearId }),
      ...(filters.type         && { type:         filters.type }),
      ...(filters.status       && { status:       filters.status }),
      ...(filters.fromBS && { dateAD: { gte: toAD(filters.fromBS) } }),
      ...(filters.toBS   && { dateAD: { lte: toAD(filters.toBS) } }),
    },
    include: { fiscalYear: { select: { name: true } } },
    orderBy: [{ dateAD: "desc" }, { createdAt: "desc" }],
    take: 500,
  })

  // Convert all Decimal/Date to JSON-safe primitives so callers can safely
  // pass these rows across the RSC boundary.
  return rows.map(r => ({
    id:             r.id,
    fiscalYearId:   r.fiscalYearId,
    fiscalYearName: r.fiscalYear.name,
    type:           r.type,
    number:         r.number,
    dateBS:         r.dateBS,
    narration:      r.narration,
    status:         r.status,
    partyType:      r.partyType,
    partyName:      r.partyName,
    panNumber:      r.panNumber,
    totalAmount:    r.totalAmount.toFixed(2),
  }))
}

// ─── Narration autocomplete ────────────────────────────────────────────────

/**
 * Return up to 10 distinct recent narrations matching `q` (case-insensitive),
 * scoped to the current school. Optionally narrows to a voucher type so the
 * suggestions are contextually relevant.
 */
export async function searchRecentNarrations(q: string, type?: VoucherType): Promise<string[]> {
  const session = await requirePermission("finance:view")
  const query = q.trim()
  if (query.length < 2) return []

  const rows = await prisma.voucher.findMany({
    where: {
      schoolId:  session.user.schoolId!,
      status:    { in: ["POSTED", "REVERSED"] },
      narration: { contains: query, mode: "insensitive" },
      ...(type && { type }),
    },
    select:   { narration: true },
    orderBy:  { createdAt: "desc" },
    distinct: ["narration"],
    take:     10,
  })

  return rows.map(r => r.narration)
}

// ─── Party autocomplete (name ↔ PAN linked) ────────────────────────────────

export interface PartySuggestion {
  name: string
  pan:  string | null
  type: string | null
}

/**
 * Return up to 10 distinct recent (party name, PAN) pairs matching `q`. Matches
 * either field — typing in the name field or the PAN field both work.
 */
export async function searchRecentParties(q: string, voucherType?: VoucherType): Promise<PartySuggestion[]> {
  const session = await requirePermission("finance:view")
  const query = q.trim()
  if (query.length < 2) return []

  const rows = await prisma.voucher.findMany({
    where: {
      schoolId: session.user.schoolId!,
      status:   { in: ["POSTED", "REVERSED"] },
      ...(voucherType && { type: voucherType }),
      OR: [
        { partyName: { contains: query, mode: "insensitive" } },
        { panNumber: { contains: query } },
      ],
    },
    select:   { partyName: true, panNumber: true, partyType: true },
    orderBy:  { createdAt: "desc" },
    distinct: ["partyName"],
    take:     10,
  })

  return rows
    .filter(r => r.partyName)
    .map(r => ({ name: r.partyName!, pan: r.panNumber, type: r.partyType }))
}

// ─── Quick-voucher one-shot post (used by /accounting/quick templates) ─────
// Creates and posts in a single transaction, returning a JSON-safe summary so
// the client doesn't need to handle Decimal/Date.

export async function createAndPostQuickVoucher(input: VoucherInput) {
  const session = await requirePermission("finance:manage")
  const data = voucherSchema.parse(input)
  validateLineShape(data.lines)
  if (data.type === "CV") {
    await validateContra(session.user.schoolId!, data.lines.map(l => l.accountId))
  }

  const { dr, cr } = sumLines(data.lines)
  if (!dr.equals(cr) || dr.lessThanOrEqualTo(0)) {
    throw new Error(`Voucher is not balanced (Dr ${dr.toString()} vs Cr ${cr.toString()})`)
  }

  const fy = await prisma.fiscalYear.findUnique({ where: { id: data.fiscalYearId } })
  if (!fy || fy.schoolId !== session.user.schoolId) throw new Error("Invalid fiscal year")
  if (fy.status !== "OPEN") throw new Error("Fiscal year is not open")

  const dateAD = toAD(data.dateBS)
  if (dateAD < fy.startAD || dateAD > fy.endAD) {
    throw new Error("Voucher date is outside the fiscal year window")
  }

  const created = await prisma.$transaction(async (tx) => {
    const counter = await tx.voucherCounter.upsert({
      where: {
        schoolId_fiscalYearId_type: {
          schoolId: session.user.schoolId!, fiscalYearId: data.fiscalYearId, type: data.type,
        },
      },
      create: { schoolId: session.user.schoolId!, fiscalYearId: data.fiscalYearId, type: data.type, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const number = formatVoucherNumber(data.type as VoucherType, fy.name, counter.lastNumber)

    return tx.voucher.create({
      data: {
        schoolId:     session.user.schoolId!,
        fiscalYearId: data.fiscalYearId,
        type:         data.type,
        number,
        dateBS:       data.dateBS,
        dateAD,
        narration:    data.narration,
        status:       "POSTED",
        partyType:    data.partyType ?? null,
        partyId:      data.partyId   ?? null,
        partyName:    data.partyName ?? null,
        panNumber:    data.panNumber ?? null,
        vatTaxable:   data.vatTaxable  ? new D(data.vatTaxable)  : null,
        vatAmount:    data.vatAmount   ? new D(data.vatAmount)   : null,
        tdsBase:      data.tdsBase     ? new D(data.tdsBase)     : null,
        tdsPercent:   data.tdsPercent  ? new D(data.tdsPercent)  : null,
        tdsAmount:    data.tdsAmount   ? new D(data.tdsAmount)   : null,
        totalAmount:  dr,
        postedAt:     new Date(),
        postedById:   session.user.id,
        createdById:  session.user.id,
        lines: {
          create: data.lines.map((l, i) => ({
            schoolId:  session.user.schoolId!,
            accountId: l.accountId,
            lineNo:    i + 1,
            debit:     new D(l.debit),
            credit:    new D(l.credit),
            partyType: l.partyType ?? null,
            partyId:   l.partyId   ?? null,
            narration: l.narration ?? null,
          })),
        },
      },
      select: { id: true, number: true },
    })
  })

  revalidatePath("/accounting/vouchers")
  revalidatePath("/accounting/reports/trial-balance")
  revalidatePath("/accounting/ledger")
  revalidatePath("/accounting/day-book")
  revalidatePath("/accounting")
  return created  // { id, number } — JSON-safe
}

// ─── System-posted helper (used by fee/payroll auto-posting in later phase) ─

export async function postSystemVoucher(
  schoolId: string,
  userId: string | null,
  input: VoucherInput,
) {
  // Skip permission check — only callable from server-side integration code.
  const data = voucherSchema.parse(input)
  validateLineShape(data.lines)
  if (data.type === "CV") await validateContra(schoolId, data.lines.map(l => l.accountId))

  const { dr, cr } = sumLines(data.lines)
  if (!dr.equals(cr) || dr.lessThanOrEqualTo(0)) {
    throw new Error("System voucher is not balanced")
  }

  const fy = await prisma.fiscalYear.findUnique({ where: { id: data.fiscalYearId } })
  if (!fy || fy.schoolId !== schoolId) throw new Error("Invalid fiscal year")
  if (fy.status !== "OPEN") throw new Error("Fiscal year is not open")

  return prisma.$transaction(async (tx) => {
    const counter = await tx.voucherCounter.upsert({
      where: {
        schoolId_fiscalYearId_type: { schoolId, fiscalYearId: data.fiscalYearId, type: data.type },
      },
      create: { schoolId, fiscalYearId: data.fiscalYearId, type: data.type, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    const number = formatVoucherNumber(data.type as VoucherType, fy.name, counter.lastNumber)

    return tx.voucher.create({
      data: {
        schoolId,
        fiscalYearId: data.fiscalYearId,
        type:         data.type,
        number,
        dateBS:       data.dateBS,
        dateAD:       toAD(data.dateBS),
        narration:    data.narration,
        status:       "POSTED",
        partyType:    data.partyType ?? null,
        partyId:      data.partyId   ?? null,
        partyName:    data.partyName ?? null,
        panNumber:    data.panNumber ?? null,
        totalAmount:  dr,
        postedAt:     new Date(),
        postedById:   userId,
        createdById:  userId,
        lines: {
          create: data.lines.map((l, i) => ({
            schoolId,
            accountId: l.accountId,
            lineNo:    i + 1,
            debit:     new D(l.debit),
            credit:    new D(l.credit),
            partyType: l.partyType ?? null,
            partyId:   l.partyId   ?? null,
            narration: l.narration ?? null,
          })),
        },
      },
    })
  })
}
