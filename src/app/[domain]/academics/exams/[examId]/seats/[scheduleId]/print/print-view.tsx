"use client"

import { useEffect, useMemo } from "react"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import type { RoomBoard, SeatRow } from "@/actions/exam-seats"

export type SeatPrintMode = "map" | "roster" | "both"

interface Props {
  schoolName:  string
  paperName:   string
  dateBS:      string
  startTime:   string
  durationMin: number
  boards:      RoomBoard[]
  seats:       SeatRow[]
  mode:        SeatPrintMode
  examId:      string
}

export function SeatPrintView({
  schoolName, paperName, dateBS, startTime, durationMin, boards, seats, mode, examId,
}: Props) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [])

  // Index seats by (roomId, roomSeatId) for fast lookup
  const seatByRoomSeat = useMemo(() => {
    const m = new Map<string, SeatRow>()
    for (const s of seats) m.set(s.roomSeatId, s)
    return m
  }, [seats])

  return (
    <>
      <style jsx global>{`
        @page { size: A4 portrait; margin: 10mm 8mm 12mm 8mm; }
        @page :landscape { size: A4 landscape; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          /* Hide global app chrome: sidebar + page header (tabs/breadcrumb). */
          aside,
          [data-slot="sidebar"],
          [data-slot="sidebar-container"],
          [data-slot="sidebar-gap"],
          header { display: none !important; }
          [data-slot="sidebar-inset"] {
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          main { padding: 0 !important; background: white !important; }
          .print-shell { background: white !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
          .print-shell .backdrop-blur-xl { backdrop-filter: none !important; }
          .print-shell tr { page-break-inside: avoid; }
          .print-shell .map-page    { page-break-after: always; page: portrait;  }
          .print-shell .roster-page { page-break-after: always; page: landscape; }
          .print-shell .map-page:last-child,
          .print-shell .roster-page:last-child { page-break-after: auto; }
          .print-shell .signature-cell { height: 28pt; }
          .print-shell table { font-size: 9.5pt !important; }
          .print-shell th, .print-shell td { border-color: #475569 !important; }
        }
        .print-shell { background: #f8fafc; padding: 16px; }
      `}</style>

      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.close()}
              className="gap-1.5 text-xs cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Close
            </Button>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {boards.length} room{boards.length === 1 ? "" : "s"} · mode: <span className="text-slate-700 normal-case">{modeLabel(mode)}</span>
            </span>
            {/* dev convenience link, not printed */}
            <span className="text-[10px] text-slate-300 hidden sm:inline">examId: {examId.slice(0, 8)}…</span>
          </div>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="print-shell">
        {boards.length === 0 && (
          <div className="max-w-[1400px] mx-auto p-12 text-center bg-white border border-dashed border-slate-300 rounded-xl">
            <p className="text-sm font-semibold text-slate-500">No rooms in this scope.</p>
          </div>
        )}

        {boards.map(b => (
          <RoomSection
            key={b.roomId}
            board={b}
            seatByRoomSeat={seatByRoomSeat}
            schoolName={schoolName}
            paperName={paperName}
            dateBS={dateBS}
            startTime={startTime}
            durationMin={durationMin}
            mode={mode}
          />
        ))}
      </div>
    </>
  )
}

// ─── Per-room printable sections ────────────────────────────────────────

function RoomSection({
  board, seatByRoomSeat, schoolName, paperName, dateBS, startTime, durationMin, mode,
}: {
  board:          RoomBoard
  seatByRoomSeat: Map<string, SeatRow>
  schoolName:     string
  paperName:      string
  dateBS:         string
  startTime:      string
  durationMin:    number
  mode:           SeatPrintMode
}) {
  const occupants = board.seats
    .filter(s => s.kind === "SEAT" && s.usableForExam)
    .map(s => ({ seat: s, occupant: seatByRoomSeat.get(s.roomSeatId) }))
    .filter(x => x.occupant)

  return (
    <>
      {(mode === "map" || mode === "both") && (
        <section className="map-page max-w-[820px] mx-auto mb-6">
          <PrintHeader
            schoolName={schoolName} title="Seat Map"
            paperName={paperName} roomName={board.roomName}
            dateBS={dateBS} startTime={startTime} durationMin={durationMin}
          />
          <SeatMapGrid board={board} seatByRoomSeat={seatByRoomSeat} />
        </section>
      )}

      {(mode === "roster" || mode === "both") && (
        <section className="roster-page max-w-[1400px] mx-auto mb-6">
          <PrintHeader
            schoolName={schoolName} title="Hall Roster"
            paperName={paperName} roomName={board.roomName}
            dateBS={dateBS} startTime={startTime} durationMin={durationMin}
          />
          <RosterTable occupants={occupants.map(o => o.occupant!)} />
        </section>
      )}
    </>
  )
}

function PrintHeader({
  schoolName, title, paperName, roomName, dateBS, startTime, durationMin,
}: {
  schoolName:  string
  title:       string
  paperName:   string
  roomName:    string
  dateBS:      string
  startTime:   string
  durationMin: number
}) {
  return (
    <div className="border-b-2 border-slate-800 pb-2 mb-3 flex items-baseline justify-between gap-4">
      <div>
        <h1 className="text-base font-black text-slate-900">{schoolName}</h1>
        <p className="text-[11px] text-slate-600 font-semibold">
          {title} · <span className="font-mono">{roomName}</span> · {paperName}
        </p>
      </div>
      <p className="text-[10px] text-slate-600 font-mono tabular-nums">
        {formatBS(dateBS)} · {startTime} · {durationMin}min
      </p>
    </div>
  )
}

// ─── Visual seat map (portrait) ─────────────────────────────────────────

function SeatMapGrid({
  board, seatByRoomSeat,
}: {
  board:          RoomBoard
  seatByRoomSeat: Map<string, SeatRow>
}) {
  const byRow = useMemo(() => {
    const m = new Map<number, typeof board.seats>()
    for (const s of board.seats) {
      if (!m.has(s.row)) m.set(s.row, [])
      m.get(s.row)!.push(s)
    }
    return [...m.entries()].sort(([a], [b]) => a - b)
  }, [board])

  return (
    <div className="bg-white border border-slate-300 rounded p-4">
      <div className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-300 pb-1 mb-3">
        ↑ Front of Room
      </div>
      <div className="space-y-1.5">
        {byRow.map(([rowNum, rowSeats]) => (
          <div key={rowNum} className="flex items-center justify-center gap-1.5">
            <span className="text-[9px] font-mono font-bold text-slate-400 tabular-nums w-5 text-right">
              R{rowNum}
            </span>
            {rowSeats.map(s => {
              if (s.kind === "AISLE") {
                return <div key={s.roomSeatId} className="w-[70px] h-[44px] flex items-center justify-center text-[9px] text-slate-300">·</div>
              }
              if (s.kind === "TEACHER_DESK") {
                return (
                  <div key={s.roomSeatId} className="w-[70px] h-[44px] rounded border-2 border-slate-400 bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600">
                    Teacher
                  </div>
                )
              }
              const occupant = seatByRoomSeat.get(s.roomSeatId)
              const skipped  = !s.usableForExam
              return (
                <div key={s.roomSeatId}
                  className={cn(
                    "w-[70px] h-[44px] rounded border flex flex-col items-center justify-center px-1 py-0.5",
                    skipped
                      ? "border-slate-200 bg-slate-50 text-slate-300"
                      : occupant
                        ? "border-slate-700 bg-white"
                        : "border-dashed border-slate-300 bg-white",
                  )}
                >
                  {occupant ? (
                    <>
                      <span className="text-[9px] font-bold text-slate-800 truncate leading-tight w-full text-center">
                        {occupant.rollNumber ?? "—"}
                      </span>
                      <span className="text-[8px] font-mono tabular-nums text-slate-500 truncate w-full text-center">
                        {occupant.admissionNo}
                      </span>
                      <span className="text-[8px] text-slate-400 truncate w-full text-center">
                        {occupant.className}
                      </span>
                    </>
                  ) : skipped ? (
                    <span className="text-[8px]">✕</span>
                  ) : (
                    <span className="text-[8px] text-slate-300 tabular-nums">{s.row}·{s.col}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Hall roster table (landscape) ──────────────────────────────────────

function RosterTable({ occupants }: { occupants: SeatRow[] }) {
  if (occupants.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded p-6 text-center text-xs text-slate-400 italic">
        No students seated in this room.
      </div>
    )
  }
  // Sort by (row, col) so the roster reads in the same order students sit
  const sorted = [...occupants].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  return (
    <table className="w-full border-collapse bg-white text-xs">
      <thead>
        <tr className="bg-slate-100/80">
          <Th width="w-8">#</Th>
          <Th width="w-12">Seat</Th>
          <Th width="w-28">Adm No</Th>
          <Th width="w-16">Roll</Th>
          <Th>Name</Th>
          <Th width="w-40">Class</Th>
          <Th width="w-48">Student signature</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((o, i) => (
          <tr key={o.id} className="border-b border-slate-200">
            <Td className="text-slate-400 tabular-nums">{i + 1}</Td>
            <Td className="font-mono tabular-nums text-slate-600">R{o.row}·C{o.col}</Td>
            <Td className="font-mono tabular-nums">{o.admissionNo}</Td>
            <Td className="font-mono tabular-nums">{o.rollNumber ?? "—"}</Td>
            <Td className="font-bold text-slate-800">{o.studentName}</Td>
            <Td className="text-slate-600">{o.className}</Td>
            <Td className="signature-cell" />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Th({ children, width }: { children?: React.ReactNode; width?: string }) {
  return (
    <th className={cn(
      "text-left px-2 py-1.5 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-700",
      width,
    )}>{children}</th>
  )
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn("px-2 py-1.5 border border-slate-300 align-top", className)}>{children}</td>
  )
}

function modeLabel(m: SeatPrintMode): string {
  return m === "map" ? "Seat map" : m === "roster" ? "Roster" : "Map + Roster"
}
