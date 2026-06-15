"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarClock, Plus, Pencil, Trash2, Settings2, GraduationCap, Send,
  ArrowRight, Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { deleteSchedule } from "@/actions/routine"
import { setWorkingDays } from "@/actions/academics"
import { ScheduleBuilder } from "./schedule-builder"
import { ApplyScheduleDialog } from "./apply-schedule-dialog"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type SlotShape = { id: string; label: string; startTime: string; endTime: string; isBreak: boolean }
type ClassShape = { id: string; name: string; facultyName: string | null; periodScheduleId: string | null }
type ScheduleShape = {
  id: string
  name: string
  description: string | null
  slots: SlotShape[]
  classes: { id: string; name: string }[]
  _count: { slots: number; classes: number }
}

interface Props {
  schoolId:    string
  workingDays: number[]
  schedules:   ScheduleShape[]
  classes:     ClassShape[]
}

export function SchedulesClient({ schoolId, workingDays, schedules, classes }: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editing,  setEditing]  = useState<ScheduleShape | null>(null)
  const [applying, setApplying] = useState<ScheduleShape | null>(null)
  const [optimisticDays, setOptimisticDays] = useState(workingDays)

  function toggleDay(d: number) {
    const next = optimisticDays.includes(d)
      ? optimisticDays.filter(x => x !== d)
      : [...optimisticDays, d].sort((a, b) => a - b)
    setOptimisticDays(next)
    startT(async () => {
      try {
        await setWorkingDays(schoolId, next)
        toast.success("Working days saved")
      } catch {
        setOptimisticDays(workingDays)
        toast.error("Failed to save working days")
      }
    })
  }

  function handleDelete(s: ScheduleShape) {
    if (!confirm(`Delete schedule "${s.name}"?`)) return
    startT(async () => {
      try {
        const res = await deleteSchedule(s.id)
        if (!res.ok) { toast.error(res.error); return }
        toast.success("Schedule deleted")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete")
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Working days */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-primary" /> Working Days
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Click days to enable/disable. Disabled days are hidden in routine grids.</p>
          </div>
          <div className="flex gap-1">
            {DAY_LABELS.map((label, idx) => {
              const enabled = optimisticDays.includes(idx)
              return (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  disabled={pending}
                  className={cn(
                    "px-3 h-8 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors",
                    enabled
                      ? "bg-primary text-white border-primary shadow-sm shadow-primary/20 hover:bg-primary/90"
                      : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Schedule list header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge variant="secondary" className="text-[10px] font-bold gap-1">
          <Layers className="w-3 h-3" /> {schedules.length} schedule{schedules.length === 1 ? "" : "s"}
        </Badge>
        <div className="flex gap-2">
          <Link href="/academics/routine/groups">
            <Button size="sm" variant="outline"
              className="gap-1.5 cursor-pointer text-xs h-8 bg-white">
              <GraduationCap className="w-3.5 h-3.5" /> Student Groups
            </Button>
          </Link>
          <Button size="sm" onClick={() => setCreating(true)}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Plus className="w-3.5 h-3.5" /> New Schedule
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {schedules.length === 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No schedules yet</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
            Create your first time-slot template (e.g. <em>Standard 8-period</em>). You can apply it to multiple classes.
          </p>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New Schedule
          </Button>
        </div>
      )}

      {/* Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {schedules.map(s => {
          const totalSlots  = s._count.slots
          const breakCount  = s.slots.filter(x => x.isBreak).length
          const periodCount = totalSlots - breakCount
          return (
            <div key={s.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CalendarClock className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{s.name}</p>
                  {s.description && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{s.description}</p>}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-bold">{periodCount} periods</Badge>
                    {breakCount > 0 && <Badge className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">{breakCount} breaks</Badge>}
                    {/* `s.classes` is already filtered server-side by the global filter; reflect that here. */}
                    <Badge variant="secondary" className="text-[10px] font-bold gap-0.5"
                      title={s._count.classes !== s.classes.length
                        ? `${s.classes.length} in scope · ${s._count.classes} total`
                        : undefined}>
                      <GraduationCap className="w-2.5 h-2.5" />
                      {s.classes.length}
                      {s._count.classes !== s.classes.length && (
                        <span className="text-slate-400 font-normal ml-0.5">/ {s._count.classes}</span>
                      )}{" "}classes
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Slot timeline */}
              {s.slots.length > 0 && (
                <div className="px-4 pb-3 flex gap-1 overflow-x-auto">
                  {s.slots.map(slot => (
                    <div key={slot.id}
                      title={`${slot.label}: ${slot.startTime}–${slot.endTime}`}
                      className={cn(
                        "px-1.5 py-1 rounded text-[9px] font-bold border whitespace-nowrap",
                        slot.isBreak
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      )}>
                      {slot.startTime}
                    </div>
                  ))}
                </div>
              )}

              {/* Adopting classes */}
              {s.classes.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-1">
                  {s.classes.map(c => (
                    <Link key={c.id} href={`/academics/routine/${c.id}`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                      <GraduationCap className="w-2.5 h-2.5" /> {c.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setApplying(s)}
                  className="gap-1 cursor-pointer text-[11px] h-7 px-2 text-primary hover:bg-primary/10">
                  <Send className="w-3 h-3" /> Apply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)}
                  className="gap-1 cursor-pointer text-[11px] h-7 px-2">
                  <Settings2 className="w-3 h-3" /> Edit slots
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(s)}
                  className="h-7 w-7 cursor-pointer ml-auto">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(s)} disabled={pending}
                  className="h-7 w-7 cursor-pointer text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Classes list with their schedule */}
      {classes.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold">Classes &amp; their schedules</p>
            <p className="text-[11px] text-muted-foreground">Click a class to edit its routine grid.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {classes.map(c => {
              const sched = schedules.find(s => s.id === c.periodScheduleId)
              return (
                <Link key={c.id} href={`/academics/routine/${c.id}`}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-primary/5 transition-colors group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{c.name}</p>
                      {c.facultyName && <p className="text-[10px] text-slate-400">{c.facultyName}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sched ? (
                      <Badge variant="outline" className="text-[10px] font-bold">{sched.name}</Badge>
                    ) : (
                      <Badge className="text-[10px] font-bold bg-rose-50 text-rose-700 border-rose-200">No schedule</Badge>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Builder */}
      {(creating || editing) && (
        <ScheduleBuilder
          key={editing?.id ?? "new"}
          schoolId={schoolId}
          editing={editing}
          onClose={() => { setCreating(false); setEditing(null); router.refresh() }}
        />
      )}

      {/* Apply dialog */}
      {applying && (
        <ApplyScheduleDialog
          key={applying.id}
          schedule={applying}
          classes={classes}
          onClose={() => { setApplying(null); router.refresh() }}
        />
      )}
    </div>
  )
}
