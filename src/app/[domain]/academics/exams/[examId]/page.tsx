import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft, CalendarRange, FileText, CalendarClock, AlertCircle, ArrowRight,
  DoorOpen, Grid3X3, UserCog, ClipboardCheck, CalendarOff, FolderTree, Building2,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getExamSummary, getExamRichSummary, listExamHolidays, getExamClasses } from "@/actions/exams"
import { formatBS } from "@/lib/nepali-date"
import { ExamTabs } from "./exam-tabs"
import { HolidaysDrawer } from "./holidays-drawer"

export const metadata: Metadata = { title: "Exam Overview" }

export default async function ExamOverviewPage({
  params,
}: {
  params: Promise<{ domain: string; examId: string }>
}) {
  const { domain, examId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const [summary, rich, holidays, examClassIds, faculty] = await Promise.all([
    getExamSummary(examId, school.id),
    getExamRichSummary(examId, school.id),
    listExamHolidays(examId, school.id),
    getExamClasses(examId, school.id),
    prisma.exam.findUnique({
      where:  { id: examId },
      select: { facultyId: true, faculty: { select: { name: true } } },
    }),
  ])
  if (!summary || !rich) notFound()

  const scheduledPct  = rich.paperCount > 0       ? Math.round((rich.scheduledCount  / rich.paperCount)       * 100) : 0
  const invigPct      = rich.invigilatorTotal > 0 ? Math.round((rich.invigilatorRooms / rich.invigilatorTotal) * 100) : 0
  const attendancePct = rich.attendanceTotal > 0  ? Math.round((rich.attendanceMarked / rich.attendanceTotal)  * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/academics/exams">
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> All exams
          </Button>
        </Link>
      </div>

      {/* Hero */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CalendarRange className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-900">{summary.name}</h1>
            {faculty?.facultyId ? (
              <Badge className="text-[10px] font-bold gap-1 bg-violet-50 text-violet-700 border-violet-200">
                <FolderTree className="w-2.5 h-2.5" /> {faculty.faculty?.name}
              </Badge>
            ) : (
              <Badge className="text-[10px] font-bold gap-1 bg-slate-100 text-slate-700 border-slate-200">
                <Building2 className="w-2.5 h-2.5" /> General
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Session <span className="font-mono text-slate-700">{summary.academicYearName}</span>
            {examClassIds.length > 0 && (
              <span className="ml-2 text-[11px] text-slate-500">
                · {examClassIds.length} class{examClassIds.length === 1 ? "" : "es"}
              </span>
            )}
          </p>
        </div>
      </div>

      <ExamTabs examId={examId} />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile
          href={`/academics/exams/${examId}/routine`}
          icon={<FileText className="w-4 h-4" />}
          accent="violet"
          label="Papers"
          value={rich.paperCount}
        />
        <StatTile
          href={`/academics/exams/${examId}/routine`}
          icon={<CalendarClock className="w-4 h-4" />}
          accent="emerald"
          label="Scheduled"
          value={rich.scheduledCount}
          sub={`${scheduledPct}%`}
        />
        <StatTile
          href={`/academics/exams/${examId}/seats`}
          icon={<DoorOpen className="w-4 h-4" />}
          accent="amber"
          label="Rooms used"
          value={rich.roomCount}
        />
        <StatTile
          href={`/academics/exams/${examId}/seats`}
          icon={<Grid3X3 className="w-4 h-4" />}
          accent="sky"
          label="Seats assigned"
          value={rich.seatsAssigned}
        />
        <StatTile
          href={`/academics/exams/${examId}/invigilators`}
          icon={<UserCog className="w-4 h-4" />}
          accent="rose"
          label="Invigilator cov."
          value={rich.invigilatorRooms}
          sub={`${invigPct}%`}
        />
        <StatTile
          href={`/academics/exams/${examId}/attendance`}
          icon={<ClipboardCheck className="w-4 h-4" />}
          accent="fuchsia"
          label="Attendance"
          value={rich.attendanceMarked}
          sub={`${attendancePct}%`}
        />
      </div>

      {/* Date span hint */}
      {summary.firstDateBS && summary.lastDateBS && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm px-5 py-3 text-xs text-slate-600 flex items-center gap-2 flex-wrap">
          <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
          <span>Scheduled span:</span>
          <code className="font-mono font-bold text-slate-800">{formatBS(summary.firstDateBS)}</code>
          <span className="text-slate-400">→</span>
          <code className="font-mono font-bold text-slate-800">{formatBS(summary.lastDateBS)}</code>
          <div className="flex-1" />
          {rich.unscheduledCount > 0 && (
            <Link href={`/academics/exams/${examId}/routine`}
              className="text-[11px] font-bold text-amber-700 hover:underline flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {rich.unscheduledCount} unscheduled paper{rich.unscheduledCount === 1 ? "" : "s"}
            </Link>
          )}
        </div>
      )}

      {/* Holidays section */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5 flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
          <CalendarOff className="w-5 h-5 text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-800">Exam holidays</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {holidays.length === 0
              ? "No blocked dates. Add holidays so they're skipped during routine planning."
              : `${holidays.length} blocked date${holidays.length === 1 ? "" : "s"} in this terminal — these are skipped when planning the routine.`}
          </p>
        </div>
        <HolidaysDrawer schoolId={school.id} examId={examId} initialHolidays={holidays} />
      </div>

      {/* Quick action grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction
          href={`/academics/exams/${examId}/routine`}
          icon={<CalendarRange className="w-4 h-4 text-violet-600" />}
          accent="violet"
          title="Build routine"
          subtitle="Drag subjects onto days"
        />
        <QuickAction
          href={`/academics/exams/${examId}/seats`}
          icon={<Grid3X3 className="w-4 h-4 text-emerald-600" />}
          accent="emerald"
          title="Seat plan"
          subtitle="Auto-assign students to rooms"
        />
        <QuickAction
          href={`/academics/exams/${examId}/invigilators`}
          icon={<UserCog className="w-4 h-4 text-rose-600" />}
          accent="rose"
          title="Invigilators"
          subtitle="Pick teachers per room"
        />
        <QuickAction
          href={`/academics/exams/${examId}/attendance`}
          icon={<ClipboardCheck className="w-4 h-4 text-amber-600" />}
          accent="amber"
          title="Attendance"
          subtitle="Mark room-by-room"
        />
      </div>
    </div>
  )
}

function StatTile({
  href, icon, label, value, accent, sub,
}: {
  href:   string
  icon:   React.ReactNode
  label:  string
  value:  number
  accent: "violet" | "emerald" | "amber" | "sky" | "rose" | "fuchsia"
  sub?:   string
}) {
  const dot = {
    violet:  "bg-violet-500",
    emerald: "bg-emerald-500",
    amber:   "bg-amber-500",
    sky:     "bg-sky-500",
    rose:    "bg-rose-500",
    fuchsia: "bg-fuchsia-500",
  }[accent]
  const ic = {
    violet:  "text-violet-600",
    emerald: "text-emerald-600",
    amber:   "text-amber-600",
    sky:     "text-sky-600",
    rose:    "text-rose-600",
    fuchsia: "text-fuchsia-600",
  }[accent]
  return (
    <Link href={href}
      className="group bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-center gap-2">
        <span className={ic}>{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-slate-900 tabular-nums">{value}</span>
        {sub && <span className="text-[11px] text-slate-400 font-medium tabular-nums">{sub}</span>}
        <span className={`ml-auto w-1.5 h-1.5 rounded-full ${dot}`} />
      </div>
      <div className="mt-1 text-[10px] text-slate-400 font-bold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="w-2.5 h-2.5" />
      </div>
    </Link>
  )
}

function QuickAction({
  href, icon, accent, title, subtitle,
}: {
  href:     string
  icon:     React.ReactNode
  accent:   "violet" | "emerald" | "amber" | "rose"
  title:    string
  subtitle: string
}) {
  const bg = {
    violet:  "from-violet-50/80",
    emerald: "from-emerald-50/80",
    amber:   "from-amber-50/80",
    rose:    "from-rose-50/80",
  }[accent]
  return (
    <Link href={href}
      className={`group bg-gradient-to-br ${bg} via-white to-white rounded-xl border border-white/40 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-bold text-slate-800">{title}</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{subtitle}</p>
      <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-primary transition-colors">
        Open <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  )
}

