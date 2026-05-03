"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { todayBS, toAD } from "@/lib/nepali-date"

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"

export interface AttendanceRecord {
  studentId: string
  status:    AttendanceStatus
  note?:     string
}

/** Save a full attendance session for a class/section on a given BS date. */
export async function saveAttendance(
  schoolId:  string,
  takenById: string,
  data: {
    classId:   string
    sectionId?: string
    dateBS:    string
    period?:   number
    records:   AttendanceRecord[]
  }
) {
  const dateAD = toAD(data.dateBS)

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
          takenById,
        },
        update: {
          status:    r.status,
          note:      r.note ?? null,
          takenById,
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

/** Fetch attendance history with filters. */
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
  return prisma.attendance.findMany({
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
      student: { include: { user: { select: { fullName: true } } } },
      takenBy: { select: { fullName: true } },
    },
    orderBy: [{ dateBS: "desc" }, { student: { admissionNo: "asc" } }],
    take: 500,
  })
}

/** Monthly attendance summary for one student. */
export async function getStudentMonthSummary(
  schoolId:  string,
  studentId: string,
  monthBS:   string     // "2081-01"
) {
  const records = await prisma.attendance.findMany({
    where: {
      schoolId,
      studentId,
      dateBS: { startsWith: monthBS },
    },
    orderBy: { dateBS: "asc" },
  })

  const present = records.filter(r => r.status === "PRESENT").length
  const absent  = records.filter(r => r.status === "ABSENT").length
  const late    = records.filter(r => r.status === "LATE").length
  const excused = records.filter(r => r.status === "EXCUSED").length
  const total   = records.length
  const pct     = total > 0 ? Math.round((present + late) / total * 100) : 0

  return { records, present, absent, late, excused, total, percentage: pct }
}
