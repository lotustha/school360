import { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarRange, Star, FolderTree, History, Info } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { listAcademicYears } from "@/actions/academic-years"
import { YearDrawer } from "./year-drawer"
import { YearsTable } from "./years-table"

export const metadata: Metadata = { title: "Academic Sessions" }

export default async function AcademicYearsPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true },
  })
  if (!school) notFound()

  const [years, faculties] = await Promise.all([
    listAcademicYears(school.id),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  // Stats
  const totalSessions   = years.length
  const currentSessions = years.filter(y => y.isCurrent).length
  const facultiesActive = new Set(years.map(y => y.facultyId ?? "__general__")).size
  const pastSessions    = totalSessions - currentSessions
  const currentNames    = years.filter(y => y.isCurrent).map(y => y.name)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each faculty can run its own session — Science on{" "}
            <span className="font-mono text-slate-700">2082/83</span>, General on{" "}
            <span className="font-mono text-slate-700">2082</span> — at the same time.
          </p>
        </div>
        <YearDrawer schoolId={school.id} faculties={faculties} />
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total sessions"  value={totalSessions}    sub="Across all faculties" tone="amber"   icon={CalendarRange} />
        <Kpi label="Currently active" value={currentSessions} sub={currentNames.length > 0 ? currentNames.join(", ") : "Mark one as current"} tone={currentSessions > 0 ? "emerald" : "rose"} icon={Star} />
        <Kpi label="Faculties active" value={facultiesActive} sub={faculties.length === 0 ? "Using General stream" : "With at least one session"} tone="violet" icon={FolderTree} />
        <Kpi label="Past sessions"    value={pastSessions}    sub="Archived" tone="slate" icon={History} />
      </div>

      {/* Setup hint */}
      {totalSessions === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">No academic sessions yet</p>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              Create at least one session and mark it as current. All exams, evaluations, and student enrolments
              are scoped to a session.
            </p>
          </div>
        </div>
      )}
      {totalSessions > 0 && currentSessions === 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-900">No session is marked as current</p>
            <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
              Edit one of the sessions below and toggle &quot;Current&quot; so the rest of the system knows which year to use by default.
            </p>
          </div>
        </div>
      )}

      <YearsTable schoolId={school.id} years={years} faculties={faculties} />
    </div>
  )
}

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: number; sub: string
  tone: "amber" | "emerald" | "violet" | "slate" | "rose"
  icon: React.ElementType
}) {
  const palette = {
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",     value: "text-amber-700" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    violet:  { ring: "ring-violet-100",  icon: "text-violet-600 bg-violet-50",   value: "text-violet-700" },
    slate:   { ring: "ring-slate-100",   icon: "text-slate-500 bg-slate-50",     value: "text-slate-700" },
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
      <p className="text-[10px] text-slate-500 mt-0.5 truncate" title={sub}>{sub}</p>
    </div>
  )
}
