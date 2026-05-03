// Nepal Grading Utilities
// Source of truth for all grade calculations — never hardcode grade boundaries in components.

export type GradeResult = {
  grade: string
  gpa: number
  description: string
  isPassed: boolean
}

const NEB_SCALE = [
  { grade: "A+", minPct: 90, gpa: 4.0, description: "Outstanding" },
  { grade: "A",  minPct: 80, gpa: 3.6, description: "Excellent" },
  { grade: "B+", minPct: 70, gpa: 3.2, description: "Very Good" },
  { grade: "B",  minPct: 60, gpa: 2.8, description: "Good" },
  { grade: "C+", minPct: 50, gpa: 2.4, description: "Satisfactory" },
  { grade: "C",  minPct: 40, gpa: 2.0, description: "Acceptable" },
  { grade: "D",  minPct: 35, gpa: 1.6, description: "Partially Acceptable" },
  { grade: "NG", minPct: 0,  gpa: 0.0, description: "Not Graded" },
]

const TU_SCALE = [
  { grade: "A",  minPct: 90, gpa: 4.0, description: "Outstanding" },
  { grade: "A-", minPct: 80, gpa: 3.7, description: "Excellent" },
  { grade: "B+", minPct: 70, gpa: 3.3, description: "Very Good" },
  { grade: "B",  minPct: 65, gpa: 3.0, description: "Good" },
  { grade: "B-", minPct: 60, gpa: 2.7, description: "Above Average" },
  { grade: "C+", minPct: 55, gpa: 2.3, description: "Average" },
  { grade: "C",  minPct: 50, gpa: 2.0, description: "Satisfactory" },
  { grade: "D",  minPct: 40, gpa: 1.3, description: "Marginal Pass" },
  { grade: "F",  minPct: 0,  gpa: 0.0, description: "Fail" },
]

function lookupGrade(scale: typeof NEB_SCALE, pct: number, passMark: number): GradeResult {
  const entry = scale.find(s => pct >= s.minPct) ?? scale[scale.length - 1]
  return { ...entry, isPassed: pct >= passMark }
}

export const getNEBGrade  = (pct: number, passMark = 35) => lookupGrade(NEB_SCALE, pct, passMark)
export const getCDCGrade  = (pct: number, passMark = 35) => lookupGrade(NEB_SCALE, pct, passMark)
export const getTUGrade   = (pct: number, passMark = 40) => lookupGrade(TU_SCALE,  pct, passMark)

/** SEE CGPA = average GPA of best 5 subjects */
export function computeSEECGPA(results: { gpa: number }[]): number {
  const top5 = [...results].sort((a, b) => b.gpa - a.gpa).slice(0, 5)
  if (!top5.length) return 0
  return round2(top5.reduce((s, r) => s + r.gpa, 0) / top5.length)
}

/** Weighted SGPA/CGPA by credit hours */
export function computeWeightedGPA(courses: { creditHours: number; gpa: number }[]): number {
  const totalCredits = courses.reduce((s, c) => s + c.creditHours, 0)
  if (!totalCredits) return 0
  return round2(courses.reduce((s, c) => s + c.gpa * c.creditHours, 0) / totalCredits)
}

/** SEE/NEB: eligible for supplementary if 1-2 subjects are NG */
export function isSupplementaryEligible(ngCount: number, maxNG = 2): boolean {
  return ngCount > 0 && ngCount <= maxNG
}

/** Grade badge color for UI */
export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    "A+": "emerald", "A": "emerald", "A-": "emerald",
    "B+": "blue",    "B": "blue",    "B-": "blue",
    "C+": "amber",   "C": "amber",   "C-": "amber",
    "D":  "orange",
    "NG": "rose",    "F": "rose",
  }
  return map[grade] ?? "slate"
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
