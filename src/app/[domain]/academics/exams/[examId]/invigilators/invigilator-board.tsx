"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Wand2, Loader2, DoorOpen, UserCog, ChevronLeft, ChevronRight,
  AlertCircle, Sparkles, Check, X, Search, Footprints,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar } from "@/components/ui/avatar-img"
import { cn } from "@/lib/utils"
import { formatBS, toAD, toBS } from "@/lib/nepali-date"
import {
  setRoomInvigilators, setRunningInvigilators, autoAssignInvigilators,
  type InvigilatorScheduleRow, type TeacherOpt,
} from "@/actions/exam-invigilators"

interface Props {
  schoolId:       string
  examId:         string
  schedules:      InvigilatorScheduleRow[]
  teachers:       TeacherOpt[]
  initialDateBS:  string
}

export function InvigilatorBoard({ schoolId, examId, schedules, teachers, initialDateBS }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  const [dateBS, setDateBS] = useState<string>(initialDateBS)

  // Unique exam dates for the date strip
  const allDates = useMemo(() => {
    const set = new Set(schedules.map(s => s.dateBS))
    return [...set].sort()
  }, [schedules])

  const todays = schedules.filter(s => s.dateBS === dateBS)
  const runningForToday = todays[0]?.runningInvigilators ?? []
  const teacherById = useMemo(() => new Map(teachers.map(t => [t.id, t])), [teachers])

  // All rooms across today's schedules — used by the running invigilator room picker.
  const todaysRooms = useMemo(() => {
    const seen = new Map<string, { roomId: string; roomName: string }>()
    for (const s of todays) {
      for (const r of s.rooms) {
        if (!seen.has(r.roomId)) seen.set(r.roomId, { roomId: r.roomId, roomName: r.roomName })
      }
    }
    return [...seen.values()].sort((a, b) => a.roomName.localeCompare(b.roomName))
  }, [todays])

  // Today's globally-assigned teachers: union of every room invigilator + every
  // running invigilator across today's schedules. Used to grey out conflicts in
  // the pickers so the same teacher can't be double-booked across rooms.
  const assignedTodayTeacherIds = useMemo(() => {
    const s = new Set<string>()
    for (const sched of todays) {
      for (const r of sched.rooms) for (const inv of r.invigilators) s.add(inv.teacherId)
      for (const run of sched.runningInvigilators) s.add(run.teacherId)
    }
    return s
  }, [todays])

  function shiftDate(delta: number) {
    if (!dateBS) return
    const ad = toAD(dateBS)
    ad.setDate(ad.getDate() + delta)
    setDateBS(toBS(ad))
  }

  function autoForToday() {
    if (!dateBS) { toast.error("Pick a date first"); return }
    setBusy("auto")
    startT(async () => {
      try {
        const res = await autoAssignInvigilators({
          examId, schoolId, dateBS,
          invigilatorsPerRoom: 1,
          excludeOwnClass: true,
          setRunningFromExaminedToday: true,
        })
        toast.success(`Assigned ${res.assigned} teacher(s) across ${res.rooms} room(s) · ${res.runningCandidates.length} running`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Auto-assign failed")
      } finally {
        setBusy(null)
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* Date strip */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <Button size="icon" variant="outline" onClick={() => shiftDate(-1)} className="h-8 w-8 cursor-pointer bg-white" title="Previous day">
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date</span>
          {dateBS ? (
            <span className="font-mono font-bold text-slate-800 text-sm tabular-nums">{formatBS(dateBS)}</span>
          ) : (
            <span className="text-slate-400 italic text-xs">none</span>
          )}
        </div>
        <Button size="icon" variant="outline" onClick={() => shiftDate(1)} className="h-8 w-8 cursor-pointer bg-white" title="Next day">
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>

        <div className="flex items-center gap-1 ml-3 flex-wrap">
          {allDates.length === 0 ? (
            <span className="text-[10px] text-slate-400 italic">No scheduled papers</span>
          ) : (
            allDates.map(d => (
              <button
                key={d}
                onClick={() => setDateBS(d)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-mono tabular-nums font-bold cursor-pointer transition-colors",
                  d === dateBS
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-100/60 text-slate-500 hover:bg-slate-200",
                )}
              >
                {d}
              </button>
            ))
          )}
        </div>

        <div className="flex-1" />

        <Button size="sm" onClick={autoForToday} disabled={busy === "auto" || todays.length === 0}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8 font-bold">
          {busy === "auto" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          Auto-assign for today
        </Button>
      </div>

      {/* Schedules + rooms for the picked day */}
      {todays.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
          <p className="font-bold text-sm text-slate-700 mb-1">No papers on this date</p>
          <p className="text-xs text-muted-foreground">Pick another date from the strip above.</p>
        </div>
      ) : (
        <>
          {todays.map(s => (
            <ScheduleCard
              key={s.scheduleId}
              schedule={s}
              teachers={teachers}
              teacherById={teacherById}
              schoolId={schoolId}
              assignedTodayTeacherIds={assignedTodayTeacherIds}
            />
          ))}

          {/* Running invigilators panel */}
          <RunningPanel
            scheduleId={todays[0].scheduleId}
            schoolId={schoolId}
            currentAssignments={runningForToday.map(r => ({ teacherId: r.teacherId, roomIds: r.roomIds }))}
            teachers={teachers}
            rooms={todaysRooms}
            assignedTodayTeacherIds={assignedTodayTeacherIds}
          />
        </>
      )}
    </div>
  )
}

// ─── Schedule card ─────────────────────────────────────────────────────

function ScheduleCard({
  schedule, teachers, teacherById, schoolId, assignedTodayTeacherIds,
}: {
  schedule:                InvigilatorScheduleRow
  teachers:                TeacherOpt[]
  teacherById:             Map<string, TeacherOpt>
  schoolId:                string
  assignedTodayTeacherIds: Set<string>
}) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/40">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <UserCog className="w-4 h-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{schedule.paperName}</p>
          <p className="text-[10px] text-slate-500 font-medium">
            <span className="font-mono tabular-nums">{schedule.startTime} · {schedule.durationMin}min</span>
            {" · "}
            {schedule.classes.length === 0
              ? <span className="text-rose-500 italic">no classes attached</span>
              : <span>{schedule.classes.map(c => c.className).join(", ")}</span>}
          </p>
        </div>
      </div>
      {schedule.rooms.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-slate-400 italic">
          No rooms picked for this sitting — open <span className="font-bold">Seats</span> to add rooms first.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {schedule.rooms.map(r => (
            <RoomRow
              key={r.scheduleRoomId}
              scheduleId={schedule.scheduleId}
              roomId={r.roomId}
              roomName={r.roomName}
              currentTeacherIds={r.invigilators.map(i => i.teacherId)}
              teachers={teachers}
              teacherById={teacherById}
              schoolId={schoolId}
              assignedTodayTeacherIds={assignedTodayTeacherIds}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Per-room invigilator picker ────────────────────────────────────────

function RoomRow({
  scheduleId, roomId, roomName, currentTeacherIds, teachers, teacherById, schoolId, assignedTodayTeacherIds,
}: {
  scheduleId:              string
  roomId:                  string
  roomName:                string
  currentTeacherIds:       string[]
  teachers:                TeacherOpt[]
  teacherById:             Map<string, TeacherOpt>
  schoolId:                string
  assignedTodayTeacherIds: Set<string>
}) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [saving, setSaving] = useState(false)

  function toggle(teacherId: string) {
    const next = currentTeacherIds.includes(teacherId)
      ? currentTeacherIds.filter(t => t !== teacherId)
      : [...currentTeacherIds, teacherId]
    setSaving(true)
    startT(async () => {
      try {
        await setRoomInvigilators(scheduleId, roomId, schoolId, next)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSaving(false)
      }
    })
  }

  function clearAll() {
    setSaving(true)
    startT(async () => {
      try {
        await setRoomInvigilators(scheduleId, roomId, schoolId, [])
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed")
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/40 transition-colors">
      <DoorOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <span className="text-xs font-bold text-slate-700 min-w-[120px]">{roomName}</span>

      <div className="flex items-center gap-1.5 flex-1 flex-wrap">
        {currentTeacherIds.length === 0 ? (
          <span className="text-[10px] text-slate-300 italic">no invigilator yet</span>
        ) : (
          currentTeacherIds.map((tid, i) => {
            const t = teacherById.get(tid)
            if (!t) return null
            return (
              <span key={tid}
                className={cn(
                  "inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full border text-[11px] font-semibold",
                  i === 0
                    ? "bg-violet-50 text-violet-800 border-violet-200"
                    : "bg-slate-50 text-slate-700 border-slate-200",
                )}>
                <Avatar name={t.fullName} url={t.avatarUrl} size={16} />
                {t.fullName}
                {i === 0 && <Sparkles className="w-2.5 h-2.5 text-violet-500" />}
                <button onClick={() => toggle(tid)} disabled={saving}
                  className="ml-0.5 w-3.5 h-3.5 rounded-full hover:bg-rose-100 text-rose-500 flex items-center justify-center cursor-pointer">
                  <X className="w-2 h-2" strokeWidth={3} />
                </button>
              </span>
            )
          })
        )}
      </div>

      <TeacherPicker
        teachers={teachers}
        selected={currentTeacherIds}
        onToggle={toggle}
        onClear={clearAll}
        disabled={saving}
        disabledTeacherIds={
          new Set([...assignedTodayTeacherIds].filter(id => !currentTeacherIds.includes(id)))
        }
      />
    </div>
  )
}

// ─── Running invigilators panel ────────────────────────────────────────

function RunningPanel({
  scheduleId, schoolId, currentAssignments, teachers, rooms, assignedTodayTeacherIds,
}: {
  scheduleId:              string
  schoolId:                string
  currentAssignments:      { teacherId: string; roomIds: string[] }[]
  teachers:                TeacherOpt[]
  rooms:                   { roomId: string; roomName: string }[]
  assignedTodayTeacherIds: Set<string>
}) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [saving, setSaving] = useState(false)
  const teacherById = useMemo(() => new Map(teachers.map(t => [t.id, t])), [teachers])

  function save(next: { teacherId: string; roomIds: string[] }[]) {
    setSaving(true)
    startT(async () => {
      try {
        await setRunningInvigilators(scheduleId, schoolId, next)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSaving(false)
      }
    })
  }

  function toggle(teacherId: string) {
    const existing = currentAssignments.find(a => a.teacherId === teacherId)
    const next = existing
      ? currentAssignments.filter(a => a.teacherId !== teacherId)
      : [...currentAssignments, { teacherId, roomIds: [] }]
    save(next)
  }

  function setRoomsFor(teacherId: string, roomIds: string[]) {
    const next = currentAssignments.map(a =>
      a.teacherId === teacherId ? { ...a, roomIds } : a,
    )
    save(next)
  }

  function clearAll() { save([]) }

  // For the running picker, exclude teachers who are room invigilators today.
  // Teachers ALREADY in the running list stay available so the user can toggle them off.
  const currentRunningIds = new Set(currentAssignments.map(a => a.teacherId))
  const disabledForRunning = new Set<string>()
  for (const id of assignedTodayTeacherIds) {
    if (!currentRunningIds.has(id)) disabledForRunning.add(id)
  }

  return (
    <div className="bg-amber-50/40 backdrop-blur-xl rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-amber-200/60">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Footprints className="w-4 h-4 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">Running invigilators</p>
          <p className="text-[10px] text-amber-700 font-medium">
            Floating teachers who provide turns to specific rooms. Pick which rooms each one covers — empty = all rooms today.
          </p>
        </div>
        <TeacherPicker
          teachers={teachers}
          selected={[...currentRunningIds]}
          onToggle={toggle}
          onClear={clearAll}
          disabled={saving}
          color="amber"
          disabledTeacherIds={disabledForRunning}
        />
      </div>
      <div className="px-5 py-3 space-y-2">
        {currentAssignments.length === 0 ? (
          <span className="text-[11px] text-amber-700/70 italic">No running invigilators set for today.</span>
        ) : (
          currentAssignments.map(a => {
            const t = teacherById.get(a.teacherId)
            if (!t) return null
            return (
              <div key={a.teacherId}
                className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                <Avatar name={t.fullName} url={t.avatarUrl} size={20} />
                <span className="text-xs font-bold text-amber-900 truncate min-w-[140px]">{t.fullName}</span>
                <RunningRoomsPicker
                  rooms={rooms}
                  selected={a.roomIds}
                  onChange={(ids) => setRoomsFor(a.teacherId, ids)}
                  disabled={saving}
                />
                <button onClick={() => toggle(a.teacherId)} disabled={saving}
                  className="ml-1 w-5 h-5 rounded-full hover:bg-rose-100 text-rose-500 flex items-center justify-center cursor-pointer"
                  aria-label="Remove">
                  <X className="w-3 h-3" strokeWidth={3} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function RunningRoomsPicker({
  rooms, selected, onChange, disabled,
}: {
  rooms:    { roomId: string; roomName: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled: boolean
}) {
  function toggle(roomId: string) {
    onChange(selected.includes(roomId)
      ? selected.filter(r => r !== roomId)
      : [...selected, roomId])
  }
  const label = selected.length === 0
    ? "All rooms"
    : selected.length === 1
      ? rooms.find(r => r.roomId === selected[0])?.roomName ?? "1 room"
      : `${selected.length} rooms`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || rooms.length === 0}
          className="gap-1.5 cursor-pointer text-[11px] h-7 bg-white border-amber-200 hover:border-amber-300 hover:bg-amber-50/80 text-amber-800 font-semibold flex-1 justify-start"
        >
          <DoorOpen className="w-3 h-3" /> {rooms.length === 0 ? "no rooms today" : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl w-64 max-h-[60vh] overflow-y-auto"
      >
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Rooms covered ({selected.length || "all"})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {rooms.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-slate-400 italic text-center">No rooms today</div>
        ) : (
          rooms.map(r => (
            <DropdownMenuCheckboxItem
              key={r.roomId}
              checked={selected.includes(r.roomId)}
              onCheckedChange={() => toggle(r.roomId)}
              onSelect={(e) => e.preventDefault()}
              className="cursor-pointer text-xs gap-2"
            >
              <DoorOpen className="w-3 h-3 text-amber-600" />
              <span className="flex-1 truncate">{r.roomName}</span>
            </DropdownMenuCheckboxItem>
          ))
        )}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              onClick={() => onChange([])}
              className="w-full text-left text-[11px] font-bold text-slate-500 hover:text-amber-700 px-3 py-1.5 cursor-pointer"
            >
              Clear (cover all)
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Teacher picker dropdown ────────────────────────────────────────────

function TeacherPicker({
  teachers, selected, onToggle, onClear, disabled, color = "primary", disabledTeacherIds,
}: {
  teachers:            TeacherOpt[]
  selected:            string[]
  onToggle:            (id: string) => void
  onClear:             () => void
  disabled:            boolean
  color?:              "primary" | "amber"
  /** Teacher ids that should be greyed out (assigned elsewhere today). */
  disabledTeacherIds?: Set<string>
}) {
  const [q, setQ] = useState("")
  const filtered = useMemo(() => {
    if (!q.trim()) return teachers
    const k = q.toLowerCase()
    return teachers.filter(t => t.fullName.toLowerCase().includes(k))
  }, [q, teachers])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          className={cn(
            "gap-1.5 cursor-pointer text-xs h-8 bg-white border-slate-200",
            color === "amber" ? "hover:border-amber-300 hover:bg-amber-50" : "hover:border-primary/30 hover:bg-primary/5",
          )}
        >
          {disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCog className="w-3.5 h-3.5" />}
          Pick
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl w-72 max-h-[60vh] overflow-y-auto"
      >
        <div className="px-2 py-1.5 flex items-center justify-between gap-2">
          <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 p-0">
            Teachers ({selected.length} picked)
          </DropdownMenuLabel>
          {selected.length > 0 && (
            <button onClick={onClear} className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer">
              Clear
            </button>
          )}
        </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search teachers…"
              className="h-7 pl-6 text-xs bg-white border-slate-200"
            />
          </div>
        </div>
        <DropdownMenuSeparator />
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-slate-400 italic text-center">No matches</div>
        ) : (
          filtered.map(t => {
            const picked      = selected.includes(t.id)
            const isElsewhere = !picked && (disabledTeacherIds?.has(t.id) ?? false)
            return (
              <DropdownMenuCheckboxItem
                key={t.id}
                checked={picked}
                onCheckedChange={() => { if (!isElsewhere) onToggle(t.id) }}
                onSelect={(e) => e.preventDefault()}
                disabled={isElsewhere}
                className={cn(
                  "cursor-pointer text-xs gap-2",
                  isElsewhere && "opacity-40 cursor-not-allowed",
                )}
              >
                <Avatar name={t.fullName} url={t.avatarUrl} size={20} />
                <span className="flex-1 truncate">{t.fullName}</span>
                {isElsewhere && <span className="text-[9px] text-rose-500 font-bold uppercase">Busy</span>}
                {picked && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenuCheckboxItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
