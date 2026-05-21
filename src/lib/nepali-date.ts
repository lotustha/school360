import NepaliDate, { dateConfigMap } from "nepali-date-converter"

// 1-indexed month → BS month key used by dateConfigMap
const BS_MONTH_KEYS = [
  "Baisakh","Jestha","Asar","Shrawan","Bhadra","Aswin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
] as const

const BS_MONTHS = [
  "Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
]

export function todayBS(): string {
  const d = new NepaliDate()
  return `${d.getYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toBS(date: Date): string {
  const d = new NepaliDate(date)
  return `${d.getYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toAD(bsStr: string): Date {
  const [y, m, day] = bsStr.split("-").map(Number)
  return new NepaliDate(y, m - 1, day).toJsDate()
}

export function formatBS(bsStr: string): string {
  const [y, m, d] = bsStr.split("-").map(Number)
  return `${BS_MONTHS[m - 1]} ${d}, ${y}`
}

export function bsMonthName(month: number): string {
  return BS_MONTHS[month - 1] ?? ""
}

export function currentBSYear(): number {
  return new NepaliDate().getYear()
}

export function currentAcademicYear(): { start: string; end: string; name: string } {
  const y = currentBSYear()
  return { start: `${y}-04-01`, end: `${y + 1}-03-30`, name: `${y}-${y + 1}` }
}

export function bsDiff(from: string, to: string): number {
  return Math.round((toAD(to).getTime() - toAD(from).getTime()) / 86_400_000)
}

/** Days in a given BS month (1-indexed month). Uses dateConfigMap; falls back to 30. */
export function daysInBsMonth(year: number, month: number): number {
  const cfg = (dateConfigMap as Record<number, Record<string, number>>)[year]
  const key = BS_MONTH_KEYS[month - 1]
  return cfg?.[key] ?? 30
}

export interface FiscalYearInfo {
  /** "2082/83" — startYear / last two digits of endYear */
  name:    string
  /** Shrawan 1 of startYear, e.g. "2082-04-01" */
  startBS: string
  /** Asar last-day of endYear, e.g. "2083-03-32" */
  endBS:   string
  startAD: Date
  endAD:   Date
}

/**
 * Nepali financial year runs Shrawan 1 → Asar end (months 4 → next year's 3).
 * Returns the FY containing the given BS date.
 */
export function fiscalYearOf(bsStr: string): FiscalYearInfo {
  const [y, m] = bsStr.split("-").map(Number)
  // Months 1-3 (Baisakh, Jestha, Asar) belong to the FY that started the previous year.
  // Months 4-12 (Shrawan onward) belong to the FY that started this year.
  const startYear = m >= 4 ? y : y - 1
  const endYear   = startYear + 1
  const startBS   = `${startYear}-04-01`
  const lastDay   = daysInBsMonth(endYear, 3) // Asar
  const endBS     = `${endYear}-03-${pad(lastDay)}`
  return {
    name:    `${startYear}/${String(endYear).slice(-2)}`,
    startBS,
    endBS,
    startAD: toAD(startBS),
    endAD:   toAD(endBS),
  }
}

/** Current Nepali financial year (Shrawan-anchored). */
export function currentFiscalYear(): FiscalYearInfo {
  return fiscalYearOf(todayBS())
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
