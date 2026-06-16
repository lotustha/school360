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

const AD_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

/** Full English month name for a 1-indexed AD month. */
export function adMonthName(month: number): string {
  return AD_MONTHS[month - 1] ?? ""
}

/** "Jun 16, 2026" from a JS Date (AD). */
export function formatAD(date: Date): string {
  return `${AD_MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`
}

/** BS → AD, returning null instead of throwing when the BS year is unconfigured. */
export function toADSafe(bsStr: string): Date | null {
  try { return toAD(bsStr) } catch { return null }
}

/** AD → BS, returning null instead of throwing at calendar-data edges. */
export function toBSSafe(date: Date): string | null {
  try { return toBS(date) } catch { return null }
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

/** First day of the BS month that follows the given BS date.  "2082-05-15" → "2082-06-01" */
export function nextBSMonthStart(bsStr: string): string {
  const [y, m] = bsStr.split("-").map(Number)
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear  = m === 12 ? y + 1 : y
  return `${nextYear}-${pad(nextMonth)}-01`
}

/** Last day of the given BS month, in "YYYY-MM-DD" form. */
export function bsMonthEnd(year: number, month: number): string {
  return `${year}-${pad(month)}-${pad(daysInBsMonth(year, month))}`
}

export interface FiscalMonth {
  /** 1..12 (1 = first BS month of the FY = Shrawan, since Nepal FY starts Shrawan 1). */
  monthIndex: number
  /** BS month number (1=Baisakh..12=Chaitra). */
  bsMonth:    number
  /** BS year for this month. */
  bsYear:     number
  /** "Shrawan 2082", "Magh 2082" etc. */
  label:      string
  /** First day of this month, BS. */
  startBS:    string
  /** Last day of this month, BS. */
  endBS:      string
}

/**
 * Enumerate the 12 BS months that make up a Nepal fiscal year (Shrawan 1 → Asar end).
 * monthIndex 1 = Shrawan (first FY month), 12 = Asar (last FY month).
 */
export function monthsInFiscalYear(fy: FiscalYearInfo): FiscalMonth[] {
  const [startYear] = fy.startBS.split("-").map(Number)
  const months: FiscalMonth[] = []
  for (let i = 0; i < 12; i++) {
    const monthIndex = i + 1
    // FY starts at month 4 (Shrawan). i=0 → month 4; i=8 → month 12; i=9 → month 1 of next year.
    const bsMonth = ((3 + i) % 12) + 1
    const bsYear  = bsMonth >= 4 ? startYear : startYear + 1
    months.push({
      monthIndex,
      bsMonth,
      bsYear,
      label:   `${bsMonthName(bsMonth)} ${bsYear}`,
      startBS: `${bsYear}-${pad(bsMonth)}-01`,
      endBS:   bsMonthEnd(bsYear, bsMonth),
    })
  }
  return months
}

// ─── Plan period generation (calendar-aware) ────────────────────────────────

const AD_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export interface PlanPeriod {
  /** 1-based offset from the plan's startMonth */
  periodIndex: number
  /** Human label, e.g. "Baisakh 2082" (BS) or "Jan 2025" (AD) */
  label:       string
  /** Stored due date in BS regardless of plan's calendar system */
  dueDateBS:   string
}

/**
 * Generate `count` consecutive months starting from (startMonth, startYear) in the
 * given calendar. Used by FeePlan.applyPlanToTarget to label and date StudentFee
 * rows. For AD calendars, due-dates are computed in AD then converted to BS for
 * storage (the schema's dueDateAD is the converse derivation).
 *
 * Examples:
 *   calendar=BS, startMonth=4 (Shrawan), startYear=2082, dueDay=10:
 *     [1: Shrawan 2082 · 2082-04-10, 2: Bhadra 2082, ..., 12: Asar 2083]
 *   calendar=BS, startMonth=1 (Baisakh), startYear=2082, dueDay=10:
 *     [1: Baisakh 2082 · 2082-01-10, ..., 12: Chaitra 2082]
 *   calendar=AD, startMonth=1 (Jan), startYear=2025, dueDay=10:
 *     [1: Jan 2025, ..., 12: Dec 2025]
 */
export function generatePlanPeriods(opts: {
  calendar:  "BS" | "AD"
  startMonth: number
  startYear:  number
  dueDay:     number
  count?:     number
}): PlanPeriod[] {
  const count = opts.count ?? 12
  const periods: PlanPeriod[] = []
  for (let i = 0; i < count; i++) {
    const monthOffset = opts.startMonth - 1 + i
    const m = (monthOffset % 12) + 1
    const yearOffset = Math.floor(monthOffset / 12)
    const y = opts.startYear + yearOffset
    if (opts.calendar === "BS") {
      const lastDay = daysInBsMonth(y, m)
      const day = Math.min(opts.dueDay, lastDay)
      periods.push({
        periodIndex: i + 1,
        label:     `${bsMonthName(m)} ${y}`,
        dueDateBS: `${y}-${pad(m)}-${pad(day)}`,
      })
    } else {
      // AD → compute in AD then convert to BS
      const adLastDay = new Date(y, m, 0).getDate()
      const day = Math.min(opts.dueDay, adLastDay)
      const adDate = new Date(y, m - 1, day)
      periods.push({
        periodIndex: i + 1,
        label:     `${AD_MONTHS_SHORT[m - 1]} ${y}`,
        dueDateBS: toBS(adDate),
      })
    }
  }
  return periods
}
