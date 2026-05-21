/**
 * Shared cross-page memory for the user's current scope: which faculty they're
 * working in, which session, which class/section. Backed by localStorage under a
 * single key so picks made on /students carry over to /academics/exams,
 * /academics/evaluations, and any other page that opts in.
 *
 * Pages that filter by year NAME (e.g. evaluations list — sessions deduped across
 * faculties) write `academicYearName`. Pages that need a specific row (e.g. the
 * student enrollment form) write `academicYearId`. We keep both so callers can
 * pick whichever is meaningful.
 */

export const GLOBAL_CTX_STORAGE_KEY = "school360.global.context"

/** Sentinel stored in `facultyKey` to represent the "General / no faculty" bucket. */
export const FACULTY_GENERAL = "__none__"

export type GlobalContext = {
  /** Either FACULTY_GENERAL ("__none__") or a real Faculty.id. */
  facultyKey?:       string
  /** Specific AcademicYear row id (preferred when we know it). */
  academicYearId?:   string
  /** AcademicYear name (used when sessions are deduped by name across faculties). */
  academicYearName?: string
  classId?:          string
  sectionId?:        string
}

export function loadGlobalCtx(): GlobalContext {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(GLOBAL_CTX_STORAGE_KEY)
    return raw ? JSON.parse(raw) as GlobalContext : {}
  } catch { return {} }
}

export function saveGlobalCtx(patch: GlobalContext) {
  if (typeof window === "undefined") return
  try {
    const current = loadGlobalCtx()
    const merged: GlobalContext = { ...current, ...patch }
    window.localStorage.setItem(GLOBAL_CTX_STORAGE_KEY, JSON.stringify(merged))
  } catch { /* ignore */ }
}

/** Convenience: clear all stored context. Useful for "switch school" or logout. */
export function clearGlobalCtx() {
  if (typeof window === "undefined") return
  try { window.localStorage.removeItem(GLOBAL_CTX_STORAGE_KEY) } catch { /* ignore */ }
}
