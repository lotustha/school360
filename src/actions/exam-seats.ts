"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type SeatStrategy =
  | "ROLL_ASC"
  | "ALTERNATING_CLASS"
  | "MIXED_FACULTY"
  | "RANDOM_SEEDED"

export type RoomDensity = "FULL" | "HALF" | "ALTERNATING"

export interface EligibleStudent {
  id:           string
  fullName:     string
  admissionNo:  string
  rollNumber:   string | null
  classId:      string
  className:    string
  facultyId:    string | null
  facultyName:  string | null
  avatarUrl:    string | null
}

export interface SeatRow {
  id:           string
  roomId:       string
  roomSeatId:   string
  studentId:    string
  studentName:  string
  admissionNo:  string
  rollNumber:   string | null
  classId:      string
  className:    string
  facultyId:    string | null
  row:          number
  col:          number
}

export interface RoomBoardSeat {
  roomSeatId:   string
  row:          number
  col:          number
  kind:         "SEAT" | "AISLE" | "TEACHER_DESK"
  label:        string | null
  /** True only when SEAT && examUsable && (density allows it for this position) */
  usableForExam: boolean
}

export interface RoomBoard {
  scheduleRoomId: string
  roomId:         string
  roomName:       string
  density:        RoomDensity
  seats:          RoomBoardSeat[]
  /** Count of usable-for-exam seats under the current density */
  effectiveSeats: number
  rowCount:       number
}

export interface ScheduleScope {
  scheduleId:   string
  paperId:      string
  paperName:    string
  dateBS:       string
  startTime:    string
  durationMin:  number
}

// ──────────────────────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────────────────────

/** Return the scope summary for a schedule. */
export async function getScheduleScope(
  scheduleId: string,
  schoolId:   string,
): Promise<ScheduleScope | null> {
  const sched = await prisma.examSchedule.findFirst({
    where:  { id: scheduleId, paper: { schoolId } },
    include: { paper: { select: { id: true, schoolId: true, subjectName: true, durationMin: true } } },
  })
  if (!sched) return null
  return {
    scheduleId:  sched.id,
    paperId:     sched.paperId,
    paperName:   sched.paper.subjectName,
    dateBS:      sched.dateBS,
    startTime:   sched.startTime,
    durationMin: sched.durationMin ?? sched.paper.durationMin,
  }
}

/** All students eligible to sit a paper — derived from paper.targets (class+subject). */
export async function listEligibleStudents(
  paperId:  string,
  schoolId: string,
): Promise<EligibleStudent[]> {
  // Find the paper's targets (which classes' students are eligible)
  const paper = await prisma.examPaper.findFirst({
    where:  { id: paperId, schoolId },
    include: { targets: { select: { classId: true } } },
  })
  if (!paper) return []
  const classIds = [...new Set(paper.targets.map(t => t.classId))]
  if (classIds.length === 0) return []

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      classId: { in: classIds },
      status:  { in: ["ACTIVE", "SUSPENDED"] },
    },
    include: {
      user:  { select: { fullName: true, avatarUrl: true } },
      class: { include: { faculty: { select: { id: true, name: true } } } },
    },
    orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }, { admissionNo: "asc" }],
  })

  return students.map(s => ({
    id:           s.id,
    fullName:     s.user.fullName,
    admissionNo:  s.admissionNo,
    rollNumber:   s.rollNumber,
    classId:      s.classId,
    className:    s.class.name,
    facultyId:    s.class.faculty?.id   ?? null,
    facultyName:  s.class.faculty?.name ?? null,
    avatarUrl:    s.user.avatarUrl,
  }))
}

/** Rooms picked for this schedule + their resolved seat layout under the chosen density. */
export async function getScheduleBoards(
  scheduleId: string,
  schoolId:   string,
): Promise<RoomBoard[]> {
  const sched = await prisma.examSchedule.findFirst({
    where:  { id: scheduleId, paper: { schoolId } },
    include: {
      rooms: {
        include: {
          room: {
            include: { seats: { orderBy: [{ row: "asc" }, { col: "asc" }] } },
          },
        },
        orderBy: { room: { name: "asc" } },
      },
    },
  })
  if (!sched) return []
  return sched.rooms.map(sr => buildBoard(sr.id, sr.room.id, sr.room.name, sr.density as RoomDensity, sr.room.seats))
}

/** Existing seat assignments for this schedule. */
export async function listSeatsForSchedule(
  scheduleId: string,
  schoolId:   string,
): Promise<SeatRow[]> {
  const seats = await prisma.examSeat.findMany({
    where: { scheduleId, paper: { schoolId } },
    include: {
      room:     { select: { id: true, name: true } },
      roomSeat: { select: { id: true, row: true, col: true } },
      student: {
        include: {
          user:  { select: { fullName: true } },
          class: { select: { id: true, name: true, facultyId: true } },
        },
      },
    },
    orderBy: [{ room: { name: "asc" } }, { roomSeat: { row: "asc" } }, { roomSeat: { col: "asc" } }],
  })
  return seats.map(s => ({
    id:          s.id,
    roomId:      s.roomId,
    roomSeatId:  s.roomSeatId,
    studentId:   s.studentId,
    studentName: s.student.user.fullName,
    admissionNo: s.student.admissionNo,
    rollNumber:  s.student.rollNumber,
    classId:     s.student.class.id,
    className:   s.student.class.name,
    facultyId:   s.student.class.facultyId,
    row:         s.roomSeat.row,
    col:         s.roomSeat.col,
  }))
}

// ──────────────────────────────────────────────────────────────────────────────
// Room picker
// ──────────────────────────────────────────────────────────────────────────────

export async function setScheduleRooms(
  scheduleId: string,
  schoolId:   string,
  rooms:      { roomId: string; density: RoomDensity }[],
) {
  // Verify schedule belongs to this school
  const sched = await prisma.examSchedule.findFirst({
    where:  { id: scheduleId, paper: { schoolId } },
    select: { id: true, paperId: true, paper: { select: { examId: true } } },
  })
  if (!sched) throw new Error("Schedule not found")

  // Verify every roomId is in this school
  if (rooms.length > 0) {
    const roomIds = rooms.map(r => r.roomId)
    const owned = await prisma.room.findMany({
      where:  { id: { in: roomIds }, schoolId },
      select: { id: true },
    })
    if (owned.length !== roomIds.length) throw new Error("One or more rooms are not in this school")
  }

  // Replace-all using a transaction. If a room is being removed and has seats
  // already assigned for this schedule, refuse.
  const existing = await prisma.examScheduleRoom.findMany({
    where:  { scheduleId },
    select: { id: true, roomId: true, density: true },
  })
  const desiredIds = new Set(rooms.map(r => r.roomId))
  const toRemove   = existing.filter(e => !desiredIds.has(e.roomId))

  if (toRemove.length > 0) {
    const refs = await prisma.examSeat.count({
      where: { scheduleId, roomId: { in: toRemove.map(r => r.roomId) } },
    })
    if (refs > 0) {
      throw new Error(
        `Cannot remove ${toRemove.length} room(s): ${refs} student(s) already seated there. Clear those seats first.`,
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.examScheduleRoom.deleteMany({ where: { id: { in: toRemove.map(r => r.id) } } })
    }
    for (const r of rooms) {
      const ex = existing.find(e => e.roomId === r.roomId)
      if (ex) {
        if (ex.density !== r.density) {
          await tx.examScheduleRoom.update({
            where: { id: ex.id },
            data:  { density: r.density },
          })
        }
      } else {
        await tx.examScheduleRoom.create({
          data: { scheduleId, roomId: r.roomId, density: r.density },
        })
      }
    }
  })

  revalidatePath(`/academics/exams/${sched.paper.examId}/seats/${scheduleId}`)
}

export async function clearScheduleSeats(scheduleId: string, schoolId: string) {
  const sched = await prisma.examSchedule.findFirst({
    where:  { id: scheduleId, paper: { schoolId } },
    select: { id: true, paper: { select: { examId: true } } },
  })
  if (!sched) throw new Error("Schedule not found")
  await prisma.examSeat.deleteMany({ where: { scheduleId } })
  revalidatePath(`/academics/exams/${sched.paper.examId}/seats/${scheduleId}`)
}

// ──────────────────────────────────────────────────────────────────────────────
// Auto-assign
// ──────────────────────────────────────────────────────────────────────────────

export interface AutoAssignResult {
  assigned:    number
  shortfall:   number    // students that couldn't be seated
  effectiveSeats: number
}

export async function autoAssignSeats(input: {
  scheduleId: string
  schoolId:   string
  strategy:   SeatStrategy
  seed?:      number
}): Promise<AutoAssignResult> {
  const { scheduleId, schoolId, strategy } = input

  const sched = await prisma.examSchedule.findFirst({
    where:  { id: scheduleId, paper: { schoolId } },
    select: { id: true, paperId: true, paper: { select: { examId: true } } },
  })
  if (!sched) throw new Error("Schedule not found")

  const [boards, students, existing] = await Promise.all([
    getScheduleBoards(scheduleId, schoolId),
    listEligibleStudents(sched.paperId, schoolId),
    prisma.examSeat.findMany({ where: { scheduleId }, select: { roomSeatId: true, studentId: true } }),
  ])

  // Linear list of (roomId, roomSeatId) for usable seats in pick order
  const allUsable: { roomId: string; roomSeatId: string }[] = []
  for (const b of boards) {
    for (const s of b.seats) {
      if (s.usableForExam) allUsable.push({ roomId: b.roomId, roomSeatId: s.roomSeatId })
    }
  }
  const totalUsable = allUsable.length

  // Order students per strategy
  const seed = input.seed ?? hashString(scheduleId)
  const ordered = orderStudentsByStrategy(students, strategy, seed)

  // Wipe + bulk insert
  const toInsert = ordered.slice(0, totalUsable).map((s, i) => ({
    scheduleId,
    paperId:    sched.paperId,
    roomId:     allUsable[i].roomId,
    roomSeatId: allUsable[i].roomSeatId,
    studentId:  s.id,
  }))

  await prisma.$transaction(async (tx) => {
    await tx.examSeat.deleteMany({ where: { scheduleId } })
    if (toInsert.length > 0) {
      await tx.examSeat.createMany({ data: toInsert })
    }
  })

  // Silence unused-var linter on existing
  void existing

  revalidatePath(`/academics/exams/${sched.paper.examId}/seats/${scheduleId}`)
  return {
    assigned:       toInsert.length,
    shortfall:      Math.max(0, students.length - totalUsable),
    effectiveSeats: totalUsable,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Manual DnD overrides
// ──────────────────────────────────────────────────────────────────────────────

/** Swap two existing seats by id (both must belong to the same schedule + school). */
export async function swapSeats(
  aSeatId:  string,
  bSeatId:  string,
  schoolId: string,
) {
  const both = await prisma.examSeat.findMany({
    where: { id: { in: [aSeatId, bSeatId] }, paper: { schoolId } },
  })
  if (both.length !== 2) throw new Error("Both seats must exist in this school")
  if (both[0].scheduleId !== both[1].scheduleId) throw new Error("Cannot swap across schedules")

  const a = both.find(x => x.id === aSeatId)!
  const b = both.find(x => x.id === bSeatId)!

  await prisma.$transaction(async (tx) => {
    // Drop both rows then re-insert with swapped roomSeatId/roomId.
    await tx.examSeat.deleteMany({ where: { id: { in: [a.id, b.id] } } })
    await tx.examSeat.createMany({
      data: [
        {
          scheduleId: a.scheduleId, paperId: a.paperId,
          studentId:  a.studentId,
          roomId:     b.roomId, roomSeatId: b.roomSeatId,
        },
        {
          scheduleId: b.scheduleId, paperId: b.paperId,
          studentId:  b.studentId,
          roomId:     a.roomId, roomSeatId: a.roomSeatId,
        },
      ],
    })
  })

  const sched = await prisma.examSchedule.findUnique({
    where:  { id: a.scheduleId },
    select: { paper: { select: { examId: true } } },
  })
  if (sched) revalidatePath(`/academics/exams/${sched.paper.examId}/seats/${a.scheduleId}`)
}

/** Move a student (by seatId) to an empty target seat, OR swap with whoever sits there. */
export async function moveOrSwap(
  seatId:        string,
  toRoomSeatId:  string,
  schoolId:      string,
) {
  const me = await prisma.examSeat.findFirst({
    where:  { id: seatId, paper: { schoolId } },
    select: {
      id: true, scheduleId: true, paperId: true, studentId: true, roomId: true, roomSeatId: true,
      paper: { select: { examId: true } },
    },
  })
  if (!me) throw new Error("Seat not found")

  const target = await prisma.roomSeat.findFirst({
    where:  { id: toRoomSeatId, room: { schoolId } },
    select: { id: true, roomId: true, kind: true, examUsable: true },
  })
  if (!target)                  throw new Error("Target seat not found")
  if (target.kind !== "SEAT")   throw new Error("Target is not a seat")
  if (!target.examUsable)       throw new Error("Target seat is excluded from exams")

  const sr = await prisma.examScheduleRoom.findFirst({
    where:  { scheduleId: me.scheduleId, roomId: target.roomId },
    select: { id: true },
  })
  if (!sr) throw new Error("Target room is not part of this sitting")

  const occupant = await prisma.examSeat.findUnique({
    where:  { scheduleId_roomSeatId: { scheduleId: me.scheduleId, roomSeatId: toRoomSeatId } },
    select: { id: true },
  })

  if (occupant) {
    await swapSeats(me.id, occupant.id, schoolId)
  } else {
    await prisma.examSeat.update({
      where: { id: me.id },
      data:  { roomId: target.roomId, roomSeatId: toRoomSeatId },
    })
    revalidatePath(`/academics/exams/${me.paper.examId}/seats/${me.scheduleId}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Pure helpers (no `prisma`, no `revalidatePath`)
// ──────────────────────────────────────────────────────────────────────────────

function buildBoard(
  scheduleRoomId: string,
  roomId:         string,
  roomName:       string,
  density:        RoomDensity,
  seats:          { id: string; row: number; col: number; kind: string; label: string | null; examUsable: boolean }[],
): RoomBoard {
  // Result rows in the same order as input
  const out: RoomBoardSeat[] = seats.map(s => ({
    roomSeatId:    s.id,
    row:           s.row,
    col:           s.col,
    kind:          (s.kind as "SEAT" | "AISLE" | "TEACHER_DESK"),
    label:         s.label,
    usableForExam: false,
  }))

  // Walk linearly; for SEAT && examUsable apply density rule.
  // Density modes:
  //   FULL        — every physically-usable seat
  //   HALF        — every other usable seat (anti-collusion strip)
  //   ALTERNATING — like HALF but offset per row (no two students vertically adjacent)
  let globalUsableIdx = -1
  let perRowUsable    = -1
  let lastRow         = -1
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i]
    const usable = s.kind === "SEAT" && s.examUsable
    if (!usable) continue
    globalUsableIdx++
    if (s.row !== lastRow) {
      lastRow = s.row
      perRowUsable = 0
    } else {
      perRowUsable++
    }

    let take = false
    if (density === "FULL") {
      take = true
    } else if (density === "HALF") {
      take = globalUsableIdx % 2 === 0
    } else {
      // ALTERNATING — odd row starts at usable index 0, even row starts at 1
      const parity = (s.row - 1) % 2
      take = perRowUsable % 2 === parity
    }
    out[i].usableForExam = take
  }

  const effective = out.filter(x => x.usableForExam).length
  const rowCount  = seats.reduce((m, s) => Math.max(m, s.row), 0)
  return {
    scheduleRoomId,
    roomId,
    roomName,
    density,
    seats: out,
    effectiveSeats: effective,
    rowCount,
  }
}

function orderStudentsByStrategy(
  students: EligibleStudent[],
  strategy: SeatStrategy,
  seed:     number,
): EligibleStudent[] {
  switch (strategy) {
    case "ROLL_ASC":
      return [...students].sort((a, b) => {
        if (a.className !== b.className) return a.className.localeCompare(b.className)
        const ar = a.rollNumber ?? ""
        const br = b.rollNumber ?? ""
        if (ar !== br) return ar.localeCompare(br, undefined, { numeric: true })
        return a.fullName.localeCompare(b.fullName)
      })
    case "ALTERNATING_CLASS": {
      const byClass = new Map<string, EligibleStudent[]>()
      const ordered = [...students].sort((a, b) => {
        const ar = a.rollNumber ?? ""
        const br = b.rollNumber ?? ""
        return ar.localeCompare(br, undefined, { numeric: true })
      })
      for (const s of ordered) {
        if (!byClass.has(s.classId)) byClass.set(s.classId, [])
        byClass.get(s.classId)!.push(s)
      }
      const lanes = [...byClass.values()]
      const out: EligibleStudent[] = []
      let idx = 0
      while (out.length < students.length) {
        const lane = lanes[idx % lanes.length]
        if (lane.length > 0) out.push(lane.shift()!)
        idx++
        // Stop loop guard
        if (idx > students.length * 10) break
      }
      return out
    }
    case "MIXED_FACULTY": {
      // Group by faculty, then interleave faculties round-robin; inside each faculty,
      // round-robin by class.
      const byFaculty = new Map<string, EligibleStudent[]>()
      const arranged = orderStudentsByStrategy(students, "ALTERNATING_CLASS", seed)
      for (const s of arranged) {
        const k = s.facultyId ?? "_general_"
        if (!byFaculty.has(k)) byFaculty.set(k, [])
        byFaculty.get(k)!.push(s)
      }
      const lanes = [...byFaculty.values()]
      const out: EligibleStudent[] = []
      let idx = 0
      while (out.length < students.length) {
        const lane = lanes[idx % lanes.length]
        if (lane.length > 0) out.push(lane.shift()!)
        idx++
        if (idx > students.length * 10) break
      }
      return out
    }
    case "RANDOM_SEEDED": {
      const rng = mulberry32(seed)
      const out = [...students]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    }
  }
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
