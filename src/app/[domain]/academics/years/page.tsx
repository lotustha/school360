import { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarRange, Star, FolderTree, History } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { listAcademicYears } from "@/actions/academic-years"
import { YearDrawer } from "./year-drawer"
import { YearsTable } from "./years-table"

export const metadata: Metadata = { title: "Academic Years" }

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

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
          <CalendarRange className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">Academic Sessions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each faculty runs its own session — Science on{" "}
            <span className="font-mono text-slate-700">2082/83</span>, General on{" "}
            <span className="font-mono text-slate-700">2082</span> — at the same time.
          </p>
        </div>
        <YearDrawer schoolId={school.id} faculties={faculties} />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          icon={<CalendarRange className="w-4 h-4 text-amber-600" />}
          accent="amber"
          label="Total sessions"
          value={totalSessions}
        />
        <StatTile
          icon={<Star className="w-4 h-4 text-emerald-600" />}
          accent="emerald"
          label="Currently active"
          value={currentSessions}
        />
        <StatTile
          icon={<FolderTree className="w-4 h-4 text-violet-600" />}
          accent="violet"
          label="Faculties with sessions"
          value={facultiesActive}
        />
        <StatTile
          icon={<History className="w-4 h-4 text-slate-500" />}
          accent="slate"
          label="Past sessions"
          value={pastSessions}
        />
      </div>

      <YearsTable schoolId={school.id} years={years} faculties={faculties} />
    </div>
  )
}

function StatTile({
  icon, accent, label, value,
}: {
  icon:   React.ReactNode
  accent: "amber" | "emerald" | "violet" | "slate"
  label:  string
  value:  number
}) {
  const dot: Record<typeof accent, string> = {
    amber:   "bg-amber-500",
    emerald: "bg-emerald-500",
    violet:  "bg-violet-500",
    slate:   "bg-slate-400",
  }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-black text-slate-900 tabular-nums">{value}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${dot[accent]}`} />
      </div>
    </div>
  )
}
