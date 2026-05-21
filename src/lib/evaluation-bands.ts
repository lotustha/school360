/**
 * Description presets shown in the New Evaluation form. Picking a preset
 * fills the description field and, when auto-seed is enabled, also seeds
 * the SubjectEvaluations with a recipe of components matching the band's
 * grading schema.
 *
 * `matches` is an optional helper that returns true when a class name
 * appears to fall inside the band — used by the form to pre-tick checkboxes
 * after a preset is chosen. The matcher is best-effort; teachers can adjust.
 */

export type BandKey = "ECD_5" | "GRADE_6_8" | "GRADE_9_10" | "GRADE_11_12" | "CUSTOM"

export type EvaluationBand = {
  key:      BandKey
  label:    string
  /** What populates the `description` text field when this preset is picked. */
  value:    string
  matches?: (className: string) => boolean
}

export type SeedComponentInput = {
  part:           "INTERNAL" | "EXTERNAL"
  label:          string
  maxMarks:       number
  source:         "MANUAL" | "ATTENDANCE" | "DERIVED_FROM_EXAM"
  /**
   * For DERIVED_FROM_EXAM:
   *   - "first" | "second" | "final" — substring used to find a matching Exam by name.
   *   - undefined — match using the evaluation's own name (Terminal Exam case).
   */
  examMatchHint?: "first" | "second" | "final"
  /** Default raw marks of the linked exam (used when no match found). Teacher edits later. */
  sourceMaxMarks?: number
}

export type BandRecipe = {
  internalMax: number
  externalMax: number
  components:  SeedComponentInput[]
}

export type BandRecipeSet = {
  /** isFinal = false */
  interim: BandRecipe | null
  /** isFinal = true */
  final:   BandRecipe | null
}

function gradeNumber(name: string): number | null {
  // "Class 11", "Grade 11", "11", "Grade-11", "Class XII"
  const arabic = name.match(/\b(\d{1,2})\b/)
  if (arabic) return parseInt(arabic[1], 10)
  const roman = name.toUpperCase().match(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\b/)
  if (roman) {
    const map: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 }
    return map[roman[1]] ?? null
  }
  return null
}

export const EVALUATION_BANDS: EvaluationBand[] = [
  {
    key:   "ECD_5",
    label: "ECD to Grade 5 (Basic 1)",
    value: "ECD to Grade 5",
    matches: (name) => {
      if (/ECD|Nursery|LKG|UKG|KG|PP/i.test(name)) return true
      const g = gradeNumber(name)
      return g !== null && g >= 1 && g <= 5
    },
  },
  {
    key:   "GRADE_6_8",
    label: "Grade 6 to 8 (Basic 2)",
    value: "Grade 6 to 8",
    matches: (name) => {
      const g = gradeNumber(name)
      return g !== null && g >= 6 && g <= 8
    },
  },
  {
    key:   "GRADE_9_10",
    label: "Grade 9 to 10 (SEE)",
    value: "Grade 9 to 10",
    matches: (name) => {
      const g = gradeNumber(name)
      return g !== null && g >= 9 && g <= 10
    },
  },
  {
    key:   "GRADE_11_12",
    label: "Grade 11 to 12 (NEB)",
    value: "Grade 11 to 12",
    matches: (name) => {
      const g = gradeNumber(name)
      return g !== null && g >= 11 && g <= 12
    },
  },
  {
    key:   "CUSTOM",
    label: "Custom — pick classes manually",
    value: "",
  },
]

// ─── Recipes ────────────────────────────────────────────────────────────────

const RECIPE_6_8_INTERIM: BandRecipe = {
  internalMax: 50,
  externalMax: 0,
  components: [
    { part: "INTERNAL", label: "Attendance",                 maxMarks: 4,  source: "ATTENDANCE" },
    { part: "INTERNAL", label: "Practical and Project Work", maxMarks: 36, source: "MANUAL" },
    { part: "INTERNAL", label: "Terminal Exam",              maxMarks: 10, source: "DERIVED_FROM_EXAM", sourceMaxMarks: 100 },
  ],
}

const RECIPE_6_8_FINAL: BandRecipe = {
  internalMax: 50,
  externalMax: 50,
  components: [
    { part: "INTERNAL", label: "Attendance",                 maxMarks: 4,  source: "ATTENDANCE" },
    { part: "INTERNAL", label: "Practical and Project Work", maxMarks: 36, source: "MANUAL" },
    { part: "INTERNAL", label: "First Term",                 maxMarks: 5,  source: "DERIVED_FROM_EXAM", examMatchHint: "first",  sourceMaxMarks: 100 },
    { part: "INTERNAL", label: "Second Term",                maxMarks: 5,  source: "DERIVED_FROM_EXAM", examMatchHint: "second", sourceMaxMarks: 100 },
    { part: "EXTERNAL", label: "Final Term",                 maxMarks: 50, source: "DERIVED_FROM_EXAM", examMatchHint: "final",  sourceMaxMarks: 100 },
  ],
}

const RECIPE_9_12_INTERIM: BandRecipe = {
  internalMax: 25,
  externalMax: 0,
  components: [
    { part: "INTERNAL", label: "Attendance",                 maxMarks: 3,  source: "ATTENDANCE" },
    { part: "INTERNAL", label: "Practical and Project Work", maxMarks: 16, source: "MANUAL" },
    { part: "INTERNAL", label: "Terminal Exam",              maxMarks: 6,  source: "DERIVED_FROM_EXAM", sourceMaxMarks: 100 },
  ],
}

const RECIPE_9_12_FINAL: BandRecipe = {
  internalMax: 25,
  externalMax: 75,
  components: [
    { part: "INTERNAL", label: "Attendance",                 maxMarks: 3,  source: "ATTENDANCE" },
    { part: "INTERNAL", label: "Practical and Project Work", maxMarks: 16, source: "MANUAL" },
    { part: "INTERNAL", label: "First Term",                 maxMarks: 3,  source: "DERIVED_FROM_EXAM", examMatchHint: "first",  sourceMaxMarks: 100 },
    { part: "INTERNAL", label: "Second Term",                maxMarks: 3,  source: "DERIVED_FROM_EXAM", examMatchHint: "second", sourceMaxMarks: 100 },
    { part: "EXTERNAL", label: "Final Term",                 maxMarks: 75, source: "DERIVED_FROM_EXAM", examMatchHint: "final",  sourceMaxMarks: 100 },
  ],
}

export const EVALUATION_BAND_RECIPES: Record<BandKey, BandRecipeSet> = {
  ECD_5:       { interim: null,                 final: null                 },
  GRADE_6_8:   { interim: RECIPE_6_8_INTERIM,   final: RECIPE_6_8_FINAL     },
  GRADE_9_10:  { interim: RECIPE_9_12_INTERIM,  final: RECIPE_9_12_FINAL    },
  GRADE_11_12: { interim: RECIPE_9_12_INTERIM,  final: RECIPE_9_12_FINAL    },
  CUSTOM:      { interim: null,                 final: null                 },
}

/**
 * Find an Exam to link a DERIVED_FROM_EXAM component to.
 *
 * - With a `hint` ("first" | "second" | "final"): the first Exam whose name
 *   contains that word case-insensitively. Avoids matching "final" inside
 *   "First Final" by preferring whole-word boundaries.
 * - Without a hint: best match using the evaluation's own name — exact-name match
 *   first, then case-insensitive substring overlap on the longest shared word.
 *
 * Returns null when no match. Caller should leave sourceExamId null and let the
 * teacher fix the link from the detail-page editor.
 */
export function findExamByHint(
  hint: "first" | "second" | "final" | undefined,
  evaluationName: string,
  exams: { id: string; name: string }[],
): { id: string } | null {
  if (exams.length === 0) return null

  if (hint) {
    const re = new RegExp(`\\b${hint}\\b`, "i")
    const match = exams.find(e => re.test(e.name))
    return match ? { id: match.id } : null
  }

  // No hint — match the evaluation's own name.
  const evLower = evaluationName.trim().toLowerCase()
  if (!evLower) return null

  // 1. Exact match
  const exact = exams.find(e => e.name.toLowerCase() === evLower)
  if (exact) return { id: exact.id }

  // 2. Substring (evaluation name contains exam name, or vice versa)
  const containing = exams.find(e => {
    const en = e.name.toLowerCase()
    return en.length > 2 && (evLower.includes(en) || en.includes(evLower))
  })
  if (containing) return { id: containing.id }

  // 3. Word overlap — pick the exam sharing the longest stem with the evaluation name.
  const evWords = new Set(evLower.split(/\W+/).filter(w => w.length > 2))
  if (evWords.size === 0) return null

  let best: { exam: { id: string; name: string }; score: number } | null = null
  for (const e of exams) {
    const ewords = e.name.toLowerCase().split(/\W+/).filter(w => w.length > 2)
    let score = 0
    for (const w of ewords) {
      if (evWords.has(w)) score += w.length
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && e.name.length < best.exam.name.length))) {
      best = { exam: e, score }
    }
  }
  return best ? { id: best.exam.id } : null
}
