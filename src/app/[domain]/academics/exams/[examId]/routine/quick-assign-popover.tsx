"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  X, BookOpen, Check, Clock, Calendar as CalendarIcon, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { toAD, formatBS } from "@/lib/nepali-date"
import { placePaperOnCell, type PaperRow } from "@/actions/exams"
import type { PaperClassOpt } from "./paper-drawer"

export interface ExamQuickAssignTarget {
  classId:   string
  className: string
  dateBS:    string
}

interface Props {
  schoolId:       string
  examId:         string
  target:         ExamQuickAssignTarget
  classes:        PaperClassOpt[]
  /** Papers already placed on this cell (class × date). Subjects with a paper here
   *  are shown as "Scheduled" so users don't double-add by accident. */
  placedPapers:   PaperRow[]
  /** Defaults inherited from the toolbar — user can override per-assignment. */
  defaultStart:   string
  defaultDuration:number
  onClose:        () => void
}

export function ExamQuickAssignPopover({
  schoolId, examId, target, classes, placedPapers, defaultStart, defaultDuration, onClose,
}: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [startTime, setStartTime] = useState(defaultStart)
  const [duration,  setDuration]  = useState(defaultDuration)
  const [busySubjectId, setBusySubjectId] = useState<string | null>(null)

  const cls = useMemo(() => classes.find(c => c.id === target.classId) ?? null, [classes, target.classId])

  const placedSubjectIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of placedPapers) {
      for (const t of p.targets) {
        if (t.classId === target.classId) s.add(t.subjectId)
      }
    }
    return s
  }, [placedPapers, target.classId])

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onEsc)
    return () => document.removeEventListener("keydown", onEsc)
  }, [onClose])

  function assign(subject: { id: string; name: string; code: string }) {
    if (placedSubjectIds.has(subject.id)) {
      toast.info(`${subject.name} is already scheduled here.`)
      return
    }
    setBusySubjectId(subject.id)
    startT(async () => {
      try {
        await placePaperOnCell({
          schoolId,
          examId,
          classId:            target.classId,
          subjectId:          subject.id,
          subjectName:        subject.name,
          subjectCode:        subject.code,
          dateBS:             target.dateBS,
          dateAD:             toAD(target.dateBS),
          startTime,
          defaultDurationMin: duration,
        })
        toast.success(`${subject.name} → ${formatBS(target.dateBS)}`)
        router.refresh()
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to schedule")
      } finally {
        setBusySubjectId(null)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-label="Quick assign — subject to day"
        className="bg-white rounded-2xl shadow-2xl border border-white/40 w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-slate-100 gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight inline-flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-primary" /> Add paper
            </h2>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              <span className="font-bold text-slate-700">{target.className}</span>
              <span className="text-slate-300 mx-1">·</span>
              <span className="font-mono tabular-nums">{formatBS(target.dateBS)}</span>
              <span className="text-slate-300 mx-1">·</span>
              <span className="font-bold text-primary">{placedSubjectIds.size} scheduled</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Time + duration */}
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/40 flex items-center gap-2 flex-wrap">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Start</span>
          <Input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="h-8 w-[150px] px-2 text-xs tabular-nums bg-white border-slate-200"
          />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Duration</span>
          <Input
            type="number"
            min={5}
            max={600}
            step={15}
            value={duration}
            onChange={e => setDuration(parseInt(e.target.value, 10) || 90)}
            className="h-8 w-[80px] px-2 text-xs font-mono tabular-nums bg-white border-slate-200"
          />
          <span className="text-[10px] text-slate-400">min</span>
        </div>

        {/* Subjects list */}
        <div className="flex-1 overflow-auto">
          {!cls ? (
            <div className="text-center py-8 px-5">
              <p className="text-sm text-slate-700">Couldn&apos;t load class subjects.</p>
            </div>
          ) : cls.subjects.length === 0 ? (
            <div className="text-center py-8 px-5">
              <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700 mb-1">No subjects on this class</p>
              <p className="text-xs text-slate-500">
                Add subjects to <strong>{cls.name}</strong> first.
              </p>
            </div>
          ) : (
            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {cls.subjects.map(s => {
                const already = placedSubjectIds.has(s.id)
                const isBusy  = busySubjectId === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => assign(s)}
                    disabled={already || pending}
                    title={already ? `${s.name} is already scheduled on this day` : `Schedule ${s.name} on ${formatBS(target.dateBS)}`}
                    className={cn(
                      "group text-left rounded-lg border p-2 transition-all flex items-start gap-2",
                      already
                        ? "bg-emerald-50 border-emerald-200 cursor-not-allowed"
                        : "bg-white border-slate-200 hover:border-primary/40 hover:bg-primary/5 cursor-pointer active:scale-[0.99]",
                      isBusy && "opacity-60",
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
                      already ? "bg-emerald-100" : "bg-violet-100 group-hover:bg-violet-200",
                    )}>
                      {isBusy
                        ? <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                        : already
                          ? <Check className="w-3.5 h-3.5 text-emerald-700" strokeWidth={3} />
                          : <BookOpen className="w-3.5 h-3.5 text-violet-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        "text-[12px] font-bold truncate leading-tight",
                        already ? "text-emerald-800" : "text-slate-800",
                      )}>
                        {s.name}
                      </div>
                      <code className="text-[9px] font-mono text-slate-400 tabular-nums">{s.code}</code>
                      {s.teacherName && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {s.teacherName}
                        </div>
                      )}
                      {already && (
                        <div className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                          Scheduled
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/40 text-[10px] text-slate-500 text-center">
          <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
            Click a subject to schedule it on this day.
            <span className="text-slate-300">·</span>
            <kbd className="font-mono text-[9px] bg-white border border-slate-200 rounded px-1 py-0.5">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}
