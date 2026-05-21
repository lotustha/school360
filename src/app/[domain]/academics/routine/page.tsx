import { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarClock } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { listSchedules } from "@/actions/routine"
import { SchedulesClient } from "./schedules-client"
import { RoutineTabs } from "./routine-tabs"
import { GlobalFiltersBar } from "@/components/ui/global-filters-bar"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"

export const metadata: Metadata = { title: "Routine" }

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{ facultyId?: string; classId?: string }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

export default async function RoutinePage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const facultyIds = parseList(sp.facultyId)
  const classIds   = parseList(sp.classId)
  const facultyNone = facultyIds.includes("none")
  const realFacultyIds = facultyIds.filter(id => id !== "none")

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, workingDays: true },
  })
  if (!school) notFound()

  const [schedules, classes, faculties] = await Promise.all([
    listSchedules(school.id),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, facultyId: true, periodScheduleId: true, faculty: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  // Apply scope filter to the classes that flow into the client.
  const inScope = (cId: string, fId: string | null): boolean => {
    if (classIds.length > 0)   return classIds.includes(cId)
    if (facultyIds.length === 0) return true
    if (facultyNone && fId === null) return true
    return fId !== null && realFacultyIds.includes(fId)
  }
  const scopedClasses    = classes.filter(c => inScope(c.id, c.facultyId))
  const visibleClassIds  = new Set(scopedClasses.map(c => c.id))
  // Filter each schedule's "classes" chip-list too, so combined-class chips
  // shown under a schedule don't leak out-of-scope names.
  const scopedSchedules  = schedules.map(s => ({
    ...s,
    classes: s.classes.filter(c => visibleClassIds.has(c.id)),
  }))

  // Filter selectable Class options in the GlobalFiltersBar by the picked
  // Faculty(ies), so the Class chip's dropdown is always sane.
  const filterClassOptions = sortClassesByFacultyThenName(classes.map(c => ({
    id:          c.id,
    name:        c.name,
    facultyId:   c.facultyId,
    facultyName: c.faculty?.name ?? null,
  })))

  const scopeActive = facultyIds.length > 0 || classIds.length > 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Routine</h2>
          <p className="text-sm text-muted-foreground">Time-slot templates, working days, and per-class schedules</p>
        </div>
      </div>

      <RoutineTabs />

      <GlobalFiltersBar
        show={["facultyId", "classId"]}
        faculties={faculties}
        classes={filterClassOptions}
      />

      {/* Scope summary line — visible only when a filter is active */}
      {scopeActive && (
        <div className="text-[11px] text-slate-500 font-medium px-1">
          Showing <span className="font-bold text-primary">{scopedClasses.length}</span> class{scopedClasses.length === 1 ? "" : "es"} in scope
          {scopedClasses.length === 0 && (
            <span className="ml-2 text-amber-700 font-bold">— nothing matches; try widening the filter.</span>
          )}
        </div>
      )}

      <SchedulesClient
        schoolId={school.id}
        workingDays={school.workingDays}
        schedules={scopedSchedules}
        classes={sortClassesByFacultyThenName(scopedClasses.map(c => ({
          id: c.id,
          name: c.name,
          facultyName: c.faculty?.name ?? null,
          periodScheduleId: c.periodScheduleId,
        })))}
      />
    </div>
  )
}
