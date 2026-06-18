"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { gateLmsRead, gateLmsPermission, gateLmsLearner } from "@/lib/lms-guard"
import { toBS, formatBS } from "@/lib/nepali-date"

export type LivePlatform = "GOOGLE_MEET" | "ZOOM" | "JITSI" | "CUSTOM"
export type LiveStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED"
const PLATFORMS = ["GOOGLE_MEET", "ZOOM", "JITSI", "CUSTOM"] as const

function safeBS(date: Date): string {
  try { return formatBS(toBS(date)) } catch { return "" }
}

const liveManage = () => gateLmsPermission("lms:live:manage")

async function assertCourse(schoolId: string, courseId: string) {
  const c = await prisma.lMSCourse.findFirst({ where: { id: courseId, schoolId }, select: { id: true } })
  if (!c) throw new Error("Course not found")
}

async function loadLive(schoolId: string, id: string) {
  const lc = await prisma.liveClass.findFirst({ where: { id, schoolId }, select: { id: true, courseId: true } })
  if (!lc) throw new Error("Live class not found")
  return lc
}

export interface LiveClassRow {
  id: string
  title: string
  description: string | null
  scheduledAt: string
  scheduledAtBS: string
  durationMinutes: number
  platform: LivePlatform
  meetingUrl: string | null
  recordingUrl: string | null
  status: LiveStatus
  attendanceCount: number
  enrolledCount: number
}

export async function listCourseLiveClasses(courseId: string): Promise<LiveClassRow[]> {
  const session = await gateLmsRead()
  const schoolId = session.user.schoolId!
  await assertCourse(schoolId, courseId)

  const [classes, enrolledCount] = await Promise.all([
    prisma.liveClass.findMany({
      where:   { courseId, schoolId },
      include: { _count: { select: { attendances: true } } },
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.lMSEnrollment.count({ where: { courseId } }),
  ])

  return classes.map(lc => ({
    id:              lc.id,
    title:           lc.title,
    description:     lc.description,
    scheduledAt:     lc.scheduledAt.toISOString(),
    scheduledAtBS:   lc.scheduledAtBS,
    durationMinutes: lc.durationMinutes,
    platform:        lc.platform as LivePlatform,
    meetingUrl:      lc.meetingUrl,
    recordingUrl:    lc.recordingUrl,
    status:          lc.status as LiveStatus,
    attendanceCount: lc._count.attendances,
    enrolledCount,
  }))
}

export async function getLiveAttendance(liveClassId: string) {
  const session = await gateLmsRead()
  const schoolId = session.user.schoolId!
  const lc = await prisma.liveClass.findFirst({
    where:  { id: liveClassId, schoolId },
    select: { id: true, title: true, courseId: true, scheduledAtBS: true, scheduledAt: true },
  })
  if (!lc || !lc.courseId) throw new Error("Live class not found")

  const [enrollments, attendances] = await Promise.all([
    prisma.lMSEnrollment.findMany({
      where:   { courseId: lc.courseId },
      include: { student: { select: { id: true, rollNumber: true, user: { select: { fullName: true } }, class: { select: { name: true } } } } },
      orderBy: [{ student: { class: { name: "asc" } } }, { student: { rollNumber: "asc" } }],
    }),
    prisma.liveClassAttendance.findMany({ where: { liveClassId } }),
  ])
  const att = new Map(attendances.map(a => [a.studentId, a]))

  return {
    liveClass: { id: lc.id, title: lc.title, courseId: lc.courseId, scheduledAtBS: lc.scheduledAtBS },
    rows: enrollments.map(e => ({
      studentId:  e.studentId,
      name:       e.student.user.fullName,
      rollNumber: e.student.rollNumber,
      className:  e.student.class.name,
      joinedAt:   att.get(e.studentId)?.joinedAt?.toISOString() ?? null,
    })),
  }
}

const scheduleSchema = z.object({
  courseId:        z.string().min(1),
  title:           z.string().min(1, "Title is required").max(200),
  description:     z.string().max(2000).nullable().optional(),
  scheduledAt:     z.string().datetime(),
  durationMinutes: z.number().int().positive().max(600).default(45),
  platform:        z.enum(PLATFORMS).default("GOOGLE_MEET"),
  meetingUrl:      z.string().url().max(1000).nullable().optional(),
  meetingId:       z.string().max(200).nullable().optional(),
  meetingPassword: z.string().max(200).nullable().optional(),
})

const updateSchema = scheduleSchema.partial().omit({ courseId: true }).extend({
  id:           z.string().min(1),
  recordingUrl: z.string().url().max(1000).nullable().optional(),
})

export async function scheduleLiveClass(input: z.infer<typeof scheduleSchema>) {
  const session = await liveManage()
  const data = scheduleSchema.parse(input)
  const schoolId = session.user.schoolId!
  await assertCourse(schoolId, data.courseId)

  const at = new Date(data.scheduledAt)
  const lc = await prisma.liveClass.create({
    data: {
      schoolId,
      courseId:        data.courseId,
      title:           data.title.trim(),
      description:     data.description?.trim() || null,
      scheduledAt:     at,
      scheduledAtBS:   safeBS(at),
      durationMinutes: data.durationMinutes,
      platform:        data.platform,
      meetingUrl:      data.meetingUrl ?? null,
      meetingId:       data.meetingId ?? null,
      meetingPassword: data.meetingPassword ?? null,
      status:          "SCHEDULED",
      createdById:     session.user.id,
    },
  })
  revalidatePath(`/lms/courses/${data.courseId}/live`)
  return { id: lc.id }
}

export async function updateLiveClass(input: z.infer<typeof updateSchema>) {
  const session = await liveManage()
  const data = updateSchema.parse(input)
  const lc = await loadLive(session.user.schoolId!, data.id)

  const at = data.scheduledAt ? new Date(data.scheduledAt) : undefined
  await prisma.liveClass.update({
    where: { id: data.id },
    data: {
      ...(data.title           !== undefined && { title: data.title.trim() }),
      ...(data.description     !== undefined && { description: data.description?.trim() || null }),
      ...(at                   !== undefined && { scheduledAt: at, scheduledAtBS: safeBS(at) }),
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      ...(data.platform        !== undefined && { platform: data.platform }),
      ...(data.meetingUrl      !== undefined && { meetingUrl: data.meetingUrl ?? null }),
      ...(data.meetingId       !== undefined && { meetingId: data.meetingId ?? null }),
      ...(data.meetingPassword !== undefined && { meetingPassword: data.meetingPassword ?? null }),
      ...(data.recordingUrl    !== undefined && { recordingUrl: data.recordingUrl ?? null }),
    },
  })
  revalidatePath(`/lms/courses/${lc.courseId}/live`)
  return { ok: true }
}

export async function setLiveStatus(id: string, status: LiveStatus) {
  const session = await liveManage()
  const lc = await loadLive(session.user.schoolId!, id)
  await prisma.liveClass.update({ where: { id }, data: { status } })
  revalidatePath(`/lms/courses/${lc.courseId}/live`)
  return { ok: true }
}

export async function deleteLiveClass(id: string) {
  const session = await liveManage()
  const lc = await loadLive(session.user.schoolId!, id)
  await prisma.liveClass.delete({ where: { id } }) // attendances cascade
  revalidatePath(`/lms/courses/${lc.courseId}/live`)
  return { ok: true }
}

// ─── Student side ─────────────────────────────────────────────────────────────

export async function getMyLiveClasses(courseId: string) {
  const { studentId, session } = await gateLmsLearner()
  const schoolId = session.user.schoolId!
  const enrolled = await prisma.lMSEnrollment.findFirst({ where: { courseId, studentId }, select: { id: true } })
  if (!enrolled) throw new Error("FORBIDDEN")

  const classes = await prisma.liveClass.findMany({
    where:   { courseId, schoolId, status: { not: "CANCELLED" } },
    include: { attendances: { where: { studentId }, select: { joinedAt: true } } },
    orderBy: { scheduledAt: "asc" },
  })

  return classes.map(lc => ({
    id:              lc.id,
    title:           lc.title,
    description:     lc.description,
    scheduledAt:     lc.scheduledAt.toISOString(),
    scheduledAtBS:   lc.scheduledAtBS,
    durationMinutes: lc.durationMinutes,
    platform:        lc.platform as LivePlatform,
    status:          lc.status as LiveStatus,
    recordingUrl:    lc.recordingUrl,
    joined:          lc.attendances.length > 0,
  }))
}

/** Record attendance and return the meeting link. Only when the class is LIVE. */
export async function joinLiveClass(liveClassId: string) {
  const { studentId, session } = await gateLmsLearner()
  const schoolId = session.user.schoolId!

  const lc = await prisma.liveClass.findFirst({
    where:  { id: liveClassId, schoolId },
    select: { id: true, courseId: true, status: true, meetingUrl: true },
  })
  if (!lc || !lc.courseId) throw new Error("Live class not found")
  const enrolled = await prisma.lMSEnrollment.findFirst({ where: { courseId: lc.courseId, studentId }, select: { id: true } })
  if (!enrolled) throw new Error("FORBIDDEN")
  if (lc.status !== "LIVE") throw new Error("This class is not live right now")
  if (!lc.meetingUrl) throw new Error("No meeting link has been set")

  await prisma.liveClassAttendance.upsert({
    where:  { liveClassId_studentId: { liveClassId, studentId } },
    update: {},
    create: { liveClassId, studentId, joinedAt: new Date() },
  })

  return { ok: true, meetingUrl: lc.meetingUrl }
}
