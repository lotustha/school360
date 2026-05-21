"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Plus, BookOpen, Save, X, Layers, Copy, Trash2, ArrowDownToLine,
  Building2, Calendar, GraduationCap, Compass, RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import { cn } from "@/lib/utils"
import {
  createSubject, updateSubject, bulkCreateSubjects, cloneSubjectsFromClass,
  upsertSubjectYearConfig,
} from "@/actions/academics"

// ─── Scope (Faculty → Session → Multi-Class) shared by all Add panes ────────

const NULL_FACULTY = "__NULL__"   // sentinel for School-wide / no faculty
const SCOPE_LS_KEY = "subject-create-scope:v1"

type FacultyOpt      = { id: string; name: string }
type AcademicYearOpt = { id: string; name: string; isCurrent: boolean; facultyId: string | null }

interface SubjectScope {
  facultyId:        string                  // "" or NULL_FACULTY for school-wide
  academicYearId:   string                  // "" means "no session context"
  classIds:         string[]
  setFacultyId:     (id: string) => void
  setAcademicYearId: (id: string) => void
  setClassIds:      (ids: string[]) => void
  /** Classes filtered by the current faculty selection. */
  classesInScope:   ClassOption[]
  /** Years filtered by the current faculty selection (faculty-scoped sessions). */
  yearsInScope:     AcademicYearOpt[]
  /** Convenience: current academic year display name (null if none selected). */
  selectedYearName: string | null
  /** True when all three steps have valid choices — gates the subject form. */
  isComplete:       boolean
}

/**
 * Faculty + Session + Multi-Class scope. Persists last-used (faculty, year)
 * to localStorage so re-opening the drawer remembers your context.
 *
 * Defaults on first use: school-wide faculty + the school's "current" year
 * (any year with isCurrent=true), or the most recent year if none current.
 */
function useSubjectScope({
  academicYears, classes,
}: {
  academicYears: AcademicYearOpt[]
  classes:       ClassOption[]
}): SubjectScope {
  const initial = (() => {
    if (typeof window === "undefined") return { facultyId: "", academicYearId: "" }
    try {
      const raw = window.localStorage.getItem(SCOPE_LS_KEY)
      if (!raw) return { facultyId: "", academicYearId: "" }
      const parsed = JSON.parse(raw) as { facultyId?: string; academicYearId?: string }
      return {
        facultyId:      parsed.facultyId      ?? "",
        academicYearId: parsed.academicYearId ?? "",
      }
    } catch { return { facultyId: "", academicYearId: "" } }
  })()

  const defaultFaculty = initial.facultyId || NULL_FACULTY
  const defaultYear    = initial.academicYearId
    || academicYears.find(y => y.isCurrent)?.id
    || academicYears[0]?.id
    || ""

  const [facultyId,      setFacultyId]      = useState<string>(defaultFaculty)
  const [academicYearId, setAcademicYearId] = useState<string>(defaultYear)
  const [classIds,       setClassIds]       = useState<string[]>([])

  // Persist memory
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(SCOPE_LS_KEY, JSON.stringify({ facultyId, academicYearId }))
    } catch { /* quota or private-mode — ignore */ }
  }, [facultyId, academicYearId])

  const facultyKey = facultyId === NULL_FACULTY ? null : facultyId
  const classesInScope = classes.filter(c =>
    (c.facultyId ?? null) === facultyKey,
  )
  const yearsInScope = academicYears.filter(y =>
    (y.facultyId ?? null) === facultyKey,
  )

  // When faculty changes: clear class picks that no longer match, and reset
  // session if the previously-selected year doesn't belong to this faculty.
  useEffect(() => {
    const validClassIds = new Set(classesInScope.map(c => c.id))
    setClassIds(prev => prev.filter(id => validClassIds.has(id)))
    if (academicYearId) {
      const stillValid = yearsInScope.some(y => y.id === academicYearId)
      if (!stillValid) {
        const fallback = yearsInScope.find(y => y.isCurrent)?.id
                      ?? yearsInScope[0]?.id ?? ""
        setAcademicYearId(fallback)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyId])

  const selectedYearName = academicYears.find(y => y.id === academicYearId)?.name ?? null

  // Faculty defaults to NULL_FACULTY (School-wide) so it always has a value.
  // Session + at least one class are the gating choices.
  const isComplete = !!facultyId && !!academicYearId && classIds.length > 0

  return {
    facultyId, academicYearId, classIds,
    setFacultyId, setAcademicYearId, setClassIds,
    classesInScope, yearsInScope, selectedYearName,
    isComplete,
  }
}

/**
 * Faculty → Session → Multi-Class scope picker rendered at the top of each
 * Add pane. Three numbered steps with their own icon + accent color, a live
 * summary chip up top, and selected classes shown as removable pills below.
 */
function ScopeHeader({
  scope, faculties,
}: {
  scope:     SubjectScope
  faculties: FacultyOpt[]
}) {
  const isSchoolWide = scope.facultyId === NULL_FACULTY || scope.facultyId === ""
  const currentFaculty = faculties.find(f => f.id === scope.facultyId)
  const facultyLabel  = isSchoolWide ? "School-wide" : (currentFaculty?.name ?? "—")
  const sessionLabel  = scope.selectedYearName ?? "—"
  const classesLabel  = scope.classIds.length === 0
    ? "no classes"
    : `${scope.classIds.length} class${scope.classIds.length === 1 ? "" : "es"}`

  // "Reset scope" clears only ephemeral choices — keeps the persisted memory.
  const canReset = scope.classIds.length > 0
  const resetClasses = () => scope.setClassIds([])

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 via-amber-50/30 to-emerald-50/30 shadow-sm overflow-hidden">
      {/* Header bar: title + live summary chip */}
      <div className="px-4 py-2.5 border-b border-slate-200/60 bg-white/60 backdrop-blur-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none">Scope</div>
            <div className="text-[11px] text-slate-600 mt-0.5 truncate">
              <span className="font-semibold text-slate-700">{facultyLabel}</span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="font-semibold text-slate-700">{sessionLabel}</span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="font-semibold text-slate-700">{classesLabel}</span>
            </div>
          </div>
        </div>
        {canReset && (
          <button
            type="button"
            onClick={resetClasses}
            className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 flex-shrink-0"
            aria-label="Clear selected classes"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* 3-column step row: Faculty · Session · Classes (stack on mobile) */}
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Step 1 — Faculty */}
          <ScopeStep
            number={1}
            icon={<Building2 className="w-3.5 h-3.5" />}
            accent="slate"
            label="Faculty"
          >
            <Select value={scope.facultyId} onValueChange={scope.setFacultyId}>
              <SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                <SelectValue placeholder="Pick a faculty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NULL_FACULTY}>School-wide / General</SelectItem>
                {faculties.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ScopeStep>

          {/* Step 2 — Session (faculty-scoped) */}
          <ScopeStep
            number={2}
            icon={<Calendar className="w-3.5 h-3.5" />}
            accent="amber"
            label="Session"
          >
            <Select value={scope.academicYearId} onValueChange={scope.setAcademicYearId}>
              <SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                <SelectValue placeholder={scope.yearsInScope.length === 0 ? "No sessions" : "Pick a session"} />
              </SelectTrigger>
              <SelectContent>
                {scope.yearsInScope.length === 0 ? (
                  <div className="px-2 py-3 text-center text-xs italic text-slate-400">
                    No sessions configured for this faculty.
                  </div>
                ) : scope.yearsInScope.map(y => (
                  <SelectItem key={y.id} value={y.id}>
                    <span className="flex items-center gap-2">
                      <span>{y.name}</span>
                      {y.isCurrent && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          Current
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ScopeStep>

          {/* Step 3 — Classes (multi) */}
          <ScopeStep
            number={3}
            icon={<GraduationCap className="w-3.5 h-3.5" />}
            accent="emerald"
            label="Classes"
          >
            <MultiSelectFilter
              icon={<Layers className="w-3 h-3" />}
              label="Pick classes"
              color="emerald"
              placeholder={scope.classesInScope.length === 0 ? "No classes" : "Pick classes…"}
              options={scope.classesInScope.map(c => ({ id: c.id, label: c.name }))}
              selected={scope.classIds}
              onChange={scope.setClassIds}
              className="w-full"
            />
          </ScopeStep>
        </div>

        {/* Selected class chips — span the full row beneath the 3 steps */}
        {scope.classIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/60">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 self-center mr-1">
              Creating in:
            </span>
            {scope.classIds.map(id => {
              const cls = scope.classesInScope.find(c => c.id === id)
              if (!cls) return null
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scope.setClassIds(scope.classIds.filter(x => x !== id))}
                  className="group cursor-pointer inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200/80 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-200 transition-colors"
                  aria-label={`Remove ${cls.name}`}
                >
                  {cls.name}
                  <X className="w-2.5 h-2.5 text-emerald-700/70 group-hover:text-emerald-900" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Banner rendered above the subject form when the scope isn't fully picked.
 * Tells the user exactly what's missing in order. Spells out each step
 * because "complete the scope" alone is too vague when 1 of 3 is missing.
 */
function ScopeIncompleteBanner({ scope }: { scope: SubjectScope }) {
  const missing: string[] = []
  if (!scope.facultyId) missing.push("faculty")
  if (!scope.academicYearId) missing.push("session")
  if (scope.classIds.length === 0) missing.push("at least one class")
  const msg = missing.length === 1
    ? `Pick ${missing[0]} above to continue.`
    : `Pick ${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]} above to continue.`
  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2.5 text-[12px] text-amber-900 flex items-start gap-2">
      <Compass className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-700" />
      <span>{msg}</span>
    </div>
  )
}

const ACCENT_CLS: Record<"slate" | "amber" | "emerald", { bg: string; text: string; ring: string }> = {
  slate:   { bg: "bg-slate-100",   text: "text-slate-700",   ring: "ring-slate-200" },
  amber:   { bg: "bg-amber-100",   text: "text-amber-700",   ring: "ring-amber-200" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200" },
}

/**
 * One step column inside ScopeHeader. Compact layout: a numbered badge sits
 * inline with the icon + label above the control. Accent color visually
 * relates the step to its concept (slate=faculty, amber=session, emerald=classes).
 */
function ScopeStep({
  number, icon, accent, label, children,
}: {
  number:   number
  icon:     React.ReactNode
  accent:   "slate" | "amber" | "emerald"
  label:    string
  children: React.ReactNode
}) {
  const a = ACCENT_CLS[accent]
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ring-1", a.bg, a.text, a.ring)}>
          {number}
        </div>
        <span className={a.text}>{icon}</span>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-600">
          {label}
        </label>
      </div>
      {children}
    </div>
  )
}

// ─── Single-edit schema ──────────────────────────────────────────────────────

const editSchema = z.object({
  name:                z.string().min(2, "Min 2 characters"),
  shortName:           z.string().max(8, "Max 8 chars").optional(),
  code:                z.string().min(1, "Code required"),
  classId:             z.string().min(1, "Select a class"),
  creditHours:         z.string().optional(),
  /** Practical/Internal Credit Hours — NEB GPA weighting. */
  internalCreditHours: z.string().optional(),
  /** Theory/External Credit Hours — NEB GPA weighting. */
  externalCreditHours: z.string().optional(),
  type:                z.enum(["REGULAR", "OPTIONAL", "EXTRA"]),
})
type EditValues = z.infer<typeof editSchema>

interface EditItem {
  id:                  string
  name:                string
  shortName:           string | null
  code:                string
  classId:             string
  /** School-wide default CH (Subject row). Shown when no editContextYearId. */
  creditHours:         number | null
  internalCreditHours: number | null
  externalCreditHours: number | null
  /** Per-year overrides for the page's edit-context year. Used as form
   *  defaults when `editContextYearId` is set. Null = no override stored. */
  yearCreditHours?:         number | null
  yearInternalCreditHours?: number | null
  yearExternalCreditHours?: number | null
  type:                "REGULAR" | "OPTIONAL" | "EXTRA"
}

type ClassOption = { id: string; name: string; facultyName: string | null; facultyId: string | null }
type SourceClass = { id: string; name: string; subjects: { id: string; name: string; code: string; creditHours: number | null }[] }

interface Props {
  schoolId:             string
  classes:              ClassOption[]
  /** All faculties in the school — used by the Add panes' scope picker. */
  faculties?:           FacultyOpt[]
  /** All academic years — used by the Add panes' scope picker. */
  academicYears?:       AcademicYearOpt[]
  sourceClasses?:       SourceClass[]   // For "Import" mode; classes with their existing subjects
  editItem?:            EditItem
  /** When set: the EditForm's CH fields edit the per-year override row for
   *  this academic year (via upsertSubjectYearConfig), not the Subject row.
   *  When null: fields edit Subject-level defaults via updateSubject. */
  editContextYearId?:   string | null
  editContextYearName?: string | null
  open?:                boolean
  onOpenChange?:        (open: boolean) => void
}

export function SubjectDrawer({
  schoolId, classes, faculties = [], academicYears = [], sourceClasses = [], editItem,
  editContextYearId = null, editContextYearName = null,
  open: externalOpen, onOpenChange,
}: Props) {
  const isEditMode = editItem !== undefined
  const [localOpen, setLocalOpen] = useState(false)
  const open    = isEditMode ? (externalOpen ?? false) : localOpen
  const setOpen = isEditMode ? (onOpenChange ?? (() => {})) : setLocalOpen

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <SheetTrigger asChild>
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Subject
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-2xl p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-7 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <BookOpen className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">
              {isEditMode ? "Edit Subject" : "Add Subjects"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {isEditMode
                ? "Update subject details."
                : "Add a single subject, paste multiple at once, or import from another class."}
            </SheetDescription>
          </div>
        </div>

        {isEditMode && editItem ? (
          <EditForm
            editItem={editItem}
            classes={classes}
            editContextYearId={editContextYearId}
            editContextYearName={editContextYearName}
            onClose={() => setOpen(false)}
          />
        ) : (
          <AddTabs
            schoolId={schoolId}
            classes={classes}
            faculties={faculties}
            academicYears={academicYears}
            sourceClasses={sourceClasses}
            onClose={() => setOpen(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Edit (single row) ──────────────────────────────────────────────────────

function EditForm({
  editItem, classes, editContextYearId, editContextYearName, onClose,
}: {
  editItem:            EditItem
  classes:             ClassOption[]
  editContextYearId:   string | null
  editContextYearName: string | null
  onClose:             () => void
}) {
  const router = useRouter()
  // CH form defaults: prefer per-year override row when in year-context mode,
  // else fall back to the Subject-level defaults.
  const initialCH = editContextYearId
    ? {
        creditHours:         editItem.yearCreditHours         ?? null,
        internalCreditHours: editItem.yearInternalCreditHours ?? null,
        externalCreditHours: editItem.yearExternalCreditHours ?? null,
      }
    : {
        creditHours:         editItem.creditHours,
        internalCreditHours: editItem.internalCreditHours,
        externalCreditHours: editItem.externalCreditHours,
      }

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name:                editItem.name,
      shortName:           editItem.shortName ?? "",
      code:                editItem.code,
      classId:             editItem.classId,
      creditHours:         initialCH.creditHours         != null ? String(initialCH.creditHours)         : "",
      internalCreditHours: initialCH.internalCreditHours != null ? String(initialCH.internalCreditHours) : "",
      externalCreditHours: initialCH.externalCreditHours != null ? String(initialCH.externalCreditHours) : "",
      type:                editItem.type,
    },
  })

  useEffect(() => {
    const reset = editContextYearId
      ? {
          creditHours:         editItem.yearCreditHours         ?? null,
          internalCreditHours: editItem.yearInternalCreditHours ?? null,
          externalCreditHours: editItem.yearExternalCreditHours ?? null,
        }
      : {
          creditHours:         editItem.creditHours,
          internalCreditHours: editItem.internalCreditHours,
          externalCreditHours: editItem.externalCreditHours,
        }
    form.reset({
      name:                editItem.name,
      shortName:           editItem.shortName ?? "",
      code:                editItem.code,
      classId:             editItem.classId,
      creditHours:         reset.creditHours         != null ? String(reset.creditHours)         : "",
      internalCreditHours: reset.internalCreditHours != null ? String(reset.internalCreditHours) : "",
      externalCreditHours: reset.externalCreditHours != null ? String(reset.externalCreditHours) : "",
      type:                editItem.type,
    })
  }, [editItem, editContextYearId, form])

  // Keep Total CH in sync as Internal + External when both pillars are set.
  // resolveCreditHourSplit ignores Total CH in that case, but mirroring keeps
  // the persisted value consistent with what the user sees.
  const watchedInternal = form.watch("internalCreditHours")
  const watchedExternal = form.watch("externalCreditHours")
  const editTotalLocked = (() => {
    const i = parseFloat(watchedInternal ?? "")
    const e = parseFloat(watchedExternal ?? "")
    return Number.isFinite(i) && Number.isFinite(e)
  })()
  useEffect(() => {
    const i = parseFloat(watchedInternal ?? "")
    const e = parseFloat(watchedExternal ?? "")
    if (Number.isFinite(i) && Number.isFinite(e)) {
      const sum = String(Math.round((i + e) * 100) / 100)
      if (form.getValues("creditHours") !== sum) {
        form.setValue("creditHours", sum, { shouldDirty: true, shouldValidate: false })
      }
    }
  }, [watchedInternal, watchedExternal, form])

  async function onSubmit(v: EditValues) {
    try {
      const credits  = v.creditHours         ? parseFloat(v.creditHours)         : null
      const inCredit = v.internalCreditHours ? parseFloat(v.internalCreditHours) : null
      const exCredit = v.externalCreditHours ? parseFloat(v.externalCreditHours) : null
      // Always update Subject's identity fields (name/code/class/type) +
      // shortName. CH writes route by mode:
      //   - year-context mode: identity goes to Subject (CH left untouched on
      //     Subject), CH goes to per-year override via upsertSubjectYearConfig.
      //   - global mode: CH goes to Subject defaults via updateSubject.
      if (editContextYearId) {
        await updateSubject(
          editItem.id, v.name, v.code, v.classId,
          editItem.creditHours,           // preserve Subject default — don't overwrite
          v.shortName ?? null, v.type,
          editItem.internalCreditHours,   // preserve
          editItem.externalCreditHours,   // preserve
        )
        await upsertSubjectYearConfig({
          subjectId:           editItem.id,
          academicYearId:      editContextYearId,
          creditHours:         credits,
          internalCreditHours: inCredit,
          externalCreditHours: exCredit,
        })
        toast.success(`"${v.name}" updated for ${editContextYearName ?? "year"}`)
      } else {
        await updateSubject(editItem.id, v.name, v.code, v.classId, credits, v.shortName ?? null, v.type, inCredit, exCredit)
        toast.success(`Subject updated to "${v.name}"`)
      }
      onClose()
      router.refresh()
    } catch {
      toast.error("Failed to update subject")
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-7 py-6">
        <Form {...form}>
          <form id="subject-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="classId" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Class</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}{cls.facultyName ? ` — ${cls.facultyName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Subject Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Compulsary Mathematics"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={form.control} name="shortName" render={({ field }) => (
                <FormItem className="sm:w-32">
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Short <span className="normal-case font-normal text-slate-400">(≤ 8)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="C.Math"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 font-mono text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Code</FormLabel>
                  <FormControl>
                    <Input placeholder="0002"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 font-mono text-sm" {...field} />
                  </FormControl>
                  <p className="text-[10px] text-slate-400 mt-1">NEB / CDC code</p>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="creditHours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Total CH <span className="normal-case font-normal text-slate-400">{editTotalLocked ? "(auto)" : "(opt)"}</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="any" min="0" placeholder="5"
                      readOnly={editTotalLocked}
                      tabIndex={editTotalLocked ? -1 : 0}
                      className={cn(
                        "h-11 border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm",
                        editTotalLocked ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white",
                      )}
                      {...field} />
                  </FormControl>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {editTotalLocked ? "Auto-summed from Internal + External" : "For NEB GPA · fallback if Int/Ext blank"}
                  </p>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </div>

            {editContextYearId && editContextYearName && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-800">
                <strong className="font-bold">Editing CH for {editContextYearName}.</strong> These values
                override the school-wide default just for this session. Other identity fields
                (name, code, class, type, short name) save globally as usual.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="internalCreditHours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Internal CH <span className="normal-case font-normal text-slate-400">(practical)</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="any" min="0" placeholder="1"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <p className="text-[10px] text-slate-400 mt-1">NEB practical weight</p>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="externalCreditHours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    External CH <span className="normal-case font-normal text-slate-400">(theory)</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="any" min="0" placeholder="4"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <p className="text-[10px] text-slate-400 mt-1">NEB theory weight (terminal)</p>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Subject Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="REGULAR">Regular — compulsory, counts toward GPA</SelectItem>
                    <SelectItem value="OPTIONAL">Optional — student choice, counts toward GPA</SelectItem>
                    <SelectItem value="EXTRA">Extra — compulsory but excluded from GPA</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400 mt-1">Affects how this subject is rolled up into ledgers and gradesheets.</p>
              </FormItem>
            )} />
          </form>
        </Form>
      </div>

      <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
        <Button form="subject-edit-form" type="submit"
          className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl"
          disabled={form.formState.isSubmitting}>
          <Save className="w-4 h-4 mr-1.5" />
          {form.formState.isSubmitting ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </>
  )
}

// ─── Add: tabbed Single / Bulk / Import ─────────────────────────────────────

function AddTabs({
  schoolId, classes, faculties, academicYears, sourceClasses, onClose,
}: {
  schoolId:      string
  classes:       ClassOption[]
  faculties:     FacultyOpt[]
  academicYears: AcademicYearOpt[]
  sourceClasses: SourceClass[]
  onClose:       () => void
}) {
  // Single scope shared across all three tabs so flipping tabs keeps the
  // user's faculty/session/class picks intact.
  const scope = useSubjectScope({ academicYears, classes })

  return (
    <Tabs defaultValue="single" className="flex-1 flex flex-col min-h-0">
      <div className="px-7 pt-4 pb-2">
        <TabsList className="bg-slate-100 h-9 p-1 rounded-xl">
          <TabsTrigger value="single" className="text-xs h-7 px-3 cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg gap-1.5">
            <Plus className="w-3 h-3" /> Single
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-xs h-7 px-3 cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg gap-1.5">
            <Layers className="w-3 h-3" /> Bulk
          </TabsTrigger>
          <TabsTrigger value="import" className="text-xs h-7 px-3 cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg gap-1.5">
            <Copy className="w-3 h-3" /> Import
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="single" className="flex-1 flex flex-col min-h-0 m-0">
        <SinglePane schoolId={schoolId} scope={scope} faculties={faculties} onClose={onClose} />
      </TabsContent>
      <TabsContent value="bulk" className="flex-1 flex flex-col min-h-0 m-0">
        <BulkPane schoolId={schoolId} scope={scope} faculties={faculties} onClose={onClose} />
      </TabsContent>
      <TabsContent value="import" className="flex-1 flex flex-col min-h-0 m-0">
        <ImportPane scope={scope} faculties={faculties} sourceClasses={sourceClasses} onClose={onClose} />
      </TabsContent>
    </Tabs>
  )
}

// ─── Single subject (one subject → many classes) ─────────────────────────────

function SinglePane({
  schoolId, scope, faculties, onClose,
}: {
  schoolId:  string
  scope:     SubjectScope
  faculties: FacultyOpt[]
  onClose:   () => void
}) {
  const router = useRouter()
  // classId field stays in schema but is no longer used — we fan out across
  // scope.classIds. Default to an empty string to keep the resolver happy.
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "", shortName: "", code: "", classId: "__multi__",
      creditHours: "", internalCreditHours: "", externalCreditHours: "",
      type: "REGULAR",
    },
  })

  const watchedInternal = form.watch("internalCreditHours")
  const watchedExternal = form.watch("externalCreditHours")
  const addTotalLocked = (() => {
    const i = parseFloat(watchedInternal ?? "")
    const e = parseFloat(watchedExternal ?? "")
    return Number.isFinite(i) && Number.isFinite(e)
  })()
  useEffect(() => {
    const i = parseFloat(watchedInternal ?? "")
    const e = parseFloat(watchedExternal ?? "")
    if (Number.isFinite(i) && Number.isFinite(e)) {
      const sum = String(Math.round((i + e) * 100) / 100)
      if (form.getValues("creditHours") !== sum) {
        form.setValue("creditHours", sum, { shouldDirty: true, shouldValidate: false })
      }
    }
  }, [watchedInternal, watchedExternal, form])

  async function onSubmit(v: EditValues) {
    // Defense-in-depth: scope is enforced via disabled inputs too, but a stale
    // click could still reach here. Spell out exactly what's missing.
    if (!scope.facultyId)              { toast.error("Pick a faculty in the Scope above");  return }
    if (!scope.academicYearId)         { toast.error("Pick a session in the Scope above");  return }
    if (scope.classIds.length === 0)   { toast.error("Pick at least one class in the Scope above"); return }
    // Zod already enforces these but provide concrete copy on the off-chance.
    if (!v.name?.trim()) { toast.error("Subject name is required"); return }
    if (!v.code?.trim()) { toast.error("Subject code is required"); return }

    const credits  = v.creditHours         ? parseFloat(v.creditHours)         : null
    const inCredit = v.internalCreditHours ? parseFloat(v.internalCreditHours) : null
    const exCredit = v.externalCreditHours ? parseFloat(v.externalCreditHours) : null
    const hasYearOverride = !!scope.academicYearId && (credits !== null || inCredit !== null || exCredit !== null)

    // Create the subject in each selected class. Per-class result so we can
    // report partial successes (e.g. unique-code collision in one class only).
    const results = await Promise.allSettled(
      scope.classIds.map(async classId => {
        const created = await createSubject(
          schoolId, classId, v.name, v.code,
          credits ?? undefined, v.shortName ?? null, v.type,
          inCredit, exCredit,
        )
        // When a session is picked AND any CH input is filled, also stamp a
        // per-year override so this year is configured immediately.
        if (hasYearOverride) {
          await upsertSubjectYearConfig({
            subjectId:           created.id,
            academicYearId:      scope.academicYearId,
            creditHours:         credits,
            internalCreditHours: inCredit,
            externalCreditHours: exCredit,
          })
        }
        return created
      }),
    )
    const ok     = results.filter(r => r.status === "fulfilled").length
    const failed = results.length - ok
    if (failed === 0) {
      toast.success(
        ok === 1 ? `"${v.name}" created`
                 : `Created "${v.name}" in ${ok} classes`,
      )
      onClose()
      form.reset()
      router.refresh()
    } else if (ok > 0) {
      toast.warning(`Created in ${ok} classes, failed in ${failed} (likely duplicate code)`)
      router.refresh()
    } else {
      toast.error("Failed to create subject in any class")
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-7 py-5">
        <Form {...form}>
          <form id="subject-single-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <ScopeHeader scope={scope} faculties={faculties} />
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Subject Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Compulsary Mathematics"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={form.control} name="shortName" render={({ field }) => (
                <FormItem className="sm:w-32">
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Short <span className="normal-case font-normal text-slate-400">(≤ 8)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="C.Math"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 font-mono text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Code</FormLabel>
                  <FormControl>
                    <Input placeholder="0002"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 font-mono text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={form.control} name="creditHours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Total CH <span className="normal-case font-normal text-slate-400">{addTotalLocked ? "(auto)" : "(opt)"}</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="any" min="0" placeholder="5"
                      readOnly={addTotalLocked}
                      tabIndex={addTotalLocked ? -1 : 0}
                      className={cn(
                        "h-11 border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm",
                        addTotalLocked ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white",
                      )}
                      {...field} />
                  </FormControl>
                  {addTotalLocked && (
                    <p className="text-[10px] text-slate-400 mt-1">Auto-summed from Internal + External</p>
                  )}
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="internalCreditHours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Internal CH <span className="normal-case font-normal text-slate-400">(practical)</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="any" min="0" placeholder="1"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
              <FormField control={form.control} name="externalCreditHours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    External CH <span className="normal-case font-normal text-slate-400">(theory)</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="any" min="0" placeholder="4"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Subject Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="REGULAR">Regular — compulsory, counts toward GPA</SelectItem>
                    <SelectItem value="OPTIONAL">Optional — student choice, counts toward GPA</SelectItem>
                    <SelectItem value="EXTRA">Extra — compulsory but excluded from GPA</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400 mt-1">Affects how this subject is rolled up into ledgers and gradesheets.</p>
              </FormItem>
            )} />
          </form>
        </Form>
      </div>
      <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}
          className="gap-1.5 cursor-pointer text-xs h-9">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
        <Button form="subject-single-form" type="submit" size="sm"
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-9"
          disabled={form.formState.isSubmitting}>
          <Save className="w-3.5 h-3.5" /> {form.formState.isSubmitting ? "Creating…" : "Create Subject"}
        </Button>
      </div>
    </>
  )
}

// ─── Bulk paste / multi-row creation ────────────────────────────────────────

type BulkRow = { name: string; code: string; creditHours: string }

function BulkPane({
  schoolId, scope, faculties, onClose,
}: {
  schoolId:  string
  scope:     SubjectScope
  faculties: FacultyOpt[]
  onClose:   () => void
}) {
  const router = useRouter()
  const [rows, setRows] = useState<BulkRow[]>([
    { name: "", code: "", creditHours: "" },
    { name: "", code: "", creditHours: "" },
    { name: "", code: "", creditHours: "" },
  ])
  const [busy, setBusy] = useState(false)

  function updateRow(i: number, patch: Partial<BulkRow>) {
    const next = [...rows]
    next[i] = { ...next[i], ...patch }
    setRows(next)
  }

  function addRow() { setRows([...rows, { name: "", code: "", creditHours: "" }]) }
  function removeRow(i: number) { setRows(rows.filter((_, j) => j !== i)) }

  async function handleSave() {
    if (scope.classIds.length === 0) { toast.error("Pick at least one class in the Scope above"); return }
    const filled = rows.filter(r => r.name.trim().length > 0)
    if (filled.length === 0) { toast.error("Add at least one subject row"); return }
    setBusy(true)
    try {
      // For each selected class, bulk-create the filled rows. Per-class result
      // so partial failures (duplicate codes etc.) don't lose the whole batch.
      const perClass = await Promise.allSettled(
        scope.classIds.map(async classId => {
          const result = await bulkCreateSubjects(
            schoolId, classId,
            filled.map(r => ({
              name: r.name,
              code: r.code,
              creditHours: r.creditHours ? parseFloat(r.creditHours) : null,
            })),
          )
          // Year-config stamp: if a session is picked, mirror the row's
          // creditHours as a per-year override total CH (no split here —
          // bulk rows don't carry the pillar split).
          if (scope.academicYearId && result.subjects?.length) {
            await Promise.all(result.subjects.map(s => {
              const matched = filled.find(r => r.code === s.code)
              const ch = matched?.creditHours ? parseFloat(matched.creditHours) : null
              if (ch === null) return Promise.resolve()
              return upsertSubjectYearConfig({
                subjectId:      s.id,
                academicYearId: scope.academicYearId,
                creditHours:    ch,
              })
            }))
          }
          return result.created
        }),
      )
      const totalCreated = perClass.reduce(
        (sum, r) => sum + (r.status === "fulfilled" ? r.value : 0), 0,
      )
      const failures = perClass.filter(r => r.status === "rejected").length
      if (totalCreated > 0) {
        toast.success(
          `Created ${totalCreated} subject${totalCreated === 1 ? "" : "s"} across ${scope.classIds.length} class${scope.classIds.length === 1 ? "" : "es"}` +
            (failures > 0 ? ` · ${failures} class${failures === 1 ? "" : "es"} failed (likely duplicate codes)` : ""),
        )
        onClose()
        router.refresh()
      } else {
        toast.error("Nothing created — check for duplicate codes in destination classes")
      }
    } catch {
      toast.error("Failed to create subjects")
    } finally {
      setBusy(false)
    }
  }

  const filledCount = rows.filter(r => r.name.trim().length > 0).length

  return (
    <>
      <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
        <ScopeHeader scope={scope} faculties={faculties} />

        <div className="bg-slate-50/60 rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="col-span-5">Name</div>
            <div className="col-span-3">Code</div>
            <div className="col-span-2">Credits</div>
            <div className="col-span-2"></div>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input value={row.name} onChange={e => updateRow(i, { name: e.target.value })}
                placeholder="Subject name"
                className="col-span-5 h-9 text-xs bg-white border-slate-200 rounded-lg" />
              <Input value={row.code} onChange={e => updateRow(i, { code: e.target.value })}
                placeholder="0002"
                className="col-span-3 h-9 text-xs bg-white border-slate-200 rounded-lg font-mono" />
              <Input value={row.creditHours} onChange={e => updateRow(i, { creditHours: e.target.value })}
                type="number" min="0" step="any" placeholder="—"
                className="col-span-2 h-9 text-xs bg-white border-slate-200 rounded-lg text-center" />
              <div className="col-span-2 flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => removeRow(i)}
                  className="h-8 w-8 cursor-pointer text-rose-600 hover:bg-rose-50" disabled={rows.length === 1}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addRow}
            className="gap-1.5 cursor-pointer text-xs h-8 w-full bg-white mt-1">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </Button>
        </div>
        <p className="text-[11px] text-slate-500">
          <strong>{filledCount}</strong> filled row{filledCount === 1 ? "" : "s"} of {rows.length}. Empty rows are skipped on save.
        </p>
      </div>
      <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}
          className="gap-1.5 cursor-pointer text-xs h-9">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={busy}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-9">
          <Save className="w-3.5 h-3.5" /> {busy ? "Creating…" : `Create ${filledCount} Subjects`}
        </Button>
      </div>
    </>
  )
}

// ─── Import from another class ──────────────────────────────────────────────

function ImportPane({
  scope, faculties, sourceClasses, onClose,
}: {
  scope:         SubjectScope
  faculties:     FacultyOpt[]
  sourceClasses: SourceClass[]
  onClose:       () => void
}) {
  const router = useRouter()
  const [fromId, setFromId] = useState("")
  const [picks,  setPicks]  = useState<Set<string>>(new Set())
  const [busy,   setBusy]   = useState(false)

  const fromClass = sourceClasses.find(c => c.id === fromId)
  // Codes already present in ANY destination class — used to flag "will skip".
  const destCodesUnion = useMemo(() => {
    const codes = new Set<string>()
    for (const cId of scope.classIds) {
      const dest = sourceClasses.find(c => c.id === cId)
      for (const s of dest?.subjects ?? []) codes.add(s.code)
    }
    return codes
  }, [scope.classIds, sourceClasses])

  // Reset picks when source changes
  useEffect(() => {
    if (!fromClass) { setPicks(new Set()); return }
    const all = new Set(fromClass.subjects.map(s => s.id))
    setPicks(all)
  }, [fromClass])

  function togglePick(id: string) {
    const next = new Set(picks)
    if (next.has(id)) next.delete(id); else next.add(id)
    setPicks(next)
  }

  async function handleImport() {
    if (!fromId) { toast.error("Pick a source class"); return }
    if (scope.classIds.length === 0) { toast.error("Pick at least one destination class in the Scope above"); return }
    if (scope.classIds.includes(fromId)) { toast.error("Source must differ from destinations"); return }
    if (picks.size === 0) { toast.error("Select at least one subject"); return }
    setBusy(true)
    try {
      // Fan out the clone across every destination class.
      const perClass = await Promise.allSettled(
        scope.classIds.map(toId =>
          cloneSubjectsFromClass({ fromClassId: fromId, toClassId: toId, subjectIds: [...picks] }),
        ),
      )
      let totalCloned  = 0
      let totalSkipped = 0
      let failures     = 0
      for (const r of perClass) {
        if (r.status === "fulfilled") {
          totalCloned  += r.value.cloned
          totalSkipped += r.value.skipped
        } else {
          failures += 1
        }
      }
      if (totalCloned > 0 || totalSkipped > 0) {
        toast.success(
          `Cloned ${totalCloned} subject${totalCloned === 1 ? "" : "s"} across ${scope.classIds.length} class${scope.classIds.length === 1 ? "" : "es"}` +
          (totalSkipped > 0 ? ` · ${totalSkipped} skipped (code already exists)` : "") +
          (failures > 0 ? ` · ${failures} class${failures === 1 ? "" : "es"} failed` : ""),
        )
        onClose()
        router.refresh()
      } else {
        toast.error("Nothing cloned")
      }
    } catch {
      toast.error("Import failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
        <ScopeHeader scope={scope} faculties={faculties} />

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Source Class</label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger className="mt-1 h-10 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
              <SelectValue placeholder="Copy subjects from…" />
            </SelectTrigger>
            <SelectContent>
              {sourceClasses
                .filter(c => c.subjects.length > 0)
                .map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} <span className="text-[10px] text-slate-400 ml-1">{cls.subjects.length} subj</span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-slate-400 mt-1">
            Destination classes come from the Scope above.
          </p>
        </div>

        {fromClass && (
          <div className="bg-slate-50/60 rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100 bg-white/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Subjects in {fromClass.name}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {picks.size} / {fromClass.subjects.length} selected
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => setPicks(new Set(fromClass.subjects.map(s => s.id)))}
                  className="text-[11px] h-6 cursor-pointer px-2">All</Button>
                <Button size="sm" variant="ghost" onClick={() => setPicks(new Set())}
                  className="text-[11px] h-6 cursor-pointer px-2">None</Button>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {fromClass.subjects.map(s => {
                const willSkip = destCodesUnion.has(s.code)
                return (
                  <label key={s.id}
                    className={cn(
                      "px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-white/60 transition-colors",
                      willSkip && "opacity-60"
                    )}>
                    <Checkbox checked={picks.has(s.id)} onCheckedChange={() => togglePick(s.id)} disabled={willSkip}
                      className="cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{s.name}</span>
                        <code className="text-[10px] text-slate-400 font-mono">{s.code}</code>
                        {s.creditHours != null && (
                          <span className="text-[10px] text-slate-400">· {s.creditHours} hr</span>
                        )}
                      </div>
                      {willSkip && (
                        <p className="text-[10px] text-amber-700 mt-0.5">Already exists in destination (matched by code) — will skip</p>
                      )}
                    </div>
                  </label>
                )
              })}
              {fromClass.subjects.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-slate-400">Source class has no subjects</div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}
          className="gap-1.5 cursor-pointer text-xs h-9">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={handleImport} disabled={busy || !fromId || scope.classIds.length === 0 || picks.size === 0}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-9">
          <ArrowDownToLine className="w-3.5 h-3.5" />
          {busy
            ? "Importing…"
            : `Import ${picks.size} × ${scope.classIds.length} class${scope.classIds.length === 1 ? "" : "es"}`}
        </Button>
      </div>
    </>
  )
}
