"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  FileText, Save, Plus, X, GraduationCap, BookOpen, Trash2, Info, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  createExamPaper, updateExamPaper, setPaperTargets, getResolvedExamMarksForUI,
  type PaperRow,
} from "@/actions/exams"
import type { ResolvedExamMarks } from "@/lib/exam-marks"

export interface PaperClassOpt {
  id:          string
  name:        string
  facultyName: string | null
  subjects:    { id: string; name: string; code: string; teacherName: string | null }[]
}

interface Props {
  schoolId:   string
  examId:     string
  classes:    PaperClassOpt[]
  editPaper?: PaperRow | null
  open:       boolean
  onOpenChange: (open: boolean) => void
}

interface DraftTarget {
  classId:   string
  subjectId: string
}

export function PaperDrawer({
  schoolId, examId, classes, editPaper, open, onOpenChange,
}: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const isEdit = !!editPaper

  // Form fields. subjectName/code are derived from the first target's subject.
  // fullMarks/passMarks are only set when the user explicitly enables an override.
  const [durationMin, setDurationMin] = useState(editPaper?.durationMin?.toString() ?? "90")
  const [useOverride, setUseOverride] = useState(
    !!(editPaper?.fullMarks != null || editPaper?.passMarks != null),
  )
  const [fullMarks,   setFullMarks]   = useState(editPaper?.fullMarks?.toString() ?? "")
  const [passMarks,   setPassMarks]   = useState(editPaper?.passMarks?.toString() ?? "")

  // Targets list
  const [targets, setTargets] = useState<DraftTarget[]>(() =>
    (editPaper?.targets ?? []).map(t => ({ classId: t.classId, subjectId: t.subjectId })),
  )

  // Resolved marks for the first target's subject (from Evaluation Configure or fallback).
  const [resolved, setResolved] = useState<ResolvedExamMarks | null>(null)
  const [resolving, setResolving] = useState(false)

  // Reset when editPaper changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDurationMin(editPaper?.durationMin?.toString() ?? "90")
    setUseOverride(!!(editPaper?.fullMarks != null || editPaper?.passMarks != null))
    setFullMarks(editPaper?.fullMarks?.toString() ?? "")
    setPassMarks(editPaper?.passMarks?.toString() ?? "")
    setTargets((editPaper?.targets ?? []).map(t => ({ classId: t.classId, subjectId: t.subjectId })))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editPaper])

  const classById = useMemo(() => new Map(classes.map(c => [c.id, c])), [classes])

  // Derived subjectName/code from first target — single source of truth.
  const firstTarget = targets[0]
  const firstSubject = useMemo(() => {
    if (!firstTarget?.classId || !firstTarget?.subjectId) return null
    const cls = classById.get(firstTarget.classId)
    return cls?.subjects.find(s => s.id === firstTarget.subjectId) ?? null
  }, [firstTarget, classById])

  // Refetch resolved marks when first target's subject changes.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!firstSubject) { setResolved(null); return }
    let cancelled = false
    setResolving(true)
    getResolvedExamMarksForUI(examId, firstSubject.id, schoolId)
      .then(r => { if (!cancelled) setResolved(r) })
      .finally(() => { if (!cancelled) setResolving(false) })
    return () => { cancelled = true }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [firstSubject, examId, schoolId])

  function addTarget() {
    setTargets(prev => [...prev, { classId: "", subjectId: "" }])
  }
  function removeTarget(i: number) {
    setTargets(prev => prev.filter((_, idx) => idx !== i))
  }
  function patchTarget(i: number, patch: Partial<DraftTarget>) {
    setTargets(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t))
  }

  function pickClass(i: number, classId: string) {
    patchTarget(i, { classId, subjectId: "" })
  }
  function pickSubject(i: number, subjectId: string) {
    patchTarget(i, { subjectId })
  }

  function validate(): string | null {
    if (targets.length === 0) return "Add at least one (class, subject) target"
    if (!firstSubject)        return "Pick a subject in the first target"
    const dur = parseInt(durationMin, 10)
    if (Number.isNaN(dur) || dur < 5 || dur > 600) return "Duration must be 5–600 minutes"
    for (const [i, t] of targets.entries()) {
      if (!t.classId || !t.subjectId) return `Target #${i + 1}: pick a class and subject`
    }
    // De-dup
    const keys = new Set<string>()
    for (const [i, t] of targets.entries()) {
      const k = `${t.classId}:${t.subjectId}`
      if (keys.has(k)) return `Target #${i + 1}: duplicate (class, subject)`
      keys.add(k)
    }
    return null
  }

  function save() {
    const err = validate()
    if (err) { toast.error(err); return }
    startT(async () => {
      try {
        let paperId = editPaper?.id
        const derivedName = firstSubject!.name
        const derivedCode = firstSubject!.code || null
        const payload = {
          subjectName: derivedName,
          code:        derivedCode,
          // Only persist manual override values; otherwise leave null and let the
          // resolver pull from EvaluationComponent.sourceMaxMarks at read time.
          fullMarks:   useOverride && fullMarks.trim() ? Number(fullMarks) : null,
          passMarks:   useOverride && passMarks.trim() ? Number(passMarks) : null,
          durationMin: parseInt(durationMin, 10),
        }
        if (isEdit && paperId) {
          await updateExamPaper(paperId, schoolId, payload)
        } else {
          const { id } = await createExamPaper({
            schoolId, examId, ...payload,
          })
          paperId = id
        }
        if (paperId) {
          await setPaperTargets(paperId, schoolId, targets)
        }
        toast.success(isEdit ? `Paper "${derivedName}" saved` : `Paper "${derivedName}" created`)
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed")
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-lg p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <FileText className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">
              {isEdit ? "Edit Paper" : "Add Paper"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              One paper = one subject taken on one date. Attach <strong>one or more</strong>{" "}
              <em>(class, subject)</em> targets — a single paper can be shared across classes
              that sit the same exam (e.g. combined Math for Class 11 Science and Management).
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          {/* Paper meta — subject/code derived from first target; marks resolved */}
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Subject</div>
              {firstSubject ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{firstSubject.name}</span>
                  {firstSubject.code && (
                    <code className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded">
                      {firstSubject.code}
                    </code>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Pick a class + subject below.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Marks</div>
                <button
                  type="button"
                  onClick={() => setUseOverride(v => !v)}
                  className="text-[10px] font-semibold text-violet-600 hover:text-violet-700 cursor-pointer"
                >
                  {useOverride ? "Use resolved" : "Override…"}
                </button>
              </div>
              {!useOverride ? (
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {resolving ? (
                    <span className="text-slate-400 italic">Resolving…</span>
                  ) : resolved ? (
                    <>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        Full {resolved.fullMarks} · Pass {resolved.passMarks}
                      </span>
                      <Badge variant="outline" className={cn(
                        "text-[9px]",
                        resolved.source === "EVALUATION"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : resolved.source === "PAPER_OVERRIDE"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-500 border-slate-200",
                      )}>
                        <Lock className="w-2.5 h-2.5 mr-0.5" />
                        {resolved.source === "EVALUATION" ? "from Evaluation Configure"
                          : resolved.source === "PAPER_OVERRIDE" ? "from paper override"
                          : "default"}
                      </Badge>
                    </>
                  ) : (
                    <span className="text-slate-400 italic">No subject selected.</span>
                  )}
                  {resolved?.source === "DEFAULT" && (
                    <p className="text-[10px] text-amber-700 mt-1 flex items-start gap-1 w-full">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      No Evaluation Configure linkage. Defaulting to 100. Click &ldquo;Override&rdquo; to set explicitly.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Full</label>
                    <Input value={fullMarks} onChange={e => setFullMarks(e.target.value)}
                      type="number" placeholder="100" min={0} step="any"
                      className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg tabular-nums" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pass</label>
                    <Input value={passMarks} onChange={e => setPassMarks(e.target.value)}
                      type="number" placeholder="35" min={0} step="any"
                      className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg tabular-nums" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Duration (minutes)</label>
              <Input value={durationMin} onChange={e => setDurationMin(e.target.value)}
                type="number" min={5} max={600} step={15}
                className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-xl tabular-nums w-32" />
            </div>
          </div>

          {/* Targets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Class + Subject targets
              </label>
              <Button size="sm" variant="outline" onClick={addTarget}
                className="gap-1.5 cursor-pointer text-xs h-7 bg-white">
                <Plus className="w-3 h-3" /> Add target
              </Button>
            </div>
            {targets.length === 0 ? (
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl px-3 py-2.5 text-[11px] text-amber-800 leading-relaxed">
                No targets yet. Add at least one so the seat plan, attendance, and printable
                routine know which students this paper is for.
              </div>
            ) : (
              <div className="space-y-1.5">
                {targets.map((t, i) => {
                  const cls = classById.get(t.classId)
                  const subjects = cls?.subjects ?? []
                  return (
                    <div key={i}
                      className={cn(
                        "grid grid-cols-[1fr_1fr_28px] gap-1.5 items-center p-1.5 rounded-lg border",
                        "bg-white/60 border-slate-200",
                      )}>
                      <Select value={t.classId} onValueChange={(v) => pickClass(i, v)}>
                        <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                          <SelectValue placeholder={<span className="text-slate-400 flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Class</span>} />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.name}
                              {c.facultyName && <span className="ml-2 text-[10px] text-slate-400">{c.facultyName}</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={t.subjectId} onValueChange={(v) => pickSubject(i, v)} disabled={!t.classId || subjects.length === 0}>
                        <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                          <SelectValue placeholder={
                            !t.classId
                              ? <span className="text-slate-400 italic">Pick class first</span>
                              : subjects.length === 0
                                ? <span className="text-rose-500 italic">No subjects in class</span>
                                : <span className="text-slate-400 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Subject</span>
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map(s => (
                            <SelectItem key={s.id} value={s.id} className="text-xs">
                              {s.name}
                              <code className="ml-2 text-[10px] font-mono text-slate-400">{s.code}</code>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => removeTarget(i)}
                        title="Remove target"
                        className="w-7 h-7 rounded-md hover:bg-rose-100 text-rose-500 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}
            className="gap-1.5 cursor-pointer text-xs h-9 bg-white">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={save}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-9 font-bold">
            <Save className="w-3.5 h-3.5" /> {isEdit ? "Save" : "Create Paper"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
