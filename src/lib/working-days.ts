// Working-days resolution: Class > Faculty > School. Empty arrays mean
// "inherit". This mirrors how Prisma stores the override (Int[] @default([])).
//
// Day indices: 0=Sun, 1=Mon, …, 6=Sat (matches `dayOfWeek` on RoutineEntry).

export interface WorkingDaysScope {
  schoolWorkingDays:   number[]
  facultyWorkingDays?: number[] | null
  classWorkingDays?:   number[] | null
}

export function effectiveWorkingDays(scope: WorkingDaysScope): number[] {
  if (scope.classWorkingDays && scope.classWorkingDays.length > 0) {
    return [...scope.classWorkingDays].sort((a, b) => a - b)
  }
  if (scope.facultyWorkingDays && scope.facultyWorkingDays.length > 0) {
    return [...scope.facultyWorkingDays].sort((a, b) => a - b)
  }
  return [...scope.schoolWorkingDays].sort((a, b) => a - b)
}

// Display helpers for routine grids (Sun=1 numbering per spec).
export const DAY_LABELS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
export const DAY_LABELS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

/** Day-of-week index → user-facing 1-based number (Sun=1, Mon=2 … Sat=7) */
export function dayDisplayNumber(dayOfWeek: number): number {
  return ((dayOfWeek % 7) + 7) % 7 + 1
}
