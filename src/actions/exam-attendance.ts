"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "DEBARRED"

const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "DEBARRED"]

export interface AttendanceRow {
  studentId:    string
  studentName:  string
  admissionNo:  string
  rollNumber:   string | null
  className:    string
  row:          number
  col:          number
  status:       AttendanceStatus
  note:         string | null
}

export interface AttendanceScope {
  scheduleId:  string
  paperId:     string
  paperName:   string
  dateBS:      string
  startTime:   string
  durationMin: number
  roomId:      string
  roomName:    string
}

// ──────────────────────────────────────────────────────────────────────────────
// Read
// ──────────────────────────────────────────────────────────────────────────────

export async function getRoomAttendance(
  scheduleId: string,
  roomId:     string,
  schoolId:   string,
): Promise<{ scope: AttendanceScope; rows: AttendanceRow[] } | null> {
  // Verify scope
  const sched = await prisma.examSchedule.findFirst({
    where:  { id: scheduleId, paper: { schoolId } },
    include: {
      paper:  { select: { id: true, schoolId: true, subjectName: true, durationMin: true } },
      rooms:  { where: { roomId }, include: { room: true }, take: 1 },
    },
  })
  if (!sched)                  return null
  if (sched.rooms.length === 0) return null
  const room = sched.rooms[0].room

  // Seated students (from ExamSeat) + their RoomSeat coords
  const seats = await prisma.examSeat.findMany({
    where: { scheduleId, roomId },
    include: {
      roomSeat: { select: { row: true, col: true } },
      student: {
        include: {
          user:  { select: { fullName: true } },
          class: { select: { name: true } },
        },
      },
    },
    orderBy: [{ roomSeat: { row: "asc" } }, { roomSeat: { col: "asc" } }],
  })

  // Existing attendance rows for this room+schedule
  const existing = await prisma.examRoomAttendance.findMany({
    where:  { scheduleId, roomId },
    select: { studentId: true, status: true, note: true },
  })
  const byStudent = new Map(existing.map(r => [r.studentId, { status: r.status as AttendanceStatus, note: r.note }]))

  const rows: AttendanceRow[] = seats.map(s => ({
    studentId:   s.studentId,
    studentName: s.student.user.fullName,
    admissionNo: s.student.admissionNo,
    rollNumber:  s.student.rollNumber,
    className:   s.student.class.name,
    row:         s.roomSeat.row,
    col:         s.roomSeat.col,
    status:      byStudent.get(s.studentId)?.status ?? "PRESENT",
    note:        byStudent.get(s.studentId)?.note   ?? null,
  }))

  return {
    scope: {
      scheduleId:  sched.id,
      paperId:     sched.paper.id,
      paperName:   sched.paper.subjectName,
      dateBS:      sched.dateBS,
      startTime:   sched.startTime,
      durationMin: sched.durationMin ?? sched.paper.durationMin,
      roomId:      room.id,
      roomName:    room.name,
    },
    rows,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────────────────

export async function setAttendance(
  input: {
    scheduleId: string
    roomId:     string
    schoolId:   string
    markedById: string
    marks:      { studentId: string; status: AttendanceStatus; note?: string | null }[]
  },
): Promise<{ saved: number }> {
  // Scope check
  const sched = await prisma.examSchedule.findFirst({
    where:  { id: input.scheduleId, paper: { schoolId: input.schoolId } },
    select: { id: true, paperId: true, paper: { select: { examId: true, schoolId: true } } },
  })
  if (!sched) throw new Error("Schedule not found")

  // Verify each student is actually seated here
  if (input.marks.length === 0) return { saved: 0 }
  const studentIds = input.marks.map(m => m.studentId)
  const seated = await prisma.examSeat.findMany({
    where:  { scheduleId: input.scheduleId, roomId: input.roomId, studentId: { in: studentIds } },
    select: { studentId: true },
  })
  const seatedSet = new Set(seated.map(s => s.studentId))
  const invalid = input.marks.filter(m => !seatedSet.has(m.studentId))
  if (invalid.length > 0) {
    throw new Error(`${invalid.length} student(s) are not seated in this room`)
  }

  await prisma.$transaction(async (tx) => {
    for (const m of input.marks) {
      // Validate status
      if (!STATUSES.includes(m.status)) throw new Error(`Invalid status: ${m.status}`)

      await tx.examRoomAttendance.upsert({
        where:  { scheduleId_studentId: { scheduleId: input.scheduleId, studentId: m.studentId } },
        create: {
          scheduleId: input.scheduleId,
          paperId:    sched.paperId,
          roomId:     input.roomId,
          studentId:  m.studentId,
          status:     m.status,
          note:       m.note ?? null,
          markedById: input.markedById,
        },
        update: {
          status:     m.status,
          note:       m.note ?? null,
          markedById: input.markedById,
        },
      })

      // Mirror ABSENT into TerminalExamScore.isAbsent (idempotent)
      // The score may not exist yet — we only upsert when it does (the
      // mark-entry flow elsewhere will reflect this when it loads).
      // We use updateMany so a missing row is a no-op rather than an error.
      const rawSubject = await tx.examPaperTarget.findFirst({
        where:  { paperId: sched.paperId, class: { students: { some: { id: m.studentId } } } },
        select: { subjectId: true },
      })
      if (rawSubject) {
        await tx.terminalExamScore.updateMany({
          where: {
            examId:    sched.paper.examId,
            studentId: m.studentId,
            subjectId: rawSubject.subjectId,
          },
          data: { isAbsent: m.status === "ABSENT" },
        })
      }
    }
  })

  revalidatePath(`/academics/exams/${sched.paper.examId}/attendance/${input.scheduleId}/${input.roomId}`)
  revalidatePath(`/academics/exams/${sched.paper.examId}/attendance`)
  return { saved: input.marks.length }
}

export async function bulkMarkAll(input: {
  scheduleId: string
  roomId:     string
  schoolId:   string
  markedById: string
  status:     AttendanceStatus
}): Promise<{ saved: number }> {
  // Load all seated students
  const seats = await prisma.examSeat.findMany({
    where:  { scheduleId: input.scheduleId, roomId: input.roomId, paper: { schoolId: input.schoolId } },
    select: { studentId: true },
  })
  if (seats.length === 0) return { saved: 0 }
  return setAttendance({
    scheduleId: input.scheduleId,
    roomId:     input.roomId,
    schoolId:   input.schoolId,
    markedById: input.markedById,
    marks:      seats.map(s => ({ studentId: s.studentId, status: input.status })),
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-exam landing summary
// ──────────────────────────────────────────────────────────────────────────────

export interface AttendanceLandingRow {
  scheduleId:    string
  paperName:     string
  dateBS:        string
  startTime:     string
  roomId:        string
  roomName:      string
  seatedCount:   number
  presentCount:  number
  absentCount:   number
  lateCount:     number
  debarredCount: number
}

export async function listAttendanceSummary(
  examId:   string,
  schoolId: string,
): Promise<AttendanceLandingRow[]> {
  const seats = await prisma.examSeat.findMany({
    where:   { paper: { examId, schoolId } },
    include: {
      schedule: { select: { id: true, dateBS: true, startTime: true, paper: { select: { subjectName: true } } } },
      room:     { select: { id: true, name: true } },
    },
  })
  const seatedMap = new Map<string, { paperName: string; dateBS: string; startTime: string; roomId: string; roomName: string; seated: number }>()
  for (const s of seats) {
    const k = `${s.scheduleId}:${s.roomId}`
    if (!seatedMap.has(k)) {
      seatedMap.set(k, {
        paperName: s.schedule.paper.subjectName,
        dateBS:    s.schedule.dateBS,
        startTime: s.schedule.startTime,
        roomId:    s.room.id,
        roomName:  s.room.name,
        seated:    0,
      })
    }
    seatedMap.get(k)!.seated++
  }

  const att = await prisma.examRoomAttendance.findMany({
    where:  { paper: { examId, schoolId } },
    select: { scheduleId: true, roomId: true, status: true },
  })
  const statMap = new Map<string, { p: number; a: number; l: number; d: number }>()
  for (const a of att) {
    const k = `${a.scheduleId}:${a.roomId}`
    if (!statMap.has(k)) statMap.set(k, { p: 0, a: 0, l: 0, d: 0 })
    const x = statMap.get(k)!
    if      (a.status === "PRESENT")  x.p++
    else if (a.status === "ABSENT")   x.a++
    else if (a.status === "LATE")     x.l++
    else if (a.status === "DEBARRED") x.d++
  }

  const out: AttendanceLandingRow[] = []
  for (const [k, m] of seatedMap.entries()) {
    const [scheduleId] = k.split(":")
    const s = statMap.get(k) ?? { p: 0, a: 0, l: 0, d: 0 }
    out.push({
      scheduleId,
      paperName:     m.paperName,
      dateBS:        m.dateBS,
      startTime:     m.startTime,
      roomId:        m.roomId,
      roomName:      m.roomName,
      seatedCount:   m.seated,
      presentCount:  s.p,
      absentCount:   s.a,
      lateCount:     s.l,
      debarredCount: s.d,
    })
  }
  out.sort((a, b) => {
    if (a.dateBS !== b.dateBS) return a.dateBS.localeCompare(b.dateBS)
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime)
    return a.roomName.localeCompare(b.roomName)
  })
  return out
}
