"use server"

import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { toAD } from "@/lib/nepali-date"

const D = Prisma.Decimal
const ZERO = new D(0)

export type PartyKind = "STUDENT" | "EMPLOYEE" | "VENDOR" | "OTHER"

export interface PartySummary {
  partyId:   string | null
  partyName: string
  partyType: PartyKind
  netDebit:  string  // positive = receivable from party / paid to party more than received
  netCredit: string
  count:     number
}

/**
 * List parties with summary balances from postings + voucher header data.
 * Uses voucher.partyType+partyId+partyName since not every party has its own
 * account (students/employees still post against the control account).
 */
export async function listPartiesSummary(partyType: PartyKind, fiscalYearId?: string): Promise<PartySummary[]> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const lines = await prisma.journalEntry.findMany({
    where: {
      schoolId,
      voucher: {
        partyType,
        status: { in: ["POSTED", "REVERSED"] },
        ...(fiscalYearId && { fiscalYearId }),
      },
    },
    select: {
      debit:    true,
      credit:   true,
      voucher:  { select: { partyId: true, partyName: true } },
      account:  { select: { type: true, subType: true } },
    },
  })

  // Aggregate by partyName (partyId may be null when no party master exists yet)
  const map = new Map<string, { partyId: string | null; partyName: string; dr: Prisma.Decimal; cr: Prisma.Decimal; count: number }>()
  for (const l of lines) {
    if (!l.voucher.partyName) continue
    // Only count lines posted against subsidiary-ledger-relevant accounts:
    //   - Vendor:   PAYABLE
    //   - Student:  RECEIVABLE
    //   - Employee: PAYABLE or RECEIVABLE
    const isRelevant =
      l.account.subType === "PAYABLE" ||
      l.account.subType === "RECEIVABLE"
    if (!isRelevant) continue

    const key = `${l.voucher.partyId ?? ""}|${l.voucher.partyName}`
    const cur = map.get(key) ?? { partyId: l.voucher.partyId, partyName: l.voucher.partyName, dr: ZERO, cr: ZERO, count: 0 }
    cur.dr = cur.dr.add(l.debit)
    cur.cr = cur.cr.add(l.credit)
    cur.count += 1
    map.set(key, cur)
  }

  return [...map.values()]
    .map(p => {
      const net = p.dr.minus(p.cr)
      return {
        partyId:   p.partyId,
        partyName: p.partyName,
        partyType,
        netDebit:  net.greaterThan(0)  ? net.toFixed(2) : "0.00",
        netCredit: net.lessThan(0)     ? net.neg().toFixed(2) : "0.00",
        count:     p.count,
      }
    })
    .sort((a, b) => a.partyName.localeCompare(b.partyName))
}

export interface PartyLedgerRow {
  dateBS:        string
  voucherId:     string
  voucherNumber: string | null
  voucherType:   string
  narration:     string
  accountCode:   string
  accountName:   string
  debit:         string
  credit:        string
  running:       string
}

export interface PartyLedger {
  partyType:     PartyKind
  partyName:     string
  rows:          PartyLedgerRow[]
  totalDebit:    string
  totalCredit:   string
  closingBalance: string  // signed: positive = Dr
}

export async function getPartyLedger(
  partyType: PartyKind,
  partyName: string,
  fiscalYearId?: string,
  fromBS?: string,
  toBS?: string,
): Promise<PartyLedger> {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!

  const fromAD = fromBS ? toAD(fromBS) : undefined
  const toADate = toBS ? toAD(toBS) : undefined

  const lines = await prisma.journalEntry.findMany({
    where: {
      schoolId,
      account: { subType: { in: ["PAYABLE", "RECEIVABLE"] } },
      voucher: {
        partyType,
        partyName,
        status: { in: ["POSTED", "REVERSED"] },
        ...(fiscalYearId && { fiscalYearId }),
        ...((fromAD || toADate) && { dateAD: { ...(fromAD && { gte: fromAD }), ...(toADate && { lte: toADate }) } }),
      },
    },
    include: {
      voucher: { select: { id: true, number: true, type: true, dateAD: true, dateBS: true, narration: true } },
      account: { select: { code: true, name: true } },
    },
    orderBy: [{ voucher: { dateAD: "asc" } }, { voucher: { createdAt: "asc" } }, { lineNo: "asc" }],
  })

  let running = ZERO
  let totalDr = ZERO
  let totalCr = ZERO

  const rows: PartyLedgerRow[] = lines.map(l => {
    running = running.add(l.debit).minus(l.credit)
    totalDr = totalDr.add(l.debit)
    totalCr = totalCr.add(l.credit)
    return {
      dateBS:        l.voucher.dateBS,
      voucherId:     l.voucher.id,
      voucherNumber: l.voucher.number,
      voucherType:   l.voucher.type,
      narration:     l.voucher.narration,
      accountCode:   l.account.code,
      accountName:   l.account.name,
      debit:         l.debit.toFixed(2),
      credit:        l.credit.toFixed(2),
      running:       running.toFixed(2),
    }
  })

  return {
    partyType, partyName,
    rows,
    totalDebit:     totalDr.toFixed(2),
    totalCredit:    totalCr.toFixed(2),
    closingBalance: running.toFixed(2),
  }
}
