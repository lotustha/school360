"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { resolveExamMarks, type ResolvedExamMarks } from "@/lib/exam-marks"

/**
 * Server-action wrapper so the paper drawer can preview the resolved full/pass
 * marks coming from Evaluation Configure (or fall back to paper override / default).
 * Returns null on error so the drawer can gracefully fall back to manual input.
 */
export async function getResolvedExamMarksForUI(
  examId:    string,
  subjectId: string,
  schoolId:  string,
): Promise<ResolvedExamMarks | null> {
  try {
    return await resolveExamMarks(examId, subjectId, schoolId)
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exam (Terminal) CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listExams(schoolId: string) {
  return prisma.exam.findMany({
    where:   { schoolId },
    include: {
      academicYear: { select: { id: true, name: true, facultyId: true } },
      faculty:      { select: { id: true, name: true } },
      _count:       { select: { papers: true, classes: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

// Listing variant that adds per-exam progress metrics in a single batched pass.
// Used by the redesigned /academics/exams listing for status pills, progress bars
// and the timeline view. Computed in JS off batched fetches to avoid N+1.
export interface ExamProgressRow {
  examId:           string
  paperCount:       number
  scheduledCount:   number
  seatsAssigned:    number
  roomsSeated:      number  // distinct scheduleRooms that have ≥1 seat assigned
  invigilatorRooms: number
  invigilatorTotal: number  // also doubles as denominator for roomsSeated
  attendanceMarked: number
  attendanceTotal:  number
  firstDateBS:      string | null
  lastDateBS:       string | null
}

export async function listExamsWithProgress(schoolId: string) {
  const exams = await prisma.exam.findMany({
    where:   { schoolId },
    include: {
      academicYear: { select: { id: true, name: true, facultyId: true } },
      faculty:      { select: { id: true, name: true } },
      _count:       { select: { papers: true, classes: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  if (exams.length === 0) return { exams, progress: new Map<string, ExamProgressRow>() }

  const examIds = exams.map(e => e.id)

  const [papers, seatsByExam, scheduleRooms, attendanceByExam] = await Promise.all([
    prisma.examPaper.findMany({
      where:  { schoolId, examId: { in: examIds } },
      select: {
        id:        true,
        examId:    true,
        schedules: { select: { dateBS: true }, orderBy: { dateAD: "asc" } },
      },
    }),
    prisma.examSeat.findMany({
      where:  { paper: { schoolId, examId: { in: examIds } } },
      select: { paperId: true, scheduleId: true, roomId: true },
    }),
    prisma.examScheduleRoom.findMany({
      where:  { schedule: { paper: { schoolId, examId: { in: examIds } } } },
      select: {
        roomId:   true,
        schedule: { select: { paper: { select: { examId: true } }, invigilators: { select: { roomId: true } } } },
      },
    }),
    prisma.examRoomAttendance.groupBy({
      by: ["paperId"],
      where: { paper: { schoolId, examId: { in: examIds } } },
      _count: { _all: true },
    }),
  ])

  // Build paperId → examId map for the groupBy results
  const paperToExam = new Map(papers.map(p => [p.id, p.examId]))

  const progress = new Map<string, ExamProgressRow>()
  for (const e of exams) {
    progress.set(e.id, {
      examId:           e.id,
      paperCount:       0,
      scheduledCount:   0,
      seatsAssigned:    0,
      roomsSeated:      0,
      invigilatorRooms: 0,
      invigilatorTotal: 0,
      attendanceMarked: 0,
      attendanceTotal:  0,
      firstDateBS:      null,
      lastDateBS:       null,
    })
  }

  // Per exam, track distinct (scheduleId, roomId) cells with at least one seat.
  const seatedCells = new Map<string, Set<string>>()

  for (const p of papers) {
    const row = progress.get(p.examId)
    if (!row) continue
    row.paperCount++
    if (p.schedules.length > 0) {
      row.scheduledCount++
      for (const s of p.schedules) {
        if (!row.firstDateBS || s.dateBS < row.firstDateBS) row.firstDateBS = s.dateBS
        if (!row.lastDateBS  || s.dateBS > row.lastDateBS)  row.lastDateBS  = s.dateBS
      }
    }
  }

  for (const seat of seatsByExam) {
    const examId = paperToExam.get(seat.paperId)
    if (!examId) continue
    const row = progress.get(examId)
    if (!row) continue
    row.seatsAssigned++
    let cells = seatedCells.get(examId)
    if (!cells) { cells = new Set<string>(); seatedCells.set(examId, cells) }
    cells.add(`${seat.scheduleId}|${seat.roomId}`)
  }
  for (const [examId, cells] of seatedCells) {
    const row = progress.get(examId)
    if (row) row.roomsSeated = cells.size
  }

  for (const sr of scheduleRooms) {
    const examId = sr.schedule.paper.examId
    const row = progress.get(examId)
    if (!row) continue
    row.invigilatorTotal++
    if (sr.schedule.invigilators.some(i => i.roomId === sr.roomId)) row.invigilatorRooms++
  }

  for (const a of attendanceByExam) {
    const examId = paperToExam.get(a.paperId)
    if (!examId) continue
    const row = progress.get(examId)
    if (row) row.attendanceMarked += a._count._all
  }

  // attendanceTotal == seatsAssigned (one mark per seated student)
  for (const row of progress.values()) row.attendanceTotal = row.seatsAssigned

  return { exams, progress }
}

// Clone a terminal's papers, classes, and (per-paper) targets into a new
// terminal under the chosen session. Schedules, seats, invigilators, and
// attendance are NOT carried over — those are session-specific work.
export async function cloneExam(input: {
  schoolId:       string
  sourceExamId:   string
  newName:        string
  academicYearId: string
}): Promise<{ id: string }> {
  const src = await prisma.exam.findFirst({
    where:  { id: input.sourceExamId, schoolId: input.schoolId },
    include: {
      classes: { select: { classId: true } },
      papers:  {
        include: { targets: { select: { classId: true, subjectId: true } } },
      },
    },
  })
  if (!src) throw new Error("Source terminal not found")

  const ay = await prisma.academicYear.findFirst({
    where:  { id: input.academicYearId, schoolId: input.schoolId },
    select: { id: true, facultyId: true },
  })
  if (!ay) throw new Error("Target session not found")
  if (ay.facultyId !== src.facultyId) {
    throw new Error("Target session faculty doesn't match source terminal faculty")
  }

  const created = await prisma.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        schoolId:       input.schoolId,
        name:           input.newName,
        academicYearId: input.academicYearId,
        facultyId:      src.facultyId,
      },
    })
    if (src.classes.length > 0) {
      await tx.examClass.createMany({
        data: src.classes.map(c => ({ examId: exam.id, classId: c.classId })),
      })
    }
    for (const p of src.papers) {
      await tx.examPaper.create({
        data: {
          schoolId:    input.schoolId,
          examId:      exam.id,
          subjectName: p.subjectName,
          code:        p.code,
          fullMarks:   p.fullMarks,
          passMarks:   p.passMarks,
          durationMin: p.durationMin,
          targets:     { createMany: { data: p.targets.map(t => ({ classId: t.classId, subjectId: t.subjectId })) } },
        },
      })
    }
    return exam
  })
  revalidatePath("/academics/exams")
  revalidatePath("/academics/evaluations")
  return { id: created.id }
}

// Bulk delete — used by the multi-select toolbar on the listing page.
export async function bulkDeleteExams(schoolId: string, ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 }
  const owned = await prisma.exam.findMany({
    where:  { id: { in: ids }, schoolId },
    select: { id: true },
  })
  if (owned.length === 0) return { deleted: 0 }
  const ownedIds = owned.map(o => o.id)
  const res = await prisma.exam.deleteMany({ where: { id: { in: ownedIds } } })
  revalidatePath("/academics/exams")
  revalidatePath("/academics/evaluations")
  return { deleted: res.count }
}

export async function createExam(data: {
  schoolId:       string
  name:           string
  academicYearId: string
  facultyId?:     string | null      // null = General / school-wide
  classIds?:      string[]           // classes that take this terminal
}) {
  // Verify AY belongs to school AND its faculty exactly matches the picked faculty.
  // General terminals (facultyId=null) must use school-wide sessions; faculty
  // terminals must use that faculty's own session.
  const ay = await prisma.academicYear.findFirst({
    where:  { id: data.academicYearId, schoolId: data.schoolId },
    select: { id: true, facultyId: true },
  })
  if (!ay) throw new Error("Academic year not found")
  const examFaculty = data.facultyId ?? null
  if (ay.facultyId !== examFaculty) {
    throw new Error("Picked academic year doesn't match the picked faculty")
  }

  // Verify classes (if any) belong to school + (if faculty set) belong to that faculty
  const classIds = data.classIds ?? []
  if (classIds.length > 0) {
    const classes = await prisma.class.findMany({
      where:  { id: { in: classIds }, schoolId: data.schoolId },
      select: { id: true, facultyId: true },
    })
    if (classes.length !== classIds.length) throw new Error("One or more classes are not in this school")
    if (data.facultyId !== undefined && data.facultyId !== null) {
      const mismatched = classes.filter(c => c.facultyId !== data.facultyId)
      if (mismatched.length > 0) {
        throw new Error("One or more classes don't belong to the selected faculty")
      }
    }
  }

  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        schoolId:       data.schoolId,
        name:           data.name,
        academicYearId: data.academicYearId,
        facultyId:      data.facultyId ?? null,
      },
    })
    if (classIds.length > 0) {
      await tx.examClass.createMany({
        data: classIds.map(cid => ({ examId: created.id, classId: cid })),
      })
    }
    return created
  })
  revalidatePath("/academics/exams")
  revalidatePath("/academics/evaluations")
  return exam
}

export async function updateExam(id: string, data: {
  name?:      string
  facultyId?: string | null
  classIds?:  string[]      // replace-all when provided
  schoolId?:  string        // for scope check when classIds is provided
}) {
  // If classes are being updated, validate scope + faculty match
  if (data.classIds) {
    const exam = await prisma.exam.findUnique({
      where:  { id },
      select: { schoolId: true, facultyId: true },
    })
    if (!exam) throw new Error("Exam not found")
    const effectiveFaculty = data.facultyId !== undefined ? data.facultyId : exam.facultyId
    if (data.classIds.length > 0) {
      const classes = await prisma.class.findMany({
        where:  { id: { in: data.classIds }, schoolId: exam.schoolId },
        select: { id: true, facultyId: true },
      })
      if (classes.length !== data.classIds.length) throw new Error("One or more classes are not in this school")
      if (effectiveFaculty) {
        const mismatched = classes.filter(c => c.facultyId !== effectiveFaculty)
        if (mismatched.length > 0) throw new Error("One or more classes don't belong to the selected faculty")
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id },
      data: {
        ...(data.name      !== undefined && { name:      data.name }),
        ...(data.facultyId !== undefined && { facultyId: data.facultyId }),
      },
    })
    if (data.classIds) {
      await tx.examClass.deleteMany({ where: { examId: id } })
      if (data.classIds.length > 0) {
        await tx.examClass.createMany({
          data: data.classIds.map(cid => ({ examId: id, classId: cid })),
        })
      }
    }
  })

  revalidatePath("/academics/exams")
  revalidatePath("/academics/evaluations")
  revalidatePath(`/academics/exams/${id}`)
  revalidatePath(`/academics/exams/${id}/routine`)
}

export async function getExamClasses(examId: string, schoolId: string): Promise<string[]> {
  const rows = await prisma.examClass.findMany({
    where:  { examId, exam: { schoolId } },
    select: { classId: true },
  })
  return rows.map(r => r.classId)
}

// ──────────────────────────────────────────────────────────────────────────────
// Rich overview summary for the per-exam dashboard
// ──────────────────────────────────────────────────────────────────────────────

export interface ExamRichSummary {
  paperCount:        number
  scheduledCount:    number
  unscheduledCount:  number
  classCount:        number
  roomCount:         number          // distinct rooms across all sittings
  seatsAssigned:     number          // total ExamSeat rows
  invigilatorRooms:  number          // (scheduleRoom) cells with ≥1 invigilator
  invigilatorTotal:  number          // distinct (schedule, room) hosting any seat
  attendanceMarked:  number
  attendanceTotal:   number          // == seatsAssigned (one mark per seated student)
  holidayCount:      number
}

export async function getExamRichSummary(
  examId:   string,
  schoolId: string,
): Promise<ExamRichSummary | null> {
  const exam = await prisma.exam.findFirst({
    where:  { id: examId, schoolId },
    select: { id: true },
  })
  if (!exam) return null

  const [
    paperCount,
    scheduledCount,
    classCount,
    rooms,
    seatsAssigned,
    invigilatorRooms,
    invigilatorTotal,
    attendanceMarked,
    holidayCount,
  ] = await Promise.all([
    prisma.examPaper.count({ where: { examId, schoolId } }),
    prisma.examPaper.count({
      where: { examId, schoolId, schedules: { some: {} } },
    }),
    prisma.examClass.count({ where: { examId } }),
    prisma.examScheduleRoom.findMany({
      where:  { schedule: { paper: { examId, schoolId } } },
      select: { roomId: true, scheduleId: true },
    }),
    prisma.examSeat.count({ where: { paper: { examId, schoolId } } }),
    (async () => {
      // "Rooms with ≥1 invigilator assigned" — Prisma can't express
      // "this scheduleRoom's roomId matches an invigilator on its schedule",
      // so we fetch the join and count in JS. Cheap: O(rooms).
      const sr = await prisma.examScheduleRoom.findMany({
        where:   { schedule: { paper: { examId, schoolId } } },
        select:  {
          roomId:   true,
          schedule: { select: { invigilators: { select: { roomId: true } } } },
        },
      })
      return sr.filter(x => x.schedule.invigilators.some(i => i.roomId === x.roomId)).length
    })(),
    prisma.examScheduleRoom.count({
      where: { schedule: { paper: { examId, schoolId } } },
    }),
    prisma.examRoomAttendance.count({
      where: { paper: { examId, schoolId } },
    }),
    prisma.examHoliday.count({ where: { examId, schoolId } }),
  ])

  const distinctRooms = new Set(rooms.map(r => r.roomId)).size

  return {
    paperCount,
    scheduledCount,
    unscheduledCount:  paperCount - scheduledCount,
    classCount,
    roomCount:         distinctRooms,
    seatsAssigned,
    invigilatorRooms,
    invigilatorTotal,
    attendanceMarked,
    attendanceTotal:   seatsAssigned,
    holidayCount,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exam holidays
// ──────────────────────────────────────────────────────────────────────────────

export interface ExamHolidayRow {
  id:     string
  dateBS: string
  reason: string | null
}

export async function listExamHolidays(
  examId:   string,
  schoolId: string,
): Promise<ExamHolidayRow[]> {
  return prisma.examHoliday.findMany({
    where:   { examId, schoolId },
    select:  { id: true, dateBS: true, reason: true },
    orderBy: { dateBS: "asc" },
  })
}

export async function addExamHoliday(input: {
  schoolId: string
  examId:   string
  dateBS:   string
  dateAD:   Date
  reason?:  string | null
}): Promise<{ id: string }> {
  const exam = await prisma.exam.findFirst({
    where:  { id: input.examId, schoolId: input.schoolId },
    select: { id: true },
  })
  if (!exam) throw new Error("Exam not found")

  const created = await prisma.examHoliday.create({
    data: {
      schoolId: input.schoolId,
      examId:   input.examId,
      dateBS:   input.dateBS,
      dateAD:   input.dateAD,
      reason:   input.reason?.trim() || null,
    },
  })
  revalidatePath(`/academics/exams/${input.examId}`)
  revalidatePath(`/academics/exams/${input.examId}/routine`)
  return { id: created.id }
}

export async function deleteExamHoliday(holidayId: string, schoolId: string) {
  const h = await prisma.examHoliday.findFirst({
    where:  { id: holidayId, schoolId },
    select: { id: true, examId: true },
  })
  if (!h) throw new Error("Holiday not found")
  await prisma.examHoliday.delete({ where: { id: h.id } })
  revalidatePath(`/academics/exams/${h.examId}`)
  revalidatePath(`/academics/exams/${h.examId}/routine`)
}

export async function deleteExam(id: string) {
  await prisma.exam.delete({ where: { id } })
  revalidatePath("/academics/exams")
  revalidatePath("/academics/evaluations")
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-Exam summary
// ──────────────────────────────────────────────────────────────────────────────

export interface ExamSummary {
  id:               string
  name:             string
  academicYearId:   string
  academicYearName: string
  paperCount:       number
  scheduledCount:   number
  unscheduledCount: number
  firstDateBS:      string | null
  lastDateBS:       string | null
}

export async function getExamSummary(examId: string, schoolId: string): Promise<ExamSummary | null> {
  const exam = await prisma.exam.findFirst({
    where:   { id: examId, schoolId },
    include: {
      academicYear: { select: { id: true, name: true } },
      papers: {
        include: { schedules: { orderBy: { dateAD: "asc" } } },
      },
    },
  })
  if (!exam) return null

  const paperCount      = exam.papers.length
  const scheduledCount  = exam.papers.filter(p => p.schedules.length > 0).length
  const allDates        = exam.papers.flatMap(p => p.schedules.map(s => s.dateBS)).sort()
  return {
    id:               exam.id,
    name:             exam.name,
    academicYearId:   exam.academicYearId,
    academicYearName: exam.academicYear.name,
    paperCount,
    scheduledCount,
    unscheduledCount: paperCount - scheduledCount,
    firstDateBS:      allDates[0]           ?? null,
    lastDateBS:       allDates[allDates.length - 1] ?? null,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exam Paper + Targets + Schedule
// ──────────────────────────────────────────────────────────────────────────────

export interface PaperTargetRow {
  id:          string
  classId:     string
  className:   string
  facultyId:   string | null
  facultyName: string | null
  subjectId:   string
  subjectName: string
}

export interface PaperScheduleRow {
  id:          string
  dateBS:      string
  dateAD:      Date
  startTime:   string
  durationMin: number | null
}

export interface PaperRow {
  id:          string
  subjectName: string
  code:        string | null
  fullMarks:   number | null
  passMarks:   number | null
  durationMin: number
  targets:     PaperTargetRow[]
  schedule:    PaperScheduleRow | null    // 0 or 1 sitting (typical case)
}

export async function listExamPapers(schoolId: string, examId: string): Promise<PaperRow[]> {
  // Defense-in-depth: confirm exam belongs to school
  const exam = await prisma.exam.findFirst({
    where:  { id: examId, schoolId },
    select: { id: true },
  })
  if (!exam) return []

  const papers = await prisma.examPaper.findMany({
    where:   { schoolId, examId },
    include: {
      targets: {
        include: {
          class:   { include: { faculty: { select: { name: true } } } },
          subject: { select: { id: true, name: true } },
        },
      },
      schedules: { orderBy: { dateAD: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  })

  return papers.map(p => ({
    id:          p.id,
    subjectName: p.subjectName,
    code:        p.code,
    fullMarks:   p.fullMarks,
    passMarks:   p.passMarks,
    durationMin: p.durationMin,
    targets:     p.targets.map(t => ({
      id:          t.id,
      classId:     t.classId,
      className:   t.class.name,
      facultyId:   t.class.facultyId ?? null,
      facultyName: t.class.faculty?.name ?? null,
      subjectId:   t.subjectId,
      subjectName: t.subject.name,
    })),
    schedule:    p.schedules[0]
      ? {
          id:          p.schedules[0].id,
          dateBS:      p.schedules[0].dateBS,
          dateAD:      p.schedules[0].dateAD,
          startTime:   p.schedules[0].startTime,
          durationMin: p.schedules[0].durationMin,
        }
      : null,
  }))
}

export async function createExamPaper(input: {
  schoolId:    string
  examId:      string
  subjectName: string
  code?:       string | null
  fullMarks?:  number | null
  passMarks?:  number | null
  durationMin: number
}): Promise<{ id: string }> {
  // Scope check
  const exam = await prisma.exam.findFirst({
    where:  { id: input.examId, schoolId: input.schoolId },
    select: { id: true },
  })
  if (!exam) throw new Error("Exam not found")

  const created = await prisma.examPaper.create({
    data: {
      schoolId:    input.schoolId,
      examId:      input.examId,
      subjectName: input.subjectName.trim(),
      code:        input.code?.trim() || null,
      fullMarks:   input.fullMarks ?? null,
      passMarks:   input.passMarks ?? null,
      durationMin: input.durationMin,
    },
  })
  revalidatePath(`/academics/exams/${input.examId}`)
  revalidatePath(`/academics/exams/${input.examId}/routine`)
  return { id: created.id }
}

/**
 * Bulk-create one paper per subject for a class, in a single transaction.
 * Subjects already covered by an existing paper in this exam (via any target)
 * are skipped. Marks are left null on each paper — the resolver picks up
 * `EvaluationComponent.sourceMaxMarks` at read time.
 *
 * Returns { created, skipped } counts; skipped includes the reason per subject.
 */
export async function bulkCreateExamPapers(input: {
  schoolId:    string
  examId:      string
  classId:     string
  subjectIds:  string[]
  durationMin: number
}): Promise<{
  created: number
  skipped: { subjectId: string; subjectName: string; reason: string }[]
}> {
  if (input.subjectIds.length === 0) return { created: 0, skipped: [] }
  if (input.durationMin < 5 || input.durationMin > 600) {
    throw new Error("Duration must be 5–600 minutes")
  }

  const exam = await prisma.exam.findFirst({
    where:  { id: input.examId, schoolId: input.schoolId },
    select: { id: true },
  })
  if (!exam) throw new Error("Exam not found")

  // Load + scope check subjects in one query
  const subjects = await prisma.subject.findMany({
    where:  { id: { in: input.subjectIds }, schoolId: input.schoolId, classId: input.classId },
    select: { id: true, name: true, code: true },
  })
  const subjectById = new Map(subjects.map(s => [s.id, s]))

  // Skip subjects that already have an ExamPaperTarget in this exam (any class)
  const existingTargets = await prisma.examPaperTarget.findMany({
    where:  { subjectId: { in: input.subjectIds }, paper: { examId: input.examId, schoolId: input.schoolId } },
    select: { subjectId: true },
  })
  const alreadyHavePaper = new Set(existingTargets.map(t => t.subjectId))

  const skipped: { subjectId: string; subjectName: string; reason: string }[] = []
  const toCreate: { id: string; name: string; code: string }[] = []
  for (const sid of input.subjectIds) {
    const s = subjectById.get(sid)
    if (!s) {
      skipped.push({ subjectId: sid, subjectName: sid, reason: "Not in this school/class" })
      continue
    }
    if (alreadyHavePaper.has(sid)) {
      skipped.push({ subjectId: sid, subjectName: s.name, reason: "Paper already exists" })
      continue
    }
    toCreate.push({ id: sid, name: s.name, code: s.code })
  }

  if (toCreate.length === 0) return { created: 0, skipped }

  // Create papers + their single (classId, subjectId) target each in one tx
  await prisma.$transaction(
    toCreate.map(s => prisma.examPaper.create({
      data: {
        schoolId:    input.schoolId,
        examId:      input.examId,
        subjectName: s.name,
        code:        s.code || null,
        durationMin: input.durationMin,
        targets:     { create: { classId: input.classId, subjectId: s.id } },
      },
    })),
  )

  revalidatePath(`/academics/exams/${input.examId}`)
  revalidatePath(`/academics/exams/${input.examId}/routine`)
  return { created: toCreate.length, skipped }
}

export async function updateExamPaper(
  paperId:  string,
  schoolId: string,
  patch: {
    subjectName?: string
    code?:        string | null
    fullMarks?:   number | null
    passMarks?:   number | null
    durationMin?: number
  },
) {
  const owns = await prisma.examPaper.findFirst({
    where:  { id: paperId, schoolId },
    select: { id: true, examId: true },
  })
  if (!owns) throw new Error("Paper not found")

  await prisma.examPaper.update({
    where: { id: paperId },
    data: {
      ...(patch.subjectName !== undefined && { subjectName: patch.subjectName.trim() }),
      ...(patch.code        !== undefined && { code:        patch.code?.trim() || null }),
      ...(patch.fullMarks   !== undefined && { fullMarks:   patch.fullMarks }),
      ...(patch.passMarks   !== undefined && { passMarks:   patch.passMarks }),
      ...(patch.durationMin !== undefined && { durationMin: patch.durationMin }),
    },
  })
  revalidatePath(`/academics/exams/${owns.examId}`)
  revalidatePath(`/academics/exams/${owns.examId}/routine`)
}

export async function deleteExamPaper(paperId: string, schoolId: string) {
  const owns = await prisma.examPaper.findFirst({
    where:  { id: paperId, schoolId },
    select: { id: true, examId: true },
  })
  if (!owns) throw new Error("Paper not found")

  await prisma.examPaper.delete({ where: { id: paperId } })
  revalidatePath(`/academics/exams/${owns.examId}`)
  revalidatePath(`/academics/exams/${owns.examId}/routine`)
}

// Replace-all targets for a paper. Caller submits the desired (classId, subjectId)
// pairs; server validates each subject belongs to its class and the school.
export async function setPaperTargets(
  paperId:  string,
  schoolId: string,
  targets:  { classId: string; subjectId: string }[],
) {
  const owns = await prisma.examPaper.findFirst({
    where:  { id: paperId, schoolId },
    select: { id: true, examId: true },
  })
  if (!owns) throw new Error("Paper not found")

  // Validate every (class, subject) pair belongs to this school and the subject is in that class
  if (targets.length > 0) {
    const subjectIds = targets.map(t => t.subjectId)
    const subjects = await prisma.subject.findMany({
      where:  { id: { in: subjectIds }, schoolId },
      select: { id: true, classId: true },
    })
    const byId = new Map(subjects.map(s => [s.id, s.classId]))
    for (const t of targets) {
      const subjectClass = byId.get(t.subjectId)
      if (!subjectClass)              throw new Error(`Subject ${t.subjectId} not in school`)
      if (subjectClass !== t.classId) throw new Error(`Subject ${t.subjectId} is not in class ${t.classId}`)
    }
  }

  // Replace-all
  await prisma.$transaction(async (tx) => {
    await tx.examPaperTarget.deleteMany({ where: { paperId } })
    if (targets.length > 0) {
      await tx.examPaperTarget.createMany({
        data: targets.map(t => ({ paperId, classId: t.classId, subjectId: t.subjectId })),
      })
    }
  })

  revalidatePath(`/academics/exams/${owns.examId}`)
  revalidatePath(`/academics/exams/${owns.examId}/routine`)
}

// Upsert THE single sitting for a paper. Most exams sit once; this models that
// directly. (Schema allows >1 ExamSchedule per paper to reserve room for makeup
// sittings without a future migration.)
export async function setPaperSchedule(input: {
  paperId:     string
  schoolId:    string
  dateBS:      string
  dateAD:      Date
  startTime:   string
  durationMin?: number | null
}) {
  const owns = await prisma.examPaper.findFirst({
    where:  { id: input.paperId, schoolId: input.schoolId },
    select: { id: true, examId: true, schedules: { orderBy: { dateAD: "asc" }, take: 1 } },
  })
  if (!owns) throw new Error("Paper not found")

  if (owns.schedules.length === 0) {
    await prisma.examSchedule.create({
      data: {
        paperId:     input.paperId,
        dateBS:      input.dateBS,
        dateAD:      input.dateAD,
        startTime:   input.startTime,
        durationMin: input.durationMin ?? null,
      },
    })
  } else {
    await prisma.examSchedule.update({
      where: { id: owns.schedules[0].id },
      data: {
        dateBS:      input.dateBS,
        dateAD:      input.dateAD,
        startTime:   input.startTime,
        durationMin: input.durationMin ?? null,
      },
    })
  }

  revalidatePath(`/academics/exams/${owns.examId}/routine`)
}

/**
 * Drag-onto-cell convenience: find the paper for (examId, classId, subjectId);
 * create it if it doesn't exist; then upsert its schedule to the chosen date.
 * Returns the resolved paperId + whether the paper was just created.
 */
export async function placePaperOnCell(input: {
  schoolId:    string
  examId:      string
  classId:     string
  subjectId:   string
  subjectName: string         // used iff we create a new paper
  subjectCode?: string | null
  dateBS:      string
  dateAD:      Date
  startTime:   string
  defaultDurationMin: number  // used iff we create a new paper
}): Promise<{ paperId: string; created: boolean }> {
  // Scope check
  const exam = await prisma.exam.findFirst({
    where:  { id: input.examId, schoolId: input.schoolId },
    select: { id: true },
  })
  if (!exam) throw new Error("Exam not found")

  // Verify subject belongs to class in the same school
  const subject = await prisma.subject.findFirst({
    where:  { id: input.subjectId, schoolId: input.schoolId, classId: input.classId },
    select: { id: true },
  })
  if (!subject) throw new Error("Subject is not in the chosen class")

  // Find existing paper for this exam where the (class, subject) target already exists.
  const existing = await prisma.examPaper.findFirst({
    where: {
      schoolId: input.schoolId,
      examId:   input.examId,
      targets:  { some: { classId: input.classId, subjectId: input.subjectId } },
    },
    select: { id: true, schedules: { orderBy: { dateAD: "asc" }, take: 1 } },
  })

  let paperId: string
  let created = false
  if (existing) {
    paperId = existing.id
    if (existing.schedules.length === 0) {
      await prisma.examSchedule.create({
        data: {
          paperId,
          dateBS:    input.dateBS,
          dateAD:    input.dateAD,
          startTime: input.startTime,
        },
      })
    } else {
      await prisma.examSchedule.update({
        where: { id: existing.schedules[0].id },
        data:  {
          dateBS:    input.dateBS,
          dateAD:    input.dateAD,
          startTime: input.startTime,
        },
      })
    }
  } else {
    const newPaper = await prisma.$transaction(async (tx) => {
      const p = await tx.examPaper.create({
        data: {
          schoolId:    input.schoolId,
          examId:      input.examId,
          subjectName: input.subjectName.trim(),
          code:        input.subjectCode?.trim() || null,
          durationMin: input.defaultDurationMin,
        },
      })
      await tx.examPaperTarget.create({
        data: { paperId: p.id, classId: input.classId, subjectId: input.subjectId },
      })
      await tx.examSchedule.create({
        data: {
          paperId:   p.id,
          dateBS:    input.dateBS,
          dateAD:    input.dateAD,
          startTime: input.startTime,
        },
      })
      return p
    })
    paperId = newPaper.id
    created = true
  }

  revalidatePath(`/academics/exams/${input.examId}/routine`)
  return { paperId, created }
}

export async function clearPaperSchedule(paperId: string, schoolId: string) {
  const owns = await prisma.examPaper.findFirst({
    where:  { id: paperId, schoolId },
    select: { id: true, examId: true },
  })
  if (!owns) throw new Error("Paper not found")

  await prisma.examSchedule.deleteMany({ where: { paperId } })
  revalidatePath(`/academics/exams/${owns.examId}/routine`)
}
