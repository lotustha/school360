"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ─── PeriodSchedule (time-slot templates) ───────────────────────────────────

export async function listSchedules(schoolId: string) {
  return prisma.periodSchedule.findMany({
    where:   { schoolId },
    include: {
      _count: { select: { slots: true, classes: true } },
      slots:  { orderBy: { orderIndex: "asc" }, select: { id: true, label: true, startTime: true, endTime: true, isBreak: true } },
      classes: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function getSchedule(id: string) {
  return prisma.periodSchedule.findUnique({
    where:   { id },
    include: {
      slots:   { orderBy: { orderIndex: "asc" } },
      classes: { select: { id: true, name: true } },
    },
  })
}

export async function createSchedule(data: {
  schoolId:    string
  name:        string
  description?: string
}) {
  const s = await prisma.periodSchedule.create({
    data: {
      schoolId:    data.schoolId,
      name:        data.name,
      description: data.description ?? null,
    },
  })
  revalidatePath("/academics/routine")
  return s
}

export async function updateSchedule(id: string, data: {
  name?:        string
  description?: string
}) {
  await prisma.periodSchedule.update({
    where: { id },
    data: {
      ...(data.name        !== undefined && { name:        data.name        }),
      ...(data.description !== undefined && { description: data.description }),
    },
  })
  revalidatePath("/academics/routine")
}

export async function deleteSchedule(id: string) {
  const adopters = await prisma.class.count({ where: { periodScheduleId: id } })
  if (adopters > 0) {
    throw new Error(`Cannot delete: ${adopters} class${adopters === 1 ? "" : "es"} use this schedule.`)
  }
  await prisma.periodSchedule.delete({ where: { id } })
  revalidatePath("/academics/routine")
}

// ─── Period slots: merge-by-id editor ───────────────────────────────────────

export type SlotInput = {
  id?:        string
  startTime:  string  // "HH:MM"
  endTime:    string
  label:      string
  isBreak:    boolean
}

export async function setScheduleSlots(scheduleId: string, slots: SlotInput[]) {
  if (slots.length === 0) {
    throw new Error("Schedule needs at least one slot")
  }
  // Basic validation
  for (const s of slots) {
    if (!/^\d{2}:\d{2}$/.test(s.startTime) || !/^\d{2}:\d{2}$/.test(s.endTime)) {
      throw new Error(`Invalid time format for "${s.label}". Use HH:MM.`)
    }
    if (!s.label.trim()) throw new Error("Every slot needs a label")
    if (s.startTime >= s.endTime) {
      throw new Error(`"${s.label}": end time must be after start time`)
    }
  }

  await prisma.$transaction(async tx => {
    const existing = await tx.periodSlot.findMany({
      where:  { scheduleId },
      select: { id: true },
    })
    const existingIds = new Set(existing.map(s => s.id))
    const incomingIds = new Set(slots.map(s => s.id).filter((x): x is string => Boolean(x)))

    const toDelete = [...existingIds].filter(eid => !incomingIds.has(eid))
    if (toDelete.length > 0) {
      // Two-step to avoid temporarily-violating @@unique([scheduleId, orderIndex])
      await tx.periodSlot.deleteMany({ where: { id: { in: toDelete } } })
    }

    // Shift surviving rows out of the way before re-inserting at final indices.
    // We use negative orderIndex during the staging phase so the unique
    // constraint isn't violated when two existing rows trade places.
    await tx.periodSlot.updateMany({
      where: { scheduleId, id: { in: [...existingIds].filter(eid => incomingIds.has(eid)) } },
      data:  { orderIndex: { decrement: 1000 } },
    })

    for (const [idx, s] of slots.entries()) {
      if (s.id && existingIds.has(s.id)) {
        await tx.periodSlot.update({
          where: { id: s.id },
          data: {
            orderIndex: idx,
            startTime:  s.startTime,
            endTime:    s.endTime,
            label:      s.label,
            isBreak:    s.isBreak,
          },
        })
      } else {
        await tx.periodSlot.create({
          data: {
            scheduleId,
            orderIndex: idx,
            startTime:  s.startTime,
            endTime:    s.endTime,
            label:      s.label,
            isBreak:    s.isBreak,
          },
        })
      }
    }
  })

  revalidatePath("/academics/routine")
}

// ─── Apply schedule to many classes ─────────────────────────────────────────

export async function applyScheduleToClasses(scheduleId: string, classIds: string[]) {
  if (classIds.length === 0) return { applied: 0, warnings: [] as string[] }
  // Warn about classes whose existing routine entries reference slots from a
  // different schedule (those entries will orphan since their periodSlotId
  // still points at the old schedule's slots).
  const conflicts = await prisma.routineEntry.findMany({
    where: {
      classId:    { in: classIds },
      periodSlot: { scheduleId: { not: scheduleId } },
    },
    select: { classId: true, class: { select: { name: true } } },
    distinct: ["classId"],
  })
  const warnings = conflicts.map(c => `${c.class.name} has existing routine entries from a different schedule that will become orphaned.`)

  await prisma.class.updateMany({
    where: { id: { in: classIds } },
    data:  { periodScheduleId: scheduleId },
  })
  revalidatePath("/academics/routine")
  revalidatePath("/academics/classes")
  return { applied: classIds.length, warnings }
}

// ─── Class routine fetch (full grid) ────────────────────────────────────────

export async function getClassRoutine(classId: string) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      school:         { select: { id: true, workingDays: true } },
      periodSchedule: {
        include: { slots: { orderBy: { orderIndex: "asc" } } },
      },
      routineEntries: {
        include: {
          subject:      { select: { id: true, name: true, code: true } },
          teacher:      { select: { id: true, fullName: true } },
          studentGroup: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!cls) return null

  // Bucket entries by (slotId, dayOfWeek) → entry[]
  const entries: Record<string, typeof cls.routineEntries> = {}
  for (const e of cls.routineEntries) {
    const key = `${e.periodSlotId}:${e.dayOfWeek}`
    if (!entries[key]) entries[key] = []
    entries[key].push(e)
  }

  return {
    class:          { id: cls.id, name: cls.name, classroom: cls.classroom, periodScheduleId: cls.periodScheduleId },
    workingDays:    cls.school.workingDays,
    schedule:       cls.periodSchedule,
    slots:          cls.periodSchedule?.slots ?? [],
    entries,
  }
}

// ─── Routine entry CRUD + conflict detection ────────────────────────────────

export type ConflictItem = {
  id:           string
  class:        { id: string; name: string }
  subject:      { id: string; name: string } | null
  studentGroup: { id: string; name: string } | null
}

/**
 * Find routine entries that would conflict with assigning `teacherUserId` to
 * a (slot, day) cell. Entries sharing the same `studentGroupId` are treated
 * as one joint session and excluded from the result.
 */
export async function checkTeacherConflicts(args: {
  teacherUserId:    string
  periodSlotId:     string
  dayOfWeek:        number
  studentGroupId?:  string | null
  excludeEntryId?:  string
}): Promise<ConflictItem[]> {
  const sameSlotDay = await prisma.routineEntry.findMany({
    where: {
      teacherUserId: args.teacherUserId,
      periodSlotId:  args.periodSlotId,
      dayOfWeek:     args.dayOfWeek,
      ...(args.excludeEntryId && { id: { not: args.excludeEntryId } }),
    },
    include: {
      class:        { select: { id: true, name: true } },
      subject:      { select: { id: true, name: true } },
      studentGroup: { select: { id: true, name: true } },
    },
  })
  // Filter out entries that share the same studentGroupId (joint session)
  return sameSlotDay.filter(e => {
    if (args.studentGroupId == null) return true
    return e.studentGroupId !== args.studentGroupId
  })
}

export type SetRoutineEntryResult =
  | { ok: true }
  | { ok: false; reason: "TEACHER_CONFLICT"; conflicts: ConflictItem[] }

export async function setRoutineEntry(args: {
  classId:               string
  periodSlotId:          string
  dayOfWeek:             number
  subjectId?:            string | null
  teacherUserId?:        string | null
  studentGroupId?:       string | null
  note?:                 string | null
  acknowledgeConflicts?: boolean
}): Promise<SetRoutineEntryResult> {
  // Conflict check (only if a teacher is assigned)
  if (args.teacherUserId && !args.acknowledgeConflicts) {
    const conflicts = await checkTeacherConflicts({
      teacherUserId:  args.teacherUserId,
      periodSlotId:   args.periodSlotId,
      dayOfWeek:      args.dayOfWeek,
      studentGroupId: args.studentGroupId ?? null,
    })
    if (conflicts.length > 0) return { ok: false, reason: "TEACHER_CONFLICT", conflicts }
  }

  const existing = await prisma.routineEntry.findFirst({
    where: {
      classId:        args.classId,
      periodSlotId:   args.periodSlotId,
      dayOfWeek:      args.dayOfWeek,
      studentGroupId: args.studentGroupId ?? null,
    },
    select: { id: true },
  })

  if (existing) {
    await prisma.routineEntry.update({
      where: { id: existing.id },
      data: {
        subjectId:     args.subjectId     ?? null,
        teacherUserId: args.teacherUserId ?? null,
        note:          args.note          ?? null,
      },
    })
  } else {
    await prisma.routineEntry.create({
      data: {
        classId:        args.classId,
        periodSlotId:   args.periodSlotId,
        dayOfWeek:      args.dayOfWeek,
        subjectId:      args.subjectId      ?? null,
        teacherUserId:  args.teacherUserId  ?? null,
        studentGroupId: args.studentGroupId ?? null,
        note:           args.note           ?? null,
      },
    })
  }

  revalidatePath(`/academics/routine/${args.classId}`)
  return { ok: true }
}

export async function clearRoutineEntry(entryId: string) {
  const entry = await prisma.routineEntry.findUnique({ where: { id: entryId }, select: { classId: true } })
  await prisma.routineEntry.delete({ where: { id: entryId } })
  if (entry) revalidatePath(`/academics/routine/${entry.classId}`)
}

export type MoveRoutineEntryResult =
  | { ok: true }
  | { ok: false; reason: "TEACHER_CONFLICT"; conflicts: ConflictItem[] }
  | { ok: false; reason: "CELL_OCCUPIED" }

export async function moveRoutineEntry(args: {
  entryId:               string
  toPeriodSlotId:        string
  toDayOfWeek:           number
  acknowledgeConflicts?: boolean
}): Promise<MoveRoutineEntryResult> {
  const entry = await prisma.routineEntry.findUnique({ where: { id: args.entryId } })
  if (!entry) throw new Error("Routine entry not found")

  if (entry.teacherUserId && !args.acknowledgeConflicts) {
    const conflicts = await checkTeacherConflicts({
      teacherUserId:   entry.teacherUserId,
      periodSlotId:    args.toPeriodSlotId,
      dayOfWeek:       args.toDayOfWeek,
      studentGroupId:  entry.studentGroupId,
      excludeEntryId:  entry.id,
    })
    if (conflicts.length > 0) return { ok: false, reason: "TEACHER_CONFLICT", conflicts }
  }

  const collision = await prisma.routineEntry.findFirst({
    where: {
      classId:        entry.classId,
      periodSlotId:   args.toPeriodSlotId,
      dayOfWeek:      args.toDayOfWeek,
      studentGroupId: entry.studentGroupId,
      id:             { not: entry.id },
    },
    select: { id: true },
  })
  if (collision) return { ok: false, reason: "CELL_OCCUPIED" }

  await prisma.routineEntry.update({
    where: { id: entry.id },
    data:  { periodSlotId: args.toPeriodSlotId, dayOfWeek: args.toDayOfWeek },
  })
  revalidatePath(`/academics/routine/${entry.classId}`)
  return { ok: true }
}

// ─── Teacher availability across all classes ───────────────────────────────

/**
 * Returns every `RoutineEntry` for a teacher across the school. Useful for the
 * routine grid heatmap: cells where this teacher is busy elsewhere can be
 * flagged yellow before the user drops a subject.
 *
 * Entries that share the same `studentGroupId` are still returned — the caller
 * decides whether they count as a conflict (different group = conflict, same
 * group = joint session, safe).
 */
export async function getTeacherSchedule(args: {
  teacherUserId:  string
  excludeClassId?: string
}) {
  return prisma.routineEntry.findMany({
    where: {
      teacherUserId: args.teacherUserId,
      ...(args.excludeClassId && { classId: { not: args.excludeClassId } }),
    },
    select: {
      id:              true,
      classId:         true,
      periodSlotId:    true,
      dayOfWeek:       true,
      studentGroupId:  true,
      class:           { select: { id: true, name: true } },
      subject:         { select: { id: true, name: true } },
      studentGroup:    { select: { id: true, name: true } },
    },
  })
}

// ─── Copy entire routine from one class to another ──────────────────────────

export async function copyRoutineFromClass(args: {
  fromClassId: string
  toClassId:   string
}) {
  const [from, to] = await Promise.all([
    prisma.class.findUnique({
      where:   { id: args.fromClassId },
      include: { routineEntries: true },
    }),
    prisma.class.findUnique({
      where:   { id: args.toClassId },
      select:  { id: true, periodScheduleId: true },
    }),
  ])
  if (!from) throw new Error("Source class not found")
  if (!to)   throw new Error("Destination class not found")
  if (!from.periodScheduleId || from.periodScheduleId !== to.periodScheduleId) {
    throw new Error("Source and destination must share the same period schedule")
  }

  // Wipe destination first so the unique composite doesn't collide.
  await prisma.$transaction(async tx => {
    await tx.routineEntry.deleteMany({ where: { classId: args.toClassId } })
    for (const e of from.routineEntries) {
      await tx.routineEntry.create({
        data: {
          classId:        args.toClassId,
          periodSlotId:   e.periodSlotId,
          dayOfWeek:      e.dayOfWeek,
          subjectId:      e.subjectId,
          teacherUserId:  e.teacherUserId,
          studentGroupId: e.studentGroupId,
          note:           e.note,
        },
      })
    }
  })

  revalidatePath(`/academics/routine/${args.toClassId}`)
  return { copied: from.routineEntries.length }
}

// ─── Compact Period × Class overview ────────────────────────────────────────
//
// Returns the matrix needed to render the Period × Class grid. Rows are
// periods (slots from each class's PeriodSchedule), columns are classes
// grouped by Faculty. For each (period × class) cell we list the unique
// (teacher, subject) pairings with the days they occur on (Sun=1..Sat=7).

export interface CompactCellEntry {
  subjectId:        string | null
  subjectName:      string | null
  subjectShortName: string | null
  teacherUserId:    string | null
  teacherName:      string | null
  teacherAvatar:    string | null
  studentGroupId:   string | null
  studentGroupName: string | null
  /** Day-of-week indices where this pairing occurs (0=Sun..6=Sat) */
  days:             number[]
}

export interface CompactClassColumn {
  classId:            string
  className:          string
  classShortName:     string
  facultyId:          string | null
  facultyName:        string | null
  workingDays:        number[]
  periodScheduleId:   string | null
  periodScheduleName: string | null
  /** Period rows for this class. Length matches the class's schedule slots. */
  rows:               {
    slotId:    string
    label:     string | null
    orderIndex: number
    isBreak:   boolean
    startTime: string | null
    endTime:   string | null
    cells:     CompactCellEntry[]
  }[]
}

export async function getCompactRoutineGrid(args: {
  schoolId:        string
  classIds?:       string[]
  facultyIds?:     string[]
  academicYearId?: string
}): Promise<CompactClassColumn[]> {
  const facultyNone     = args.facultyIds?.includes("none") ?? false
  const realFacultyIds  = (args.facultyIds ?? []).filter(id => id !== "none")
  const facultyFilter   =
    realFacultyIds.length > 0 && facultyNone
      ? { OR: [{ facultyId: { in: realFacultyIds } }, { facultyId: null }] }
      : realFacultyIds.length > 0
        ? { facultyId: { in: realFacultyIds } }
        : facultyNone
          ? { facultyId: null }
          : undefined

  // Pull school working days for inheritance fallback
  const school = await prisma.school.findUnique({
    where:  { id: args.schoolId },
    select: { workingDays: true },
  })
  const schoolWorkingDays = school?.workingDays ?? [1, 2, 3, 4, 5]

  const classes = await prisma.class.findMany({
    where: {
      schoolId: args.schoolId,
      ...(args.classIds && args.classIds.length > 0 ? { id: { in: args.classIds } } : {}),
      ...(facultyFilter ?? {}),
    },
    include: {
      faculty: { select: { id: true, name: true, workingDays: true } },
      periodSchedule: {
        include: { slots: { orderBy: { orderIndex: "asc" } } },
      },
      routineEntries: {
        include: {
          subject:      { select: { id: true, name: true, shortName: true } },
          teacher:      { select: { id: true, fullName: true, avatarUrl: true } },
          studentGroup: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ faculty: { name: "asc" } }, { name: "asc" }],
  })

  return classes.map(cls => {
    const effectiveDays =
      cls.workingDays.length > 0          ? cls.workingDays :
      cls.faculty?.workingDays.length     ? cls.faculty.workingDays :
                                            schoolWorkingDays

    const slots = cls.periodSchedule?.slots ?? []

    const rows = slots.map(slot => {
      // Group entries at this slot by (teacher, subject, group)
      const entriesAtSlot = cls.routineEntries.filter(e =>
        e.periodSlotId === slot.id && effectiveDays.includes(e.dayOfWeek),
      )
      const byKey = new Map<string, CompactCellEntry>()
      for (const e of entriesAtSlot) {
        const key = [e.subjectId ?? "_", e.teacherUserId ?? "_", e.studentGroupId ?? "_"].join("|")
        const cur = byKey.get(key) ?? {
          subjectId:        e.subjectId,
          subjectName:      e.subject?.name        ?? null,
          subjectShortName: e.subject?.shortName   ?? null,
          teacherUserId:    e.teacherUserId,
          teacherName:      e.teacher?.fullName    ?? null,
          teacherAvatar:    e.teacher?.avatarUrl   ?? null,
          studentGroupId:   e.studentGroupId,
          studentGroupName: e.studentGroup?.name   ?? null,
          days:             [],
        }
        cur.days.push(e.dayOfWeek)
        byKey.set(key, cur)
      }
      const cells = [...byKey.values()]
      // Sort each cell's day list and the cell list (by first day)
      for (const c of cells) c.days.sort((a, b) => a - b)
      cells.sort((a, b) => (a.days[0] ?? 0) - (b.days[0] ?? 0))
      return {
        slotId:     slot.id,
        label:      slot.label,
        orderIndex: slot.orderIndex,
        isBreak:    slot.isBreak,
        startTime:  slot.startTime ?? null,
        endTime:    slot.endTime   ?? null,
        cells,
      }
    })

    return {
      classId:            cls.id,
      className:          cls.name,
      classShortName:     shortClassNameFromName(cls.name),
      facultyId:          cls.facultyId,
      facultyName:        cls.faculty?.name ?? null,
      workingDays:        effectiveDays,
      periodScheduleId:   cls.periodScheduleId ?? null,
      periodScheduleName: cls.periodSchedule?.name ?? null,
      rows,
    }
  })
}

// Local class-short helper kept in this module (server-only context).
// We deliberately don't import from src/lib/routine-format because that file
// is also pulled into client code that might bundle it twice.
function shortClassNameFromName(name: string): string {
  const m = name.match(/(\d{1,2})\s*(?:section\s+)?([A-Z])?/i)
  if (m) return `${m[1]}${m[2]?.toUpperCase() ?? ""}`
  return name.slice(0, 4)
}

// ─── Teacher week routines ───────────────────────────────────────────────────

export interface TeacherWeekCell {
  classId:          string
  className:        string
  classShortName:   string
  subjectId:        string | null
  subjectName:      string | null
  subjectShortName: string | null
  studentGroupName: string | null
}

export interface TeacherWeek {
  teacherId:    string
  teacherName:  string
  teacherAvatar: string | null
  /** entries[periodIndex][dayOfWeek 0..6] = TeacherWeekCell[] */
  weekMatrix:   Record<string, Record<number, TeacherWeekCell[]>>
  /** Ordered unique periodSlot ids the teacher actually teaches in */
  slots:        { id: string; label: string | null; orderIndex: number }[]
  workingDays:  number[]
}

export async function getTeacherWeekRoutines(args: {
  schoolId:        string
  facultyIds?:     string[]
  academicYearId?: string
}): Promise<TeacherWeek[]> {
  const facultyNone     = args.facultyIds?.includes("none") ?? false
  const realFacultyIds  = (args.facultyIds ?? []).filter(id => id !== "none")
  const classFacultyFilter =
    realFacultyIds.length > 0 && facultyNone
      ? { OR: [{ facultyId: { in: realFacultyIds } }, { facultyId: null }] }
      : realFacultyIds.length > 0
        ? { facultyId: { in: realFacultyIds } }
        : facultyNone
          ? { facultyId: null }
          : undefined

  const school = await prisma.school.findUnique({
    where:  { id: args.schoolId },
    select: { workingDays: true },
  })
  const schoolWorkingDays = school?.workingDays ?? [1, 2, 3, 4, 5]

  const entries = await prisma.routineEntry.findMany({
    where: {
      teacherUserId: { not: null },
      class: {
        schoolId: args.schoolId,
        ...(classFacultyFilter ?? {}),
      },
    },
    include: {
      teacher:      { select: { id: true, fullName: true, avatarUrl: true } },
      class:        { select: { id: true, name: true, faculty: { select: { workingDays: true } }, workingDays: true } },
      subject:      { select: { id: true, name: true, shortName: true } },
      periodSlot:   { select: { id: true, label: true, orderIndex: true } },
      studentGroup: { select: { name: true } },
    },
  })

  const byTeacher = new Map<string, TeacherWeek>()
  for (const e of entries) {
    if (!e.teacher) continue

    const t = byTeacher.get(e.teacher.id) ?? {
      teacherId:     e.teacher.id,
      teacherName:   e.teacher.fullName,
      teacherAvatar: e.teacher.avatarUrl,
      weekMatrix:    {},
      slots:         [],
      workingDays:   [],
    }

    const day = e.dayOfWeek
    const slotKey = e.periodSlot.id

    if (!t.weekMatrix[slotKey]) t.weekMatrix[slotKey] = {}
    if (!t.weekMatrix[slotKey][day]) t.weekMatrix[slotKey][day] = []
    t.weekMatrix[slotKey][day].push({
      classId:          e.class.id,
      className:        e.class.name,
      classShortName:   shortClassNameFromName(e.class.name),
      subjectId:        e.subjectId,
      subjectName:      e.subject?.name      ?? null,
      subjectShortName: e.subject?.shortName ?? null,
      studentGroupName: e.studentGroup?.name ?? null,
    })

    if (!t.slots.some(s => s.id === slotKey)) {
      t.slots.push({ id: slotKey, label: e.periodSlot.label, orderIndex: e.periodSlot.orderIndex })
    }

    // Track effective working days as a union across all classes this teacher visits
    const cls = e.class
    const effective =
      cls.workingDays.length > 0           ? cls.workingDays :
      cls.faculty?.workingDays.length      ? cls.faculty.workingDays :
                                             schoolWorkingDays
    for (const d of effective) {
      if (!t.workingDays.includes(d)) t.workingDays.push(d)
    }

    byTeacher.set(e.teacher.id, t)
  }

  // Final sort: slots by orderIndex, working days asc, teachers by name
  const out: TeacherWeek[] = []
  for (const t of byTeacher.values()) {
    t.slots.sort((a, b) => a.orderIndex - b.orderIndex)
    t.workingDays.sort((a, b) => a - b)
    out.push(t)
  }
  out.sort((a, b) => a.teacherName.localeCompare(b.teacherName))
  return out
}
