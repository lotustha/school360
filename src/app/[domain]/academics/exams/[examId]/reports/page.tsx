import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft, FileBarChart2, GraduationCap, FolderTree, Users, FileText,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, Sigma,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getExamReportOverview, type ClassReportRow } from "@/actions/exam-reports"
import { ExamTabs } from "../exam-tabs"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Exam Reports" }

export default async function ExamReportsPage({
  params,
}: {
  params: Promise<{ domain: string; examId: string }>
}) {
  const { domain, examId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const overview = await getExamReportOverview(examId, school.id)
  if (!overview) notFound()

  const completionPct = overview.scoresExpected > 0
    ? Math.round((overview.scoresEntered / overview.scoresExpected) * 100)
    : 0

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
          <FileBarChart2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{overview.examName} — Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Class-wise pass/fail summary and printable mark sheets. Pick a class to drill into its full mark sheet.
          </p>
        </div>
      </div>

      <ExamTabs examId={examId} />

      {/* Exam-wide stat cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Students"
          value={String(overview.totalStudents)}
          tint="emerald"
        />
        <StatCard
          icon={<FileText className="w-4 h-4" />}
          label="Papers"
          value={String(overview.totalPapers)}
          tint="violet"
        />
        <StatCard
          icon={<Sigma className="w-4 h-4" />}
          label="Marks entered"
          value={`${overview.scoresEntered} / ${overview.scoresExpected}`}
          tint="amber"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Completion"
          value={`${completionPct}%`}
          tint={completionPct === 100 ? "emerald" : completionPct >= 50 ? "amber" : "rose"}
        />
      </div>

      {/* Per-class summary table */}
      {overview.classRows.length === 0 ? (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          No classes are assigned to this exam yet. Add classes from the exam editor first.
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">By Class</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th className="text-left pl-4">Class</Th>
                  <Th className="text-right">Students</Th>
                  <Th className="text-right">Papers</Th>
                  <Th className="text-left min-w-[180px]">Marks entered</Th>
                  <Th className="text-right">Avg %</Th>
                  <Th className="text-center">Pass</Th>
                  <Th className="text-center">Fail</Th>
                  <Th className="text-center">Incomplete</Th>
                  <Th className="text-right pr-4 w-12"><span className="sr-only">Open</span></Th>
                </tr>
              </thead>
              <tbody>
                {overview.classRows.map(r => (
                  <ClassReportRowView key={r.classId} examId={examId} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      "px-3 py-2 font-black uppercase tracking-widest text-slate-500 text-[10px] whitespace-nowrap",
      className,
    )}>
      {children}
    </th>
  )
}

function ClassReportRowView({ examId, row }: { examId: string; row: ClassReportRow }) {
  const href = `/academics/exams/${examId}/reports/${row.classId}`
  const completionPct = row.totalScoresExpected > 0
    ? Math.round((row.totalScoresEntered / row.totalScoresExpected) * 100)
    : 0
  const completionTone =
    completionPct === 100 ? "bg-emerald-500"
      : completionPct >= 50 ? "bg-amber-500"
      : "bg-rose-400"

  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-emerald-50/30 transition-colors group">
      {/* Class */}
      <td className="px-3 py-2 pl-4">
        <Link href={href} className="flex items-center gap-2.5 min-w-0 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-800 truncate group-hover:text-primary transition-colors">{row.className}</div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              {row.facultyName ? (
                <>
                  <FolderTree className="w-2.5 h-2.5 text-violet-600" />
                  <span className="truncate">{row.facultyName}</span>
                </>
              ) : (
                <span className="italic text-slate-400">General</span>
              )}
            </div>
          </div>
        </Link>
      </td>

      {/* Students */}
      <td className="px-3 py-2 text-right font-bold text-slate-700 tabular-nums">{row.studentCount}</td>

      {/* Papers */}
      <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{row.paperCount}</td>

      {/* Marks entered with progress bar */}
      <td className="px-3 py-2 min-w-[180px]">
        {row.totalScoresExpected === 0 ? (
          <span className="text-[11px] text-slate-400 italic">
            {row.studentCount === 0 ? "No students" : "No papers"}
          </span>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold tabular-nums">
              <span className="text-slate-700">{row.totalScoresEntered} / {row.totalScoresExpected}</span>
              <span className={cn(
                completionPct === 100 ? "text-emerald-600"
                  : completionPct >= 50 ? "text-amber-600"
                  : "text-rose-600",
              )}>{completionPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", completionTone)}
                style={{ width: `${Math.max(2, completionPct)}%` }}
              />
            </div>
          </div>
        )}
      </td>

      {/* Avg % */}
      <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-700">
        {row.averagePercent != null ? row.averagePercent.toFixed(1) : <span className="text-slate-300">—</span>}
      </td>

      {/* Pass */}
      <td className="px-3 py-2 text-center">
        <CountChip count={row.passCount} icon={<CheckCircle2 className="w-2.5 h-2.5" />} tone="emerald" />
      </td>

      {/* Fail */}
      <td className="px-3 py-2 text-center">
        <CountChip count={row.failCount} icon={<XCircle className="w-2.5 h-2.5" />} tone="rose" />
      </td>

      {/* Incomplete */}
      <td className="px-3 py-2 text-center">
        <CountChip count={row.notGradedCount} icon={<AlertCircle className="w-2.5 h-2.5" />} tone="slate" mutedWhenZero />
      </td>

      {/* Open chevron */}
      <td className="px-3 py-2 pr-4 text-right w-12">
        <Link
          href={href}
          aria-label={`Open ${row.className} mark sheet`}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  )
}

function CountChip({
  count, icon, tone, mutedWhenZero,
}: {
  count: number
  icon:  React.ReactNode
  tone:  "emerald" | "rose" | "slate"
  mutedWhenZero?: boolean
}) {
  const isZero = count === 0
  const cls = {
    emerald: isZero ? "bg-slate-50 text-slate-300 border-slate-100"
      : "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: isZero ? "bg-slate-50 text-slate-300 border-slate-100"
      : "bg-rose-50 text-rose-700 border-rose-200",
    slate: isZero && mutedWhenZero ? "bg-slate-50 text-slate-300 border-slate-100"
      : isZero ? "bg-slate-50 text-slate-400 border-slate-100"
      : "bg-slate-100 text-slate-700 border-slate-200",
  }[tone]
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border tabular-nums min-w-[28px] justify-center",
      cls,
    )}>
      {icon}
      {count}
    </span>
  )
}

// ─── Components ────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, tint,
}: {
  icon:  React.ReactNode
  label: string
  value: string
  tint:  "emerald" | "violet" | "amber" | "rose" | "slate"
}) {
  const tintBg = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    violet:  "bg-violet-50 text-violet-700 border-violet-200",
    amber:   "bg-amber-50 text-amber-700 border-amber-200",
    rose:    "bg-rose-50 text-rose-700 border-rose-200",
    slate:   "bg-slate-50 text-slate-700 border-slate-200",
  }[tint]
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${tintBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
        <div className="text-base font-bold text-slate-800 truncate tabular-nums">{value}</div>
      </div>
    </div>
  )
}

