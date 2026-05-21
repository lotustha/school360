/**
 * Display + pass-mark helpers used by ledger, transcript, and Excel export.
 * Centralized so the same rounding rules apply everywhere a mark is shown.
 *
 * Display conventions:
 *   integer → round-half-up to whole number (NEB marksheet style)
 *   percent → 1 decimal
 *   gpa     → 2 decimals
 *   raw     → no rounding; trim trailing zeros for cleanliness
 *
 * Pass-mark policy applies to per-pillar pass checks (internal AND external):
 *   strict       → obtained ≥ ceil(full × passPct/100)
 *   roundHalfUp  → round(obtained) ≥ threshold (forgives 34.5 → 35)
 *   ceilToPass   → ceil(obtained) ≥ threshold (forgives anything above 34.0)
 */

export type MarkFormat = "integer" | "percent" | "gpa" | "raw"
export type PassGracePolicy = "strict" | "roundHalfUp" | "ceilToPass"

export function formatMark(value: number | null | undefined, fmt: MarkFormat): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  switch (fmt) {
    case "integer": return Math.round(value).toString()
    case "percent": return value.toFixed(1)
    case "gpa":     return value.toFixed(2)
    case "raw":     return value % 1 === 0 ? value.toString() : Number(value.toFixed(2)).toString()
  }
}

export function computePassMarks(fullMarks: number, passPercent: number): number {
  if (fullMarks <= 0 || passPercent <= 0) return 0
  return Math.ceil((fullMarks * passPercent) / 100)
}

export function isPillarPass(
  obtained:    number,
  fullMarks:   number,
  passPercent: number,
  policy:      PassGracePolicy,
): boolean {
  if (fullMarks <= 0) return true        // no pillar to fail
  const threshold = computePassMarks(fullMarks, passPercent)
  if (threshold <= 0)  return true
  const compared =
    policy === "roundHalfUp" ? Math.round(obtained) :
    policy === "ceilToPass"  ? Math.ceil(obtained)  :
                               obtained              // strict
  return compared >= threshold
}
