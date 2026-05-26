// Shared formatters for routine views.

/**
 * Auto-shorten a subject name when no `shortName` is set.
 * Examples:
 *   "Compulsory Mathematics"  → "C.Math"   (with shortName override)
 *   "Compulsory Mathematics"  → "CM"       (auto)
 *   "Nepali"                  → "Nep"
 *   "Social Studies"          → "SS"
 *   "English"                 → "Eng"
 */
export function subjectShort(subject: { name: string; shortName?: string | null }): string {
  if (subject.shortName && subject.shortName.trim()) return subject.shortName.trim()
  const words = subject.name.trim().split(/\s+/)
  if (words.length >= 2) {
    return words.map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 4)
  }
  return subject.name.slice(0, 3)
}

/**
 * Class label short form. "Class 11" → "11", "Grade 10" → "10",
 * "Class 5 Section A" → "5A". Falls back to first 4 chars.
 */
export function classShort(cls: { name: string }): string {
  const m = cls.name.match(/(\d{1,2})\s*(?:section\s+)?([A-Z])?/i)
  if (m) {
    const grade = m[1]
    const sec   = m[2]?.toUpperCase() ?? ""
    return `${grade}${sec}`
  }
  return cls.name.slice(0, 4)
}

/**
 * Teacher initials, max 2 chars. "Suraj Shrestha" → "SS",
 * "Suraj" → "SU", "" → "?".
 */
export function teacherInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Stable color palette by faculty id. Null id (General) always gets slot 0.
 * The same facultyId picks the same swatch on every page so the user can
 * visually correlate (Science = violet) across listing / print / etc.
 */
const FACULTY_SWATCHES = [
  { bg: "bg-slate-50",    text: "text-slate-700",   border: "border-slate-200",   dot: "bg-slate-400",   bar: "bg-slate-400" },
  { bg: "bg-violet-50",   text: "text-violet-700",  border: "border-violet-200",  dot: "bg-violet-500",  bar: "bg-violet-500" },
  { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  { bg: "bg-sky-50",      text: "text-sky-700",     border: "border-sky-200",     dot: "bg-sky-500",     bar: "bg-sky-500" },
  { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500",   bar: "bg-amber-500" },
  { bg: "bg-rose-50",     text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-500",    bar: "bg-rose-500" },
  { bg: "bg-fuchsia-50",  text: "text-fuchsia-700", border: "border-fuchsia-200", dot: "bg-fuchsia-500", bar: "bg-fuchsia-500" },
  { bg: "bg-teal-50",     text: "text-teal-700",    border: "border-teal-200",    dot: "bg-teal-500",    bar: "bg-teal-500" },
]

export type FacultySwatch = (typeof FACULTY_SWATCHES)[number]

export function facultyColor(facultyId: string | null): FacultySwatch {
  if (!facultyId) return FACULTY_SWATCHES[0]
  // Deterministic non-cryptographic hash over the id string.
  let h = 0
  for (let i = 0; i < facultyId.length; i++) h = (h * 31 + facultyId.charCodeAt(i)) | 0
  // Skip slot 0 (reserved for null / General) so faculties never collide with it.
  return FACULTY_SWATCHES[1 + (Math.abs(h) % (FACULTY_SWATCHES.length - 1))]
}
