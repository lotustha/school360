"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  CalendarRange, FolderTree, GraduationCap, Users, SlidersHorizontal, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import {
  GLOBAL_FILTER_KEYS, readGlobalFilters, writeGlobalFilters,
  hasAnyGlobalFilterInUrl, type GlobalFilterKey,
} from "@/lib/global-filters"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"

export type FacultyOpt      = { id: string; name: string }
export type SectionOpt      = { id: string; name: string }
export type ClassOpt        = {
  id:           string
  name:         string
  facultyId:    string | null
  facultyName?: string | null
  sections?:    SectionOpt[]
}
export type AcademicYearOpt = {
  id:         string
  name:       string
  isCurrent:  boolean
  facultyId?: string | null
}

export interface GlobalFiltersBarProps {
  /** Which filter dimensions to expose. Pages render only the chips they need. */
  show:           GlobalFilterKey[]
  faculties?:     FacultyOpt[]
  classes?:       ClassOpt[]
  academicYears?: AcademicYearOpt[]
  /** Status options (defaults to standard student statuses). */
  statusOptions?: { id: string; label: string }[]
  /** Optional alignment / spacing override. */
  className?: string
}

const DEFAULT_STATUS_OPTIONS = [
  { id: "ACTIVE",    label: "Active"    },
  { id: "LEFT",      label: "Left"      },
  { id: "GRADUATED", label: "Graduated" },
  { id: "SUSPENDED", label: "Suspended" },
]

function parseList(s: string | null): string[] {
  if (!s) return []
  return s.split(",").map(x => x.trim()).filter(Boolean)
}

/**
 * Drop-in filter chip bar that uses the cross-page shared filter store.
 * - Reads selection from URL search params
 * - Hydrates URL from `localStorage` on first mount if no shared keys present
 * - Writes back to storage on every change
 *
 * Pages just consume the URL params server-side as usual; nothing else changes.
 */
export function GlobalFiltersBar({
  show, faculties = [], classes = [], academicYears = [],
  statusOptions = DEFAULT_STATUS_OPTIONS, className,
}: GlobalFiltersBarProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const restoredRef  = useRef(false)

  const facultyIds      = parseList(searchParams.get("facultyId"))
  const classIds        = parseList(searchParams.get("classId"))
  const sectionIds      = parseList(searchParams.get("sectionId"))
  const statuses        = parseList(searchParams.get("status"))
  const academicYearIds = parseList(searchParams.get("academicYearId"))

  // Hydrate URL from storage on first mount when no shared keys present
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (typeof window === "undefined") return
    if (hasAnyGlobalFilterInUrl(searchParams as unknown as URLSearchParams)) return
    const saved = readGlobalFilters()
    if (Object.keys(saved).length === 0) return
    const params = new URLSearchParams(searchParams.toString())
    let touched = false
    for (const k of show) {
      const v = saved[k]
      if (v) { params.set(k, v); touched = true }
    }
    if (touched) router.replace(`${pathname}?${params.toString()}`)
  }, [searchParams, pathname, router, show])

  // Persist whatever the URL currently has back to storage
  useEffect(() => {
    if (typeof window === "undefined") return
    writeGlobalFilters({
      facultyId:      facultyIds.join(","),
      classId:        classIds.join(","),
      sectionId:      sectionIds.join(","),
      status:         statuses.join(","),
      academicYearId: academicYearIds.join(","),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Auto-prefill the current AY for the selected faculty when no AY is set.
  // Resolution: prefer an AY scoped to the selected faculty AND marked current,
  // else fall back to a school-wide current AY. Only runs when AY is one of
  // the shown filters.
  useEffect(() => {
    if (!show.includes("academicYearId")) return
    if (academicYearIds.length > 0) return            // user has chosen something
    if (academicYears.length === 0) return

    let resolved: AcademicYearOpt | undefined
    if (facultyIds.length === 1 && facultyIds[0] !== "none") {
      const fid = facultyIds[0]
      resolved = academicYears.find(y => y.facultyId === fid && y.isCurrent)
                ?? academicYears.find(y => !y.facultyId && y.isCurrent)
    } else if (facultyIds.length === 0) {
      // No faculty filter — pick a school-wide current, if any
      resolved = academicYears.find(y => !y.facultyId && y.isCurrent)
    }
    if (resolved) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("academicYearId", resolved.id)
      params.delete("page")
      router.replace(`${pathname}?${params.toString()}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyIds.join(","), academicYears.length])

  function updateList(key: string, values: string[], cascades: string[] = []) {
    const params = new URLSearchParams(searchParams.toString())
    if (values.length > 0) params.set(key, values.join(","))
    else                   params.delete(key)
    for (const c of cascades) params.delete(c)
    params.delete("page")
    router.replace(`${pathname}?${params.toString()}`)
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString())
    for (const k of GLOBAL_FILTER_KEYS) params.delete(k)
    params.delete("page")
    router.replace(`${pathname}?${params.toString()}`)
  }

  // ─── Cascading visible options ─────────────────────────────────────────────
  const facultyNone     = facultyIds.includes("none")
  const realFacultyIds  = facultyIds.filter(id => id !== "none")
  const visibleClasses  = sortClassesByFacultyThenName(
    facultyIds.length === 0
      ? classes
      : classes.filter(c =>
          (facultyNone && c.facultyId == null) ||
          (c.facultyId != null && realFacultyIds.includes(c.facultyId))
        )
  )
  const visibleSections = useMemo(() => {
    if (classIds.length === 0) return [] as { id: string; name: string; className: string }[]
    return classes
      .filter(c => classIds.includes(c.id))
      .flatMap(c => (c.sections ?? []).map(s => ({ id: s.id, name: s.name, className: c.name })))
  }, [classes, classIds])

  const hasFilters =
    facultyIds.length || classIds.length || sectionIds.length ||
    statuses.length || academicYearIds.length

  // Filter chips render in the order given by the `show` prop — caller controls.
  const facultyNameById     = new Map(faculties.map(f => [f.id, f.name]))
  const facultyFilterActive = facultyIds.length > 0
  const filteredYears = facultyFilterActive
    ? academicYears.filter(y => {
        if (!y.facultyId) return true                          // school-wide always fits
        if (facultyNone && y.facultyId === null)  return true
        return realFacultyIds.includes(y.facultyId)
      })
    : academicYears

  function renderChip(key: GlobalFilterKey): React.ReactNode {
    switch (key) {
      case "academicYearId":
        if (academicYears.length === 0) return null
        return (
          <MultiSelectFilter
            key="academicYearId"
            icon={<CalendarRange className="w-3.5 h-3.5 text-amber-600" />}
            label="Year"
            color="amber"
            options={filteredYears.map(y => {
              const scope = y.facultyId
                ? facultyNameById.get(y.facultyId) ?? "Faculty"
                : "School-wide"
              const secondaryBits = [
                facultyFilterActive ? null : scope,
                y.isCurrent ? "Current" : null,
              ].filter(Boolean) as string[]
              return {
                id:        y.id,
                label:     y.name,
                secondary: secondaryBits.length > 0 ? secondaryBits.join(" · ") : undefined,
              }
            })}
            selected={academicYearIds}
            onChange={(ids) => updateList("academicYearId", ids)}
            emptyText={facultyFilterActive ? "No sessions for this faculty." : "No sessions."}
            placeholder="Search years…"
          />
        )
      case "facultyId":
        return (
          <MultiSelectFilter
            key="facultyId"
            icon={<FolderTree className="w-3.5 h-3.5 text-violet-600" />}
            label="Faculty"
            color="violet"
            options={[
              ...faculties.map(f => ({ id: f.id, label: f.name })),
              { id: "none", label: "General", secondary: "no faculty" },
            ]}
            selected={facultyIds}
            onChange={(ids) => updateList("facultyId", ids, ["classId", "sectionId"])}
            placeholder="Search faculties…"
          />
        )
      case "classId":
        return (
          <MultiSelectFilter
            key="classId"
            icon={<GraduationCap className="w-3.5 h-3.5 text-emerald-600" />}
            label="Class"
            color="emerald"
            options={visibleClasses.map(c => ({
              id:        c.id,
              label:     c.name,
              secondary: facultyIds.length === 0 && c.facultyName ? c.facultyName : undefined,
            }))}
            selected={classIds}
            onChange={(ids) => updateList("classId", ids, ["sectionId"])}
            emptyText={facultyIds.length > 0 ? "No classes in selected faculties." : "No classes."}
            placeholder="Search classes…"
          />
        )
      case "sectionId":
        if (visibleSections.length === 0) return null
        return (
          <MultiSelectFilter
            key="sectionId"
            icon={<Users className="w-3.5 h-3.5 text-sky-600" />}
            label="Section"
            color="sky"
            options={visibleSections.map(s => ({
              id: s.id, label: s.name, secondary: s.className,
            }))}
            selected={sectionIds}
            onChange={(ids) => updateList("sectionId", ids)}
            placeholder="Search sections…"
          />
        )
      case "status":
        return (
          <MultiSelectFilter
            key="status"
            icon={<SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />}
            label="Status"
            color="slate"
            options={statusOptions}
            selected={statuses}
            onChange={(ids) => updateList("status", ids)}
            placeholder="Filter statuses…"
          />
        )
    }
  }

  return (
    <div className={className ?? "flex items-center gap-2 flex-wrap"}>
      {show.map(k => renderChip(k))}
      {hasFilters ? (
        <Button size="sm" variant="ghost" onClick={clearAll}
          className="gap-1.5 cursor-pointer text-xs h-9 text-rose-600 hover:bg-rose-50">
          <X className="w-3.5 h-3.5" /> Clear
        </Button>
      ) : null}
    </div>
  )
}
