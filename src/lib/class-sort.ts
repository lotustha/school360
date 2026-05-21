// Natural ordering helpers for class lists.
//
// Prisma can't sort numerically on a string column ("Class 10" comes between
// "Class 1" and "Class 2" lexically). Run findMany unsorted (or
// alphabetically), then pipe through `sortClassesByFacultyThenName` before
// rendering / passing to the client.

export interface ClassSortable {
  name:         string
  facultyName?: string | null
}

// Natural-aware comparator: "Class 2" < "Class 10".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b)
}

// Sort by (faculty name, natural class name). Classes without a faculty
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
    return collator.compare(a.name, b.name)
  })
}
