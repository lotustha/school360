"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Search, X, FolderTree, GraduationCap, Users, SlidersHorizontal, CalendarRange,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import {
  readGlobalFilters, writeGlobalFilters, hasAnyGlobalFilterInUrl,
} from "@/lib/global-filters"

type FacultyOpt      = { id: string; name: string }
type ClassOpt        = { id: string; name: string; facultyId: string | null; facultyName?: string | null; sections: { id: string; name: string }[] }
type AcademicYearOpt = { id: string; name: string; isCurrent: boolean }

const STATUS_OPTIONS = [
  { id: "ACTIVE",    label: "Active"    },
  { id: "LEFT",      label: "Left"      },
  { id: "GRADUATED", label: "Graduated" },
  { id: "SUSPENDED", label: "Suspended" },
]

interface Props {
  faculties:              FacultyOpt[]
  classes:                ClassOpt[]
  academicYears:          AcademicYearOpt[]
  initialQuery:           string
  initialFacultyIds:      string[]
  initialClassIds:        string[]
  initialSectionIds:      string[]
  initialStatuses:        string[]
  initialAcademicYearIds: string[]
  totalCount:             number
}

export function StudentsToolbar({
  faculties, classes, academicYears,
  initialQuery, initialFacultyIds, initialClassIds, initialSectionIds,
  initialStatuses, initialAcademicYearIds,
  totalCount,
}: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const restoredRef = useRef(false)

  // Restore from shared global filter storage on first mount if URL has none of
  // the 5 shared keys. We deliberately don't restore q/page — those are scoped
  // to the current page only.
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (typeof window === "undefined") return
    if (hasAnyGlobalFilterInUrl(searchParams as unknown as URLSearchParams)) return
    if (searchParams.get("q") || searchParams.get("page")) return
    const saved = readGlobalFilters()
    if (Object.keys(saved).length === 0) return
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(saved)) if (v) params.set(k, v)
    if (params.toString()) router.replace(`${pathname}?${params.toString()}`)
  }, [searchParams, pathname, router])

  // Persist current selection back to the shared store on every change.
  // We store the full URL value (comma-separated for multi-select); single-
  // select pages will just consume the first segment.
  useEffect(() => {
    writeGlobalFilters({
      facultyId:      initialFacultyIds.join(","),
      classId:        initialClassIds.join(","),
      sectionId:      initialSectionIds.join(","),
      status:         initialStatuses.join(","),
      academicYearId: initialAcademicYearIds.join(","),
    })
  }, [initialFacultyIds, initialClassIds, initialSectionIds, initialStatuses, initialAcademicYearIds])

  // Debounced search
  useEffect(() => {
    if (query === initialQuery) return
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (query.trim()) params.set("q", query.trim())
      else              params.delete("q")
      params.delete("page")
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function updateList(key: string, values: string[], cascades?: string[]) {
    const params = new URLSearchParams(searchParams.toString())
    if (values.length > 0) params.set(key, values.join(","))
    else                   params.delete(key)
    for (const c of cascades ?? []) params.delete(c)
    params.delete("page")
    router.replace(`${pathname}?${params.toString()}`)
  }

  function clearAll() {
    setQuery("")
    router.replace(pathname)
  }

  // Cascading visible options
  const facultySet      = new Set(initialFacultyIds)
  const facultyNone     = facultySet.has("none")
  const realFacultyIds  = initialFacultyIds.filter(id => id !== "none")
  const visibleClasses  =
    initialFacultyIds.length === 0
      ? classes
      : classes.filter(c =>
          (facultyNone && c.facultyId == null) ||
          (c.facultyId != null && realFacultyIds.includes(c.facultyId))
        )
  const sectionScopeClasses = initialClassIds.length > 0
    ? classes.filter(c => initialClassIds.includes(c.id))
    : visibleClasses
  const visibleSections = sectionScopeClasses.flatMap(c =>
    c.sections.map(s => ({ id: s.id, name: s.name, className: c.name }))
  )

  const hasFilters = !!(
    initialQuery || initialFacultyIds.length || initialClassIds.length ||
    initialSectionIds.length || initialStatuses.length || initialAcademicYearIds.length
  )

  return (
    <div className="space-y-2.5">
      {/* Search + count */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, admission no, NEB reg…"
            className="h-9 pl-9 pr-9 text-sm bg-white border-slate-200 rounded-lg"
          />
          {query && (
            <button onClick={() => setQuery("")}
              title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] font-bold gap-1 h-9 px-2.5">
          {totalCount} result{totalCount === 1 ? "" : "s"}
        </Badge>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearAll}
            className="gap-1.5 cursor-pointer text-xs h-9 text-rose-600 hover:bg-rose-50">
            <X className="w-3.5 h-3.5" /> Clear filters
          </Button>
        )}
      </div>

      {/* Filter dropdowns */}
      <div className="flex items-center gap-2 flex-wrap">
        <MultiSelectFilter
          icon={<FolderTree className="w-3.5 h-3.5 text-violet-600" />}
          label="Faculty"
          color="violet"
          options={[
            ...faculties.map(f => ({ id: f.id, label: f.name })),
            { id: "none", label: "General", secondary: "no faculty" },
          ]}
          selected={initialFacultyIds}
          onChange={(ids) => updateList("facultyId", ids, ["classId", "sectionId"])}
          placeholder="Search faculties…"
        />

        {academicYears.length > 0 && (
          <MultiSelectFilter
            icon={<CalendarRange className="w-3.5 h-3.5 text-amber-600" />}
            label="Year"
            color="amber"
            options={academicYears.map(y => ({
              id:        y.id,
              label:     y.name,
              secondary: y.isCurrent ? "Current" : undefined,
            }))}
            selected={initialAcademicYearIds}
            onChange={(ids) => updateList("academicYearId", ids)}
            placeholder="Search years…"
          />
        )}

        <MultiSelectFilter
          icon={<GraduationCap className="w-3.5 h-3.5 text-emerald-600" />}
          label="Class"
          color="emerald"
          options={visibleClasses.map(c => ({
            id:        c.id,
            label:     c.name,
            // Only show faculty hint when no faculty filter narrows the list
            secondary: initialFacultyIds.length === 0 && c.facultyName ? c.facultyName : undefined,
          }))}
          selected={initialClassIds}
          onChange={(ids) => updateList("classId", ids, ["sectionId"])}
          emptyText={initialFacultyIds.length > 0 ? "No classes in selected faculties." : "No classes."}
          placeholder="Search classes…"
        />

        {visibleSections.length > 0 && (
          <MultiSelectFilter
            icon={<Users className="w-3.5 h-3.5 text-sky-600" />}
            label="Section"
            color="sky"
            options={visibleSections.map(s => ({
              id:        s.id,
              label:     s.name,
              secondary: s.className,
            }))}
            selected={initialSectionIds}
            onChange={(ids) => updateList("sectionId", ids)}
            placeholder="Search sections…"
          />
        )}

        <MultiSelectFilter
          icon={<SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />}
          label="Status"
          color="slate"
          options={STATUS_OPTIONS}
          selected={initialStatuses}
          onChange={(ids) => updateList("status", ids)}
          placeholder="Filter statuses…"
        />
      </div>
    </div>
  )
}
