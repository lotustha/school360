import type { PassGracePolicy } from "@/lib/format-marks"

export type GradeRow = {
  grade:       string
  gpa:         number
  minPercent:  number
  description: string
}

/** Which evaluations count toward a student's aggregate NG status on the ledger. */
export type AggregateNGScope = "allEvaluations" | "isFinalOnly" | "latestOnly"

/**
 * Persisted on School.gradingSettings (JSON). All fields are optional on the
 * stored shape — `resolveGradingSettings` fills in NEB defaults at read time.
 */
export type GradingSettings = {
  type?:               "NEB_GPA" | "PERCENTAGE"
  /** Legacy subject-total fallback; kept for back-compat but unused for status. */
  passPercent?:         number
  /** NEB: practical/internal threshold (default 40). */
  internalPassPercent?: number
  /** NEB: theory/external threshold (default 35). */
  externalPassPercent?: number
  /** Rounding rule applied when comparing obtained marks to the pass threshold. */
  passMarkGracePolicy?: PassGracePolicy
  /** Which evaluations trigger aggregate NG on the class ledger GPA column. */
  aggregateNGScope?:    AggregateNGScope
  scale?:               GradeRow[]
  /** Marks-entry typo-detector thresholds. See `markEntryOutlier*` defaults. */
  markEntryOutlierCellMaxPct?:    number  // cell% below this is "low enough to be suspicious"
  markEntryOutlierVsOwnAvgRatio?: number  // cell% must be < ratio × student's other-component avg
  markEntryMissingFillRate?:       number  // ≥this fraction of class scored → flag empty cells
}

/** Concrete shape after defaults are filled in. */
export type ResolvedGradingSettings = {
  type:                          "NEB_GPA" | "PERCENTAGE"
  passPercent:                   number
  internalPassPercent:           number
  externalPassPercent:           number
  passMarkGracePolicy:           PassGracePolicy
  aggregateNGScope:              AggregateNGScope
  scale:                         GradeRow[]
  markEntryOutlierCellMaxPct:    number
  markEntryOutlierVsOwnAvgRatio: number
  markEntryMissingFillRate:      number
}

export type ComponentType = "INTERNAL" | "EXTERNAL" | "CAS"

export type BreakdownItem = { label: string; marks: number }

export const NEB_DEFAULT_SCALE: GradeRow[] = [
  { grade: "A+", gpa: 4.0, minPercent: 90, description: "Outstanding" },
  { grade: "A",  gpa: 3.6, minPercent: 80, description: "Excellent" },
  { grade: "B+", gpa: 3.2, minPercent: 70, description: "Very Good" },
  { grade: "B",  gpa: 2.8, minPercent: 60, description: "Good" },
  { grade: "C+", gpa: 2.4, minPercent: 50, description: "Satisfactory" },
  { grade: "C",  gpa: 2.0, minPercent: 40, description: "Acceptable" },
  { grade: "D",  gpa: 1.6, minPercent: 35, description: "Partially Acceptable" },
  { grade: "NG", gpa: 0.0, minPercent: 0,  description: "Not Graded (Fail)" },
]

export const DEFAULT_GRADING_SETTINGS: ResolvedGradingSettings = {
  type:                          "NEB_GPA",
  passPercent:                   35,
  internalPassPercent:           40,
  externalPassPercent:           35,
  passMarkGracePolicy:           "roundHalfUp",
  aggregateNGScope:              "allEvaluations",
  scale:                         NEB_DEFAULT_SCALE,
  // Strict typo-detection defaults — keep false positives low; admins can relax.
  markEntryOutlierCellMaxPct:    40,
  markEntryOutlierVsOwnAvgRatio: 0.5,
  markEntryMissingFillRate:      0.5,
}

/**
 * Normalize any persisted `School.gradingSettings` JSON into a fully-resolved
 * settings object. Reads must always go through this so defaults stay consistent.
 */
export function resolveGradingSettings(raw: unknown): ResolvedGradingSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as GradingSettings
  return {
    type:                          s.type                          ?? DEFAULT_GRADING_SETTINGS.type,
    passPercent:                   s.passPercent                   ?? DEFAULT_GRADING_SETTINGS.passPercent,
    internalPassPercent:           s.internalPassPercent           ?? DEFAULT_GRADING_SETTINGS.internalPassPercent,
    externalPassPercent:           s.externalPassPercent           ?? DEFAULT_GRADING_SETTINGS.externalPassPercent,
    passMarkGracePolicy:           s.passMarkGracePolicy           ?? DEFAULT_GRADING_SETTINGS.passMarkGracePolicy,
    aggregateNGScope:              s.aggregateNGScope              ?? DEFAULT_GRADING_SETTINGS.aggregateNGScope,
    scale:                         (s.scale && s.scale.length > 0) ? s.scale : NEB_DEFAULT_SCALE,
    markEntryOutlierCellMaxPct:    s.markEntryOutlierCellMaxPct    ?? DEFAULT_GRADING_SETTINGS.markEntryOutlierCellMaxPct,
    markEntryOutlierVsOwnAvgRatio: s.markEntryOutlierVsOwnAvgRatio ?? DEFAULT_GRADING_SETTINGS.markEntryOutlierVsOwnAvgRatio,
    markEntryMissingFillRate:      s.markEntryMissingFillRate      ?? DEFAULT_GRADING_SETTINGS.markEntryMissingFillRate,
  }
}

// NEB presets for subject components
export const NEB_COMPONENT_PRESETS: Record<ComponentType, {
  fullMarks: number
  passMarks: number
  breakdown: BreakdownItem[]
}> = {
  INTERNAL: {
    fullMarks: 25,
    passMarks: 10,
    breakdown: [
      { label: "Attendance",    marks: 2 },
      { label: "Participation", marks: 3 },
      { label: "Assignment",    marks: 5 },
      { label: "Terminal I",    marks: 7 },
      { label: "Terminal II",   marks: 8 },
    ],
  },
  EXTERNAL: { fullMarks: 75, passMarks: 27, breakdown: [] },
  CAS:      { fullMarks: 50, passMarks: 20, breakdown: [] },
}
