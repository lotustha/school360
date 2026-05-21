// Cross-page shared filter persistence.
//
// Pattern: URL search params are the source of truth at render time. On first
// mount a toolbar can hydrate from `localStorage` if the URL has none of the
// shared keys — that copies the user's last-picked filters into the URL,
// which then re-runs the server component with them applied.
//
// On any filter change, all 5 keys are written back to storage so other pages
// see the same selection on their next visit. Pages render only the chips
// they actually use; the other keys are preserved untouched.

export const GLOBAL_FILTER_KEYS = [
  "academicYearId",
  "facultyId",
  "classId",
  "sectionId",
  "status",
] as const

export type GlobalFilterKey = (typeof GLOBAL_FILTER_KEYS)[number]
export type GlobalFilters   = Partial<Record<GlobalFilterKey, string>>

export const GLOBAL_FILTERS_STORAGE = "school360.global-filters"

// ─── Read / write storage ────────────────────────────────────────────────────

export function readGlobalFilters(): GlobalFilters {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(GLOBAL_FILTERS_STORAGE)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: GlobalFilters = {}
    for (const k of GLOBAL_FILTER_KEYS) {
      const v = parsed[k]
      if (typeof v === "string" && v) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function writeGlobalFilters(next: GlobalFilters) {
  if (typeof window === "undefined") return
  try {
    // Merge with existing so a page that doesn't track Section still preserves it
    const cur = readGlobalFilters()
    const merged: GlobalFilters = { ...cur }
    for (const k of GLOBAL_FILTER_KEYS) {
      const v = next[k]
      if (v && v.length > 0) merged[k] = v
      else                   delete merged[k]
    }
    window.localStorage.setItem(GLOBAL_FILTERS_STORAGE, JSON.stringify(merged))
  } catch { /* private mode etc. */ }
}

// ─── URL <→> filter helpers ──────────────────────────────────────────────────

export function readGlobalFiltersFromUrl(
  searchParams: URLSearchParams,
): GlobalFilters {
  const out: GlobalFilters = {}
  for (const k of GLOBAL_FILTER_KEYS) {
    const v = searchParams.get(k)
    if (v) out[k] = v
  }
  return out
}

export function hasAnyGlobalFilterInUrl(searchParams: URLSearchParams): boolean {
  for (const k of GLOBAL_FILTER_KEYS) {
    if (searchParams.get(k)) return true
  }
  return false
}

/**
 * Apply a `GlobalFilters` patch to a URLSearchParams instance — adds/removes
 * the 5 keys, leaves other params (q, page, etc.) untouched.
 */
export function applyGlobalFilters(
  params:   URLSearchParams,
  filters:  GlobalFilters,
): URLSearchParams {
  const out = new URLSearchParams(params)
  for (const k of GLOBAL_FILTER_KEYS) {
    const v = filters[k]
    if (v) out.set(k, v)
    else   out.delete(k)
  }
  return out
}
