"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Plus, Minus, Save, RotateCcw, GripVertical, Trash2,
  Armchair, Footprints, BookOpen, AlertTriangle, Loader2, Check, X, Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { copyLayoutFromRoom, setRoomLayout, type RoomSeatRow, type SeatKind } from "@/actions/rooms"

interface Props {
  roomId:           string
  schoolId:         string
  initialSeats:     RoomSeatRow[]
  initialRowCount:  number
  examSeatCount:    number
  sourceCandidates: { id: string; name: string; capacity: number }[]
}

interface EditableSeat {
  /** Stable per-render id; existing seats keep their server id, new ones use `new-...` */
  id:         string
  kind:       SeatKind
  label:      string | null
  examUsable: boolean
}

interface EditableRow {
  id:    string
  seats: EditableSeat[]
}

const KIND_CYCLE: Record<SeatKind, SeatKind> = {
  SEAT:         "AISLE",
  AISLE:        "TEACHER_DESK",
  TEACHER_DESK: "SEAT",
}

const KIND_META: Record<SeatKind, { label: string; classes: string; icon: typeof Armchair }> = {
  SEAT:         { label: "Seat",         classes: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100",  icon: Armchair },
  AISLE:        { label: "Aisle",        classes: "bg-slate-100/60 text-slate-400 border-dashed border-slate-300 hover:bg-slate-200/60", icon: Footprints },
  TEACHER_DESK: { label: "Teacher desk", classes: "bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100",   icon: BookOpen },
}

function seedFromInitial(initial: RoomSeatRow[], rowCount: number): EditableRow[] {
  if (initial.length === 0 && rowCount === 0) {
    // Sensible default: 4 rows of 4 SEATs, all exam-usable
    return Array.from({ length: 4 }, (_, r) => ({
      id:    `new-row-${r}`,
      seats: Array.from({ length: 4 }, (_, c) => ({
        id:         `new-${r}-${c}`,
        kind:       "SEAT" as SeatKind,
        label:      null,
        examUsable: true,
      })),
    }))
  }
  const byRow = new Map<number, RoomSeatRow[]>()
  for (const s of initial) {
    if (!byRow.has(s.row)) byRow.set(s.row, [])
    byRow.get(s.row)!.push(s)
  }
  const rows: EditableRow[] = []
  for (let r = 1; r <= rowCount; r++) {
    const xs = (byRow.get(r) ?? []).sort((a, b) => a.col - b.col)
    rows.push({
      id:    `row-${r}`,
      seats: xs.map(s => ({
        id:         s.id,
        kind:       s.kind,
        label:      s.label,
        examUsable: s.examUsable,
      })),
    })
  }
  return rows
}

export function SeatLayoutEditor({
  roomId, schoolId, initialSeats, initialRowCount, examSeatCount, sourceCandidates,
}: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [dirty, setDirty] = useState(false)

  const baselineRef = useRef<EditableRow[]>(seedFromInitial(initialSeats, initialRowCount))
  const [rows, setRows] = useState<EditableRow[]>(baselineRef.current)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Stats
  const stats = useMemo(() => {
    let seats = 0, examSeats = 0, aisles = 0, teacherDesks = 0
    let maxCols = 0
    for (const r of rows) {
      maxCols = Math.max(maxCols, r.seats.length)
      for (const s of r.seats) {
        if      (s.kind === "SEAT")         { seats++; if (s.examUsable) examSeats++ }
        else if (s.kind === "AISLE")        aisles++
        else                                teacherDesks++
      }
    }
    return { seats, examSeats, aisles, teacherDesks, maxCols, rowCount: rows.length }
  }, [rows])

  // Track dirty state vs baseline
  useEffect(() => {
    const fingerprint = (rs: EditableRow[]) =>
      JSON.stringify(rs.map(r => r.seats.map(s => `${s.kind}:${s.label ?? ""}:${s.examUsable ? 1 : 0}`)))
    setDirty(fingerprint(baselineRef.current) !== fingerprint(rows))
  }, [rows])

  // ── Row ops ──────────────────────────────────────────────────────────────
  // New row mirrors the previous row's pattern (count + per-seat kind + label + examUsable).
  // Falls back to 4 plain SEATs (exam-usable) if this is the first row.
  function addRow() {
    setRows(prev => {
      const last = prev[prev.length - 1]
      const template: { kind: SeatKind; label: string | null; examUsable: boolean }[] = last?.seats.length
        ? last.seats.map(s => ({ kind: s.kind, label: s.label, examUsable: s.examUsable }))
        : Array.from({ length: 4 }, () => ({ kind: "SEAT" as SeatKind, label: null, examUsable: true }))
      const stamp = Date.now()
      return [...prev, {
        id:    `new-row-${stamp}`,
        seats: template.map((s, c) => ({
          id:         `new-${stamp}-${c}`,
          kind:       s.kind,
          label:      s.label,
          examUsable: s.examUsable,
        })),
      }]
    })
  }
  function removeRow(rowId: string) {
    setRows(prev => prev.filter(r => r.id !== rowId))
  }

  // ── Seat ops ─────────────────────────────────────────────────────────────
  function addSeat(rowId: string) {
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, seats: [...r.seats, { id: `new-${rowId}-${Date.now()}`, kind: "SEAT", label: null, examUsable: true }] }
      : r))
  }
  function removeSeat(rowId: string) {
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, seats: r.seats.slice(0, -1) }
      : r))
  }
  function cycleSeat(rowId: string, seatId: string) {
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, seats: r.seats.map(s => s.id === seatId ? { ...s, kind: KIND_CYCLE[s.kind] } : s) }
      : r))
  }
  function toggleExamUsable(rowId: string, seatId: string) {
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, seats: r.seats.map(s => s.id === seatId ? { ...s, examUsable: !s.examUsable } : s) }
      : r))
  }
  function setRowExamUsable(rowId: string, value: boolean) {
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, seats: r.seats.map(s => s.kind === "SEAT" ? { ...s, examUsable: value } : s) }
      : r))
  }

  // ── DnD row reorder ──────────────────────────────────────────────────────
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = rows.findIndex(r => r.id === active.id)
    const newIdx = rows.findIndex(r => r.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    setRows(prev => arrayMove(prev, oldIdx, newIdx))
  }

  // ── Save / revert ────────────────────────────────────────────────────────
  function revert() {
    setRows(baselineRef.current)
    toast.info("Reverted to last saved layout")
  }

  function copyFrom(sourceId: string, sourceName: string) {
    const totalSeats = rows.reduce((n, r) => n + r.seats.length, 0)
    if (totalSeats > 0 && !confirm(
      `This will REPLACE the current layout with "${sourceName}". Continue?`,
    )) return
    setCopying(true)
    startT(async () => {
      try {
        const res = await copyLayoutFromRoom(roomId, schoolId, sourceId)
        toast.success(`Copied from "${sourceName}" — ${res.added} added, ${res.kept} kept, ${res.removed} removed.`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Copy failed")
      } finally {
        setCopying(false)
      }
    })
  }

  function save() {
    if (rows.length === 0) {
      toast.error("Add at least one row before saving.")
      return
    }
    setSaving(true)
    startT(async () => {
      try {
        const payload = rows.map(r => ({
          seats: r.seats.map(s => ({ kind: s.kind, label: s.label, examUsable: s.examUsable })),
        }))
        const res = await setRoomLayout(roomId, schoolId, payload)
        toast.success(`Saved — ${res.added} added, ${res.kept} kept, ${res.removed} removed.`)
        baselineRef.current = rows.map(r => ({
          id: r.id, seats: r.seats.map(s => ({ ...s })),
        }))
        setDirty(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        <StatTile color="emerald" label="Seats"         value={stats.seats}        sub="physical" />
        <StatTile color="sky"     label="Exam usable"   value={stats.examSeats}    sub={`of ${stats.seats}`} />
        <StatTile color="slate"   label="Aisles"        value={stats.aisles}       />
        <StatTile color="violet"  label="Teacher desks" value={stats.teacherDesks} />
        <StatTile color="amber"   label="Rows"          value={stats.rowCount}     />
        <StatTile color="slate"   label="Widest row"    value={stats.maxCols}      />
      </div>

      {examSeatCount > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2.5 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{examSeatCount}</strong> exam seat assignment{examSeatCount === 1 ? "" : "s"} reference this room.
            You can edit kind/label freely, but removing chairs that are already assigned will be refused — clear those exam seatings first.
          </span>
        </div>
      )}

      {/* The editor */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        {/* Toolbar: front-of-room hint + copy-from picker */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1" />
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
            ↑ Front of room
          </span>
          <div className="flex-1 flex justify-end">
            {sourceCandidates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={copying}
                    className="gap-1.5 cursor-pointer text-xs h-7 bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50"
                  >
                    {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                    Copy from…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl max-h-[60vh] overflow-y-auto"
                >
                  <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Replace layout with…
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {sourceCandidates.map(s => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => copyFrom(s.id, s.name)}
                      className="cursor-pointer gap-2 text-xs"
                    >
                      <span className="font-semibold flex-1">{s.name}</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">{s.capacity} seats</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {rows.map((row, rowIdx) => (
                <SortableRow
                  key={row.id}
                  row={row}
                  rowIdx={rowIdx}
                  onAddSeat={() => addSeat(row.id)}
                  onRemoveSeat={() => removeSeat(row.id)}
                  onRemoveRow={() => removeRow(row.id)}
                  onCycleSeat={(seatId) => cycleSeat(row.id, seatId)}
                  onToggleExam={(seatId) => toggleExamUsable(row.id, seatId)}
                  onSetRowExam={(v) => setRowExamUsable(row.id, v)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-4 flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="gap-1.5 cursor-pointer bg-white border-dashed border-2 hover:border-primary/40 hover:bg-primary/5"
          >
            <Plus className="w-3.5 h-3.5" /> Add row
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white/40 backdrop-blur-sm rounded-xl border border-white/40 p-3 flex items-center justify-center gap-4 text-[11px] text-slate-500 flex-wrap">
        <LegendChip kind="SEAT" />
        <LegendChip kind="AISLE" />
        <LegendChip kind="TEACHER_DESK" />
        <span className="text-slate-300">·</span>
        <span><strong>Click</strong> seat to cycle kind</span>
        <span className="text-slate-300">·</span>
        <span>The <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[8px] align-middle"><Check className="w-2 h-2" /></span> corner toggles exam-usable</span>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div className="sticky bottom-4 bg-white/95 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg px-5 py-3 flex items-center gap-3 z-30">
          <div className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Unsaved changes
          </div>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={revert} disabled={saving}
            className="gap-1.5 cursor-pointer text-xs text-slate-600 hover:bg-slate-100">
            <RotateCcw className="w-3.5 h-3.5" /> Revert
          </Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save layout
          </Button>
        </div>
      )}

      {!dirty && stats.seats > 0 && (
        <div className="text-center text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-1.5">
          <Check className="w-3 h-3" /> Layout saved
        </div>
      )}
    </div>
  )
}

// ─── Sortable row ────────────────────────────────────────────────────────────

function SortableRow({
  row, rowIdx, onAddSeat, onRemoveSeat, onRemoveRow, onCycleSeat, onToggleExam, onSetRowExam,
}: {
  row:           EditableRow
  rowIdx:        number
  onAddSeat:     () => void
  onRemoveSeat:  () => void
  onRemoveRow:   () => void
  onCycleSeat:   (seatId: string) => void
  onToggleExam:  (seatId: string) => void
  onSetRowExam:  (value: boolean) => void
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: row.id })

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.4 : 1,
    zIndex:     isDragging ? 30 : undefined,
  }

  const seatCells     = row.seats.filter(s => s.kind === "SEAT")
  const examUsableCnt = seatCells.filter(s => s.examUsable).length
  const allOn         = seatCells.length > 0 && examUsableCnt === seatCells.length

  return (
    <div ref={setNodeRef} style={style}
      className="group/row flex items-center gap-2 bg-slate-50/40 hover:bg-slate-50/80 rounded-xl px-2 py-1.5 transition-colors">
      <button ref={setActivatorNodeRef} {...attributes} {...listeners}
        title="Drag to reorder row"
        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-primary p-1 opacity-50 group-hover/row:opacity-100 transition-opacity flex-shrink-0">
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <span className="text-[10px] font-mono font-bold text-slate-400 tabular-nums w-6 text-right flex-shrink-0">
        R{rowIdx + 1}
      </span>

      <div className="flex-1 flex items-center gap-1.5 flex-wrap">
        {row.seats.map((s, i) => (
          <SeatTile
            key={s.id}
            index={i + 1}
            seat={s}
            onClick={() => onCycleSeat(s.id)}
            onToggleExam={() => onToggleExam(s.id)}
          />
        ))}
        {row.seats.length === 0 && (
          <span className="text-[10px] text-slate-300 italic px-2">empty row</span>
        )}
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-50 group-hover/row:opacity-100 transition-opacity">
        {seatCells.length > 0 && (
          <button
            onClick={() => onSetRowExam(!allOn)}
            title={allOn ? "Mark all seats in this row as NOT exam-usable" : "Mark all seats in this row as exam-usable"}
            className={cn(
              "h-7 px-2 rounded-md flex items-center gap-1 cursor-pointer text-[10px] font-bold",
              allOn ? "text-sky-700 bg-sky-50 hover:bg-sky-100" : "text-slate-500 hover:bg-slate-200",
            )}
          >
            {allOn ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            <span className="tabular-nums">{examUsableCnt}/{seatCells.length}</span>
          </button>
        )}
        <button
          onClick={onRemoveSeat}
          disabled={row.seats.length === 0}
          title="Remove last seat"
          className="w-7 h-7 rounded-md hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={onAddSeat}
          title="Add seat to end"
          className="w-7 h-7 rounded-md hover:bg-emerald-100 text-emerald-600 flex items-center justify-center cursor-pointer"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          onClick={onRemoveRow}
          title="Delete entire row"
          className="w-7 h-7 rounded-md hover:bg-rose-100 text-rose-500 flex items-center justify-center cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Single seat tile ────────────────────────────────────────────────────────

function SeatTile({
  index, seat, onClick, onToggleExam,
}: {
  index:        number
  seat:         EditableSeat
  onClick:      () => void
  onToggleExam: () => void
}) {
  const meta = KIND_META[seat.kind]
  const Icon = meta.icon
  const isSeat       = seat.kind === "SEAT"
  const examDisabled = isSeat && !seat.examUsable
  return (
    <div className="relative">
      <button
        onClick={onClick}
        title={`${meta.label} (click to change kind)`}
        className={cn(
          "min-w-[48px] h-10 px-2 rounded-md border-2 flex flex-col items-center justify-center cursor-pointer transition-all",
          meta.classes,
          examDisabled && "opacity-50 bg-stripe",
        )}
        style={examDisabled ? {
          backgroundImage: "repeating-linear-gradient(45deg, rgba(225,29,72,0.10) 0 4px, transparent 4px 8px)",
        } : undefined}
      >
        <Icon className="w-3 h-3" />
        <span className="text-[9px] font-mono font-bold tabular-nums leading-none mt-0.5">{index}</span>
      </button>
      {isSeat && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleExam() }}
          title={seat.examUsable
            ? "Exam-usable — click to exclude from exams"
            : "Excluded from exams — click to include"}
          className={cn(
            "absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold cursor-pointer shadow-sm transition-colors",
            seat.examUsable
              ? "bg-sky-500 border-sky-600 text-white hover:bg-sky-600"
              : "bg-white border-rose-300 text-rose-500 hover:bg-rose-50",
          )}
        >
          {seat.examUsable
            ? <Check className="w-2.5 h-2.5" strokeWidth={3} />
            : <X     className="w-2.5 h-2.5" strokeWidth={3} />}
        </button>
      )}
    </div>
  )
}

// ─── Legend chip ─────────────────────────────────────────────────────────────

function LegendChip({ kind }: { kind: SeatKind }) {
  const meta = KIND_META[kind]
  const Icon = meta.icon
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold",
      meta.classes.replace(/hover:[^ ]+/g, ""),
    )}>
      <Icon className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  )
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({
  color, label, value, sub,
}: {
  color: "emerald" | "slate" | "violet" | "amber" | "sky"
  label: string
  value: number
  sub?:  string
}) {
  const dotCls = {
    emerald: "bg-emerald-500",
    slate:   "bg-slate-400",
    violet:  "bg-violet-500",
    amber:   "bg-amber-500",
    sky:     "bg-sky-500",
  }[color]
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-black text-slate-900 tabular-nums">{value}</span>
        {sub && <span className="text-[10px] text-slate-400 font-medium tabular-nums">{sub}</span>}
        <span className={cn("ml-auto w-1.5 h-1.5 rounded-full", dotCls)} />
      </div>
    </div>
  )
}
