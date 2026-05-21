"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarRange, Plus, Pencil, Trash2, Save, X, Info, FileText, ArrowRight,
  GraduationCap, Check, Layers, FolderTree, Building2,
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { createExam, updateExam, deleteExam, getExamClasses } from "@/actions/exams"
import { loadGlobalCtx, saveGlobalCtx, FACULTY_GENERAL } from "@/lib/global-context"

type ExamRow = {
  id:             string
  name:           string
  academicYearId: string
  facultyId:      string | null
  academicYear:   { id: string; name: string; facultyId: string | null }
  faculty:        { id: string; name: string } | null
  createdAt:      Date
  _count?:        { papers: number; classes: number }
}

type FacultyOpt      = { id: string; name: string }
type AcademicYearOpt = { id: string; name: string; isCurrent: boolean; facultyId: string | null; startDateBS: string }
type ClassOpt        = { id: string; name: string; facultyId: string | null; facultyName: string | null }

const GENERAL = FACULTY_GENERAL
const SESSION_ALL = "__all__"

interface Props {
  schoolId:      string
  initialExams:  ExamRow[]
  academicYears: AcademicYearOpt[]
  faculties:     FacultyOpt[]
  classes:       ClassOpt[]
}

export function ExamsClient({ schoolId, initialExams, academicYears, faculties, classes }: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [editing, setEditing] = useState<ExamRow | null>(null)
  const [creating, setCreating] = useState(false)

  // Faculty + Session filters — restored from shared global context, default to General.
  const [filterFacultyId,    setFilterFacultyIdState]    = useState<string>(() =>
    loadGlobalCtx().facultyKey ?? GENERAL,
  )
  const [filterSessionName,  setFilterSessionNameState]  = useState<string>(() =>
    loadGlobalCtx().academicYearName ?? SESSION_ALL,
  )

  function setFilterFacultyId(v: string) {
    setFilterFacultyIdState(v)
    saveGlobalCtx({ facultyKey: v })
  }
  function setFilterSessionName(v: string) {
    setFilterSessionNameState(v)
    saveGlobalCtx({ academicYearName: v === SESSION_ALL ? undefined : v })
  }

  // Sessions filtered to the picked faculty. General = facultyId null. Otherwise
  // strict match — no fallback to null. Deduped by name in case the school
  // happened to have multiple rows with the same display name.
  const sessionOptions = useMemo(() => {
    const facultyMatch = (yFacultyId: string | null) =>
      filterFacultyId === GENERAL ? yFacultyId === null : yFacultyId === filterFacultyId
    const byName = new Map<string, { name: string; isCurrent: boolean; latestStart: string }>()
    for (const y of academicYears) {
      if (!facultyMatch(y.facultyId)) continue
      const ex = byName.get(y.name)
      const start = y.startDateBS ?? ""
      if (!ex) { byName.set(y.name, { name: y.name, isCurrent: y.isCurrent, latestStart: start }); continue }
      if (y.isCurrent) ex.isCurrent = true
      if (start > ex.latestStart) ex.latestStart = start
    }
    return [...byName.values()].sort((a, b) => b.latestStart.localeCompare(a.latestStart))
  }, [academicYears, filterFacultyId])

  // If the stored session isn't available under the current faculty, snap to the
  // latest current/first option of that faculty (or "All" when faculty has none).
  useEffect(() => {
    if (filterSessionName === SESSION_ALL) return
    if (!sessionOptions.some(s => s.name === filterSessionName)) {
      const latest = sessionOptions.find(s => s.isCurrent) ?? sessionOptions[0]
      setFilterSessionNameState(latest?.name ?? SESSION_ALL)
      saveGlobalCtx({ academicYearName: latest?.name })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionOptions])

  const exams = initialExams

  const filtered = useMemo(() => exams.filter(e => {
    if (filterFacultyId === GENERAL) {
      if (e.facultyId !== null) return false
    } else if (e.facultyId !== filterFacultyId) {
      return false
    }
    if (filterSessionName !== SESSION_ALL && e.academicYear.name !== filterSessionName) return false
    return true
  }), [exams, filterFacultyId, filterSessionName])

  function handleDelete(exam: ExamRow) {
    if (!confirm(`Delete "${exam.name}"? Papers, schedules, seats, and TerminalExamScore rows for this terminal will be removed.`)) return
    startT(async () => {
      try {
        await deleteExam(exam.id)
        toast.success("Terminal Exam deleted")
        router.refresh()
      } catch {
        toast.error("Failed to delete")
      }
    })
  }

  const sortedFaculties = useMemo(
    () => [...faculties].sort((a, b) => b.name.localeCompare(a.name)),
    [faculties],
  )

  return (
    <div className="space-y-4">
      {/* Faculty + Session dropdowns */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3" /> Faculty
          </span>
          <Select value={filterFacultyId} onValueChange={setFilterFacultyId}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[180px]">
              <SelectValue placeholder="Pick faculty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GENERAL}>General (no faculty)</SelectItem>
              {sortedFaculties.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <CalendarRange className="w-3 h-3" /> Session
          </span>
          <Select value={filterSessionName} onValueChange={setFilterSessionName}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[180px]">
              <SelectValue placeholder="All sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SESSION_ALL}>All sessions</SelectItem>
              {sessionOptions.map(s => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                  {s.isCurrent && <span className="ml-2 text-[10px] text-emerald-600 font-bold">CURRENT</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge variant="secondary" className="text-[10px] font-bold gap-1">
          <CalendarRange className="w-3 h-3" /> {filtered.length} {filtered.length === 1 ? "terminal" : "terminals"}
        </Badge>
        <Button size="sm" onClick={() => setCreating(true)}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
          <Plus className="w-3.5 h-3.5" /> New Terminal Exam
        </Button>
      </div>

      <div className="bg-blue-50/40 border border-blue-200/60 rounded-xl p-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800 leading-relaxed">
          A <strong>terminal</strong> belongs to a faculty (or General) and a session (academic year).
          When creating a terminal you also pick <em>which classes</em> from that faculty sit it — those
          are the only classes the routine and seat plan will show.
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <CalendarRange className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No terminals in this faculty yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Add one — e.g. <em>Term 1</em>, <em>Final Term</em>.
          </p>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New Terminal Exam
          </Button>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50/60 border-b border-slate-100">
            <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Name</div>
            <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Session</div>
            <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Classes</div>
            <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Papers</div>
            <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">⋯</div>
          </div>
          <div className="divide-y divide-slate-100/60">
            {filtered.map(exam => {
              const papers  = exam._count?.papers  ?? 0
              const cnt     = exam._count?.classes ?? 0
              return (
                <div key={exam.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-primary/5 transition-colors group">
                  <div className="col-span-4 min-w-0">
                    <Link
                      href={`/academics/exams/${exam.id}`}
                      className="font-semibold text-sm truncate flex items-center gap-1.5 text-slate-800 hover:text-primary transition-colors"
                    >
                      <span className="truncate">{exam.name}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </Link>
                  </div>
                  <div className="col-span-3 text-xs text-slate-600 truncate font-mono tabular-nums">{exam.academicYear.name}</div>
                  <div className="col-span-2 flex items-center gap-1.5">
                    {cnt > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <GraduationCap className="w-2.5 h-2.5" />
                        {cnt}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">no classes</span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5">
                    {papers > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                        <FileText className="w-2.5 h-2.5" />
                        {papers}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">no papers</span>
                    )}
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-0.5">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(exam)}
                      className="h-7 w-7 cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(exam)} disabled={pending}
                      className="h-7 w-7 cursor-pointer text-rose-600 hover:bg-rose-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(editing !== null || creating) && (
        <ExamBuilder
          key={editing?.id ?? "new-exam"}
          schoolId={schoolId}
          faculties={faculties}
          academicYears={academicYears}
          classes={classes}
          defaultFacultyId={filterFacultyId === GENERAL ? null : filterFacultyId}
          editing={editing}
          onClose={() => { setEditing(null); setCreating(false); router.refresh() }}
        />
      )}
    </div>
  )
}

// ─── Builder ────────────────────────────────────────────────────────────

function ExamBuilder({
  schoolId, faculties, academicYears, classes, defaultFacultyId, editing, onClose,
}: {
  schoolId:         string
  faculties:        FacultyOpt[]
  academicYears:    AcademicYearOpt[]
  classes:          ClassOpt[]
  defaultFacultyId: string | null
  editing:          ExamRow | null
  onClose:          () => void
}) {
  const isEdit = editing !== null

  // Faculty
  const [facultyId, setFacultyId] = useState<string>(
    editing
      ? (editing.facultyId ?? GENERAL)
      : (defaultFacultyId ?? GENERAL),
  )
  const facultyForLookup = facultyId === GENERAL ? null : facultyId

  // Strict scoping: General shows only school-wide (null) sessions; a specific
  // faculty shows only its own sessions. Sessions from another faculty or the
  // school-wide bucket are not selectable for a faculty-scoped terminal.
  const sessionOptions = useMemo(() => academicYears.filter(y => {
    if (!facultyForLookup) return y.facultyId === null
    return y.facultyId === facultyForLookup
  }), [academicYears, facultyForLookup])

  // Latest session for this faculty = first in pre-sorted list (orderBy isCurrent desc, startDateBS desc)
  const defaultSessionId = sessionOptions[0]?.id ?? ""

  const [name, setName] = useState(editing?.name ?? "")
  const [academicYearId, setAcademicYearId] = useState(
    editing?.academicYearId ?? defaultSessionId,
  )

  // Classes filtered to this faculty
  const classOptions = useMemo(() => {
    if (!facultyForLookup) return classes.filter(c => c.facultyId === null)
    return classes.filter(c => c.facultyId === facultyForLookup)
  }, [classes, facultyForLookup])

  // Default: all classes in the chosen faculty are pre-selected for new exams.
  // On edit, classes get replaced by the existing exam's classes once loaded.
  const [classIds, setClassIds] = useState<string[]>(() =>
    isEdit ? [] : classOptions.map(c => c.id),
  )
  const [classesLoaded, setClassesLoaded] = useState(false)

  // On edit, pre-load this exam's existing classes
  useMemo(() => {
    if (!isEdit || classesLoaded || !editing) return
    getExamClasses(editing.id, schoolId).then(ids => {
      setClassIds(ids)
      setClassesLoaded(true)
    }).catch(() => setClassesLoaded(true))
  }, [isEdit, classesLoaded, editing, schoolId])

  // When faculty changes (create flow): reset session + pre-select all classes
  // in the new faculty so the user doesn't have to tick every checkbox.
  function changeFaculty(next: string) {
    setFacultyId(next)
    const nextLookup = next === GENERAL ? null : next
    const nextSession = academicYears.find(y => {
      if (!nextLookup) return y.facultyId === null
      return y.facultyId === nextLookup
    })
    setAcademicYearId(nextSession?.id ?? "")
    const nextClasses = nextLookup
      ? classes.filter(c => c.facultyId === nextLookup)
      : classes.filter(c => c.facultyId === null)
    setClassIds(nextClasses.map(c => c.id))
  }

  function toggleClass(id: string) {
    setClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function pickAllClasses() { setClassIds(classOptions.map(c => c.id)) }
  function clearClasses()   { setClassIds([]) }

  const [pending, startT] = useTransition()

  function handleSave() {
    if (!name.trim())                  { toast.error("Name is required");                    return }
    if (!academicYearId)               { toast.error("Pick a session");                      return }
    startT(async () => {
      try {
        if (isEdit && editing) {
          await updateExam(editing.id, {
            name,
            facultyId: facultyForLookup,
            classIds,
          })
          toast.success("Terminal Exam updated")
        } else {
          await createExam({
            schoolId,
            name,
            academicYearId,
            facultyId: facultyForLookup,
            classIds,
          })
          toast.success("Terminal Exam created")
        }
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarRange className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold">{isEdit ? "Edit Terminal Exam" : "New Terminal Exam"}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {isEdit ? "Rename or change which classes sit it" : "Faculty → Session → Name → Classes"}
              </div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Terminal Exam editor</SheetDescription>
        </div>

        <div className="p-6 space-y-5">
          {/* Faculty */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Faculty</label>
            <Select value={facultyId} onValueChange={changeFaculty} disabled={isEdit}>
              <SelectTrigger className="mt-1 h-10 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {faculties.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    <FolderTree className="w-3 h-3 text-violet-600 inline mr-1.5" />
                    {f.name}
                  </SelectItem>
                ))}
                <SelectItem value={GENERAL}>
                  <Building2 className="w-3 h-3 text-slate-500 inline mr-1.5" />
                  General <span className="text-[10px] text-slate-400 ml-1">no faculty</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-[10px] text-slate-400 mt-1">Faculty cannot be changed once the terminal exists.</p>
            )}
          </div>

          {/* Session */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Session (academic year)</label>
            <Select value={academicYearId} onValueChange={setAcademicYearId} disabled={isEdit}>
              <SelectTrigger className="mt-1 h-10 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue placeholder={sessionOptions.length === 0 ? "No sessions for this faculty" : "Select session"} />
              </SelectTrigger>
              <SelectContent>
                {sessionOptions.map(y => (
                  <SelectItem key={y.id} value={y.id}>
                    <span className="font-mono tabular-nums">{y.name}</span>
                    {y.isCurrent && <span className="text-[10px] text-amber-600 ml-1.5 font-bold">CURRENT</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEdit && sessionOptions.length === 0 && (
              <p className="text-[10px] text-rose-500 mt-1">
                No sessions exist for this faculty.{" "}
                <Link href="/academics/years" className="underline">Create one →</Link>
              </p>
            )}
            {isEdit && (
              <p className="text-[10px] text-slate-400 mt-1">Session cannot be changed once the terminal exists.</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Term 1, Final Term"
              className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-lg" />
          </div>

          {/* Classes */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Classes that sit this terminal ({classIds.length}/{classOptions.length})
              </label>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={pickAllClasses}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer">All</button>
                <span className="text-slate-300">·</span>
                <button type="button" onClick={clearClasses}
                  className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer">None</button>
              </div>
            </div>
            {classOptions.length === 0 ? (
              <div className="mt-1 bg-amber-50/60 border border-amber-200 rounded-lg px-3 py-2.5 text-[11px] text-amber-800">
                No classes in this faculty.{" "}
                <Link href="/academics/classes" className="underline font-semibold">Add classes →</Link>
              </div>
            ) : (
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {classOptions.map(c => {
                  const picked = classIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer text-left",
                        picked
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      <span className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                        picked ? "bg-emerald-500 border-emerald-600" : "border-slate-300",
                      )}>
                        {picked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className="font-bold truncate">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {!isEdit && classIds.length === 0 && classOptions.length > 0 && (
              <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" />
                Pick at least one class so the routine knows which columns to show.
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Save className="w-3.5 h-3.5" /> {pending ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
