"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core"
import Link from "next/link"
import {
  Plus, Wand2, Loader2, DoorOpen, RotateCcw,
  Footprints, BookOpen, Inbox, Shuffle, Layers, Users, Check, Printer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  setScheduleRooms, clearScheduleSeats, autoAssignSeats, moveOrSwap,
  type RoomBoard, type SeatRow, type EligibleStudent, type RoomDensity, type SeatStrategy,
} from "@/actions/exam-seats"

interface RoomOpt {
  id:           string
  name:         string
  capacity:     number    // physical SEAT count
  examCapacity: number    // SEAT && examUsable
}

interface Props {
  schoolId:        string
  examId:          string
  scheduleId:      string
  initialBoards:   RoomBoard[]
  initialSeats:    SeatRow[]
  initialEligible: EligibleStudent[]
  rooms:           RoomOpt[]
}

function openSeatPrint(examId: string, scheduleId: string, opts?: { roomIds?: string[]; mode?: "map" | "roster" | "both" }) {
  const params = new URLSearchParams()
  if (opts?.roomIds && opts.roomIds.length > 0) params.set("roomId", opts.roomIds.join(","))
  if (opts?.mode) params.set("mode", opts.mode)
  const qs = params.toString()
  window.open(
    `/academics/exams/${examId}/seats/${scheduleId}/print${qs ? `?${qs}` : ""}`,
    "_blank",
    "noopener,noreferrer",
  )
}

const UNASSIGNED_DROP = "__UNASSIGNED__"

export function SeatBoard({
  schoolId, examId, scheduleId, initialBoards, initialSeats, initialEligible, rooms,
}: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  const [boards, setBoards] = useState<RoomBoard[]>(initialBoards)
  const [seats,  setSeats]  = useState<SeatRow[]>(initialSeats)
  const eligible = initialEligible

  useEffect(() => { setBoards(initialBoards) }, [initialBoards])
  useEffect(() => { setSeats(initialSeats)   }, [initialSeats])

  // ─── Derived state ────────────────────────────────────────────────────
  const seatedIds  = useMemo(() => new Set(seats.map(s => s.studentId)), [seats])
  const unassigned = useMemo(() => eligible.filter(e => !seatedIds.has(e.id)), [eligible, seatedIds])
  const seatByRoomSeat = useMemo(() => {
    const m = new Map<string, SeatRow>()
    for (const s of seats) m.set(s.roomSeatId, s)
    return m
  }, [seats])

  const totalEffective = boards.reduce((n, b) => n + b.effectiveSeats, 0)
  const shortfall = Math.max(0, eligible.length - totalEffective)

  // Color-by-class palette (deterministic)
  const classColor = useMemo(() => {
    const palette = [
      "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-800",
      "from-sky-50 to-sky-100 border-sky-200 text-sky-800",
      "from-violet-50 to-violet-100 border-violet-200 text-violet-800",
      "from-amber-50 to-amber-100 border-amber-200 text-amber-800",
      "from-rose-50 to-rose-100 border-rose-200 text-rose-800",
      "from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-800",
      "from-fuchsia-50 to-fuchsia-100 border-fuchsia-200 text-fuchsia-800",
      "from-lime-50 to-lime-100 border-lime-200 text-lime-800",
    ]
    const map = new Map<string, string>()
    const classes = [...new Set(eligible.map(e => e.classId))]
    classes.forEach((id, i) => map.set(id, palette[i % palette.length]))
    return map
  }, [eligible])

  // ─── DnD ─────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null)
  const activeSeat = activeSeatId ? seats.find(s => s.id === activeSeatId) ?? null : null

  function onDragStart(e: DragStartEvent) {
    setActiveSeatId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveSeatId(null)
    const seatId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId) return
    if (overId === UNASSIGNED_DROP) {
      // Eject student from this seat → delete the seat row
      ejectSeat(seatId)
      return
    }
    // overId is a roomSeatId
    movePersist(seatId, overId)
  }

  function movePersist(seatId: string, toRoomSeatId: string) {
    // Optimistic: swap locally
    const a = seats.find(s => s.id === seatId)
    if (!a) return
    const b = seats.find(s => s.roomSeatId === toRoomSeatId)
    const targetMeta = boardSeatMeta(boards, toRoomSeatId)
    if (!targetMeta) return
    if (!targetMeta.usableForExam) {
      toast.error("Target seat is excluded from exams")
      return
    }
    setSeats(prev => {
      const next = [...prev]
      const aIdx = next.findIndex(s => s.id === seatId)
      const bIdx = b ? next.findIndex(s => s.id === b.id) : -1
      if (aIdx < 0) return prev
      const newA = { ...next[aIdx], roomId: targetMeta.roomId, roomSeatId: toRoomSeatId, row: targetMeta.row, col: targetMeta.col }
      if (bIdx >= 0) {
        // SWAP
        const aOld = next[aIdx]
        const newB = { ...next[bIdx], roomId: aOld.roomId, roomSeatId: aOld.roomSeatId, row: aOld.row, col: aOld.col }
        next[aIdx] = newA
        next[bIdx] = newB
      } else {
        next[aIdx] = newA
      }
      return next
    })
    startT(async () => {
      try {
        await moveOrSwap(seatId, toRoomSeatId, schoolId)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Move failed")
        router.refresh()
      }
    })
  }

  function ejectSeat(seatId: string) {
    // No bulk "delete one seat" action — clear + re-auto? Too aggressive.
    // Mark as a follow-up. For now, surface a toast and ask user to use Clear All.
    toast.message("Eject not yet implemented — use Clear All or move the student to a different chair.")
    void seatId
  }

  // ─── Room picker (multi-select + density per room) ────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRooms, setPickerRooms] = useState<{ roomId: string; density: RoomDensity }[]>(
    () => initialBoards.map(b => ({ roomId: b.roomId, density: b.density })),
  )
  useEffect(() => {
    setPickerRooms(initialBoards.map(b => ({ roomId: b.roomId, density: b.density })))
  }, [initialBoards])

  function toggleRoom(roomId: string) {
    setPickerRooms(prev => prev.find(p => p.roomId === roomId)
      ? prev.filter(p => p.roomId !== roomId)
      : [...prev, { roomId, density: "FULL" }])
  }
  function setRoomDensity(roomId: string, density: RoomDensity) {
    setPickerRooms(prev => prev.map(p => p.roomId === roomId ? { ...p, density } : p))
  }
  function saveRoomPicker() {
    setBusy("rooms")
    startT(async () => {
      try {
        await setScheduleRooms(scheduleId, schoolId, pickerRooms)
        toast.success(`Saved ${pickerRooms.length} room${pickerRooms.length === 1 ? "" : "s"}`)
        setPickerOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setBusy(null)
      }
    })
  }

  // Quick density change while board is live (skip picker UI)
  function changeDensityInline(roomId: string, density: RoomDensity) {
    const next = pickerRooms.length > 0
      ? pickerRooms.map(p => p.roomId === roomId ? { ...p, density } : p)
      : boards.map(b => ({ roomId: b.roomId, density: b.roomId === roomId ? density : b.density }))
    setBusy("density")
    startT(async () => {
      try {
        await setScheduleRooms(scheduleId, schoolId, next)
        toast.success(`Density updated to ${density.toLowerCase()}`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed")
      } finally {
        setBusy(null)
      }
    })
  }

  // ─── Auto-assign ──────────────────────────────────────────────────────
  function autoAssign(strategy: SeatStrategy) {
    if (boards.length === 0) {
      toast.error("Pick at least one room first")
      return
    }
    if (eligible.length === 0) {
      toast.error("No eligible students — attach class+subject targets to the paper")
      return
    }
    setBusy("auto")
    startT(async () => {
      try {
        const res = await autoAssignSeats({ scheduleId, schoolId, strategy })
        const msg = res.shortfall > 0
          ? `Seated ${res.assigned} students. ${res.shortfall} unseated (capacity shortfall)`
          : `Seated all ${res.assigned} students`
        if (res.shortfall > 0) toast.warning(msg)
        else                   toast.success(msg)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Auto-assign failed")
      } finally {
        setBusy(null)
      }
    })
  }

  function clearAll() {
    if (seats.length === 0) return
    if (!confirm(`Clear all ${seats.length} seat assignments for this sitting?`)) return
    setBusy("clear")
    startT(async () => {
      try {
        await clearScheduleSeats(scheduleId, schoolId)
        toast.success("Cleared")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed")
      } finally {
        setBusy(null)
      }
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* Toolbar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(o => !o)}
          className={cn(
            "gap-1.5 cursor-pointer text-xs h-8 bg-white",
            pickerOpen && "border-primary/40 bg-primary/5",
          )}>
          <DoorOpen className="w-3.5 h-3.5" /> Pick Rooms
          {boards.length > 0 && <span className="text-slate-400">({boards.length})</span>}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={busy === "auto" || boards.length === 0 || eligible.length === 0}
              className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8 font-bold">
              {busy === "auto" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Auto-assign
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Strategy
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => autoAssign("ROLL_ASC")} className="cursor-pointer gap-2 text-xs">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex flex-col">
                <span className="font-bold">Roll-number order</span>
                <span className="text-[10px] text-slate-400">Class-grouped, by roll #</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => autoAssign("ALTERNATING_CLASS")} className="cursor-pointer gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <div className="flex flex-col">
                <span className="font-bold">Alternating class</span>
                <span className="text-[10px] text-slate-400">Round-robin classes — anti-collusion</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => autoAssign("MIXED_FACULTY")} className="cursor-pointer gap-2 text-xs">
              <Shuffle className="w-3.5 h-3.5 text-violet-600" />
              <div className="flex flex-col">
                <span className="font-bold">Mixed faculty</span>
                <span className="text-[10px] text-slate-400">Spread faculties + classes</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => autoAssign("RANDOM_SEEDED")} className="cursor-pointer gap-2 text-xs">
              <Shuffle className="w-3.5 h-3.5 text-rose-600" />
              <div className="flex flex-col">
                <span className="font-bold">Random (seeded)</span>
                <span className="text-[10px] text-slate-400">Same input → same map</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="outline" onClick={clearAll}
          disabled={seats.length === 0 || busy !== null}
          className="gap-1.5 cursor-pointer text-xs h-8 bg-white text-rose-600 border-rose-200 hover:bg-rose-50">
          {busy === "clear" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Clear all
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"
              disabled={seats.length === 0 || boards.length === 0}
              className="gap-1.5 cursor-pointer text-xs h-8 bg-white border-slate-200 hover:border-primary/30 hover:bg-primary/5"
              title={seats.length === 0 ? "Assign seats first" : "Print"}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Print all rooms
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openSeatPrint(examId, scheduleId, { mode: "both" })} className="cursor-pointer gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex flex-col">
                <span className="font-bold">Map + Roster</span>
                <span className="text-[10px] text-slate-400">Map page then roster page per room</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSeatPrint(examId, scheduleId, { mode: "map" })} className="cursor-pointer gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-violet-600" />
              <div className="flex flex-col">
                <span className="font-bold">Seat map only</span>
                <span className="text-[10px] text-slate-400">Portrait grid (one page per room)</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSeatPrint(examId, scheduleId, { mode: "roster" })} className="cursor-pointer gap-2 text-xs">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <div className="flex flex-col">
                <span className="font-bold">Roster only</span>
                <span className="text-[10px] text-slate-400">Landscape table with signature column</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {seats.length}/{eligible.length} seated · {totalEffective} usable
          {shortfall > 0 && <span className="text-rose-600 ml-1">· shortfall {shortfall}</span>}
        </div>
      </div>

      {/* Room picker panel */}
      {pickerOpen && (
        <div className="mt-3 bg-amber-50/40 border border-amber-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">Pick rooms for this sitting</span>
          </div>
          {rooms.length === 0 ? (
            <p className="text-xs text-slate-500">
              No active rooms registered. Add one in <Link href="/settings/rooms" className="underline font-semibold">Settings → Rooms</Link> first.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {rooms.map(r => {
                const picked = pickerRooms.find(p => p.roomId === r.id)
                return (
                  <div key={r.id}
                    className={cn(
                      "bg-white rounded-lg border p-2.5 flex items-center gap-2 transition-all",
                      picked ? "border-primary/40 shadow-sm" : "border-slate-200 hover:border-slate-300",
                    )}>
                    <button
                      onClick={() => toggleRoom(r.id)}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all",
                        picked ? "bg-primary border-primary text-white" : "border-slate-300 hover:border-slate-500",
                      )}
                    >
                      {picked && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{r.name}</p>
                      <p className="text-[10px] text-slate-400 tabular-nums">
                        {r.examCapacity} exam · {r.capacity} total
                      </p>
                    </div>
                    {picked && (
                      <Select value={picked.density} onValueChange={(v: string) => setRoomDensity(r.id, v as RoomDensity)}>
                        <SelectTrigger className="h-7 w-[110px] text-[10px] bg-white border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FULL"        className="text-xs">Full</SelectItem>
                          <SelectItem value="HALF"        className="text-xs">Half (anti-collusion)</SelectItem>
                          <SelectItem value="ALTERNATING" className="text-xs">Alternating</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPickerOpen(false)} className="text-xs h-8 cursor-pointer">
              Cancel
            </Button>
            <Button size="sm" onClick={saveRoomPicker} disabled={busy === "rooms"}
              className="gap-1.5 cursor-pointer text-xs h-8 shadow-md shadow-primary/20 font-bold">
              {busy === "rooms" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save rooms
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
        {/* Unassigned tray */}
        <UnassignedRail unassigned={unassigned} classColor={classColor} />

        {/* Room boards */}
        <div className="space-y-3">
          {boards.length === 0 ? (
            <EmptyBoards />
          ) : (
            boards.map(b => (
              <RoomCard
                key={b.roomId}
                examId={examId}
                scheduleId={scheduleId}
                board={b}
                seatByRoomSeat={seatByRoomSeat}
                classColor={classColor}
                onDensityChange={(d) => changeDensityInline(b.roomId, d)}
                density={b.density}
                busy={busy === "density"}
              />
            ))
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeSeat && (
          <StudentChipStatic seat={activeSeat} classColor={classColor} ghost />
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

function boardSeatMeta(boards: RoomBoard[], roomSeatId: string) {
  for (const b of boards) {
    const s = b.seats.find(x => x.roomSeatId === roomSeatId)
    if (s) return { roomId: b.roomId, row: s.row, col: s.col, usableForExam: s.usableForExam }
  }
  return null
}

// ─── Unassigned rail ────────────────────────────────────────────────────

function UnassignedRail({
  unassigned, classColor,
}: {
  unassigned: EligibleStudent[]
  classColor: Map<string, string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_DROP })
  return (
    <div ref={setNodeRef}
      className={cn(
        "bg-white/70 backdrop-blur-xl rounded-xl border shadow-sm p-3 min-h-[300px] transition-colors",
        isOver ? "border-primary/40 bg-primary/5" : "border-white/40",
      )}>
      <div className="flex items-center gap-2 mb-2.5">
        <Inbox className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Unassigned ({unassigned.length})
        </span>
      </div>
      {unassigned.length === 0 ? (
        <div className="text-[11px] text-slate-300 italic text-center py-8 leading-relaxed">
          All students are seated.
        </div>
      ) : (
        <div className="space-y-1">
          {unassigned.map(s => (
            <div key={s.id}
              title={`${s.fullName} · ${s.className}`}
              className={cn(
                "p-1.5 rounded-md border bg-gradient-to-br text-[10px]",
                classColor.get(s.classId) ?? "from-slate-50 to-slate-100 border-slate-200 text-slate-700",
              )}>
              <div className="font-bold truncate">{s.fullName}</div>
              <div className="text-[9px] opacity-70 truncate font-mono tabular-nums">
                {s.rollNumber ?? "—"} · {s.className}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Room card ──────────────────────────────────────────────────────────

function RoomCard({
  examId, scheduleId, board, seatByRoomSeat, classColor, onDensityChange, density, busy,
}: {
  examId:          string
  scheduleId:      string
  board:           RoomBoard
  seatByRoomSeat:  Map<string, SeatRow>
  classColor:      Map<string, string>
  onDensityChange: (d: RoomDensity) => void
  density:         RoomDensity
  busy:            boolean
}) {
  const occupants = useMemo(
    () => board.seats.filter(s => s.kind === "SEAT" && s.usableForExam && seatByRoomSeat.has(s.roomSeatId)).length,
    [board.seats, seatByRoomSeat],
  )
  // Group seats by row for the visual grid
  const byRow = useMemo(() => {
    const m = new Map<number, typeof board.seats>()
    for (const s of board.seats) {
      if (!m.has(s.row)) m.set(s.row, [])
      m.get(s.row)!.push(s)
    }
    return [...m.entries()].sort(([a], [b]) => a - b)
  }, [board])

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/40">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <DoorOpen className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{board.roomName}</p>
          <p className="text-[10px] text-slate-400 font-medium">
            {board.effectiveSeats} usable · {board.seats.filter(s => s.kind === "SEAT").length} physical · {density.toLowerCase()} density
          </p>
        </div>
        <Select value={density} onValueChange={(v: string) => onDensityChange(v as RoomDensity)} disabled={busy}>
          <SelectTrigger className="h-7 w-[120px] text-[10px] bg-white border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FULL"        className="text-xs">Full</SelectItem>
            <SelectItem value="HALF"        className="text-xs">Half</SelectItem>
            <SelectItem value="ALTERNATING" className="text-xs">Alternating</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={occupants === 0}
              title={occupants === 0 ? "Assign seats first" : "Print this room"}
              className={cn(
                "h-7 px-2 rounded-md text-[10px] font-bold border cursor-pointer flex items-center gap-1",
                occupants === 0
                  ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-primary/5 hover:border-primary/30",
              )}
            >
              <Printer className="w-3 h-3" /> Print
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Print {board.roomName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openSeatPrint(examId, scheduleId, { roomIds: [board.roomId], mode: "both" })}
              className="cursor-pointer gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-500" /> Map + Roster
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSeatPrint(examId, scheduleId, { roomIds: [board.roomId], mode: "map" })}
              className="cursor-pointer gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-violet-600" /> Seat map only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSeatPrint(examId, scheduleId, { roomIds: [board.roomId], mode: "roster" })}
              className="cursor-pointer gap-2 text-xs">
              <Users className="w-3.5 h-3.5 text-emerald-600" /> Roster only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-3">
        <div className="text-center text-[9px] font-black uppercase tracking-widest text-slate-300 mb-2">
          ↑ Front of room
        </div>
        <div className="space-y-1.5">
          {byRow.map(([rowNum, rowSeats]) => (
            <div key={rowNum} className="flex items-center justify-center gap-1.5">
              <span className="text-[9px] font-mono font-bold text-slate-300 tabular-nums w-5 text-right">
                R{rowNum}
              </span>
              {rowSeats.map(s => (
                <SeatCell
                  key={s.roomSeatId}
                  seat={s}
                  occupant={seatByRoomSeat.get(s.roomSeatId)}
                  classColor={classColor}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Single seat cell — droppable (target). If occupied, also wraps a draggable student chip ─

function SeatCell({
  seat, occupant, classColor,
}: {
  seat:       { roomSeatId: string; row: number; col: number; kind: "SEAT" | "AISLE" | "TEACHER_DESK"; label: string | null; usableForExam: boolean }
  occupant:   SeatRow | undefined
  classColor: Map<string, string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: seat.roomSeatId, disabled: !seat.usableForExam })

  if (seat.kind === "AISLE") {
    return (
      <div
        className="w-12 h-12 rounded-md flex items-center justify-center text-slate-300"
        title="Aisle"
      >
        <Footprints className="w-3 h-3" />
      </div>
    )
  }
  if (seat.kind === "TEACHER_DESK") {
    return (
      <div
        className="w-12 h-12 rounded-md flex items-center justify-center bg-violet-50 border-2 border-violet-200 text-violet-600"
        title="Teacher desk"
      >
        <BookOpen className="w-3 h-3" />
      </div>
    )
  }

  // SEAT
  const isSkipped = !seat.usableForExam   // excluded by density or examUsable=false
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-12 h-12 rounded-md border-2 flex items-center justify-center text-[9px] font-bold transition-all relative",
        isSkipped
          ? "bg-slate-50 border-slate-200 text-slate-300"
          : occupant
            ? "border-slate-300"
            : "bg-white border-dashed border-slate-300 hover:border-primary/40",
        isOver && !isSkipped && "ring-2 ring-primary/40",
      )}
      style={isSkipped ? {
        backgroundImage: "repeating-linear-gradient(45deg, rgba(148,163,184,0.10) 0 4px, transparent 4px 8px)",
      } : undefined}
      title={
        isSkipped ? "Skipped by density / excluded" :
        occupant  ? `${occupant.studentName} · ${occupant.className}` :
        `Empty seat (row ${seat.row}, col ${seat.col})`
      }
    >
      {occupant ? (
        <DraggableStudentChip seat={occupant} classColor={classColor} />
      ) : isSkipped ? (
        <span className="text-[8px] opacity-50">✕</span>
      ) : (
        <span className="text-slate-200 tabular-nums">{seat.row}·{seat.col}</span>
      )}
    </div>
  )
}

function DraggableStudentChip({
  seat, classColor,
}: {
  seat:       SeatRow
  classColor: Map<string, string>
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: seat.id })
  const colorClasses = classColor.get(seat.classId) ?? "from-slate-50 to-slate-100 border-slate-200 text-slate-700"
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={cn(
        "absolute inset-0 rounded cursor-grab active:cursor-grabbing bg-gradient-to-br p-1 flex flex-col items-center justify-center leading-none",
        colorClasses,
        isDragging && "opacity-30",
      )}
    >
      <span className="text-[9px] font-black truncate w-full text-center">
        {initialsOf(seat.studentName)}
      </span>
      <span className="text-[8px] font-mono tabular-nums opacity-80 truncate w-full text-center">
        {seat.rollNumber ?? "—"}
      </span>
    </div>
  )
}

function StudentChipStatic({
  seat, classColor, ghost,
}: {
  seat:       SeatRow
  classColor: Map<string, string>
  ghost?:     boolean
}) {
  const colorClasses = classColor.get(seat.classId) ?? "from-slate-50 to-slate-100 border-slate-200 text-slate-700"
  return (
    <div className={cn(
      "rounded-md border-2 bg-gradient-to-br p-1.5 flex flex-col items-center justify-center w-14 h-14 shadow-lg",
      colorClasses,
      ghost && "rotate-3",
    )}>
      <span className="text-[10px] font-black">{initialsOf(seat.studentName)}</span>
      <span className="text-[9px] font-mono tabular-nums opacity-80">{seat.rollNumber ?? "—"}</span>
    </div>
  )
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("")
}

function EmptyBoards() {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-dashed border-slate-200 p-12 text-center">
      <Plus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="font-bold text-base text-slate-800 mb-1">Pick rooms for this sitting</p>
      <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
        Click <strong>Pick Rooms</strong> above to choose which halls host this paper.
        For each room you can set its density — <span className="font-mono">FULL</span>,
        {" "}<span className="font-mono">HALF</span>, or <span className="font-mono">ALTERNATING</span> —
        before auto-assigning students.
      </p>
    </div>
  )
}
