"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  BookOpen, X, Coffee, Plus, Copy, UsersRound, Star, GripVertical, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  setRoutineEntry, clearRoutineEntry, moveRoutineEntry, copyRoutineFromClass, getTeacherSchedule,
} from "@/actions/routine"
import { TeacherPickerDialog } from "./teacher-picker-dialog"
import { ConflictConfirmModal } from "./conflict-confirm-modal"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type SlotShape = { id: string; orderIndex: number; label: string; startTime: string; endTime: string; isBreak: boolean }
type SubjectTeacherOpt = { id: string; fullName: string; isPrimary: boolean }
type SubjectShape = { id: string; name: string; code: string; teachers: SubjectTeacherOpt[] }
type GroupShape = { id: string; name: string; memberCount: number; subjectId: string | null }
type EntryShape = {
  id:             string
  subjectId:      string | null
  teacherUserId:  string | null
  studentGroupId: string | null
  subject:        { id: string; name: string; code: string } | null
  teacher:        { id: string; fullName: string } | null
  studentGroup:   { id: string; name: string } | null
}
type ConflictItem = {
  id:           string
  class:        { id: string; name: string }
  subject:      { id: string; name: string } | null
  studentGroup: { id: string; name: string } | null
}

interface Props {
  classId:       string
  schoolId:      string
  workingDays:   number[]
  slots:         SlotShape[]
  entries:       Record<string, EntryShape[]>
  subjects:      SubjectShape[]
  groups:        GroupShape[]
  sourceClasses: { id: string; name: string }[]
}

export function RoutineGrid({
  classId, schoolId, workingDays, slots, entries, subjects, groups, sourceClasses,
}: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [picker, setPicker] = useState<null | {
    slotId:        string
    dayOfWeek:     number
    subjectId:     string
    studentGroupId?: string | null
  }>(null)
  const [conflicts, setConflicts] = useState<null | {
    args:       Parameters<typeof setRoutineEntry>[0]
    conflicts:  ConflictItem[]
  }>(null)
  const [copyFromId, setCopyFromId] = useState("")
  const [activeDrag, setActiveDrag] = useState<null | {
    kind: "subject"; subjectId: string
  } | {
    kind: "entry"; entry: EntryShape
  }>(null)
  // Heatmap: when a subject is "selected" in the palette, fetch its primary
  // teacher's busy schedule across all OTHER classes and visualise availability.
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  type BusySlot = {
    classId:        string
    className:      string
    subjectName:    string | null
    studentGroupId: string | null
    studentGroupName: string | null
  }
  const [busyByCell, setBusyByCell] = useState<Record<string, BusySlot[]>>({})
  const [busyLoading, setBusyLoading] = useState(false)

  useEffect(() => {
    if (!selectedSubjectId) return
    const subj = subjects.find(s => s.id === selectedSubjectId)
    const primary = subj?.teachers.find(t => t.isPrimary) ?? subj?.teachers[0]
    if (!primary) return
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) setBusyLoading(true) })
    getTeacherSchedule({ teacherUserId: primary.id, excludeClassId: classId })
      .then(rows => {
        if (cancelled) return
        const map: Record<string, BusySlot[]> = {}
        for (const r of rows) {
          const key = `${r.periodSlotId}:${r.dayOfWeek}`
          if (!map[key]) map[key] = []
          map[key].push({
            classId:          r.classId,
            className:        r.class.name,
            subjectName:      r.subject?.name ?? null,
            studentGroupId:   r.studentGroupId,
            studentGroupName: r.studentGroup?.name ?? null,
          })
        }
        setBusyByCell(map)
      })
      .catch(() => toast.error("Failed to load teacher schedule"))
      .finally(() => { if (!cancelled) setBusyLoading(false) })
    return () => { cancelled = true }
  }, [selectedSubjectId, subjects, classId])

  // Reset the heatmap when the selection clears or the chosen subject has no teacher.
  // Done as a derived check at render time (no useEffect needed for the clear path).
  const heatmapActive = (() => {
    if (!selectedSubjectId) return false
    const subj = subjects.find(s => s.id === selectedSubjectId)
    const primary = subj?.teachers.find(t => t.isPrimary) ?? subj?.teachers[0]
    return !!primary
  })()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const sortedDays = [...workingDays].sort((a, b) => a - b)

  // Modifier keys tracked globally:
  //   Ctrl/⌘ — when dragging a placed entry, copy instead of move
  //   Shift  — force the teacher picker open (override the auto-primary default)
  const ctrlHeldRef  = useRef(false)
  const shiftHeldRef = useRef(false)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      ctrlHeldRef.current  = e.ctrlKey || e.metaKey
      shiftHeldRef.current = e.shiftKey
    }
    function onBlur() { ctrlHeldRef.current = false; shiftHeldRef.current = false }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup",   onKey)
    window.addEventListener("blur",    onBlur)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup",   onKey)
      window.removeEventListener("blur",    onBlur)
    }
  }, [])

  async function trySetEntry(args: Parameters<typeof setRoutineEntry>[0]) {
    try {
      const res = await setRoutineEntry(args)
      if (res.ok) {
        toast.success("Saved")
        router.refresh()
        setPicker(null)
        return
      }
      if (res.reason === "TEACHER_CONFLICT") {
        setConflicts({ args, conflicts: res.conflicts })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    }
  }

  /**
   * Place a subject into a cell with auto-resolved teacher.
   * Used by both DnD drop and paint-click (palette select → cell click).
   *
   * Teacher resolution:
   *   0 teachers           → place with null + warning toast
   *   1 teacher            → auto-assign
   *   2+ teachers, primary → auto-pick primary (skip picker)
   *   2+ teachers, no primary → open picker (truly ambiguous)
   *
   * Hold Shift (or use `forcePicker: true`) to always open the picker — useful
   * for assigning a non-primary teacher or splitting by student group.
   */
  function placeSubjectInCell(
    subjectId:  string,
    slotId:     string,
    dayOfWeek:  number,
    opts?:      { forcePicker?: boolean },
  ) {
    const subj = subjects.find(s => s.id === subjectId)
    const teachers = subj?.teachers ?? []
    const primary  = teachers.find(t => t.isPrimary) ?? null

    if (opts?.forcePicker) {
      setPicker({ slotId, dayOfWeek, subjectId })
      return
    }
    if (teachers.length === 0) {
      startT(() => trySetEntry({
        classId, periodSlotId: slotId, dayOfWeek,
        subjectId, teacherUserId: null, studentGroupId: null,
      }))
      toast.warning(`${subj?.name ?? "Subject"} placed with no teacher — assign one to clear the warning`)
      return
    }
    if (teachers.length === 1 || primary) {
      const picked = primary ?? teachers[0]
      startT(() => trySetEntry({
        classId, periodSlotId: slotId, dayOfWeek,
        subjectId, teacherUserId: picked.id, studentGroupId: null,
      }))
      return
    }
    // 2+ teachers, no primary → genuinely ambiguous; open picker.
    setPicker({ slotId, dayOfWeek, subjectId })
  }

  async function tryMoveEntry(entryId: string, slotId: string, dayOfWeek: number) {
    try {
      const res = await moveRoutineEntry({ entryId, toPeriodSlotId: slotId, toDayOfWeek: dayOfWeek })
      if (res.ok) {
        toast.success("Moved")
        router.refresh()
        return
      }
      if (res.reason === "TEACHER_CONFLICT") {
        toast.error(`Conflict with ${res.conflicts.map(c => c.class.name).join(", ")} — drag with care or use the picker to override`)
      } else if (res.reason === "CELL_OCCUPIED") {
        toast.error("Destination cell already has an entry for this student group — clear it first")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed")
    }
  }

  function handleDragStart(e: DragStartEvent) {
    const d = e.active.data.current as
      | { kind: "subject"; subjectId: string }
      | { kind: "entry"; entryId: string }
      | undefined
    if (!d) return
    if (d.kind === "subject") {
      setActiveDrag({ kind: "subject", subjectId: d.subjectId })
    } else {
      // Find the entry across all cells
      for (const cellEntries of Object.values(entries)) {
        const e2 = cellEntries.find(en => en.id === d.entryId)
        if (e2) { setActiveDrag({ kind: "entry", entry: e2 }); break }
      }
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = e
    if (!over) return
    const overData = over.data.current as { slotId: string; dayOfWeek: number } | undefined
    if (!overData) return
    const activeData = active.data.current as
      | { kind: "subject"; subjectId: string }
      | { kind: "entry"; entryId: string }
      | undefined
    if (!activeData) return

    if (activeData.kind === "subject") {
      placeSubjectInCell(
        activeData.subjectId,
        overData.slotId,
        overData.dayOfWeek,
        { forcePicker: shiftHeldRef.current },
      )
    } else if (activeData.kind === "entry") {
      // Hold Ctrl/⌘ to COPY a placed entry instead of moving it.
      if (ctrlHeldRef.current) {
        const src = Object.values(entries).flat().find(e => e.id === activeData.entryId)
        if (src) {
          startT(() => trySetEntry({
            classId,
            periodSlotId:   overData.slotId,
            dayOfWeek:      overData.dayOfWeek,
            subjectId:      src.subjectId,
            teacherUserId:  src.teacherUserId,
            studentGroupId: src.studentGroupId,
          }))
          return
        }
      }
      startT(() => tryMoveEntry(activeData.entryId, overData.slotId, overData.dayOfWeek))
    }
  }

  function handleClear(entryId: string) {
    startT(async () => {
      try {
        await clearRoutineEntry(entryId)
        router.refresh()
      } catch {
        toast.error("Failed to clear")
      }
    })
  }

  function handleCopyFrom() {
    if (!copyFromId) return
    if (!confirm("Replace this class's entire routine with a copy from the selected class? Current entries will be deleted.")) return
    startT(async () => {
      try {
        const res = await copyRoutineFromClass({ fromClassId: copyFromId, toClassId: classId })
        toast.success(`Copied ${res.copied} entries`)
        setCopyFromId("")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Copy failed")
      }
    })
  }

  const draggedSubject = activeDrag?.kind === "subject" ? subjects.find(s => s.id === activeDrag.subjectId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
      {/* Top action bar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={cn(
            "text-[10px] font-bold gap-1",
            selectedSubjectId && "bg-primary text-primary-foreground",
          )}>
            {selectedSubjectId ? "🎨 Paint mode — click empty cells to place" : "Click a subject to pin, then click cells (or drag)"}
          </Badge>
          <span className="text-[10px] text-slate-400 font-medium">
            Primary teacher auto-assigned · hold{" "}
            <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-bold">Shift</kbd>{" "}
            to open the picker · drag a placed cell with{" "}
            <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-bold">Ctrl</kbd>{" "}
            to copy
          </span>
        </div>
        {sourceClasses.length > 0 && (
          <div className="flex gap-2">
            <Select value={copyFromId} onValueChange={setCopyFromId}>
              <SelectTrigger className="h-8 text-xs cursor-pointer bg-white border-slate-200 w-48">
                <SelectValue placeholder="Copy routine from…" />
              </SelectTrigger>
              <SelectContent>
                {sourceClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleCopyFrom} disabled={pending || !copyFromId}
              className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
              <Copy className="w-3.5 h-3.5" /> Copy
            </Button>
          </div>
        )}
      </div>

      {/* Subject palette — horizontal scrolling row, drag from here onto cells below */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-2.5 mb-3 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 flex-shrink-0 px-1">
            <BookOpen className="w-3 h-3" /> Subjects
          </div>
          {subjects.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic px-2">No subjects in this class</p>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 flex-1 scrollbar-thin">
              {subjects.map(s => (
                <SubjectChip key={s.id} subject={s}
                  selected={selectedSubjectId === s.id}
                  onSelect={() => setSelectedSubjectId(prev => prev === s.id ? null : s.id)} />
              ))}
            </div>
          )}
          {selectedSubjectId && (
            <button onClick={() => setSelectedSubjectId(null)}
              className="flex-shrink-0 text-[10px] font-bold text-primary hover:underline cursor-pointer px-2">
              Clear
            </button>
          )}
        </div>
        {selectedSubjectId && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-3 text-[10px] text-slate-500 px-1">
            <span className="font-bold text-slate-600">Heatmap:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-400" /> Free
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400" /> Busy elsewhere
            </span>
            {busyLoading && <span className="text-slate-400">loading…</span>}
            {groups.length > 0 && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-slate-400">
                <UsersRound className="w-3 h-3" /> {groups.length} group{groups.length === 1 ? "" : "s"} available — pick in the teacher dialog
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grid — full width */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-x-auto">
          <table className="min-w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="sticky left-0 bg-slate-50/60 backdrop-blur-xl text-left px-3 py-2.5 border-b border-slate-200 z-10 min-w-[140px]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Slot</span>
                </th>
                {sortedDays.map(d => (
                  <th key={d} className="text-center px-2 py-2.5 border-b border-slate-200 min-w-[180px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{DAY_LABELS[d]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map(slot => (
                <tr key={slot.id}>
                  <td className={cn(
                    "sticky left-0 px-3 py-2 border-b border-slate-100 z-10 align-top",
                    slot.isBreak ? "bg-amber-50/60 backdrop-blur-xl" : "bg-white/95 backdrop-blur-xl"
                  )}>
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      {slot.isBreak && <Coffee className="w-3 h-3 text-amber-600" />}
                      {slot.label}
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums">{slot.startTime}–{slot.endTime}</p>
                  </td>
                  {sortedDays.map(day => {
                    const key = `${slot.id}:${day}`
                    const cellEntries = entries[key] ?? []
                    const busyHere = heatmapActive ? (busyByCell[key] ?? []) : []
                    const availability: "none" | "free" | "busy" =
                      !heatmapActive             ? "none"
                      : busyHere.length > 0       ? "busy"
                      :                              "free"
                    return (
                      <td key={day} className="px-1.5 py-1.5 border-b border-slate-100 align-top">
                        <RoutineCell
                          slotId={slot.id}
                          dayOfWeek={day}
                          isBreak={slot.isBreak}
                          entries={cellEntries}
                          availability={availability}
                          busyDetail={busyHere}
                          onAddGroup={() => setPicker({ slotId: slot.id, dayOfWeek: day, subjectId: "", studentGroupId: null })}
                          onEmptyClick={() => {
                            // Paint mode: a subject is pinned in the palette → place it
                            // here directly. Shift forces the picker (for non-primary
                            // teachers or student-group splits).
                            if (selectedSubjectId) {
                              placeSubjectInCell(selectedSubjectId, slot.id, day, { forcePicker: shiftHeldRef.current })
                            } else {
                              setPicker({ slotId: slot.id, dayOfWeek: day, subjectId: "" })
                            }
                          }}
                          onEditEntry={(e) => setPicker({
                            slotId:        slot.id,
                            dayOfWeek:     day,
                            subjectId:     e.subjectId ?? "",
                            studentGroupId: e.studentGroupId ?? null,
                          })}
                          onClear={handleClear}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Teacher picker */}
      {picker && (
        <TeacherPickerDialog
          key={`${picker.slotId}-${picker.dayOfWeek}-${picker.subjectId}`}
          schoolId={schoolId}
          slotId={picker.slotId}
          dayOfWeek={picker.dayOfWeek}
          initialSubjectId={picker.subjectId}
          initialStudentGroupId={picker.studentGroupId ?? null}
          subjects={subjects}
          groups={groups}
          dayLabel={DAY_LABELS[picker.dayOfWeek]}
          onClose={() => setPicker(null)}
          onSave={(args) => trySetEntry({ classId, ...args })}
        />
      )}

      {/* Conflict modal */}
      {conflicts && (
        <ConflictConfirmModal
          conflicts={conflicts.conflicts}
          onCancel={() => setConflicts(null)}
          onConfirm={() => {
            const args = { ...conflicts.args, acknowledgeConflicts: true }
            setConflicts(null)
            startT(() => trySetEntry(args))
          }}
        />
      )}

      {/* Floating drag preview — follows cursor */}
      <DragOverlay dropAnimation={null}>
        {draggedSubject ? (
          <div className="bg-primary text-white rounded-lg px-2.5 py-1.5 shadow-2xl ring-2 ring-primary/40 inline-flex items-center gap-1.5 cursor-grabbing">
            <BookOpen className="w-3 h-3" />
            <div className="text-xs font-bold">{draggedSubject.name}</div>
          </div>
        ) : activeDrag?.kind === "entry" ? (
          <div className="bg-white border border-primary rounded-md px-2 py-1 shadow-2xl inline-flex items-center gap-1 cursor-grabbing">
            <div className="text-[11px] font-bold">{activeDrag.entry.subject?.name ?? "—"}</div>
            {activeDrag.entry.teacher && (
              <div className="text-[9px] text-slate-500">· {activeDrag.entry.teacher.fullName}</div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Subject chip in palette (draggable) ────────────────────────────────────

function SubjectChip({
  subject, selected, onSelect,
}: {
  subject:  SubjectShape
  selected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `subject:${subject.id}`,
    data: { kind: "subject", subjectId: subject.id },
  })
  const primary = subject.teachers.find(t => t.isPrimary)
  return (
    <button ref={setNodeRef} {...attributes} {...listeners}
      onClick={onSelect}
      title={primary
        ? `${subject.name} — primary: ${primary.fullName}`
        : subject.teachers.length === 0
          ? `${subject.name} — no teacher assigned`
          : `${subject.name} — ${subject.teachers.length} teachers`}
      className={cn(
        "flex-shrink-0 bg-white border rounded-full px-3 h-9 inline-flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all whitespace-nowrap",
        selected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-slate-200",
        isDragging && "opacity-30",
        subject.teachers.length === 0 && !selected && "border-rose-200 bg-rose-50/50"
      )}>
      <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
      <span className="text-xs font-bold">{subject.name}</span>
      {primary ? (
        <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
          <Star className="w-2.5 h-2.5 text-amber-500" /> {primary.fullName}
        </span>
      ) : subject.teachers.length === 0 ? (
        <span className="text-[10px] text-rose-500 font-medium">no teacher</span>
      ) : (
        <span className="text-[10px] text-slate-400">{subject.teachers.length} teachers</span>
      )}
    </button>
  )
}

// ─── Cell (droppable) with stacked entries ─────────────────────────────────

function RoutineCell({
  slotId, dayOfWeek, isBreak, entries, availability, busyDetail,
  onAddGroup, onEmptyClick, onEditEntry, onClear,
}: {
  slotId:       string
  dayOfWeek:    number
  isBreak:      boolean
  entries:      EntryShape[]
  availability: "none" | "free" | "busy"
  busyDetail:   { className: string; subjectName: string | null; studentGroupName: string | null }[]
  onAddGroup:   () => void
  onEmptyClick: () => void
  onEditEntry:  (e: EntryShape) => void
  onClear:      (entryId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id:   `cell:${slotId}:${dayOfWeek}`,
    data: { slotId, dayOfWeek },
  })

  if (isBreak) {
    return (
      <div className="h-16 rounded-lg bg-amber-50/40 border border-dashed border-amber-200 flex items-center justify-center">
        <span className="text-[10px] text-amber-700 flex items-center gap-1">
          <Coffee className="w-3 h-3" /> Break
        </span>
      </div>
    )
  }

  const busyTitle = busyDetail.length > 0
    ? `Teacher busy with: ${busyDetail.map(b => `${b.className}${b.subjectName ? ` (${b.subjectName})` : ""}${b.studentGroupName ? ` · ${b.studentGroupName}` : ""}`).join(" · ")}`
    : undefined

  return (
    <div ref={setNodeRef}
      title={busyTitle}
      className={cn(
        "min-h-16 rounded-lg border-2 border-dashed p-1 space-y-1 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-slate-200 bg-slate-50/40",
        entries.length > 0 && !isOver && availability === "none" && "border-solid border-slate-100 bg-white",
        availability === "free" && !isOver && "bg-emerald-50/70 border-emerald-300",
        availability === "busy" && !isOver && "bg-amber-50/70 border-amber-300"
      )}>
      {entries.length === 0 && (
        <button
          onClick={onEmptyClick}
          title="Click to assign, or drag a subject here"
          className="w-full h-full min-h-12 flex items-center justify-center text-[10px] text-slate-300 select-none hover:text-primary hover:bg-primary/5 rounded-md transition-colors cursor-pointer"
        >
          + Drop or click
        </button>
      )}
      {entries.map(e => (
        <EntryChip key={e.id} entry={e}
          onEdit={() => onEditEntry(e)}
          onClear={() => onClear(e.id)} />
      ))}
      {entries.length > 0 && entries.some(e => e.studentGroupId) && (
        <button onClick={onAddGroup}
          className="w-full text-[10px] text-slate-400 hover:text-primary border border-dashed border-slate-200 hover:border-primary/40 rounded px-1.5 py-0.5 flex items-center justify-center gap-1 cursor-pointer">
          <Plus className="w-2.5 h-2.5" /> Add group
        </button>
      )}
    </div>
  )
}

// ─── Entry chip (draggable to move; × to clear) ────────────────────────────

function EntryChip({
  entry, onEdit, onClear,
}: {
  entry:   EntryShape
  onEdit:  () => void
  onClear: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `entry:${entry.id}`,
    data: { kind: "entry", entryId: entry.id },
  })
  const noTeacher = !entry.teacher
  return (
    <div ref={setNodeRef}
      className={cn(
        "bg-white border rounded-md px-1.5 py-1 flex items-center gap-1 group cursor-pointer",
        entry.studentGroup ? "border-violet-300" : "border-blue-200",
        noTeacher && "border-amber-400 bg-amber-50/60 ring-1 ring-amber-300/40 print:border-blue-200 print:bg-white print:ring-0",
        isDragging && "opacity-30",
      )}
      title={noTeacher
        ? "No teacher assigned — click to fix"
        : "Click to edit, drag the grip to move"}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-edit]")) return
        onEdit()
      }}
    >
      <button {...attributes} {...listeners} data-no-edit
        className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-2.5 h-2.5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold truncate flex items-center gap-1">
          {entry.subject?.name ?? "—"}
          {noTeacher && (
            <AlertTriangle
              className="w-2.5 h-2.5 text-amber-600 shrink-0 print:hidden"
              aria-label="No teacher assigned"
            />
          )}
        </p>
        <p className="text-[9px] text-slate-500 truncate flex items-center gap-0.5">
          {entry.teacher
            ? entry.teacher.fullName
            : <span className="text-amber-700 font-semibold print:hidden">Needs teacher</span>}
          {entry.studentGroup && <span className="text-violet-600 ml-1">· {entry.studentGroup.name}</span>}
        </p>
      </div>
      <button data-no-edit
        onClick={(e) => { e.stopPropagation(); onClear() }}
        className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
