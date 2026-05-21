import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ClipboardCheck, ArrowRight, AlertCircle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getExamSummary } from "@/actions/exams"
import { listAttendanceSummary } from "@/actions/exam-attendance"
import { formatBS } from "@/lib/nepali-date"
import { ExamTabs } from "../exam-tabs"

export const metadata: Metadata = { title: "Exam Attendance" }

export default async function AttendanceLandingPage({
  params,
}: {
  params: Promise<{ domain: string; examId: string }>
}) {
  const { domain, examId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const summary = await getExamSummary(examId, school.id)
  if (!summary) notFound()

  const rows = await listAttendanceSummary(examId, school.id)

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
          <ClipboardCheck className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{summary.name} — Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mark presence per room per sitting. Absent students are mirrored into the terminal-exam marks
            (their score row will be flagged absent automatically).
          </p>
        </div>
      </div>

      <ExamTabs examId={examId} />

      {rows.length === 0 ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2.5" />
          <p className="font-bold text-sm text-amber-900 mb-1">No seated students yet</p>
          <p className="text-xs text-amber-700 max-w-md mx-auto leading-relaxed">
            Go to <Link href={`/academics/exams/${examId}/seats`} className="underline font-semibold">Seats</Link> and
            assign students to rooms first. Each (sitting × room) will then show up here.
          </p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50/60 border-b border-slate-100">
            <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Paper · Room</div>
            <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Date / Time</div>
            <div className="col-span-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</div>
          </div>
          <div className="divide-y divide-slate-100/60">
            {rows.map(r => {
              const remaining = Math.max(0, r.seatedCount - r.presentCount - r.absentCount - r.lateCount - r.debarredCount)
              return (
                <Link key={`${r.scheduleId}-${r.roomId}`}
                  href={`/academics/exams/${examId}/attendance/${r.scheduleId}/${r.roomId}`}
                  className="group grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  <div className="col-span-4 min-w-0">
                    <p className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span className="truncate">{r.paperName}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </p>
                    <p className="text-[11px] text-slate-400">Room <span className="font-mono">{r.roomName}</span> · {r.seatedCount} seated</p>
                  </div>
                  <div className="col-span-3 text-[11px] text-slate-600 font-mono tabular-nums">
                    {formatBS(r.dateBS)} · {r.startTime}
                  </div>
                  <div className="col-span-5 flex items-center gap-1.5 flex-wrap">
                    <Pill color="emerald" label="P" n={r.presentCount}  />
                    <Pill color="rose"    label="A" n={r.absentCount}   />
                    <Pill color="amber"   label="L" n={r.lateCount}     />
                    <Pill color="slate"   label="D" n={r.debarredCount} />
                    {remaining > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        {remaining} not marked
                      </span>
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

function Pill({
  color, label, n,
}: {
  color: "emerald" | "rose" | "amber" | "slate"
  label: string
  n:     number
}) {
  if (n === 0) return null
  const cls = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose:    "bg-rose-50 text-rose-700 border-rose-200",
    amber:   "bg-amber-50 text-amber-700 border-amber-200",
    slate:   "bg-slate-100 text-slate-700 border-slate-200",
  }[color]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border tabular-nums ${cls}`}>
      <span className="w-3 h-3 rounded-full bg-white/60 flex items-center justify-center text-[8px]">{label}</span>
      {n}
    </span>
  )
}
