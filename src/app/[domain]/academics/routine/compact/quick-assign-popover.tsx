"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, X, AlertCircle, BookOpen, Check, Trash2, Layers, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { DAY_LABELS_SHORT } from "@/lib/working-days"
import {
  getQuickAssignContext, getRoutineSlotAssignments,
  quickAssignRoutineSlot, clearRoutineSlotDay,
  clearRoutineSlotSubject, addRoutineSlotSubject,
  getTeacherBusyAtSlot,
  type QuickAssignContext, type QuickAssignSubject,
} from "@/actions/routine"

export interface QuickAssignTarget {
  classId:       string
  className:     string
  classShort:    string
  periodSlotId:  string
  periodLabel:   string
  initialDay?:   number | null
}

interface Props {
  target:  QuickAssignTarget
  onClose: () => void
}

type CellKey = string  // `${subjectId}:${day}`

export function QuickAssignPopover({ target, onClose }: Props) {
  const router = useRouter()
  const [, start] = useTransition()
  const [ctx, setCtx] = useState<QuickAssignContext | null>(null)
  const [loading, setLoading] = useState(true)
  /** day → Set<subjectId>. Optimistically updated on every click. */
  const [assignments, setAssignments] = useState<Map<number, Set<string>>>(new Map())
  const [pendingCells, setPendingCells] = useState<Set<CellKey>>(new Set())
  /** When true, clicking an empty cell ADDS without clearing other subjects on that day. */
  const [combinedMode, setCombinedMode] = useState(false)
  /** Conflicts map: `${teacherUserId}:${day}` -> human label of the other class/subject. */
  const [busy, setBusy] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [c, current] = await Promise.all([
          getQuickAssignContext(target.classId),
          getRoutineSlotAssignments(target.classId, target.periodSlotId),
        ])
        if (cancelled) return
        setCtx(c)
        const m = new Map<number, Set<string>>()
        for (const a of current) {
          if (!a.subjectId) continue
          const s = m.get(a.day) ?? new Set<string>()
          s.add(a.subjectId)
          m.set(a.day, s)
        }
        setAssignments(m)
        if (Array.from(m.values()).some(s => s.size >= 2)) setCombinedMode(true)

        // Now fetch teacher-busy map for all primary teachers of this class's
        // subjects across the working days — used to disable conflicting cells.
        if (c) {
          const teacherIds = Array.from(new Set(
            c.subjects.map(s => s.teacherUserId).filter((x): x is string => !!x),
          ))
          if (teacherIds.length > 0 && c.workingDays.length > 0) {
            const b = await getTeacherBusyAtSlot({
              periodSlotId:   target.periodSlotId,
              excludeClassId: target.classId,
              teacherUserIds: teacherIds,
              days:           c.workingDays,
            })
            if (!cancelled) setBusy(b)
          }
        }
      } catch {
        if (!cancelled) setCtx(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [target.classId, target.periodSlotId])

  /** Refresh the busy map (called after assignment changes so other classes
   *  on-screen update too). Optimistic UI keeps perf snappy. */
  async function refreshBusy() {
    if (!ctx) return
    const teacherIds = Array.from(new Set(
      ctx.subjects.map(s => s.teacherUserId).filter((x): x is string => !!x),
    ))
    if (teacherIds.length === 0) return
    try {
      const b = await getTeacherBusyAtSlot({
        periodSlotId:   target.periodSlotId,
        excludeClassId: target.classId,
        teacherUserIds: teacherIds,
        days:           ctx.workingDays,
      })
      setBusy(b)
    } catch { /* swallow — busy display is advisory only */ }
  }

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onEsc)
    return () => document.removeEventListener("keydown", onEsc)
  }, [onClose])

  function setDaySet(day: number, mut: (s: Set<string>) => Set<string>) {
    setAssignments(prev => {
      const next = new Map(prev)
      const cur = new Set(prev.get(day) ?? [])
      const updated = mut(cur)
      if (updated.size === 0) next.delete(day)
      else next.set(day, updated)
      return next
    })
  }

  function isBusy(subject: QuickAssignSubject, day: number): string | null {
    if (!subject.teacherUserId) return null
    return busy[`${subject.teacherUserId}:${day}`] ?? null
  }

  function cellClick(subject: QuickAssignSubject, day: number, force = false) {
    const key: CellKey = `${subject.subjectId}:${day}`
    if (pendingCells.has(key)) return
    const daySet = assignments.get(day) ?? new Set<string>()
    const subjectHere = daySet.has(subject.subjectId)
    const otherSubjectsHere = daySet.size > 0 && !subjectHere

    // Block plain click on a busy cell (unless we're toggling THIS subject off
    // or the user explicitly forced via double-click).
    if (!subjectHere && !force) {
      const conflict = isBusy(subject, day)
      if (conflict) {
        toast.error(`${subject.teacherName ?? "Teacher"} is busy with ${conflict}. Double-click to override.`)
        return
      }
    }

    setPendingCells(prev => { const s = new Set(prev); s.add(key); return s })
    const snapshot = new Map(assignments)

    // Optimistic update
    if (subjectHere) {
      // Toggle off — remove THIS subject only
      setDaySet(day, s => { s.delete(subject.subjectId); return s })
    } else if (otherSubjectsHere && !combinedMode) {
      // Replace: clear all then add this
      setDaySet(day, () => new Set([subject.subjectId]))
    } else {
      // Add: simple insert (covers empty cell + combined-mode add)
      setDaySet(day, s => { s.add(subject.subjectId); return s })
    }

    start(async () => {
      try {
        if (subjectHere) {
          await clearRoutineSlotSubject({
            classId:      target.classId,
            periodSlotId: target.periodSlotId,
            dayOfWeek:    day,
            subjectId:    subject.subjectId,
          })
        } else if (otherSubjectsHere && !combinedMode) {
          // Clear everything then assign this one
          await clearRoutineSlotDay({
            classId:      target.classId,
            periodSlotId: target.periodSlotId,
            dayOfWeek:    day,
          })
          await quickAssignRoutineSlot({
            classId:       target.classId,
            periodSlotId:  target.periodSlotId,
            subjectId:     subject.subjectId,
            teacherUserId: subject.teacherUserId,
            days:          [day],
          })
        } else {
          // Combined add or first assignment — use addRoutineSlotSubject so we
          // don't accidentally replace another entry on the same day.
          await addRoutineSlotSubject({
            classId:       target.classId,
            periodSlotId:  target.periodSlotId,
            dayOfWeek:     day,
            subjectId:     subject.subjectId,
            teacherUserId: subject.teacherUserId,
          })
        }
        if (force) {
          toast.warning(`Assigned despite conflict — ${subject.teacherName ?? "teacher"} double-booked.`)
        }
        refreshBusy()
        router.refresh()
      } catch (e) {
        setAssignments(snapshot)
        toast.error((e as Error).message || "Failed")
      } finally {
        setPendingCells(prev => { const s = new Set(prev); s.delete(key); return s })
      }
    })
  }

  function assignAllDays(subject: QuickAssignSubject) {
    if (!ctx) return
    const targetDays = ctx.workingDays.filter(d => !(assignments.get(d) ?? new Set()).has(subject.subjectId))
    if (targetDays.length === 0) return
    const snapshot = new Map(assignments)
    // Optimistic: in combined mode add alongside; else replace day's set with just this
    setAssignments(prev => {
      const next = new Map(prev)
      for (const d of targetDays) {
        if (combinedMode) {
          const s = new Set(next.get(d) ?? [])
          s.add(subject.subjectId)
          next.set(d, s)
        } else {
          next.set(d, new Set([subject.subjectId]))
        }
      }
      return next
    })
    const keys = targetDays.map(d => `${subject.subjectId}:${d}` as CellKey)
    setPendingCells(prev => { const s = new Set(prev); keys.forEach(k => s.add(k)); return s })
    start(async () => {
      try {
        if (!combinedMode) {
          // Clear each target day first
          await Promise.all(targetDays.map(d => clearRoutineSlotDay({
            classId:      target.classId,
            periodSlotId: target.periodSlotId,
            dayOfWeek:    d,
          })))
        }
        // Add the subject to each target day
        await Promise.all(targetDays.map(d => addRoutineSlotSubject({
          classId:       target.classId,
          periodSlotId:  target.periodSlotId,
          dayOfWeek:     d,
          subjectId:     subject.subjectId,
          teacherUserId: subject.teacherUserId,
        })))
        toast.success(`${subject.subjectShortName || subject.subjectName} → ${targetDays.length} day${targetDays.length === 1 ? "" : "s"}`)
        router.refresh()
      } catch (e) {
        setAssignments(snapshot)
        toast.error((e as Error).message || "Failed")
      } finally {
        setPendingCells(prev => { const s = new Set(prev); keys.forEach(k => s.delete(k)); return s })
      }
    })
  }

  function clearAll() {
    if (!ctx) return
    const days = Array.from(assignments.keys())
    if (days.length === 0) return
    const snapshot = new Map(assignments)
    setAssignments(new Map())
    start(async () => {
      try {
        await Promise.all(days.map(d => clearRoutineSlotDay({
          classId:      target.classId,
          periodSlotId: target.periodSlotId,
          dayOfWeek:    d,
        })))
        toast.success(`Cleared ${days.length} day${days.length === 1 ? "" : "s"}`)
        router.refresh()
      } catch (e) {
        setAssignments(snapshot)
        toast.error((e as Error).message || "Failed to clear")
      }
    })
  }

  const subjects = ctx?.subjects ?? []
  const subjectById = new Map(subjects.map(s => [s.subjectId, s]))
  // Total assignments (sum of set sizes)
  const totalAssignments = Array.from(assignments.values()).reduce((sum, s) => sum + s.size, 0)
  const daysWithMulti = Array.from(assignments.values()).filter(s => s.size >= 2).length

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-label="Quick assign — subject × day matrix"
        className="bg-white rounded-2xl shadow-2xl border border-white/40 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight">Quick assign</h2>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              <span className="font-bold text-slate-700">{target.className}</span>
              <span className="text-slate-300 mx-1">·</span>
              <span>{target.periodLabel}</span>
              <span className="text-slate-300 mx-1">·</span>
              <span className="font-bold text-primary">{totalAssignments} assignment{totalAssignments === 1 ? "" : "s"}</span>
              {daysWithMulti > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  <Layers className="w-2.5 h-2.5" /> {daysWithMulti} combined
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {totalAssignments > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md px-2 py-1 inline-flex items-center gap-1 cursor-pointer"
                title="Clear all assignments at this slot"
              >
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Combined-mode toggle bar */}
        <div className={cn(
          "px-5 py-2 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap",
          combinedMode ? "bg-amber-50/60" : "bg-slate-50/40",
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setCombinedMode(v => !v)}
              role="switch"
              aria-checked={combinedMode}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer flex-shrink-0",
                combinedMode ? "bg-amber-500" : "bg-slate-300",
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                combinedMode ? "translate-x-4" : "translate-x-0.5",
              )} />
            </button>
            <div className="min-w-0">
              <p className={cn("text-xs font-bold inline-flex items-center gap-1", combinedMode ? "text-amber-800" : "text-slate-600")}>
                <Layers className="w-3 h-3" /> Combined-subjects mode
                {combinedMode && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    <AlertTriangle className="w-2.5 h-2.5" /> Unusual
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                {combinedMode
                  ? "Clicks ADD subjects to a day without removing others. Use only for split-group, team-teaching, or combined sessions."
                  : "Default: one subject per day. Click replaces the previous subject."}
              </p>
            </div>
          </div>
        </div>

        {/* Body — matrix */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !ctx ? (
            <div className="text-center py-8 px-5">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-400 mb-2" />
              <p className="text-sm text-slate-700">Couldn&apos;t load class subjects.</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8 px-5">
              <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700 mb-1">No subjects on this class</p>
              <p className="text-xs text-slate-500">
                Add subjects to <strong>{ctx.className}</strong> in <span className="font-mono">/academics/subjects</span> first.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <tr className="border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-black text-slate-500">Subject</th>
                  {ctx.workingDays.map(d => {
                    const set = assignments.get(d) ?? new Set()
                    const isCombined = set.size >= 2
                    return (
                      <th key={d} className="text-center px-1 py-2 w-12">
                        <div className="text-[10px] uppercase tracking-widest font-black text-slate-500">
                          {DAY_LABELS_SHORT[d]}
                        </div>
                        {isCombined && (
                          <div className="text-[8px] font-black text-amber-700 mt-0.5 inline-flex items-center gap-0.5">
                            <Layers className="w-2 h-2" /> {set.size}
                          </div>
                        )}
                      </th>
                    )
                  })}
                  <th className="text-center px-2 py-2 text-[10px] uppercase tracking-widest font-black text-slate-400 w-16">All</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map(s => (
                  <tr key={s.subjectId} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-3 py-2 align-middle">
                      <p className="text-sm font-bold text-slate-800 leading-tight">
                        {s.subjectShortName || s.subjectName}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">
                        {s.teacherName ?? <span className="text-amber-600 font-bold">No primary teacher</span>}
                      </p>
                    </td>
                    {ctx.workingDays.map(d => {
                      const key: CellKey = `${s.subjectId}:${d}`
                      const daySet = assignments.get(d) ?? new Set()
                      const assignedHere   = daySet.has(s.subjectId)
                      const otherAssigned  = daySet.size > 0 && !assignedHere
                      const isPending      = pendingCells.has(key)
                      const busyLabel      = !assignedHere ? isBusy(s, d) : null
                      return (
                        <td key={d} className="text-center px-1 py-1 align-middle">
                          <button
                            type="button"
                            onClick={() => cellClick(s, d)}
                            onDoubleClick={() => {
                              if (busyLabel) cellClick(s, d, true)
                            }}
                            disabled={isPending}
                            aria-busy={!!busyLabel || undefined}
                            title={
                              assignedHere
                                ? "Click to clear this subject from this day"
                                : busyLabel
                                  ? `Conflict: ${s.teacherName ?? "teacher"} is busy with ${busyLabel}. Double-click to assign anyway.`
                                  : otherAssigned
                                    ? combinedMode
                                      ? `Add alongside ${Array.from(daySet).map(id => subjectById.get(id)?.subjectShortName ?? "?").join(", ")}`
                                      : `Replace ${Array.from(daySet).map(id => subjectById.get(id)?.subjectShortName ?? "?").join(", ")}`
                                    : "Click to assign"
                            }
                            className={cn(
                              "w-9 h-9 rounded-lg border-2 transition-colors cursor-pointer inline-flex items-center justify-center relative",
                              isPending && "opacity-50 cursor-not-allowed",
                              assignedHere
                                ? "bg-primary text-primary-foreground border-primary"
                                : busyLabel
                                  ? "bg-rose-50 border-rose-200 text-rose-400 hover:border-rose-400 hover:text-rose-600 cursor-help"
                                  : otherAssigned
                                    ? combinedMode
                                      ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                      : "bg-slate-100 border-slate-300 text-slate-400 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                                    : "bg-white border-slate-200 text-slate-300 hover:border-primary/60 hover:bg-primary/5 hover:text-primary",
                            )}
                          >
                            {isPending
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : assignedHere
                                ? <Check className="w-4 h-4" />
                                : busyLabel
                                  ? <AlertTriangle className="w-3.5 h-3.5" />
                                  : otherAssigned
                                    ? combinedMode
                                      ? <span className="text-[14px] font-black leading-none">+</span>
                                      : <span className="text-[9px] font-black">·</span>
                                    : <span className="text-[10px]">+</span>}
                          </button>
                        </td>
                      )
                    })}
                    <td className="text-center px-2 py-1 align-middle">
                      <button
                        type="button"
                        onClick={() => assignAllDays(s)}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer px-2 py-1 rounded hover:bg-primary/5"
                        title={`${combinedMode ? "Add" : "Assign"} ${s.subjectName} to every working day`}
                      >All</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/40 text-[10px] text-slate-500 text-center">
          {combinedMode ? (
            <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
              <AlertTriangle className="w-3 h-3 text-amber-700" />
              <span className="text-amber-800 font-bold">Combined mode active</span>
              <span className="text-slate-400">·</span>
              <span>clicks add without removing other subjects · click ✓ to remove just that subject</span>
              <span className="text-slate-300">·</span>
              <kbd className="font-mono text-[9px] bg-white border border-slate-200 rounded px-1 py-0.5">Esc</kbd> to close
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-primary bg-primary inline-flex items-center justify-center"><Check className="w-2 h-2 text-primary-foreground" /></span>
                assigned
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-slate-300 bg-slate-100" />
                other subject
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-rose-200 bg-rose-50 inline-flex items-center justify-center"><AlertTriangle className="w-2 h-2 text-rose-500" /></span>
                teacher busy
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-slate-200 bg-white" />
                empty
              </span>
              <span className="text-slate-300">·</span>
              <span>Tap to toggle, <strong>double-click</strong> to force a busy cell</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
