"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface TeacherOpt {
  id:        string
  fullName:  string
  avatarUrl: string | null
}

export interface InvigilatorScheduleRow {
  scheduleId:   string
  paperId:      string
  paperName:    string
  dateBS:       string
  dateAD:       Date
  startTime:    string
  durationMin:  number
  /** Classes that sit this paper (from ExamPaperTarget) */
  classes:      { classId: string; className: string }[]
  /** Rooms hosting this sitting (from ExamScheduleRoom). Empty if no rooms picked. */
  rooms:        {
    scheduleRoomId: string
    roomId:         string
    roomName:       string
    invigilators:   { id: string; teacherId: string; teacherName: string; avatarUrl: string | null; isPrimary: boolean }[]
  }[]
  /** Day's running invigilators (computed from the schedule's date) */
  runningInvigilators: {
    id:          string
    teacherId:   string
    teacherName: string
    avatarUrl:   string | null
    /** Rooms this running invigilator covers. Empty = covers all rooms in the schedule. */
    roomIds:     string[]
  }[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Read
// ──────────────────────────────────────────────────────────────────────────────

export async function listInvigilatorsForExam(
  examId:   string,
  schoolId: string,
): Promise<InvigilatorScheduleRow[]> {
  // All scheduled papers for this exam
  const papers = await prisma.examPaper.findMany({
    where: { schoolId, examId },
    include: {
      schedules: {
        orderBy: [{ dateAD: "asc" }, { startTime: "asc" }],
        include: {
          rooms: {
            include: {
              room: { select: { id: true, name: true } },
            },
            orderBy: { room: { name: "asc" } },
          },
          invigilators: {
            include: { teacher: { select: { id: true, fullName: true, avatarUrl: true } } },
            orderBy: { isPrimary: "desc" },
          },
          runningInvigilators: {
            include: { teacher: { select: { id: true, fullName: true, avatarUrl: true } } },
          },
        },
      },
      targets: {
        include: { class: { select: { id: true, name: true } } },
      },
    },
  })

  const out: InvigilatorScheduleRow[] = []
  for (const p of papers) {
    for (const s of p.schedules) {
      out.push({
        scheduleId:  s.id,
        paperId:     p.id,
        paperName:   p.subjectName,
        dateBS:      s.dateBS,
        dateAD:      s.dateAD,
        startTime:   s.startTime,
        durationMin: s.durationMin ?? p.durationMin,
        classes:     [...new Map(p.targets.map(t => [t.classId, { classId: t.classId, className: t.class.name }])).values()],
        rooms:       s.rooms.map(sr => ({
          scheduleRoomId: sr.id,
          roomId:         sr.room.id,
          roomName:       sr.room.name,
          invigilators:   s.invigilators.filter(i => i.roomId === sr.room.id).map(i => ({
            id:          i.id,
            teacherId:   i.teacherId,
            teacherName: i.teacher.fullName,
            avatarUrl:   i.teacher.avatarUrl,
            isPrimary:   i.isPrimary,
          })),
        })),
        runningInvigilators: s.runningInvigilators.map(r => ({
          id:          r.id,
          teacherId:   r.teacherId,
          teacherName: r.teacher.fullName,
          avatarUrl:   r.teacher.avatarUrl,
          roomIds:     r.roomIds,
        })),
      })
    }
  }
  out.sort((a, b) => {
    const ad = a.dateAD.getTime?.() ?? new Date(a.dateAD).getTime()
    const bd = b.dateAD.getTime?.() ?? new Date(b.dateAD).getTime()
    if (ad !== bd) return ad - bd
    return a.startTime.localeCompare(b.startTime)
  })
  return out
}

export async function listTeachers(schoolId: string): Promise<TeacherOpt[]> {
  const rows = await prisma.user.findMany({
    where:   { schoolId, role: { in: ["TEACHER", "STAFF", "SCHOOL_ADMIN"] } },
    select:  { id: true, fullName: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
  })
  return rows
}

// ──────────────────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────────────────

/**
 * For a given (examId, dateBS), returns the set of teacher ids already assigned
 * to ANY room (excluding the current room) or as a running invigilator on any
 * schedule that day. Used to enforce: one teacher = one duty per date.
 */
async function getOtherDateAssignments(args: {
  schoolId:        string
  examId:          string
  dateBS:          string
  excludeScheduleId?: string
  excludeRoomId?:     string
}) {
  const schedules = await prisma.examSchedule.findMany({
    where:  {
      dateBS:  args.dateBS,
      paper:   { schoolId: args.schoolId, examId: args.examId },
    },
    select: { id: true },
  })
  const scheduleIds = schedules.map(s => s.id)
  if (scheduleIds.length === 0) return new Set<string>()

  const [rooms, running] = await Promise.all([
    prisma.examRoomInvigilator.findMany({
      where: {
        scheduleId: { in: scheduleIds },
        ...(args.excludeScheduleId && args.excludeRoomId
          ? { NOT: { scheduleId: args.excludeScheduleId, roomId: args.excludeRoomId } }
          : {}),
      },
      select: { teacherId: true },
    }),
    prisma.examRunningInvigilator.findMany({
      where:  {
        scheduleId: { in: scheduleIds },
        ...(args.excludeScheduleId ? { NOT: { scheduleId: args.excludeScheduleId } } : {}),
      },
      select: { teacherId: true },
    }),
  ])

  return new Set<string>([...rooms.map(r => r.teacherId), ...running.map(r => r.teacherId)])
}

export async function setRoomInvigilators(
  scheduleId:  string,
  roomId:      string,
  schoolId:    string,
  teacherIds:  string[],
) {
  // Scope check: schedule → paper → school
  const sched = await prisma.examSchedule.findFirst({
    where:  { id: scheduleId, paper: { schoolId } },
    select: { id: true, dateBS: true, paper: { select: { examId: true } } },
  })
  if (!sched) throw new Error("Schedule not found")

  // Scope check: room belongs to school AND is part of this schedule
  const sr = await prisma.examScheduleRoom.findFirst({
    where:  { scheduleId, roomId, room: { schoolId } },
    select: { id: true },
  })
  if (!sr) throw new Error("Room is not part of this sitting")

  // Exclusivity: reject if any teacherId already has an assignment elsewhere on this date.
  const taken = await getOtherDateAssignments({
    schoolId,
    examId:            sched.paper.examId,
    dateBS:            sched.dateBS,
    excludeScheduleId: scheduleId,
    excludeRoomId:     roomId,
  })
  const conflicts = teacherIds.filter(t => taken.has(t))
  if (conflicts.length > 0) {
    throw new Error(`Teacher already assigned to another room or as running invigilator today (${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"})`)
  }

  // Replace-all
  await prisma.$transaction(async (tx) => {
    await tx.examRoomInvigilator.deleteMany({ where: { scheduleId, roomId } })
    if (teacherIds.length > 0) {
      await tx.examRoomInvigilator.createMany({
        data: teacherIds.map((tid, i) => ({
          scheduleId, roomId, teacherId: tid, isPrimary: i === 0,
        })),
      })
    }
  })

  revalidatePath(`/academics/exams/${sched.paper.examId}/invigilators`)
}

export async function setRunningInvigilators(
  scheduleId: string,
  schoolId:   string,
  assignments: { teacherId: string; roomIds: string[] }[],
) {
  const sched = await prisma.examSchedule.findFirst({
    where:  { id: scheduleId, paper: { schoolId } },
    select: { id: true, dateBS: true, paper: { select: { examId: true } } },
  })
  if (!sched) throw new Error("Schedule not found")

  // Exclusivity: a teacher set as room invigilator on this date can't be running.
  const taken = await getOtherDateAssignments({
    schoolId,
    examId:            sched.paper.examId,
    dateBS:            sched.dateBS,
    excludeScheduleId: scheduleId,
  })
  const conflicts = assignments.filter(a => taken.has(a.teacherId)).map(a => a.teacherId)
  if (conflicts.length > 0) {
    throw new Error(`Teacher already assigned elsewhere today (${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"})`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.examRunningInvigilator.deleteMany({ where: { scheduleId } })
    if (assignments.length > 0) {
      await Promise.all(assignments.map(a =>
        tx.examRunningInvigilator.create({
          data: { scheduleId, teacherId: a.teacherId, roomIds: a.roomIds },
        }),
      ))
    }
  })

  revalidatePath(`/academics/exams/${sched.paper.examId}/invigilators`)
}

// ──────────────────────────────────────────────────────────────────────────────
// Auto-assign for a day
// ──────────────────────────────────────────────────────────────────────────────
//
// Rules:
//   HARD: a teacher whose own subject is being examined today is excluded from
//         room invigilation (they're at the school anyway → moved to the
//         running-invigilator suggestion list).
//   SOFT: prefer NOT to put a teacher in a room hosting a class they teach.
//   ROTATION: weight by how many rooms the teacher has already been assigned to
//             across the entire exam (lowest first).

export interface AutoAssignResult {
  assigned:           number
  rooms:              number
  runningCandidates:  string[]   // teacher ids suggested as running invigilators
}

export async function autoAssignInvigilators(input: {
  examId:                       string
  schoolId:                     string
  dateBS:                       string
  invigilatorsPerRoom?:         number   // default 1
  excludeOwnClass?:             boolean  // default true
  setRunningFromExaminedToday?: boolean  // default true
}): Promise<AutoAssignResult> {
  const perRoom              = input.invigilatorsPerRoom         ?? 1
  const excludeOwnClass      = input.excludeOwnClass             ?? true
  const setRunningSuggestion = input.setRunningFromExaminedToday ?? true

  // Verify exam belongs to school
  const exam = await prisma.exam.findFirst({
    where:  { id: input.examId, schoolId: input.schoolId },
    select: { id: true },
  })
  if (!exam) throw new Error("Exam not found")

  // Today's schedules
  const todaysSchedules = await prisma.examSchedule.findMany({
    where: {
      dateBS:  input.dateBS,
      paper:   { schoolId: input.schoolId, examId: input.examId },
    },
    include: {
      paper:   { include: { targets: { include: { subject: true, class: true } } } },
      rooms:   { include: { room: true } },
    },
  })

  // HARD-excluded teachers: anyone who teaches a subject examined today
  // (collected from SubjectTeacher for the subjects in today's papers)
  const todaysSubjectIds = [
    ...new Set(todaysSchedules.flatMap(s => s.paper.targets.map(t => t.subjectId))),
  ]
  const todaysClassIds = [
    ...new Set(todaysSchedules.flatMap(s => s.paper.targets.map(t => t.classId))),
  ]

  const examinedTodayTeachers = todaysSubjectIds.length === 0
    ? new Set<string>()
    : new Set(
        (await prisma.subjectTeacher.findMany({
          where:  { subjectId: { in: todaysSubjectIds } },
          select: { teacherUserId: true },
        })).map(r => r.teacherUserId),
      )

  // Eligible teacher pool = all school TEACHER/STAFF/SCHOOL_ADMIN NOT in examined-today set
  const allTeachers = await prisma.user.findMany({
    where:  { schoolId: input.schoolId, role: { in: ["TEACHER", "STAFF", "SCHOOL_ADMIN"] } },
    select: { id: true, fullName: true },
  })
  const eligible = allTeachers.filter(t => !examinedTodayTeachers.has(t.id))
  if (eligible.length === 0) {
    return { assigned: 0, rooms: 0, runningCandidates: [...examinedTodayTeachers] }
  }

  // Rotation: count existing invigilator assignments across the ENTIRE exam for each teacher
  const rotationCounts = new Map<string, number>()
  const examTeachers = await prisma.examRoomInvigilator.groupBy({
    by:     ["teacherId"],
    where:  { schedule: { paper: { examId: input.examId } } },
    _count: { _all: true },
  })
  for (const r of examTeachers) rotationCounts.set(r.teacherId, r._count._all)

  // Own-class hint: which classes does each teacher teach?
  const teachersOwnClasses = new Map<string, Set<string>>()
  if (excludeOwnClass) {
    const ct = await prisma.class.findMany({
      where:  { classTeacherId: { not: null }, schoolId: input.schoolId },
      select: { id: true, classTeacherId: true },
    })
    for (const c of ct) {
      if (!c.classTeacherId) continue
      if (!teachersOwnClasses.has(c.classTeacherId)) teachersOwnClasses.set(c.classTeacherId, new Set())
      teachersOwnClasses.get(c.classTeacherId)!.add(c.id)
    }
    // Also: subject teachers whose subjects sit in those classes today
    const st = await prisma.subjectTeacher.findMany({
      where:  { subject: { classId: { in: todaysClassIds } } },
      include: { subject: { select: { classId: true } } },
    })
    for (const s of st) {
      if (!teachersOwnClasses.has(s.teacherUserId)) teachersOwnClasses.set(s.teacherUserId, new Set())
      teachersOwnClasses.get(s.teacherUserId)!.add(s.subject.classId)
    }
  }

  // Assign per (schedule, room). Per-slot busy-set prevents the same teacher
  // being assigned to two overlapping rooms within the same schedule.
  let assignedTotal = 0
  let roomsTotal    = 0

  for (const s of todaysSchedules) {
    if (s.rooms.length === 0) continue
    const schedAssigned = new Set<string>()

    // Wipe existing for this schedule first (replace-all per auto-assign run)
    await prisma.examRoomInvigilator.deleteMany({ where: { scheduleId: s.id } })

    for (const sr of s.rooms) {
      // The classes in this schedule (paper.targets → classIds)
      const roomClasses = new Set(s.paper.targets.map(t => t.classId))

      // Score the pool
      const scored = eligible
        .filter(t => !schedAssigned.has(t.id))
        .map(t => {
          const rot     = rotationCounts.get(t.id)            ?? 0
          const ownCls  = teachersOwnClasses.get(t.id)        ?? new Set()
          const conflict = excludeOwnClass && [...ownCls].some(cid => roomClasses.has(cid))
          const score   = rot * 10 + (conflict ? 100 : 0) + Math.random() * 0.01
          return { id: t.id, score }
        })
        .sort((a, b) => a.score - b.score)

      const picks = scored.slice(0, perRoom).map(x => x.id)
      if (picks.length === 0) continue

      await prisma.examRoomInvigilator.createMany({
        data: picks.map((tid, i) => ({
          scheduleId: s.id,
          roomId:     sr.roomId,
          teacherId:  tid,
          isPrimary:  i === 0,
        })),
      })

      // Update local counters
      for (const tid of picks) {
        schedAssigned.add(tid)
        rotationCounts.set(tid, (rotationCounts.get(tid) ?? 0) + 1)
      }
      assignedTotal += picks.length
      roomsTotal++
    }

    // Auto-set running invigilators from examined-today teachers, if requested
    if (setRunningSuggestion) {
      await prisma.examRunningInvigilator.deleteMany({ where: { scheduleId: s.id } })
      if (examinedTodayTeachers.size > 0) {
        await prisma.examRunningInvigilator.createMany({
          data: [...examinedTodayTeachers].map(tid => ({ scheduleId: s.id, teacherId: tid })),
        })
      }
    }
  }

  revalidatePath(`/academics/exams/${input.examId}/invigilators`)
  return {
    assigned:          assignedTotal,
    rooms:             roomsTotal,
    runningCandidates: [...examinedTodayTeachers],
  }
}
