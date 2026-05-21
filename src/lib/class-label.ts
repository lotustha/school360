// Format a class name with optional faculty suffix.
//
// Rule: show "Class 11 — Science" wherever a class is listed UNLESS a faculty
// filter is already active in the surrounding scope (in which case the
// faculty is redundant). Callers either pass `hideFaculty: true` (filter
// active) or omit it.

export interface ClassLike {
  name:         string
  facultyName?: string | null
}

export function formatClassLabel(
  cls:          ClassLike,
  opts?:        { hideFaculty?: boolean; separator?: string },
): string {
  const sep = opts?.separator ?? " — "
  if (opts?.hideFaculty) return cls.name
  if (!cls.facultyName) return cls.name
  return `${cls.name}${sep}${cls.facultyName}`
}
