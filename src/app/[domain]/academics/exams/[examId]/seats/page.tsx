import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft, Grid3X3, ArrowRight, CalendarClock, AlertCircle,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getExamSummary, listExamPapers } from "@/actions/exams"
import { formatBS } from "@/lib/nepali-date"
import { ExamTabs } from "../exam-tabs"

export const metadata: Metadata = { title: "Seat Plans" }

export default async function SeatsLandingPage({
  params,
}: {
  params: Promise<{ domain: string; examId: string }>
}) {
  const { domain, examId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const [summary, papers] = await Promise.all([
    getExamSummary(examId, school.id),
    listExamPapers(school.id, examId),
  ])
  if (!summary) notFound()

  const scheduled = papers.filter(p => p.schedule)
  // Fetch existing seat counts per schedule for the summary chip
  const schedIds = scheduled.map(p => p.schedule!.id)
  const seatCounts = schedIds.length === 0
    ? new Map<string, number>()
    : new Map(
        (await prisma.examSeat.groupBy({
          by:     ["scheduleId"],
          where:  { scheduleId: { in: schedIds }, paper: { schoolId: school.id } },
          _count: { _all: true },
        })).map(r => [r.scheduleId, r._count._all]),
      )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/academics/exams/${examId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Back to overview
          </Button>
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Grid3X3 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{summary.name} — Seat Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick a sitting to assign students to physical chairs across rooms.
          </p>
        </div>
      </div>

      <ExamTabs examId={examId} />

      {scheduled.length === 0 ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2.5" />
          <p className="font-bold text-sm text-amber-900 mb-1">No scheduled papers yet</p>
          <p className="text-xs text-amber-700 max-w-md mx-auto leading-relaxed">
            Schedule a paper in the routine first — drag it onto a day cell in
            <Link href={`/academics/exams/${examId}/routine`} className="ml-1 underline font-semibold">Routine</Link>.
          </p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100/60">
            {scheduled
              .sort((a, b) => {
                const ad = a.schedule!.dateAD instanceof Date ? a.schedule!.dateAD.getTime() : new Date(a.schedule!.dateAD).getTime()
                const bd = b.schedule!.dateAD instanceof Date ? b.schedule!.dateAD.getTime() : new Date(b.schedule!.dateAD).getTime()
                if (ad !== bd) return ad - bd
                return a.schedule!.startTime.localeCompare(b.schedule!.startTime)
              })
              .map(p => {
                const s = p.schedule!
                const seated = seatCounts.get(s.id) ?? 0
                return (
                  <Link
                    key={p.id}
                    href={`/academics/exams/${examId}/seats/${s.id}`}
                    className="group grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <div className="col-span-5">
                      <p className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {p.subjectName}
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {p.targets.length} target{p.targets.length === 1 ? "" : "s"} ·
                        <span className="ml-1 font-mono">{s.durationMin ?? p.durationMin}min</span>
                      </p>
                    </div>
                    <div className="col-span-3 text-[11px] text-slate-600 flex items-center gap-1.5">
                      <CalendarClock className="w-3 h-3 text-slate-400" />
                      <span className="font-mono tabular-nums">{formatBS(s.dateBS)}</span>
                    </div>
                    <div className="col-span-2 text-[11px] text-slate-600 font-mono tabular-nums">{s.startTime}</div>
                    <div className="col-span-2 text-right">
                      {seated > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Grid3X3 className="w-2.5 h-2.5" />
                          {seated} seated
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 italic">no seats yet</span>
                      )}
                    </div>
                  </Link>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
