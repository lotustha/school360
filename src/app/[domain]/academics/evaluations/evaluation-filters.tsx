"use client"

import { useEffect, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Layers, CalendarRange, GraduationCap } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadGlobalCtx, saveGlobalCtx, FACULTY_GENERAL } from "@/lib/global-context"
import { naturalCompare } from "@/lib/class-sort"

type FacultyOpt      = { id: string; name: string }
type AcademicYearOpt = { id: string; name: string; isCurrent: boolean; facultyId: string | null }
type ClassOpt        = { id: string; name: string; facultyId: string | null }

interface Props {
  faculties:     FacultyOpt[]
  academicYears: AcademicYearOpt[]
  classes:       ClassOpt[]
  /** When true, the Class picker has no "All classes" option. Only honored if showClass is true. */
  requireClass?: boolean
  /** When false, hide the Class field entirely (list page uses this; ledger keeps it visible). */
  showClass?:    boolean
  /** When true, the Session dropdown shows one entry per unique year name and stores name (not id) in URL. */
  dedupeYearsByName?: boolean
}

const ALL  = "__all__"
const NONE = "__none__"

export function EvaluationFilters({
  faculties, academicYears, classes,
  requireClass = false,
  showClass    = true,
  dedupeYearsByName = false,
}: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  // Faculty defaults to "none" (General). Session defaults to whatever URL has
  // (parent server component will fill it on first paint).
  const facultyParam = searchParams.get("faculty") ?? "none"
  const yearParam    = searchParams.get("year")    ?? ""
  const classParam   = searchParams.get("class")   ?? "all"

  const facultyValue = facultyParam === "none" ? NONE : facultyParam
  const yearValue    = yearParam
  const classValue   = classParam === "all" ? ALL : classParam

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v === null) params.delete(k)
      else            params.set(k, v)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function selectFaculty(v: string) {
    const out = v === NONE ? "none" : v
    pushParams({ faculty: out, year: null, class: null })
  }
  function selectYear(v: string)  { pushParams({ year: v, class: null }) }
  function selectClass(v: string) {
    const next = v === ALL ? null : v
    pushParams({ class: next })
    saveGlobalCtx({ classId: next ?? undefined })
  }

  // Dependent filtering — strict to the picked faculty (no "all" mode).
  const facultyFilteredYears = useMemo(() => {
    return academicYears.filter(y =>
      facultyParam === "none" ? y.facultyId === null : y.facultyId === facultyParam,
    )
  }, [academicYears, facultyParam])

  const facultyFilteredClasses = useMemo(() => {
    return classes
      .filter(c =>
        facultyParam === "none" ? c.facultyId === null : c.facultyId === facultyParam,
      )
      .sort((a, b) => naturalCompare(a.name, b.name))
  }, [classes, facultyParam])

  // For dedupe mode: collapse sessions by name, keep "current" flag if any matching year is current.
  const dedupedYears = useMemo(() => {
    if (!dedupeYearsByName) return null
    const byName = new Map<string, { name: string; isCurrent: boolean }>()
    for (const y of facultyFilteredYears) {
      const existing = byName.get(y.name)
      if (existing) {
        if (y.isCurrent) existing.isCurrent = true
      } else {
        byName.set(y.name, { name: y.name, isCurrent: y.isCurrent })
      }
    }
    return [...byName.values()].sort((a, b) => b.name.localeCompare(a.name))
  }, [dedupeYearsByName, facultyFilteredYears])

  // Auto-resolve session. Three cases:
  //   1. Empty / missing → pick latest for current faculty.
  //   2. Mismatched format (id on a name-dedupe page or vice versa) → convert.
  //   3. Stale value (not in the current faculty's options) → snap to latest.
  useEffect(() => {
    function replaceYear(next: string) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("year", next)
      router.replace(`${pathname}?${params.toString()}`)
    }

    if (dedupedYears !== null) {
      // Name-based mode (list page).
      const isValid = yearParam !== "" && dedupedYears.some(y => y.name === yearParam)
      if (isValid) return
      // Maybe URL has an id — convert to that year's name.
      const byId = yearParam ? academicYears.find(y => y.id === yearParam) : null
      if (byId && dedupedYears.some(y => y.name === byId.name)) {
        replaceYear(byId.name); return
      }
      const latest = dedupedYears.find(y => y.isCurrent) ?? dedupedYears[0]
      if (latest && yearParam !== latest.name) replaceYear(latest.name)
    } else {
      // Id-based mode (ledger page).
      const isValid = yearParam !== "" && facultyFilteredYears.some(y => y.id === yearParam)
      if (isValid) return
      // Maybe URL has a name — convert to id of a matching year in this faculty.
      const byName = yearParam ? facultyFilteredYears.find(y => y.name === yearParam) : null
      if (byName) { replaceYear(byName.id); return }
      const latest = facultyFilteredYears.find(y => y.isCurrent) ?? facultyFilteredYears[0]
      if (latest && yearParam !== latest.id) replaceYear(latest.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyParam, yearParam, dedupedYears, facultyFilteredYears, academicYears])

  // Persist into the shared global context so the same scope follows the user
  // across /students, /academics/exams, /academics/evaluations, etc.

  // First-mount restore. Memory is the source of truth for which class the user
  // wants to see — EvaluationTabs preserves URL params across tab switches, so
  // the URL may carry stale values from a prior visit. Branches:
  //   1. Memory has a classId that differs from URL → realign URL to memory
  //      (also realign faculty so the dropdown reflects the chosen class).
  //   2. URL has `?year=` or `?class=` but no faculty → infer faculty.
  //   3. URL is empty → restore everything from shared memory.
  useEffect(() => {
    const urlFaculty = searchParams.get("faculty")
    const urlYear    = searchParams.get("year")
    const urlClass   = searchParams.get("class")
    const ctx        = loadGlobalCtx()

    // (1) Memory class wins. Only when memory differs from URL — otherwise no-op.
    if (ctx.classId && ctx.classId !== urlClass) {
      const owner = classes.find(c => c.id === ctx.classId)
      if (owner) {
        const params = new URLSearchParams(searchParams.toString())
        params.set("class",   owner.id)
        params.set("faculty", owner.facultyId === null ? "none" : owner.facultyId)
        if (params.toString() !== searchParams.toString()) {
          router.replace(`${pathname}?${params.toString()}`)
        }
        return
      }
    }

    if (urlFaculty !== null) return   // explicit faculty + no memory override → leave URL alone

    // (2) URL has year/class but no faculty → infer faculty from them.
    let inferredFacultyId: string | null | undefined = undefined
    if (urlYear) {
      const y = academicYears.find(yr => yr.id === urlYear || yr.name === urlYear)
      if (y) inferredFacultyId = y.facultyId
    }
    if (inferredFacultyId === undefined && urlClass) {
      const c = classes.find(cl => cl.id === urlClass)
      if (c) inferredFacultyId = c.facultyId
    }
    if (inferredFacultyId !== undefined) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("faculty", inferredFacultyId === null ? "none" : inferredFacultyId)
      router.replace(`${pathname}?${params.toString()}`)
      return
    }

    // (3) URL empty → restore from shared memory.
    if (urlYear || urlClass) return
    const params = new URLSearchParams(searchParams.toString())
    if (ctx.facultyKey) {
      params.set("faculty", ctx.facultyKey === FACULTY_GENERAL ? "none" : ctx.facultyKey)
    }
    if (ctx.academicYearName) {
      params.set("year", ctx.academicYearName)
    }
    if (params.toString() !== searchParams.toString()) {
      router.replace(`${pathname}?${params.toString()}`)
    }
    // Mount-only restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save whenever the URL has either filter value resolved.
  useEffect(() => {
    const f = searchParams.get("faculty")
    const y = searchParams.get("year")
    const c = searchParams.get("class")
    if (!f && !y && !c) return
    saveGlobalCtx({
      facultyKey:       f ? (f === "none" ? FACULTY_GENERAL : f) : undefined,
      academicYearName: y ?? undefined,
      classId:          c && c !== "all" ? c : undefined,
    })
  }, [searchParams])

  // Auto-resolve Class when the page requires one.
  //   1. If URL class is valid under the current faculty → keep.
  //   2. If URL class exists but belongs to a different faculty → switch faculty
  //      to match that class so the user keeps the class they navigated with.
  //   3. Otherwise try memory; finally fall back to the first class in the
  //      faculty list (or the first class across all faculties when the picked
  //      faculty has none).
  useEffect(() => {
    if (!requireClass) return

    // (1) Already valid in this faculty
    const isValid = classParam !== "all" && facultyFilteredClasses.some(c => c.id === classParam)
    if (isValid) return

    // (2) Class belongs to a different faculty — realign faculty
    if (classParam !== "all") {
      const owner = classes.find(c => c.id === classParam)
      if (owner) {
        const ownerFacultyParam = owner.facultyId === null ? "none" : owner.facultyId
        if (ownerFacultyParam !== facultyParam) {
          const params = new URLSearchParams(searchParams.toString())
          params.set("faculty", ownerFacultyParam)
          router.replace(`${pathname}?${params.toString()}`)
          return
        }
      }
    }

    // (3a) Try memory next.
    const savedId = loadGlobalCtx().classId
    const fromMemory = savedId
      ? facultyFilteredClasses.find(c => c.id === savedId) ?? classes.find(c => c.id === savedId) ?? null
      : null

    // If memory's class is from a different faculty, realign faculty to it.
    if (fromMemory && !facultyFilteredClasses.some(c => c.id === fromMemory.id)) {
      const ownerFacultyParam = fromMemory.facultyId === null ? "none" : fromMemory.facultyId
      const params = new URLSearchParams(searchParams.toString())
      params.set("faculty", ownerFacultyParam)
      params.set("class",   fromMemory.id)
      router.replace(`${pathname}?${params.toString()}`)
      return
    }

    // (3b) First available — within current faculty, or across the school if empty.
    const next = fromMemory
      ?? facultyFilteredClasses[0]
      ?? classes[0]
      ?? null
    if (!next) return
    if (classParam === next.id) return

    const params = new URLSearchParams(searchParams.toString())
    // If the chosen class is outside the current faculty (because faculty list is
    // empty), also realign faculty so the dropdown shows the picked class.
    if (!facultyFilteredClasses.some(c => c.id === next.id)) {
      params.set("faculty", next.facultyId === null ? "none" : next.facultyId)
    }
    params.set("class", next.id)
    router.replace(`${pathname}?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireClass, classParam, facultyParam, facultyFilteredClasses, classes])

  // Faculty options sorted name-desc; General first.
  const sortedFaculties = useMemo(
    () => [...faculties].sort((a, b) => b.name.localeCompare(a.name)),
    [faculties],
  )

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex flex-wrap items-end gap-3">
      <Field label="Faculty" icon={<Layers className="w-3.5 h-3.5" />}>
        <Select value={facultyValue} onValueChange={selectFaculty}>
          <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[180px]">
            <SelectValue placeholder="Pick faculty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>General (no faculty)</SelectItem>
            {sortedFaculties.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Session" icon={<CalendarRange className="w-3.5 h-3.5" />}>
        <Select value={yearValue} onValueChange={selectYear}>
          <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[180px]">
            <SelectValue placeholder="Pick session" />
          </SelectTrigger>
          <SelectContent>
            {dedupedYears !== null ? (
              dedupedYears.length === 0
                ? <div className="px-2 py-1.5 text-xs italic text-slate-400">No sessions for this faculty</div>
                : dedupedYears.map(y => (
                    <SelectItem key={y.name} value={y.name}>
                      {y.name}
                      {y.isCurrent && <span className="ml-2 text-[10px] text-emerald-600 font-bold">CURRENT</span>}
                    </SelectItem>
                  ))
            ) : (
              facultyFilteredYears.length === 0
                ? <div className="px-2 py-1.5 text-xs italic text-slate-400">No sessions for this faculty</div>
                : facultyFilteredYears.map(y => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}
                      {y.isCurrent && <span className="ml-2 text-[10px] text-emerald-600 font-bold">CURRENT</span>}
                    </SelectItem>
                  ))
            )}
          </SelectContent>
        </Select>
      </Field>

      {showClass && (
        <Field label="Class" icon={<GraduationCap className="w-3.5 h-3.5" />}>
          <Select value={classValue} onValueChange={selectClass}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[180px]">
              <SelectValue placeholder={requireClass ? "Pick a class…" : "All classes"} />
            </SelectTrigger>
            <SelectContent>
              {!requireClass && <SelectItem value={ALL}>All classes</SelectItem>}
              {facultyFilteredClasses.length === 0 ? (
                <div className="px-2 py-1.5 text-xs italic text-slate-400">No classes in this faculty</div>
              ) : facultyFilteredClasses.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
        {icon} {label}
      </span>
      {children}
    </div>
  )
}
