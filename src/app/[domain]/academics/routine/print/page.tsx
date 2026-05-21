import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCompactRoutineGrid } from "@/actions/routine"
import { RoutinePrintView } from "./print-view"

export const metadata: Metadata = { title: "Print Routine" }

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{
    scheduleId?:     string
    facultyId?:      string
    classId?:        string
    academicYearId?: string
    title?:          string
  }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

export default async function RoutinePrintPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, name: true },
  })
  if (!school) notFound()

  const facultyIds = parseList(sp.facultyId)
  const classIds   = parseList(sp.classId)

  const allColumns = await getCompactRoutineGrid({
    schoolId:        school.id,
    facultyIds:      facultyIds.length ? facultyIds : undefined,
    classIds:        classIds.length   ? classIds   : undefined,
    academicYearId:  sp.academicYearId,
  })

  // If a scheduleId is specified, restrict to that schedule. Otherwise let
  // the client render every schedule (rare path; the page is usually opened
  // per-schedule from the routine grid).
  const columns = sp.scheduleId
    ? allColumns.filter(c => c.periodScheduleId === sp.scheduleId)
    : allColumns

  // Look up schedule name + slot count for the print header
  const focusedSchedule = sp.scheduleId
    ? await prisma.periodSchedule.findUnique({
        where:  { id: sp.scheduleId },
        select: { id: true, name: true },
      })
    : null

  return (
    <RoutinePrintView
      schoolName={school.name}
      scheduleName={focusedSchedule?.name ?? null}
      columns={columns}
      title={sp.title ?? null}
    />
  )
}
