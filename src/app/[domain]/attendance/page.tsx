import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { CalendarDays, CheckCircle2, Clock, AlertCircle, ArrowRight, Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getTodaySummary } from "@/actions/attendance"
import { formatBS, todayBS } from "@/lib/nepali-date"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Attendance" }

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const today      = todayBS()
  const summary    = await getTodaySummary(school.id)
  const total      = summary.length
  const completed  = summary.filter(s => s.isComplete).length
  const totalStud  = summary.reduce((a, s) => a + s.total, 0)
  const totalPres  = summary.reduce((a, s) => a + s.present, 0)
  const totalAbs   = summary.reduce((a, s) => a + s.absent, 0)

  return (
    <div className="space-y-7 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Attendance</h1>
            <p className="text-sm text-muted-foreground">{formatBS(today)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/attendance/history`}>
            <Button variant="outline" size="sm" className="cursor-pointer gap-1.5">
              History
            </Button>
          </Link>
          <Link href={`/attendance/take`}>
            <Button size="sm" className="cursor-pointer gap-1.5 shadow-md shadow-primary/20">
              <Plus className="w-4 h-4" /> Take Attendance
            </Button>
          </Link>
        </div>
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Sections",    value: total,       sub: "configured",       color: "text-primary",    bg: "bg-primary/8" },
          { label: "Completed",   value: completed,   sub: `of ${total} today`, color: "text-emerald-600", bg: "bg-emerald-500/8" },
          { label: "Present",     value: totalPres,   sub: "students today",   color: "text-blue-600",   bg: "bg-blue-500/8" },
          { label: "Absent",      value: totalAbs,    sub: "students today",   color: "text-rose-600",   bg: "bg-rose-500/8" },
        ].map(stat => (
          <div key={stat.label}
            className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-5 shadow-sm">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", stat.bg)}>
              <CalendarDays className={cn("w-4 h-4", stat.color)} />
            </div>
            <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
            <div className="text-sm font-medium mt-0.5">{stat.label}</div>
            <div className="text-xs text-muted-foreground">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Section status grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Today's Status by Section
          </h2>
          <Badge variant="outline" className="text-xs">
            {completed}/{total} submitted
          </Badge>
        </div>

        {summary.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-12 text-center">
            <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No sections configured yet.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Add classes and sections first.</p>
            <Link href="/academics">
              <Button variant="outline" size="sm" className="mt-4 cursor-pointer gap-1.5">
                Go to Academics <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.map(sec => (
              <Link
                key={sec.sectionId}
                href={`/attendance/take?classId=${sec.classId}&sectionId=${sec.sectionId}`}
                className="block"
              >
                <div className={cn(
                  "bg-white/70 backdrop-blur-xl rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer group",
                  sec.isComplete
                    ? "border-emerald-500/25 hover:border-emerald-500/40"
                    : "border-white/40 hover:border-primary/30"
                )}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">{sec.className}</p>
                      <p className="text-xs text-muted-foreground">Section {sec.sectionName}</p>
                    </div>
                    {sec.isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    ) : sec.marked > 0 ? (
                      <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 rounded-full bg-muted/50 mb-3 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        sec.isComplete ? "bg-emerald-500" : "bg-primary"
                      )}
                      style={{ width: `${sec.total > 0 ? (sec.marked / sec.total) * 100 : 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex gap-3">
                      <span className="text-emerald-600 font-medium">{sec.present} P</span>
                      <span className="text-rose-600 font-medium">{sec.absent} A</span>
                      {sec.late > 0 && <span className="text-amber-600 font-medium">{sec.late} L</span>}
                    </div>
                    <span>{sec.marked}/{sec.total} marked</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
