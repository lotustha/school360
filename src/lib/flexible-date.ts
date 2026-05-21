// Flexible date parser for imports.
//
// Handles the formats NEB and other Nepali boards commonly emit:
//   yyyy-mm-dd, yyyy/mm/dd, dd-mm-yyyy, dd/mm/yyyy
//
// Strategy: split on `-` or `/`, identify the year position from the
// magnitude of the segments (a segment > 31 must be a year). When the
// first segment is > 31 we assume year-first; otherwise day-first. We
// deliberately reject all-2-digit-segment dates as ambiguous instead of
// guessing the century — fail-loud is correct for a one-shot admin import.
//
// Returns either an AD `Date` (for calendar="AD") or a BS string
// "YYYY-MM-DD" (for calendar="BS"). The caller is responsible for
// computing the counterpart via toBS/toAD from nepali-date.ts.

import { toBS, toAD } from "@/lib/nepali-date"

export type Calendar = "AD" | "BS"

export interface FlexibleDateResult {
  dobAD: Date    // always populated
  dobBS: string  // always populated, format "YYYY-MM-DD"
}

const AD_YEAR_MIN = 1900
const AD_YEAR_MAX = 2025
const BS_YEAR_MIN = 1950
const BS_YEAR_MAX = 2090

/**
 * Parse a flexible date string (or already-typed Date) and resolve into
 * both AD and BS forms.
 *
 * Throws on:
 *   - unparseable input
 *   - all-2-digit-segment values (e.g. "05-04-08") — ambiguous century
 *   - out-of-range year for the chosen calendar
 *   - day/month outside 1..31 / 1..12
 */
export function parseFlexibleDate(
  raw:      string | number | Date | null | undefined,
  calendar: Calendar,
): FlexibleDateResult {
  // SheetJS with `cellDates: true` may hand us a Date directly.
  if (raw instanceof Date) {
    return forFromDate(raw, calendar)
  }
  if (raw == null) throw new Error("Empty date")
  const s = String(raw).trim()
  if (!s) throw new Error("Empty date")

  // SheetJS may also pass numeric Excel serial dates if cellDates was off.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (n > 25569 && n < 60000) {
      // Excel serial date → JS Date (Excel epoch 1899-12-30)
      const d = new Date(Math.round((n - 25569) * 86400 * 1000))
      if (!Number.isNaN(d.getTime())) return forFromDate(d, calendar)
    }
  }

  const parts = s.split(/[-/.]/).map(p => p.trim())
  if (parts.length !== 3 || parts.some(p => !/^\d+$/.test(p))) {
    throw new Error(`Date "${s}" is not in a recognised format (use YYYY-MM-DD or DD-MM-YYYY)`)
  }

  const [a, b, c] = parts.map(Number)

  let year: number, month: number, day: number

  // First segment > 31 → must be year (yyyy-mm-dd)
  if (a > 31) {
    year = a; month = b; day = c
  }
  // Last segment > 31 → must be year (dd-mm-yyyy)
  else if (c > 31) {
    year = c; month = b; day = a
  }
  // All three ≤ 31 — only acceptable if every segment is 4-digit (impossible)
  // or if we have an unambiguous year via length. Otherwise reject.
  else if (parts[0].length === 4) {
    year = a; month = b; day = c
  }
  else if (parts[2].length === 4) {
    year = c; month = b; day = a
  }
  else {
    throw new Error(`Date "${s}" is ambiguous — please use a 4-digit year`)
  }

  if (month < 1 || month > 12) throw new Error(`Date "${s}": month ${month} is out of range`)
  if (day < 1   || day > 31)   throw new Error(`Date "${s}": day ${day} is out of range`)

  if (calendar === "AD") {
    if (year < AD_YEAR_MIN || year > AD_YEAR_MAX) {
      throw new Error(`Date "${s}": AD year ${year} is implausible`)
    }
    const ad = new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00`)
    if (Number.isNaN(ad.getTime())) throw new Error(`Date "${s}" could not be parsed as AD`)
    const bs = toBS(ad)
    return { dobAD: ad, dobBS: bs }
  }

  // calendar === "BS"
  if (year < BS_YEAR_MIN || year > BS_YEAR_MAX) {
    throw new Error(`Date "${s}": BS year ${year} is implausible`)
  }
  const bsStr = `${year}-${pad(month)}-${pad(day)}`
  let ad: Date
  try {
    ad = toAD(bsStr)
  } catch {
    throw new Error(`Date "${s}" could not be converted from BS to AD`)
  }
  return { dobAD: ad, dobBS: bsStr }
}

function forFromDate(d: Date, calendar: Calendar): FlexibleDateResult {
  if (Number.isNaN(d.getTime())) throw new Error("Invalid Date object")
  if (calendar === "AD") {
    return { dobAD: d, dobBS: toBS(d) }
  }
  // calendar === "BS" but we got an AD Date — treat the Date as already-AD
  // (SheetJS will never invent a BS date; this branch is here for symmetry).
  return { dobAD: d, dobBS: toBS(d) }
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
