import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { CalendarClock, GraduationCap, AlertCircle, Clock, LayoutGrid, Info } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
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

  // Readiness signals
  const totalClasses        = classes.length
  const classesWithSchedule = classes.filter(c => c.periodScheduleId).length
  const classesWithout      = totalClasses - classesWithSchedule
  const readinessPct        = totalClasses > 0 ? Math.round((classesWithSchedule / totalClasses) * 100) : 0
  const totalSlots          = schedules.reduce((s, sch) => s + sch.slots.length, 0)
  const teachingSlots       = schedules.reduce((s, sch) => s + sch.slots.filter(sl => !sl.isBreak).length, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Routine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Period schedules, working days, and per-class timetables.
            Create a schedule first, then assign it to one or more classes.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Schedules" value={schedules.length} sub={schedules.length === 0 ? "Create one to start" : "Period templates"} tone="primary" icon={CalendarClock} />
        <Kpi
          label="Classes scheduled"
          value={classesWithSchedule}
          sub={totalClasses > 0 ? `${readinessPct}% of ${totalClasses} class${totalClasses === 1 ? "" : "es"}` : "Add classes first"}
          tone={classesWithout === 0 && totalClasses > 0 ? "emerald" : "amber"}
          icon={GraduationCap}
        />
        <Kpi label="Teaching slots" value={teachingSlots} sub={`${totalSlots} total (incl. breaks)`} tone="sky"     icon={Clock} />
        <Kpi label="Unscheduled classes" value={classesWithout} sub={classesWithout > 0 ? "No period schedule" : "All set"} tone={classesWithout > 0 ? "rose" : "slate"} icon={AlertCircle} />
      </div>

      <RoutineTabs />

      {/* Setup callouts */}
      {totalClasses === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            <strong>No classes yet.</strong> Add classes in{" "}
            <Link href="/academics/classes" className="underline font-bold hover:text-amber-950">/academics/classes</Link>{" "}
            before building routine schedules.
          </p>
        </div>
      )}
      {totalClasses > 0 && schedules.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <LayoutGrid className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-800">No period schedules yet</p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              A schedule defines the daily time slots (e.g. Period 1 → 9:00–9:45, Period 2 → 9:45–10:30…).
              You can share one schedule across multiple classes or create separate ones per grade.
            </p>
          </div>
        </div>
      )}
      {classesWithout > 0 && schedules.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              {classesWithout} class{classesWithout === 1 ? "" : "es"} {classesWithout === 1 ? "has" : "have"} no period schedule assigned
            </p>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              Unscheduled classes don&apos;t appear in <Link href="/academics/routine/compact" className="underline font-bold">Period × Class</Link> or{" "}
              <Link href="/academics/routine/teachers" className="underline font-bold">Teacher week</Link> views.
              Assign a schedule to each class via the dropdown on its card.
            </p>
          </div>
        </div>
      )}

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

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: number; sub: string
  tone: "primary" | "emerald" | "amber" | "sky" | "rose" | "slate"
  icon: React.ElementType
}) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",     value: "text-amber-700" },
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",         value: "text-sky-700" },
    rose:    { ring: "ring-rose-100",    icon: "text-rose-600 bg-rose-50",       value: "text-rose-700" },
    slate:   { ring: "ring-slate-100",   icon: "text-slate-500 bg-slate-50",     value: "text-slate-700" },
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 ring-1", palette.ring)}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", palette.icon)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={cn("text-xl font-bold font-mono tabular-nums leading-tight", palette.value)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 truncate" title={sub}>{sub}</p>
    </div>
  )
}
