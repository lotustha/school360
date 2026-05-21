// Faculty-scoped academic-year helpers.
//
// An AcademicYear may belong to a Faculty (Science, Management) or be
// "school-wide" (facultyId = null) for the General / no-faculty stream.
// Each (schoolId, facultyId) group has its own `isCurrent` row.

export interface AcademicYearLike {
  id:           string
  name:         string
  isCurrent:    boolean
  facultyId:    string | null
  startDateBS?: string
  endDateBS?:   string
}

export interface FacultyLike {
  id:   string
  name: string
}

/**
 * Resolve the current academic year for a given faculty (or null = school-wide).
 * Prefers a faculty-scoped current row, falls back to a school-wide one.
 */
export function resolveCurrentForFaculty(
  years:     AcademicYearLike[],
  facultyId: string | null,
): AcademicYearLike | null {
  const direct = years.find(y => y.facultyId === facultyId && y.isCurrent)
  if (direct) return direct
  if (facultyId !== null) {
    const shared = years.find(y => y.facultyId === null && y.isCurrent)
    if (shared) return shared
  }
  return null
}

/**
 * Group AYs by faculty for grouped dropdown rendering. Returned in the order
 * faculties are supplied, with the null-faculty group rendered last
 * (labelled "School-wide / General").
 */
export interface YearGroup<Y extends AcademicYearLike = AcademicYearLike> {
  facultyId:   string | null
  facultyName: string                  // "School-wide" for null-faculty group
  years:       Y[]
}

export function groupYearsByFaculty<Y extends AcademicYearLike>(
  years:     Y[],
  faculties: FacultyLike[],
): YearGroup<Y>[] {
  const byFac = new Map<string | null, Y[]>()
  for (const y of years) {
    const k = y.facultyId
    if (!byFac.has(k)) byFac.set(k, [])
    byFac.get(k)!.push(y)
  }
  const out: YearGroup<Y>[] = []
  for (const f of faculties) {
    const list = byFac.get(f.id)
    if (list && list.length > 0) {
      out.push({ facultyId: f.id, facultyName: f.name, years: list })
    }
  }
  const shared = byFac.get(null)
  if (shared && shared.length > 0) {
    out.push({ facultyId: null, facultyName: "School-wide", years: shared })
  }
  return out
}

/** Human label for an AY in a list/picker. */
export function formatYearLabel(y: AcademicYearLike): string {
  return y.isCurrent ? `${y.name} · current` : y.name
}
