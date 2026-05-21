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
