import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { UserCog, Clock, Users as UsersIcon, ListOrdered, Printer, AlertCircle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getTeacherWeekRoutines } from "@/actions/routine"
import { RoutineTabs } from "../routine-tabs"
import { TeacherWeekGrid } from "./teacher-week-grid"
import { TeacherFilter } from "./teacher-filter"
import { GlobalFiltersBar } from "@/components/ui/global-filters-bar"
import { SessionBadge } from "@/components/ui/session-badge"
import { resolveCurrentForFaculty } from "@/lib/academic-year"

export const metadata: Metadata = { title: "Routine — Teacher week" }

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{
    facultyId?:      string
    academicYearId?: string
    teacherId?:      string
    q?:              string
  }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default async function RoutineTeachersPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const facultyIds = parseList(sp.facultyId)
  const teacherIds = parseList(sp.teacherId)
  const q = (sp.q ?? "").trim().toLowerCase()

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true },
  })
  if (!school) notFound()

  const [allTeachers, faculties, classes, academicYears, schoolTeachers] = await Promise.all([
    getTeacherWeekRoutines({
      schoolId:   school.id,
      facultyIds: facultyIds.length ? facultyIds : undefined,
      academicYearId: sp.academicYearId,
    }),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, facultyId: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, isCurrent: true, facultyId: true },
      orderBy: { name: "desc" },
    }),
    prisma.user.findMany({
      where:   { schoolId: school.id, role: { in: ["TEACHER", "STAFF", "SCHOOL_ADMIN"] } },
      select:  { id: true, fullName: true, avatarUrl: true },
      orderBy: { fullName: "asc" },
    }),
  ])

  // Apply teacher-id filter + text search after fetching the week data
  let teachers = allTeachers
  if (teacherIds.length > 0) {
    const idSet = new Set(teacherIds)
    teachers = teachers.filter(t => idSet.has(t.teacherId))
  }
  if (q) {
    teachers = teachers.filter(t => t.teacherName.toLowerCase().includes(q))
  }

  // KPI aggregates over the filtered teachers
  const totalScheduledTeachers = teachers.length
  const totalScheduledPeriods  = teachers.reduce((s, t) => s + t.weeklyPeriods, 0)
  const totalScheduledMinutes  = teachers.reduce((s, t) => s + t.weeklyMinutes, 0)
  const avgMinutesPerTeacher   = totalScheduledTeachers > 0 ? Math.round(totalScheduledMinutes / totalScheduledTeachers) : 0
  // Staff who don't appear in any routine entry = unscheduled
  const scheduledIds = new Set(allTeachers.map(t => t.teacherId))
  const unscheduledCount = schoolTeachers.filter(t => !scheduledIds.has(t.id)).length

  // Build a print-all URL preserving filters
  const printAllParams = new URLSearchParams()
  if (sp.academicYearId) printAllParams.set("academicYearId", sp.academicYearId)
  if (sp.facultyId)      printAllParams.set("facultyId",      sp.facultyId)
  if (sp.teacherId)      printAllParams.set("teacherId",      sp.teacherId)
  if (q)                 printAllParams.set("q",              q)
  const printAllHref = `/academics/routine/teachers/print${printAllParams.toString() ? `?${printAllParams}` : ""}`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher week</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One card per teacher showing the full week — days across, periods down.
            Weekly workload calculated from period durations on each schedule.
          </p>
        </div>
        <Link href={printAllHref} target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-sm shadow-primary/20">
            <Printer className="w-3.5 h-3.5" /> Print all
          </Button>
        </Link>
      </div>

      <RoutineTabs />

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Scheduled teachers" value={`${totalScheduledTeachers}`}                sub={unscheduledCount > 0 ? `${unscheduledCount} have no routine` : "All staffed"}  tone={unscheduledCount > 0 ? "amber" : "emerald"} icon={UserCog} />
        <Kpi label="Total periods/week" value={`${totalScheduledPeriods}`}                  sub="Across filtered scope" tone="primary"  icon={ListOrdered} />
        <Kpi label="Total hours/week"   value={formatHours(totalScheduledMinutes)}          sub="Teaching minutes summed" tone="sky"     icon={Clock} />
        <Kpi label="Avg per teacher"    value={formatHours(avgMinutesPerTeacher)}           sub={totalScheduledTeachers > 0 ? "Mean weekly workload" : "—"} tone="violet" icon={UsersIcon} />
      </div>

      {(() => {
        const scopedFacultyId: string | null =
          facultyIds.length === 1 && facultyIds[0] !== "none"
            ? facultyIds[0]
            : null
        const sessionLocked = scopedFacultyId !== null ||
          (facultyIds.length === 1 && facultyIds[0] === "none")
        const sessionAY = sessionLocked
          ? resolveCurrentForFaculty(academicYears, scopedFacultyId)
          : null
        const sessionFacultyName = scopedFacultyId
          ? (faculties.find(f => f.id === scopedFacultyId)?.name ?? null)
          : null

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <GlobalFiltersBar
                show={sessionLocked ? ["facultyId"] : ["academicYearId", "facultyId"]}
                faculties={faculties}
                classes={classes}
                academicYears={academicYears}
              />
              {sessionLocked && (
                <SessionBadge
                  facultyName={sessionFacultyName ?? "School-wide"}
                  yearName={sessionAY?.name ?? null}
                  isCurrent={sessionAY?.isCurrent}
                />
              )}
            </div>
            <TeacherFilter
              teachers={schoolTeachers.map(t => ({ id: t.id, name: t.fullName, avatarUrl: t.avatarUrl }))}
              selectedIds={teacherIds}
              initialQuery={q}
            />
          </div>
        )
      })()}

      {/* Teacher cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {teachers.map(t => (
          <TeacherWeekGrid
            key={t.teacherId}
            teacher={t}
            workloadLabel={formatHours(t.weeklyMinutes)}
            printHref={`/academics/routine/teachers/print?teacherId=${t.teacherId}${sp.academicYearId ? `&academicYearId=${sp.academicYearId}` : ""}`}
          />
        ))}
      </div>

      {teachers.length === 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-sm mb-1 text-slate-700">No teachers scheduled</p>
          <p className="text-xs text-slate-500">
            {teacherIds.length > 0 || q
              ? "No teachers match the current filter. Try clearing it."
              : "No routine entries for any teacher in the current scope yet."}
          </p>
        </div>
      )}
    </div>
  )
}

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "primary" | "emerald" | "amber" | "sky" | "violet" | "rose"
  icon: React.ElementType
}) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",     value: "text-amber-700" },
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",         value: "text-sky-700" },
    violet:  { ring: "ring-violet-100",  icon: "text-violet-600 bg-violet-50",   value: "text-violet-700" },
    rose:    { ring: "ring-rose-100",    icon: "text-rose-600 bg-rose-50",       value: "text-rose-700" },
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
      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>
    </div>
  )
}
