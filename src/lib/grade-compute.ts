import type { GradeRow } from "@/lib/grading-config"

/**
 * Lookup the GradeRow whose minPercent the given percentage clears. Returns the
 * lowest-tier row when nothing matches (guards against empty / mis-sorted scales).
 */
export function resolveGradeFromPercent(percent: number, scale: GradeRow[]): GradeRow {
  if (scale.length === 0) {
    return { grade: "NG", gpa: 0, minPercent: 0, description: "Not Graded" }
  }
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent)
  return sorted.find(r => percent >= r.minPercent) ?? sorted[sorted.length - 1]
}

/**
 * Map a credit-hour-weighted subject GP back to a grade letter via the same
 * scale. NEB practice: subject grade follows GP, not raw percentage.
 * Falls through to the lowest tier (typically NG) when nothing matches.
 */
export function mapGpaToGrade(gpa: number, scale: GradeRow[]): GradeRow {
  if (scale.length === 0) {
    return { grade: "NG", gpa: 0, minPercent: 0, description: "Not Graded" }
  }
  const sorted = [...scale].sort((a, b) => b.gpa - a.gpa)
  return sorted.find(r => gpa >= r.gpa) ?? sorted[sorted.length - 1]
}

/**
 * Derive grade letter + GPA + description from raw (obtained / max). When max is
 * zero or negative we treat the part as not graded so render layers can show a blank.
 */
export function gradePart(obtained: number, max: number, scale: GradeRow[]): {
  percent: number
  grade:   string
  gpa:     number
  remark:  string
} {
  if (max <= 0) {
    return { percent: 0, grade: "", gpa: 0, remark: "" }
  }
  const percent = (obtained / max) * 100
  const row     = resolveGradeFromPercent(percent, scale)
  return {
    percent: Math.round(percent * 100) / 100,
    grade:   row.grade,
    gpa:     row.gpa,
    remark:  row.description,
  }
}
