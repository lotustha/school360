// Natural ordering helpers for class lists.
//
// Prisma can't sort numerically on a string column ("Class 10" comes between
// "Class 1" and "Class 2" lexically). Run findMany unsorted (or
// alphabetically), then pipe through `sortClassesByFacultyThenName` before
// rendering / passing to the client.
//
// Class-name ordering is school-specific in Nepal: pre-primary tiers (ECD,
// Nursery, LKG, UKG) come BEFORE numbered grades, then grades 1..12 in
// numeric order. Plain "Class 10" sorts after "Class 9", not after "Class 1".

export interface ClassSortable {
  name:         string
  facultyName?: string | null
}

// Natural-aware comparator: "Class 2" < "Class 10".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b)
}

/**
 * Numeric rank for a class name. Lower number = earlier in the academic
 * progression. Pre-primary tiers use negative ranks so they sort before
 * Grade 1. Numbered grades use their own number. Unknown names sort last.
 *
 *   "Play"         → -50
 *   "Nursery"      → -40
 *   "LKG"          → -30
 *   "UKG"          → -20
 *   "ECD"          → -10
 *   "ECD 2"        →  -9   (so ECD precedes ECD 2)
 *   "ECD 3"        →  -8
 *   "Class 1" / "Grade 1" / "1" → 1
 *   "Class 10"     → 10
 *   "Special"      → 9999
 */
export function classRank(name: string): number {
  const n = name.toUpperCase().trim()
  if (/\bPLAY\b/.test(n))                  return -50
  if (/\bNUR(SERY)?\b/.test(n))            return -40
  if (/\bLKG\b/.test(n))                   return -30
  if (/\bUKG\b/.test(n))                   return -20
  const ecd = n.match(/\bECD\s*(\d+)?\b/)
  if (ecd) {
    const num = ecd[1] ? parseInt(ecd[1], 10) : 1
    return -10 + (num - 1)   // ECD = -10, ECD 2 = -9, ECD 3 = -8 …
  }
  const m = n.match(/(\d+)/)
  if (m) return parseInt(m[1], 10)
  return 9999
}

/**
 * Compare two class names by academic progression (pre-primary → 1..12 → other).
 * Falls back to natural collation when ranks tie (e.g. two unknown names, or
 * two grades that share a number).
 */
export function compareClassNames(a: string, b: string): number {
  const ra = classRank(a)
  const rb = classRank(b)
  if (ra !== rb) return ra - rb
  return collator.compare(a, b)
}

// Sort by (faculty name, class progression). Classes without a faculty
// ("General") sort last.
export function sortClassesByFacultyThenName<T extends ClassSortable>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const af = a.facultyName ?? ""
    const bf = b.facultyName ?? ""
    if (af !== bf) {
      if (af === "") return  1
      if (bf === "") return -1
      return collator.compare(af, bf)
    }
    return compareClassNames(a.name, b.name)
  })
}
