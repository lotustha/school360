"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ─── Shared types (exported for client components) ─────────────────────────

export type SeatKind = "SEAT" | "AISLE" | "TEACHER_DESK"

export interface RoomSeatInput {
  kind:       SeatKind
  label?:     string | null
  examUsable: boolean
}

export interface RoomSeatRow {
  id:         string
  row:        number
  col:        number
  kind:       SeatKind
  label:      string | null
  examUsable: boolean
}

export interface RoomRow {
  id:            string
  name:          string
  notes:         string | null
  isActive:      boolean
  capacity:      number   // physical: count of kind="SEAT"
  examCapacity:  number   // exam-usable: SEAT && examUsable
  classCount:    number
  examSeatCount: number   // existing exam seat assignments (deletion safety)
}

export interface RoomDetail extends RoomRow {
  rowCount: number
  seats:    RoomSeatRow[]
}

// ─── Queries ───────────────────────────────────────────────────────────────

export async function listRooms(schoolId: string): Promise<RoomRow[]> {
  const rooms = await prisma.room.findMany({
    where:   { schoolId },
    include: {
      seats:     { select: { kind: true, examUsable: true } },
      _count:    { select: { classes: true, examSeats: true } },
    },
    orderBy: { name: "asc" },
  })
  return rooms.map(r => {
    const seats        = r.seats.filter(s => s.kind === "SEAT")
    const examUsable   = seats.filter(s => s.examUsable)
    return {
      id:            r.id,
      name:          r.name,
      notes:         r.notes,
      isActive:      r.isActive,
      capacity:      seats.length,
      examCapacity:  examUsable.length,
      classCount:    r._count.classes,
      examSeatCount: r._count.examSeats,
    }
  })
}

export async function getRoomWithSeats(roomId: string, schoolId: string): Promise<RoomDetail | null> {
  const room = await prisma.room.findFirst({
    where:   { id: roomId, schoolId },
    include: {
      seats:  { orderBy: [{ row: "asc" }, { col: "asc" }] },
      _count: { select: { classes: true, examSeats: true } },
    },
  })
  if (!room) return null

  const seats: RoomSeatRow[] = room.seats.map(s => ({
    id:         s.id,
    row:        s.row,
    col:        s.col,
    kind:       (s.kind as SeatKind),
    label:      s.label,
    examUsable: s.examUsable,
  }))
  const rowCount         = seats.reduce((m, s) => Math.max(m, s.row), 0)
  const physicalSeats    = seats.filter(s => s.kind === "SEAT")
  return {
    id:            room.id,
    name:          room.name,
    notes:         room.notes,
    isActive:      room.isActive,
    capacity:      physicalSeats.length,
    examCapacity:  physicalSeats.filter(s => s.examUsable).length,
    rowCount,
    classCount:    room._count.classes,
    examSeatCount: room._count.examSeats,
    seats,
  }
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export async function createRoom(input: {
  schoolId: string
  name:     string
  notes?:   string | null
}): Promise<{ id: string }> {
  const name = input.name.trim()
  if (!name) throw new Error("Name is required")
  const room = await prisma.room.create({
    data: {
      schoolId: input.schoolId,
      name,
      notes:    input.notes?.trim() || null,
      isActive: true,
    },
  })
  revalidatePath("/settings/rooms")
  return { id: room.id }
}

export async function updateRoom(
  id: string,
  schoolId: string,
  patch: { name?: string; notes?: string | null; isActive?: boolean },
) {
  // Scope check
  const owns = await prisma.room.findFirst({ where: { id, schoolId }, select: { id: true } })
  if (!owns) throw new Error("Room not found")

  await prisma.room.update({
    where: { id },
    data: {
      ...(patch.name     !== undefined && { name:     patch.name.trim() }),
      ...(patch.notes    !== undefined && { notes:    patch.notes?.trim() || null }),
      ...(patch.isActive !== undefined && { isActive: patch.isActive }),
    },
  })
  revalidatePath("/settings/rooms")
  revalidatePath(`/settings/rooms/${id}`)
}

// Duplicate the full configuration (name + notes + seat layout) into a NEW room.
// Returns the new room's id so callers can navigate straight into its editor.
export async function duplicateRoom(
  sourceId: string,
  schoolId: string,
  newName?: string,
): Promise<{ id: string; name: string }> {
  const source = await prisma.room.findFirst({
    where:  { id: sourceId, schoolId },
    include: { seats: { orderBy: [{ row: "asc" }, { col: "asc" }] } },
  })
  if (!source) throw new Error("Source room not found")

  // Generate a unique name. Honour caller's preference, else "<source> (copy)" + counter.
  const desired = (newName?.trim() || `${source.name} (copy)`).slice(0, 60)
  const taken   = new Set(
    (await prisma.room.findMany({
      where:  { schoolId, name: { startsWith: desired.replace(/ \(\d+\)$/, "") } },
      select: { name: true },
    })).map(r => r.name),
  )
  let finalName = desired
  let n = 2
  while (taken.has(finalName)) {
    finalName = `${desired} (${n})`
    n++
  }

  const created = await prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        schoolId,
        name:     finalName,
        notes:    source.notes,
        isActive: true,
      },
    })
    if (source.seats.length > 0) {
      await tx.roomSeat.createMany({
        data: source.seats.map(s => ({
          roomId:     room.id,
          row:        s.row,
          col:        s.col,
          kind:       s.kind,
          label:      s.label,
          examUsable: s.examUsable,
        })),
      })
    }
    return room
  })

  revalidatePath("/settings/rooms")
  return { id: created.id, name: finalName }
}

// Replace the target room's layout with the source room's layout. Same diff
// safety as setRoomLayout — refuses to drop seats that have ExamSeat references.
export async function copyLayoutFromRoom(
  targetId: string,
  schoolId: string,
  sourceId: string,
): Promise<{ added: number; removed: number; kept: number }> {
  if (targetId === sourceId) throw new Error("Source and target are the same room")
  const source = await prisma.room.findFirst({
    where:  { id: sourceId, schoolId },
    include: { seats: { orderBy: [{ row: "asc" }, { col: "asc" }] } },
  })
  if (!source) throw new Error("Source room not found")
  if (source.seats.length === 0) throw new Error("Source room has no seats to copy")

  // Reshape source seats into the (row → seats[]) shape setRoomLayout expects.
  const rowsMap = new Map<number, { kind: SeatKind; label: string | null; examUsable: boolean }[]>()
  for (const s of source.seats) {
    if (!rowsMap.has(s.row)) rowsMap.set(s.row, [])
    rowsMap.get(s.row)!.push({
      kind:       (s.kind as SeatKind),
      label:      s.label,
      examUsable: s.examUsable,
    })
  }
  const sortedRowKeys = [...rowsMap.keys()].sort((a, b) => a - b)
  const rows = sortedRowKeys.map(k => ({ seats: rowsMap.get(k)! }))

  return setRoomLayout(targetId, schoolId, rows)
}

export async function deleteRoom(id: string, schoolId: string) {
  const room = await prisma.room.findFirst({
    where:  { id, schoolId },
    select: { id: true, _count: { select: { classes: true, examSeats: true } } },
  })
  if (!room) throw new Error("Room not found")
  if (room._count.classes > 0 || room._count.examSeats > 0) {
    throw new Error(
      `Cannot delete: room is used by ${room._count.classes} class(es) and ${room._count.examSeats} exam seat assignment(s). Disable it instead.`,
    )
  }
  await prisma.room.delete({ where: { id } })
  revalidatePath("/settings/rooms")
}

// ─── Layout (seat) replace-all ─────────────────────────────────────────────
//
// The editor sends the full intended layout. We diff against existing RoomSeat
// rows by (row, col) so IDs are preserved where positions match — this matters
// because existing ExamSeat rows reference RoomSeat.id.
//
// Rejects: deleting a seat that still has an exam-seat assignment.

export async function setRoomLayout(
  roomId:   string,
  schoolId: string,
  rows:     { seats: RoomSeatInput[] }[],
): Promise<{ added: number; removed: number; kept: number }> {
  const owns = await prisma.room.findFirst({
    where:   { id: roomId, schoolId },
    include: { seats: true },
  })
  if (!owns) throw new Error("Room not found")

  // Build the desired set keyed by (row, col)
  type Desired = { row: number; col: number; kind: SeatKind; label: string | null; examUsable: boolean }
  const desired: Desired[] = []
  rows.forEach((r, rowIdx) => {
    r.seats.forEach((s, colIdx) => {
      desired.push({
        row:        rowIdx + 1,
        col:        colIdx + 1,
        kind:       s.kind,
        label:      s.label?.trim() || null,
        // Only SEAT-kind respects examUsable; aisles/desks default to false (irrelevant anyway).
        examUsable: s.kind === "SEAT" ? s.examUsable : false,
      })
    })
  })

  const existingByKey = new Map(owns.seats.map(s => [`${s.row}:${s.col}`, s]))
  const desiredKeys   = new Set(desired.map(d => `${d.row}:${d.col}`))

  // Determine which seats will be removed
  const toRemove = owns.seats.filter(s => !desiredKeys.has(`${s.row}:${s.col}`))
  if (toRemove.length > 0) {
    const refsCount = await prisma.examSeat.count({
      where: { roomSeatId: { in: toRemove.map(s => s.id) } },
    })
    if (refsCount > 0) {
      throw new Error(
        `Cannot shrink layout: ${refsCount} exam seat assignment(s) reference seats you're removing. Clear those exam seatings first.`,
      )
    }
  }

  let added = 0, kept = 0
  await prisma.$transaction(async (tx) => {
    // Delete removed seats
    if (toRemove.length > 0) {
      await tx.roomSeat.deleteMany({ where: { id: { in: toRemove.map(s => s.id) } } })
    }
    // Upsert each desired seat
    for (const d of desired) {
      const ex = existingByKey.get(`${d.row}:${d.col}`)
      if (ex) {
        // Update only if changed
        if (
          ex.kind !== d.kind ||
          (ex.label ?? null) !== d.label ||
          ex.examUsable !== d.examUsable
        ) {
          await tx.roomSeat.update({
            where: { id: ex.id },
            data:  { kind: d.kind, label: d.label, examUsable: d.examUsable },
          })
        }
        kept++
      } else {
        await tx.roomSeat.create({
          data: {
            roomId,
            row:        d.row,
            col:        d.col,
            kind:       d.kind,
            label:      d.label,
            examUsable: d.examUsable,
          },
        })
        added++
      }
    }
  })

  revalidatePath("/settings/rooms")
  revalidatePath(`/settings/rooms/${roomId}`)
  return { added, removed: toRemove.length, kept }
}
