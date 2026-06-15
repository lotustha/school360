"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePermission } from "@/lib/permissions"
import { todayBS, toAD, bsMonthEnd, daysInBsMonth } from "@/lib/nepali-date"
import { MIN_ATTENDANCE_PCT } from "@/lib/nepal-data"

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"

export interface AttendanceRecord {
  studentId: string
  status:    AttendanceStatus
  note?:     string
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

const saveSchema = z.object({
  classId:   z.string().min(1),
  sectionId: z.string().min(1).optional(),
  dateBS:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period:    z.number().int().min(1).max(8).optional(),
  records:   z.array(z.object({
    studentId: z.string().min(1),
    status:    z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    note:      z.string().max(500).optional(),
  })).min(1),
})

/** Save a full attendance session for a class/section on a given BS date (optionally per-period). */
export async function saveAttendance(
  schoolId:  string,
  takenById: string,
  input: {
    classId:    string
    sectionId?: string
    dateBS:     string
    period?:    number
    records:    AttendanceRecord[]
  }
) {
  const session = await requirePermission("attendance:manage")
  if (session.user.schoolId !== schoolId) throw new Error("FORBIDDEN")

  const data   = saveSchema.parse(input)
  const dateAD = toAD(data.dateBS)
  const taker  = takenById && takenById !== "system" ? takenById : session.user.id

  await prisma.$transaction(
    data.records.map(r =>
      prisma.attendance.upsert({
        where: {
          studentId_dateBS_period: {
            studentId: r.studentId,
            dateBS:    data.dateBS,
            period:    data.period ?? null as unknown as number,
          },
        },
        create: {
          studentId: r.studentId,
          schoolId,
          classId:   data.classId,
          sectionId: data.sectionId ?? null,
          dateBS:    data.dateBS,
          dateAD,
          period:    data.period ?? null,
          status:    r.status,
          note:      r.note ?? null,
          takenById: taker,
        },
        update: {
          status:    r.status,
          note:      r.note ?? null,
          takenById: taker,
        },
      })
    )
  )

  revalidatePath("/attendance")
}

/** Get existing attendance for a class on a date (to pre-fill the board). */
export async function getAttendanceForDate(
  schoolId:   string,
  classId:    string,
  dateBS:     string,
  sectionId?: string,
  period?:    number
) {
  const session = await requirePermission("attendance:view")
  if (session.user.schoolId !== schoolId) throw new Error("FORBIDDEN")

  return prisma.attendance.findMany({
    where: {
      schoolId,
      classId,
      dateBS,
      sectionId: sectionId ?? null,
      period:    period    ?? null,
    },
    include: { student: { include: { user: { select: { fullName: true } } } } },
  })
}

/** Today's attendance summary per section for a school. */
export async function getTodaySummary(schoolId: string) {
  const session = await requirePermission("attendance:view")
  if (session.user.schoolId !== schoolId) throw new Error("FORBIDDEN")

  const today = todayBS()

  const counts = await prisma.attendance.groupBy({
    by: ["classId", "sectionId", "status"],
    where: { schoolId, dateBS: today },
    _count: { status: true },
  })

  const sections = await prisma.section.findMany({
    where: { schoolId },
    include: {
      class:    { select: { name: true } },
      students: { select: { id: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  })

  return sections.map(sec => {
    const total   = sec.students.length
    const secData = counts.filter(c => c.classId === sec.classId && c.sectionId === sec.id)
    const present = secData.find(c => c.status === "PRESENT")?._count.status ?? 0
    const absent  = secData.find(c => c.status === "ABSENT")?._count.status  ?? 0
    const late    = secData.find(c => c.status === "LATE")?._count.status    ?? 0
    const marked  = secData.reduce((s, c) => s + c._count.status, 0)

    return {
      classId:   sec.classId,
      className: sec.class.name,
      sectionId: sec.id,
      sectionName: sec.name,
      total,
      present,
      absent,
      late,
      marked,
      isComplete: marked >= total && total > 0,
    }
  })
}

/** Fetch attendance history with filters. Returns records with resolved class/section names. */
export async function getAttendanceHistory(
  schoolId: string,
  filters: {
    classId?:   string
    sectionId?: string
    studentId?: string
    fromBS?:    string
    toBS?:      string
    status?:    string
  }
) {
  const session = await requirePermission("attendance:view")
  if (session.user.schoolId !== schoolId) throw new Error("FORBIDDEN")

  const records = await prisma.attendance.findMany({
    where: {
      schoolId,
      ...(filters.classId   && { classId:   filters.classId }),
      ...(filters.sectionId && { sectionId: filters.sectionId }),
      ...(filters.studentId && { studentId: filters.studentId }),
      ...(filters.status    && { status:    filters.status }),
      ...(filters.fromBS    && { dateBS: { gte: filters.fromBS } }),
      ...(filters.toBS      && { dateBS: { lte: filters.toBS   } }),
    },
    include: {
      student: { include: { user: { select: { fullName: true, avatarUrl: true } } } },
      takenBy: { select: { fullName: true, avatarUrl: true } },
    },
    orderBy: [{ dateBS: "desc" }, { student: { admissionNo: "asc" } }],
    take: 500,
  })

  const classIds   = [...new Set(records.map(r => r.classId))]
  const sectionIds = [...new Set(records.map(r => r.sectionId).filter(Boolean))] as string[]

  const [classes, sections] = await Promise.all([
    prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }),
    sectionIds.length > 0
      ? prisma.section.findMany({ where: { id: { in: sectionIds } }, select: { id: true, name: true } })
      : [],
  ])

  const classMap   = new Map(classes.map(c => [c.id, c.name]))
  const sectionMap = new Map(sections.map(s => [s.id, s.name]))

  return records.map(r => ({
    ...r,
    className:   classMap.get(r.classId)   ?? "",
    sectionName: r.sectionId ? (sectionMap.get(r.sectionId) ?? null) : null,
  }))
}

// ─── Holiday handling (Academic Calendar, Phase 15) ─────────────────────────

/**
 * All public-holiday BS dates ("YYYY-MM-DD") falling inside the given BS month,
 * sourced from AcademicCalendarEvent rows flagged isHoliday (incl. multi-day ranges).
 */
async function getHolidayDateSet(schoolId: string, monthBS: string): Promise<Set<string>> {
  const [y, m]     = monthBS.split("-").map(Number)
  const monthStart = `${monthBS}-01`
  const monthEnd   = bsMonthEnd(y, m)

  const events = await prisma.academicCalendarEvent.findMany({
    where: {
      schoolId,
      isHoliday: true,
      dateBS: { lte: monthEnd },
      OR: [
        { endDateBS: null, dateBS: { gte: monthStart } },
        { endDateBS: { gte: monthStart } },
      ],
    },
    select: { dateBS: true, endDateBS: true },
  })

  const totalDays = daysInBsMonth(y, m)
  const set = new Set<string>()
  for (const ev of events) {
    const start    = ev.dateBS > monthStart ? ev.dateBS : monthStart
    const rawEnd   = ev.endDateBS ?? ev.dateBS
    const end      = rawEnd < monthEnd ? rawEnd : monthEnd
    const startDay = Number(start.slice(8, 10))
    const endDay   = Math.min(Number(end.slice(8, 10)), totalDays)
    for (let d = startDay; d <= endDay; d++) {
      set.add(`${monthBS}-${String(d).padStart(2, "0")}`)
    }
  }
  return set
}

/** Public-holiday dates of a BS month for the caller's school (for UI shading). */
export async function getMonthHolidays(monthBS: string): Promise<string[]> {
  const session = await requirePermission("attendance:view")
  if (!MONTH_RE.test(monthBS)) throw new Error("Invalid month — expected YYYY-MM")
  return [...await getHolidayDateSet(session.user.schoolId!, monthBS)]
}

/**
 * Resolve one student's status for one day. A daily (period = null) record wins;
 * otherwise the most frequent status among the day's period records
 * (ties broken PRESENT > LATE > EXCUSED > ABSENT).
 */
function resolveDayStatus(recs: { period: number | null; status: string }[]): AttendanceStatus {
  const daily = recs.find(r => r.period === null)
  if (daily) return daily.status as AttendanceStatus

  const counts: Record<string, number> = {}
  recs.forEach(r => { counts[r.status] = (counts[r.status] ?? 0) + 1 })

  let best: AttendanceStatus = "ABSENT"
  let bestN = -1
  for (const s of ["PRESENT", "LATE", "EXCUSED", "ABSENT"] as AttendanceStatus[]) {
    const n = counts[s] ?? 0
    if (n > bestN) { best = s; bestN = n }
  }
  return best
}

/**
 * Monthly attendance summary for one student. Public holidays are excluded
 * from all counts and from the percentage denominator (Nepal guideline).
 * Percentage = (present + late) / countable marked days.
 */
export async function getStudentMonthSummary(
  schoolId:  string,
  studentId: string,
  monthBS:   string     // "2081-01"
) {
  const session = await requirePermission("attendance:view")
  if (session.user.schoolId !== schoolId) throw new Error("FORBIDDEN")
  if (!MONTH_RE.test(monthBS)) throw new Error("Invalid month — expected YYYY-MM")

  const [records, holidaySet] = await Promise.all([
    prisma.attendance.findMany({
      where: { schoolId, studentId, dateBS: { startsWith: monthBS } },
      orderBy: { dateBS: "asc" },
    }),
    getHolidayDateSet(schoolId, monthBS),
  ])

  // Group countable (non-holiday) records by day, resolving period records to a day status.
  const byDay = new Map<string, { period: number | null; status: string }[]>()
  for (const r of records) {
    if (holidaySet.has(r.dateBS)) continue
    const list = byDay.get(r.dateBS) ?? []
    list.push({ period: r.period, status: r.status })
    byDay.set(r.dateBS, list)
  }

  let present = 0, absent = 0, late = 0, excused = 0
  for (const recs of byDay.values()) {
    const s = resolveDayStatus(recs)
    if (s === "PRESENT") present++
    else if (s === "ABSENT") absent++
    else if (s === "LATE") late++
    else excused++
  }

  const total = byDay.size
  const pct   = total > 0 ? Math.round((present + late) / total * 100) : 0

  return {
    records,
    present, absent, late, excused, total,
    percentage:       pct,
    holidaysExcluded: holidaySet.size,
    belowThreshold:   total > 0 && pct < MIN_ATTENDANCE_PCT,
  }
}

// ─── Class monthly report ────────────────────────────────────────────────────

const reportSchema = z.object({
  classId:   z.string().min(1),
  sectionId: z.string().min(1).optional(),
  monthBS:   z.string().regex(MONTH_RE, "Invalid month — expected YYYY-MM"),
})

export interface MonthReportRow {
  studentId:   string
  name:        string
  rollNumber:  string | null
  admissionNo: string
  sectionName: string | null
  /** day-of-month (1-based) → resolved status for that day */
  days:        Record<number, AttendanceStatus>
  present:     number
  absent:      number
  late:        number
  excused:     number
  /** marked non-holiday days for this student */
  countedDays: number
  /** (present + late) / countedDays, rounded; 0 when nothing marked */
  percentage:  number
  belowThreshold: boolean
}

export interface ClassMonthReport {
  monthBS:     string
  daysInMonth: number
  /** day numbers (1-based) that are public holidays */
  holidays:    number[]
  /** distinct non-holiday dates on which attendance was taken for this class */
  schoolDays:  number
  thresholdPct: number
  rows:        MonthReportRow[]
}

/**
 * Class-level monthly attendance register: one row per active student with a
 * per-day status grid, totals and a holiday-excluded attendance percentage,
 * flagged against the Nepal 75% minimum-attendance guideline.
 */
export async function getClassMonthReport(input: {
  classId:    string
  sectionId?: string
  monthBS:    string
}): Promise<ClassMonthReport> {
  const session  = await requirePermission("attendance:view")
  const schoolId = session.user.schoolId!
  const data     = reportSchema.parse(input)

  const cls = await prisma.class.findUnique({ where: { id: data.classId }, select: { schoolId: true } })
  if (!cls || cls.schoolId !== schoolId) throw new Error("Class not found")

  const [year, month] = data.monthBS.split("-").map(Number)
  const daysCount     = daysInBsMonth(year, month)

  const [students, records, holidaySet] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        classId: data.classId,
        ...(data.sectionId && { sectionId: data.sectionId }),
        status: "ACTIVE",
      },
      include: {
        user:    { select: { fullName: true } },
        section: { select: { name: true } },
      },
      orderBy: { admissionNo: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        schoolId,
        classId: data.classId,
        ...(data.sectionId && { sectionId: data.sectionId }),
        dateBS: { startsWith: data.monthBS },
      },
      select: { studentId: true, dateBS: true, period: true, status: true },
    }),
    getHolidayDateSet(schoolId, data.monthBS),
  ])

  // studentId → dateBS → records
  const byStudent = new Map<string, Map<string, { period: number | null; status: string }[]>>()
  const classDates = new Set<string>()
  for (const r of records) {
    if (holidaySet.has(r.dateBS)) continue
    classDates.add(r.dateBS)
    const days = byStudent.get(r.studentId) ?? new Map()
    const list = days.get(r.dateBS) ?? []
    list.push({ period: r.period, status: r.status })
    days.set(r.dateBS, list)
    byStudent.set(r.studentId, days)
  }

  const rows: MonthReportRow[] = students.map(s => {
    const dayMap = byStudent.get(s.id)
    const days: Record<number, AttendanceStatus> = {}
    let present = 0, absent = 0, late = 0, excused = 0

    if (dayMap) {
      for (const [dateBS, recs] of dayMap) {
        const dayNum = Number(dateBS.slice(8, 10))
        const status = resolveDayStatus(recs)
        days[dayNum] = status
        if (status === "PRESENT") present++
        else if (status === "ABSENT") absent++
        else if (status === "LATE") late++
        else excused++
      }
    }

    const countedDays = present + absent + late + excused
    const percentage  = countedDays > 0 ? Math.round((present + late) / countedDays * 100) : 0

    return {
      studentId:   s.id,
      name:        s.user.fullName,
      rollNumber:  s.rollNumber,
      admissionNo: s.admissionNo,
      sectionName: s.section?.name ?? null,
      days,
      present, absent, late, excused,
      countedDays,
      percentage,
      belowThreshold: countedDays > 0 && percentage < MIN_ATTENDANCE_PCT,
    }
  })

  return {
    monthBS:      data.monthBS,
    daysInMonth:  daysCount,
    holidays:     [...holidaySet].map(d => Number(d.slice(8, 10))).sort((a, b) => a - b),
    schoolDays:   classDates.size,
    thresholdPct: MIN_ATTENDANCE_PCT,
    rows,
  }
}
