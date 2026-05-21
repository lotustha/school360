/**
 * NEB credit-hour resolution.
 *
 * Subject GP is the credit-hour-weighted average of theory and internal GPs:
 *   subjectGP = (inGP × internalCH + exGP × externalCH) / (internalCH + externalCH)
 *
 * Per-year configuration lives in `SubjectAcademicYearStatus` (renamed
 * conceptually to "year config" — table name kept for back-compat). Subject
 * carries a legacy single `creditHours` value for back-compat. Resolution
 * order:
 *   1. Per-year explicit internal + external CH set → use both.
 *   2. Per-year `creditHours` set + (internalMax + externalMax) > 0 → pro-rate.
 *   3. Subject legacy `creditHours` + max-marks ratio → pro-rate.
 *   4. Else → all zeros (subject not yet configured for GPA).
 */

export type CreditHourSplit = {
  internal: number
  external: number
  total:    number
}

type SubjectCH = {
  creditHours:         number | null
  internalCreditHours: number | null
  externalCreditHours: number | null
}

type SubjectYearCH = {
  creditHours:         number | null
  internalCreditHours: number | null
  externalCreditHours: number | null
} | null | undefined

export function resolveCreditHourSplit(
  subject:    SubjectCH,
  yearConfig: SubjectYearCH,
  internalMax: number,
  externalMax: number,
): CreditHourSplit {
  // 1. Per-year explicit pillar split wins (NEB weightages can change yearly).
  if (yearConfig
      && typeof yearConfig.internalCreditHours === "number"
      && typeof yearConfig.externalCreditHours === "number") {
    const internal = yearConfig.internalCreditHours
    const external = yearConfig.externalCreditHours
    return { internal, external, total: internal + external }
  }
  // 2. School-wide explicit pillar split on Subject.
  if (typeof subject.internalCreditHours === "number"
      && typeof subject.externalCreditHours === "number") {
    const internal = subject.internalCreditHours
    const external = subject.externalCreditHours
    return { internal, external, total: internal + external }
  }
  // 3+4. Total CH (year override or subject default), pro-rated by max-marks.
  const total = (yearConfig?.creditHours ?? subject.creditHours) ?? null
  if (total === null || total <= 0) return { internal: 0, external: 0, total: 0 }

  const fullMarks = internalMax + externalMax
  if (fullMarks <= 0) return { internal: 0, external: 0, total: 0 }

  const internal = (total * internalMax) / fullMarks
  const external = (total * externalMax) / fullMarks
  return {
    internal: round2(internal),
    external: round2(external),
    total:    round2(internal + external),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
