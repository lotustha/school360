"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission, getSchoolSession } from "@/lib/permissions"
import { CALENDAR_EVENT_TYPES, HOLIDAY_LIKE_TYPES } from "@/lib/calendar-events"
import { holidaysForRangeBS } from "@/lib/nepal-holidays"
import { todayBS } from "@/lib/nepali-date"

// ─── Validation ──────────────────────────────────────────────────────────────

const BS_DATE = /^\d{4}-\d{2}-\d{2}$/

const createSchema = z.object({
  academicYearId: z.string().min(1),
  title:          z.string().min(1).max(160),
  eventType:      z.enum(CALENDAR_EVENT_TYPES),
  dateBS:         z.string().regex(BS_DATE, "Date must be YYYY-MM-DD (BS)"),
  endDateBS:      z.string().regex(BS_DATE, "End date must be YYYY-MM-DD (BS)").nullable().optional(),
  isHoliday:      z.boolean().optional(),
  isAllDay:       z.boolean().optional(),
  description:    z.string().max(1000).nullable().optional(),
  color:          z.string().max(32).nullable().optional(),
})

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) })

function assertRange(dateBS: string, endDateBS?: string | null) {
  // Zero-padded BS strings compare lexicographically.
  if (endDateBS && endDateBS < dateBS) throw new Error("End date must be on or after the start date")
}

async function assertYearInSchool(academicYearId: string, schoolId: string) {
  const year = await prisma.academicYear.findUnique({
    where:  { id: academicYearId },
    select: { id: true, schoolId: true, startDateBS: true, endDateBS: true },
  })
  if (!year || year.schoolId !== schoolId) throw new Error("Academic year not found")
  return year
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export interface CalendarEventRow {
  id:             string
  academicYearId: string
  title:          string
  eventType:      string
  dateBS:         string
  endDateBS:      string | null
  isHoliday:      boolean
  isAllDay:       boolean
  description:    string | null
  color:          string | null
}

/**
 * All events of an academic year (optionally narrowed to one BS month
 * "YYYY-MM"). Multi-day events overlapping the month are included.
 */
export async function listCalendarEvents(
  academicYearId: string,
  monthBS?: string,
): Promise<CalendarEventRow[]> {
  const session = await requirePermission("calendar:view")
  const schoolId = session.user.schoolId!
  await assertYearInSchool(academicYearId, schoolId)

  const rows = await prisma.academicCalendarEvent.findMany({
    where:   { schoolId, academicYearId },
    orderBy: [{ dateBS: "asc" }, { title: "asc" }],
  })

  const mapped = rows.map(r => ({
    id:             r.id,
    academicYearId: r.academicYearId,
    title:          r.title,
    eventType:      r.eventType,
    dateBS:         r.dateBS,
    endDateBS:      r.endDateBS,
    isHoliday:      r.isHoliday,
    isAllDay:       r.isAllDay,
    description:    r.description,
    color:          r.color,
  }))

  if (!monthBS || !/^\d{4}-\d{2}$/.test(monthBS)) return mapped
  const monthStart = `${monthBS}-01`
  const monthEnd   = `${monthBS}-33` // lexicographic upper bound (BS months max 32 days)
  return mapped.filter(e => (e.endDateBS ?? e.dateBS) >= monthStart && e.dateBS <= monthEnd)
}

export interface UpcomingEventRow {
  id:        string
  title:     string
  eventType: string
  dateBS:    string
  endDateBS: string | null
  isHoliday: boolean
  color:     string | null
}

/**
 * Today's and upcoming events across the school, soonest first. Light read for
 * the dashboard widget — any authenticated tenant user may see it (no
 * calendar:view gate), mirroring getDashboardNotices.
 */
export async function getUpcomingEvents(limit = 5): Promise<UpcomingEventRow[]> {
  const session = await getSchoolSession()
  const schoolId = session.user.schoolId!
  const today = todayBS()

  // Zero-padded BS strings compare lexicographically. An event is upcoming/ongoing
  // when its end (or its single date) is today or later.
  return prisma.academicCalendarEvent.findMany({
    where: {
      schoolId,
      OR: [
        { endDateBS: { gte: today } },
        { AND: [{ endDateBS: null }, { dateBS: { gte: today } }] },
      ],
    },
    orderBy: [{ dateBS: "asc" }, { title: "asc" }],
    take: limit,
    select: {
      id: true, title: true, eventType: true, dateBS: true,
      endDateBS: true, isHoliday: true, color: true,
    },
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createCalendarEvent(input: z.infer<typeof createSchema>) {
  const session = await requirePermission("calendar:manage")
  const data = createSchema.parse(input)
  const schoolId = session.user.schoolId!

  assertRange(data.dateBS, data.endDateBS)
  await assertYearInSchool(data.academicYearId, schoolId)

  const event = await prisma.academicCalendarEvent.create({
    data: {
      schoolId,
      academicYearId: data.academicYearId,
      title:          data.title.trim(),
      eventType:      data.eventType,
      dateBS:         data.dateBS,
      endDateBS:      data.endDateBS ?? null,
      isHoliday:      data.isHoliday ?? HOLIDAY_LIKE_TYPES.has(data.eventType),
      isAllDay:       data.isAllDay ?? true,
      description:    data.description?.trim() || null,
      color:          data.color || null,
    },
  })

  revalidatePath("/calendar")
  return { id: event.id, title: event.title }
}

export async function updateCalendarEvent(input: z.infer<typeof updateSchema>) {
  const session = await requirePermission("calendar:manage")
  const data = updateSchema.parse(input)
  const schoolId = session.user.schoolId!

  const existing = await prisma.academicCalendarEvent.findUnique({ where: { id: data.id } })
  if (!existing || existing.schoolId !== schoolId) throw new Error("Calendar event not found")

  if (data.academicYearId && data.academicYearId !== existing.academicYearId) {
    await assertYearInSchool(data.academicYearId, schoolId)
  }

  const nextStart = data.dateBS ?? existing.dateBS
  const nextEnd   = data.endDateBS !== undefined ? data.endDateBS : existing.endDateBS
  assertRange(nextStart, nextEnd)

  await prisma.academicCalendarEvent.update({
    where: { id: data.id },
    data: {
      ...(data.academicYearId !== undefined && { academicYearId: data.academicYearId }),
      ...(data.title          !== undefined && { title: data.title.trim() }),
      ...(data.eventType      !== undefined && { eventType: data.eventType }),
      ...(data.dateBS         !== undefined && { dateBS: data.dateBS }),
      ...(data.endDateBS      !== undefined && { endDateBS: data.endDateBS }),
      ...(data.isHoliday      !== undefined && { isHoliday: data.isHoliday }),
      ...(data.isAllDay       !== undefined && { isAllDay: data.isAllDay }),
      ...(data.description    !== undefined && { description: data.description?.trim() || null }),
      ...(data.color          !== undefined && { color: data.color || null }),
    },
  })

  revalidatePath("/calendar")
  return { ok: true }
}

export async function deleteCalendarEvent(id: string) {
  const session = await requirePermission("calendar:manage")
  const existing = await prisma.academicCalendarEvent.findUnique({ where: { id } })
  if (!existing || existing.schoolId !== session.user.schoolId) throw new Error("Calendar event not found")

  await prisma.academicCalendarEvent.delete({ where: { id } })

  revalidatePath("/calendar")
  return { ok: true }
}

/**
 * Idempotent bulk import of Nepal public holidays into one academic year.
 * Dedupe key: title + dateBS among the year's existing events. Imported rows
 * are ordinary HOLIDAY events the school can edit or delete afterwards.
 */
export async function seedNepalHolidays(academicYearId: string) {
  const session = await requirePermission("calendar:manage")
  const schoolId = session.user.schoolId!
  const year = await assertYearInSchool(academicYearId, schoolId)

  const candidates = holidaysForRangeBS(year.startDateBS, year.endDateBS)
  if (candidates.length === 0) {
    throw new Error(
      `No seed holiday data covers ${year.startDateBS} – ${year.endDateBS}. Add events manually.`,
    )
  }

  const existing = await prisma.academicCalendarEvent.findMany({
    where:  { schoolId, academicYearId },
    select: { title: true, dateBS: true },
  })
  const seen = new Set(existing.map(e => `${e.title}::${e.dateBS}`))

  const fresh = candidates.filter(h => !seen.has(`${h.title}::${h.dateBS}`))
  if (fresh.length > 0) {
    await prisma.academicCalendarEvent.createMany({
      data: fresh.map(h => ({
        schoolId,
        academicYearId,
        title:     h.title,
        eventType: "HOLIDAY",
        dateBS:    h.dateBS,
        endDateBS: h.endDateBS ?? null,
        isHoliday: true,
        isAllDay:  true,
      })),
    })
  }

  revalidatePath("/calendar")
  return { inserted: fresh.length, skipped: candidates.length - fresh.length }
}
