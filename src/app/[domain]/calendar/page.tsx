import { Metadata } from "next"
import { CalendarDays, Sun, GraduationCap, PartyPopper } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requirePermission, hasPermission } from "@/lib/permissions"
import { listCalendarEvents, type CalendarEventRow } from "@/actions/calendar"
import { todayBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"
import { CalendarClient } from "./calendar-client"

export const metadata: Metadata = { title: "Academic Calendar" }

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const session = await requirePermission("calendar:view")
  const schoolId = session.user.schoolId!
  const { year: yearParam, month: monthParam } = await searchParams
  const canManage = await hasPermission(session, "calendar:manage")

  const years = await prisma.academicYear.findMany({
    where:   { schoolId },
    select:  { id: true, name: true, isCurrent: true, startDateBS: true, endDateBS: true },
    orderBy: [{ startDateBS: "desc" }, { name: "desc" }],
  })

  const selectedYear =
    years.find(y => y.id === yearParam) ??
    years.find(y => y.isCurrent) ??
    years[0] ??
    null

  const events: CalendarEventRow[] = selectedYear
    ? await listCalendarEvents(selectedYear.id)
    : []

  // Initial month: ?month=YYYY-MM if valid, else today's BS month.
  const initialMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : todayBS().slice(0, 7)

  const holidayCount  = events.filter(e => e.isHoliday).length
  const examCount     = events.filter(e => e.eventType === "EXAM").length
  const eventCount    = events.length - holidayCount - examCount

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Holidays, exams, and school events on the Bikram Sambat calendar
            {selectedYear ? ` — ${selectedYear.name}` : ""}.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          {events.length} entr{events.length === 1 ? "y" : "ies"} this year
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Holidays & breaks" value={`${holidayCount}`} sub="Days off school"          tone="rose"    icon={Sun} />
        <Stat label="Exams"             value={`${examCount}`}    sub="Exam windows scheduled"   tone="violet"  icon={GraduationCap} />
        <Stat label="Other events"      value={`${eventCount}`}   sub="PTMs, sports, cultural…"  tone="sky"     icon={PartyPopper} />
      </div>

      {years.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <CalendarDays className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No academic years configured yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Create an academic year in Academics settings first — calendar events live inside one.
          </p>
        </div>
      ) : (
        <CalendarClient
          years={years}
          selectedYearId={selectedYear!.id}
          events={events}
          initialMonth={initialMonth}
          canManage={canManage}
        />
      )}
    </div>
  )
}

function Stat({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "rose" | "violet" | "sky"
  icon: React.ElementType
}) {
  const palette = {
    rose:   { ring: "ring-rose-100",   icon: "text-rose-600 bg-rose-50",     value: "text-rose-700" },
    violet: { ring: "ring-violet-100", icon: "text-violet-600 bg-violet-50", value: "text-violet-700" },
    sky:    { ring: "ring-sky-100",    icon: "text-sky-600 bg-sky-50",       value: "text-sky-700" },
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
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
