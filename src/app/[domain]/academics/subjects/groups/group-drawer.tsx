"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Layers, Plus, Save, X, FolderTree, CalendarRange, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { loadGlobalCtx, saveGlobalCtx, FACULTY_GENERAL } from "@/lib/global-context"
import {
  createSubjectGroup, updateSubjectGroup,
  type CreateGroupArgs, type UpdateGroupArgs,
} from "@/actions/subject-groups"

export interface FacultyOpt {
  id:   string
  name: string
}

export interface YearOpt {
  id:          string
  name:        string
  facultyId:   string | null
  isCurrent:   boolean
  startDateBS: string
}

export interface ClassOpt {
  id:          string
  name:        string
  facultyId:   string | null
  facultyName: string | null
  subjects:    { id: string; name: string; code: string; type: "REGULAR" | "OPTIONAL" | "EXTRA" }[]
}

export interface GroupDrawerData {
  id:          string
  label:       string
  kind:        "OPTIONAL_PICK" | "EXTRA_COHORT"
  pickCount:   number
  classId:     string
  subjectIds:  string[]
}

interface Props {
  schoolId:     string
  faculties:    FacultyOpt[]
  years:        YearOpt[]
  classes:      ClassOpt[]
  editing:      GroupDrawerData | null
  open:         boolean
  onOpenChange: (open: boolean) => void
  /** Optional trigger button. When omitted, the drawer is opened externally. */
  showTrigger?: boolean
}

export function GroupDrawer({ schoolId, faculties, years, classes, editing, open, onOpenChange, showTrigger }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const isEdit = !!editing

  const [label,      setLabel]      = useState(editing?.label ?? "")
  const [kind,       setKind]       = useState<"OPTIONAL_PICK" | "EXTRA_COHORT">(editing?.kind ?? "OPTIONAL_PICK")
  const [pickCount,  setPickCount]  = useState<number>(editing?.pickCount ?? 1)
  const [classId,    setClassId]    = useState(editing?.classId ?? "")
  const [subjectIds, setSubjectIds] = useState<string[]>(editing?.subjectIds ?? [])

  // Global-context filter chain: Faculty → Session → Class.
  // Hydrated from localStorage on first open; saved on every change so other
  // pages (and the next session) see the same selection.
  const [facultyKey, setFacultyKey] = useState<string>("")
  const [yearId,     setYearId]     = useState<string>("")

  // Reset on editing change.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setLabel(editing?.label ?? "")
    setKind(editing?.kind ?? "OPTIONAL_PICK")
    setPickCount(editing?.pickCount ?? 1)
    setClassId(editing?.classId ?? "")
    setSubjectIds(editing?.subjectIds ?? [])
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editing])

  // Hydrate the Faculty/Session filter chain from global context when the
  // drawer first opens. When editing, derive faculty from the existing class
  // so the dropdowns show a coherent picture.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) return
    if (editing) {
      const editClass = classes.find(c => c.id === editing.classId)
      setFacultyKey(editClass?.facultyId ?? FACULTY_GENERAL)
      // Session is a UI scope — leave whatever's in localStorage so the next
      // mutation lands in the same session.
      const ctx = loadGlobalCtx()
      if (ctx.academicYearId) setYearId(ctx.academicYearId)
      else                    setYearId(years.find(y => y.isCurrent)?.id ?? years[0]?.id ?? "")
      return
    }
    const ctx = loadGlobalCtx()
    setFacultyKey(ctx.facultyKey ?? FACULTY_GENERAL)
    const fallbackYear =
      years.find(y => y.id === ctx.academicYearId)?.id
      ?? years.find(y => y.isCurrent)?.id
      ?? years[0]?.id
      ?? ""
    setYearId(fallbackYear)
    if (ctx.classId && classes.some(c => c.id === ctx.classId)) {
      setClassId(ctx.classId)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editing, classes, years])

  // Persist any pick to global context so other pages share it.
  useEffect(() => {
    if (!open) return
    saveGlobalCtx({
      facultyKey:     facultyKey || undefined,
      academicYearId: yearId     || undefined,
      classId:        classId    || undefined,
    })
  }, [open, facultyKey, yearId, classId])

  // Faculty → narrows Session list (sessions are faculty-scoped) AND Class list.
  const realFacultyId = facultyKey === FACULTY_GENERAL ? null : facultyKey
  const eligibleYears = useMemo(() => {
    if (!facultyKey) return years
    return years.filter(y => y.facultyId === realFacultyId)
  }, [years, facultyKey, realFacultyId])
  const eligibleClasses = useMemo(() => {
    if (!facultyKey) return classes
    return classes.filter(c => c.facultyId === realFacultyId)
  }, [classes, facultyKey, realFacultyId])

  // If the current year/class isn't in the eligible set after a faculty change, clear it.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (yearId   && !eligibleYears.some(y   => y.id   === yearId))   setYearId("")
    if (classId  && !eligibleClasses.some(c => c.id   === classId))  setClassId("")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [yearId, classId, eligibleYears, eligibleClasses])

  const currentClass = useMemo(() => eligibleClasses.find(c => c.id === classId), [eligibleClasses, classId])

  // Subject list filtered by kind:
  //   OPTIONAL_PICK → only OPTIONAL subjects (typical use case)
  //   EXTRA_COHORT  → only EXTRA subjects
  const eligibleSubjects = useMemo(() => {
    if (!currentClass) return []
    return currentClass.subjects.filter(s =>
      kind === "OPTIONAL_PICK" ? s.type === "OPTIONAL" : s.type === "EXTRA",
    )
  }, [currentClass, kind])

  // For EXTRA_COHORT: enforce single subject.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (kind === "EXTRA_COHORT" && subjectIds.length > 1) {
      setSubjectIds(subjectIds.slice(0, 1))
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [kind, subjectIds])

  function toggleSubject(id: string) {
    if (kind === "EXTRA_COHORT") {
      setSubjectIds([id])
    } else {
      setSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }
  }

  function onSubmit() {
    const cleanLabel = label.trim()
    if (!cleanLabel)            { toast.error("Label is required"); return }
    if (!classId)               { toast.error("Pick a class"); return }
    if (subjectIds.length === 0){ toast.error("Pick at least one subject"); return }
    if (kind === "OPTIONAL_PICK" && subjectIds.length < 2) {
      toast.error("Optional groups need at least 2 subjects"); return
    }
    if (kind === "OPTIONAL_PICK" && (pickCount < 1 || pickCount >= subjectIds.length)) {
      toast.error(`pickCount must be between 1 and ${subjectIds.length - 1}`); return
    }

    startT(async () => {
      try {
        if (isEdit && editing) {
          const args: UpdateGroupArgs = {
            label: cleanLabel,
            ...(kind === "OPTIONAL_PICK" && { pickCount }),
            subjectIds,
          }
          await updateSubjectGroup(editing.id, args)
          toast.success("Group updated")
        } else {
          const args: CreateGroupArgs = {
            label: cleanLabel,
            kind,
            ...(kind === "OPTIONAL_PICK" && { pickCount }),
            subjectIds,
          }
          await createSubjectGroup(schoolId, classId, args)
          toast.success("Group created")
        }
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <>
      {showTrigger && (
        <Button onClick={() => onOpenChange(true)} className="cursor-pointer shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" />
          New Group
        </Button>
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
          <div className="px-7 py-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <SheetTitle className="text-base font-semibold">
                  {isEdit ? "Edit Subject Group" : "New Subject Group"}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {isEdit ? "Update label, pick count or subject membership." : "Bucket optional subjects or curate an EXTRA cohort."}
                </SheetDescription>
              </div>
            </div>
          </div>

          <div className="px-7 py-5 flex-1 overflow-y-auto space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Label</Label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Optional I"
                className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Scope</div>

              <div className="grid grid-cols-[20px_1fr] items-center gap-2">
                <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                <Select value={facultyKey} onValueChange={setFacultyKey} disabled={isEdit}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 rounded-lg cursor-pointer text-xs">
                    <SelectValue placeholder="Faculty…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FACULTY_GENERAL}>General · no faculty</SelectItem>
                    {faculties.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[20px_1fr] items-center gap-2">
                <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                <Select value={yearId} onValueChange={setYearId}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 rounded-lg cursor-pointer text-xs">
                    <SelectValue placeholder={eligibleYears.length === 0 ? "No sessions for this faculty" : "Session…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleYears.map(y => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name}{y.isCurrent ? " · current" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[20px_1fr] items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                <Select value={classId} onValueChange={setClassId} disabled={isEdit}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 rounded-lg cursor-pointer text-xs">
                    <SelectValue placeholder={eligibleClasses.length === 0 ? "No classes for this faculty" : "Class…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleClasses.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isEdit && <p className="text-[10px] text-slate-400">Class can&apos;t change after creation.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Kind</Label>
                <Select
                  value={kind}
                  onValueChange={v => setKind(v as "OPTIONAL_PICK" | "EXTRA_COHORT")}
                  disabled={isEdit}
                >
                  <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPTIONAL_PICK">Optional pick</SelectItem>
                    <SelectItem value="EXTRA_COHORT">Extra cohort</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kind === "OPTIONAL_PICK" ? (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Pick count</Label>
                  <Input
                    type="number" min={1} max={Math.max(1, subjectIds.length - 1)} step={1}
                    value={pickCount}
                    onChange={e => setPickCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm"
                  />
                </div>
              ) : (
                <div /> /* spacer to preserve grid */
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed -mt-2">
              {kind === "OPTIONAL_PICK"
                ? <><strong>Optional pick:</strong> 2+ OPTIONAL subjects; each student picks N (e.g. Optional I = {"{Math, Econ}"}). Counts toward GPA.</>
                : <><strong>Extra cohort:</strong> 1 EXTRA subject; admin curates which students take it (e.g. Computer). Counts on the mark sheet but excluded from GPA.</>}
            </p>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Subjects</Label>
              {!classId ? (
                <p className="text-xs text-slate-400 italic">Pick a class first.</p>
              ) : eligibleSubjects.length === 0 ? (
                <p className="text-xs text-amber-600">
                  No {kind === "OPTIONAL_PICK" ? "OPTIONAL" : "EXTRA"} subjects in this class. Add them via the Subjects tab first.
                </p>
              ) : (
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-[280px] overflow-y-auto">
                  {eligibleSubjects.map(s => {
                    const checked = subjectIds.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors",
                          checked && "bg-amber-50/40",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSubject(s.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{s.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{s.code}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60 flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
              <X className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
            <Button onClick={onSubmit} className="flex-1 cursor-pointer shadow-lg shadow-primary/20 font-bold">
              <Save className="w-4 h-4 mr-1.5" />
              {isEdit ? "Save changes" : "Create group"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
