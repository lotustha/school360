"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Printer, ArrowRight, GraduationCap, BookOpen, Award, Eye, EyeOff,
  Hash, CalendarRange, TrendingUp, TrendingDown, Users, AlertCircle, Download,
  Trophy, AlertTriangle, FileSignature,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList,
} from "recharts"
import * as XLSX from "xlsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import type {
  EvaluationReport, FailBuckets, GradeDistRow, SubjectRollup,
  GpaHistogramRow, StudentRollupRow, ClassReport,
} from "@/actions/evaluation-report"

interface EvalPickerOption {
  id:             string
  name:           string
  sequenceNumber: number
  isFinal:        boolean
  publishAt:      Date | null
  yearName:       string
  isCurrentYear:  boolean
  classCount:     number
  subjectsCount:  number
}

interface Props {
  report:      EvaluationReport
  evaluations: EvalPickerOption[]
}

export function ReportsClient({ report, evaluations }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function pickEvaluation(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("eval", id)
    params.delete("classes")
    router.push(`${pathname}?${params.toString()}`)
  }

  const printHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set("eval", report.evaluation.id)
    if (report.scope.classIds.length > 0 && report.scope.classIds.length < evaluations.length) {
      params.set("classes", report.scope.classIds.join(","))
    }
    return `/academics/evaluations/reports/print?${params.toString()}`
  }, [report, evaluations.length])

  function handleExportXlsx() { exportEvaluationReportXlsx(report) }

  return (
    <div className="space-y-4">
      {/* Picker + Actions */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-[260px]">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Evaluation</span>
          <Select value={report.evaluation.id} onValueChange={pickEvaluation}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {evaluations.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-bold">{e.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums">Seq {e.sequenceNumber}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] font-mono text-slate-500">{e.yearName}</span>
                    {e.isFinal && <span className="text-[10px] font-bold text-emerald-600">FINAL</span>}
                    {e.publishAt && <span className="text-[10px] font-bold text-emerald-600">PUBLISHED</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExportXlsx}
              className="gap-1.5 cursor-pointer text-xs h-9">
              <Download className="w-3.5 h-3.5" /> XLSX
            </Button>
            <Link href={printHref} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-9">
                <Printer className="w-3.5 h-3.5" /> Print A4 packet
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Executive summary */}
      <HeaderCard report={report} />
      <KpiBand report={report} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FailDistributionChart buckets={report.failBuckets} />
        <GradeDistributionChart rows={report.gradeDist} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SubjectPassRateChart rows={report.subjects} />
        <GpaHistogramChart rows={report.gpaHistogram} />
      </div>

      <SubjectTable rows={report.subjects} />

      {/* Per-class breakdown */}
      {report.byClass.length > 0 && (
        <div className="space-y-4">
          {report.byClass.map(c => <ClassBlock key={c.classId} block={c} />)}
        </div>
      )}

      {/* Roll of honour + actionable failer lists */}
      <RollOfHonour rows={report.rollOfHonour} />
      <FailerLists single={report.singleFailers} two={report.twoFailers} />
      <SignoffBlock />
    </div>
  )
}

// ─── XLSX export ───────────────────────────────────────────────────────

function exportEvaluationReportXlsx(report: EvaluationReport) {
  const wb = XLSX.utils.book_new()

  // Summary sheet
  const summary: (string | number)[][] = [
    [report.school.name],
    [report.evaluation.name],
    [`Session: ${report.evaluation.yearName} · Seq ${report.evaluation.sequenceNumber}${report.evaluation.isFinal ? " · FINAL" : ""}`],
    [`Classes: ${report.scope.classes.map(c => c.name).join(", ")}`],
    [`Generated: ${report.generatedAt.toISOString().slice(0, 16).replace("T", " ")}`],
    [],
    ["Metric", "Value"],
    ["Total students", report.rollup.totalStudents],
    ["Appeared", report.rollup.appeared],
    ["Pass", report.rollup.pass],
    ["Fail", report.rollup.fail],
    ["Incomplete", report.rollup.incomplete],
    ["Absent", report.rollup.absent],
    ["Pass %", report.rollup.passPct],
    ["Fail %", report.rollup.failPct],
    ["Average GPA", report.rollup.avgGpa ?? ""],
    ["Average %", report.rollup.avgPercent ?? ""],
    [],
    ["Fail bucket", "Students"],
    ["0 fails", report.failBuckets.zero],
    ["1 fail",  report.failBuckets.one],
    ["2 fail",  report.failBuckets.two],
    ["3 fail",  report.failBuckets.three],
    ["4+ fail", report.failBuckets.fourPlus],
    [],
    ["Grade", "Count", "% of appeared"],
    ...report.gradeDist.map(g => [g.grade, g.count, g.pct]),
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summary)
  summaryWs["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

  // Subjects sheet
  const subjectsAoa: (string | number)[][] = [
    ["Class", "Subject", "Code", "Type", "Taken", "Avg obtained", "Avg %", "Avg GPA", "Pass", "Fail", "Absent", "Pass rate %"],
    ...report.subjects.map(r => [
      r.className,
      r.subjectName,
      r.subjectCode ?? "",
      r.subjectType,
      r.studentsTaken,
      r.avgObtained ?? "",
      r.avgPercent ?? "",
      r.avgGpa ?? "",
      r.passCount,
      r.failCount,
      r.absentCount,
      r.passRate,
    ]),
  ]
  const subjectsWs = XLSX.utils.aoa_to_sheet(subjectsAoa)
  subjectsWs["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, subjectsWs, "Subjects")

  // Roll of honour
  const honourAoa: (string | number)[][] = [
    ["Rank", "Student", "Class", "Roll", "GPA", "Grade", "%"],
    ...report.rollOfHonour.map((s, i) => [
      i + 1,
      s.fullName,
      s.className,
      s.rollNumber ?? "",
      s.gpa ?? "",
      s.grade ?? "",
      s.percentage ?? "",
    ]),
  ]
  const honourWs = XLSX.utils.aoa_to_sheet(honourAoa)
  honourWs["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, honourWs, "Roll of Honour")

  // Single failers
  const singleFailers: (string | number)[][] = [
    ["Student", "Class", "Roll", "Failed subject", "Obtained", "Full"],
    ...report.singleFailers.map(s => [
      s.fullName,
      s.className,
      s.rollNumber ?? "",
      s.failedSubjects[0]?.subjectName ?? "",
      s.failedSubjects[0]?.obtained ?? "",
      s.failedSubjects[0]?.full ?? "",
    ]),
  ]
  const sfWs = XLSX.utils.aoa_to_sheet(singleFailers)
  sfWs["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, { wch: 10 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, sfWs, "Single-fail")

  // Two failers
  const twoFailers: (string | number)[][] = [
    ["Student", "Class", "Roll", "Failed subject 1", "Obt", "Full", "Failed subject 2", "Obt", "Full"],
    ...report.twoFailers.map(s => [
      s.fullName,
      s.className,
      s.rollNumber ?? "",
      s.failedSubjects[0]?.subjectName ?? "",
      s.failedSubjects[0]?.obtained ?? "",
      s.failedSubjects[0]?.full ?? "",
      s.failedSubjects[1]?.subjectName ?? "",
      s.failedSubjects[1]?.obtained ?? "",
      s.failedSubjects[1]?.full ?? "",
    ]),
  ]
  const tfWs = XLSX.utils.aoa_to_sheet(twoFailers)
  tfWs["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 24 }, { wch: 8 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, tfWs, "Two-fail")

  const fname = `evaluation-report-${report.evaluation.name.replace(/\s+/g, "-").toLowerCase()}.xlsx`
  XLSX.writeFile(wb, fname)
}

// ─── Sections (exported so the print view can reuse them) ──────────────

export function HeaderCard({ report }: { report: EvaluationReport }) {
  const ev = report.evaluation
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {report.school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.school.logoUrl} alt="" className="w-10 h-10 object-contain" />
        ) : (
          <Award className="w-6 h-6 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-bold text-slate-900 truncate">{report.school.name}</h1>
          <Badge variant="secondary" className="text-[10px] font-bold gap-1">
            <Hash className="w-2.5 h-2.5" /> Seq {ev.sequenceNumber}
          </Badge>
          {ev.isFinal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Award className="w-2.5 h-2.5" /> FINAL
            </span>
          )}
          {ev.publishAt ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Eye className="w-2.5 h-2.5" /> Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <EyeOff className="w-2.5 h-2.5" /> Draft
            </span>
          )}
        </div>
        <p className="text-sm text-slate-700 mt-0.5 font-semibold">{ev.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
          <CalendarRange className="w-3 h-3" />
          <span className="font-mono tabular-nums">{ev.yearName}</span>
          {ev.publishAtBS && (
            <>
              <span className="text-slate-300">·</span>
              <span>Published {formatBS(ev.publishAtBS)}</span>
            </>
          )}
          <span className="text-slate-300">·</span>
          <GraduationCap className="w-3 h-3" />
          <span>{report.scope.classes.length} class{report.scope.classes.length === 1 ? "" : "es"}</span>
          <span className="text-slate-300">·</span>
          <Users className="w-3 h-3" />
          <span>{report.rollup.totalStudents} student{report.rollup.totalStudents === 1 ? "" : "s"}</span>
          {ev.description && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-violet-700">{ev.description}</span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

export function KpiBand({ report }: { report: EvaluationReport }) {
  const r = report.rollup
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Kpi label="Students"   value={r.totalStudents} sub={r.appeared > 0 ? `${r.appeared} appeared` : "—"} accent="violet"  icon={<Users className="w-3.5 h-3.5" />} />
      <Kpi label="Pass"       value={r.pass}          sub={r.passPct > 0 ? `${r.passPct}%` : "—"}            accent="emerald" icon={<Eye className="w-3.5 h-3.5" />} />
      <Kpi label="Fail"       value={r.fail}          sub={r.failPct > 0 ? `${r.failPct}%` : "—"}            accent="rose"    icon={<EyeOff className="w-3.5 h-3.5" />} />
      <Kpi label="Incomplete" value={r.incomplete}    sub={r.incomplete > 0 ? "marks pending" : "all marks in"} accent="amber" icon={<AlertCircle className="w-3.5 h-3.5" />} />
      <Kpi label="Avg GPA"    value={r.avgGpa != null ? r.avgGpa.toFixed(2) : "—"} sub={r.avgPercent != null ? `${r.avgPercent.toFixed(1)}% avg` : "—"} accent="sky" icon={<TrendingUp className="w-3.5 h-3.5" />} />
      <Kpi label="Top / Low"  value={r.highest ? r.highest.gpa.toFixed(2) : "—"} sub={r.lowest ? `low ${r.lowest.gpa.toFixed(2)}` : "—"} accent="fuchsia" icon={<TrendingDown className="w-3.5 h-3.5" />} />
    </div>
  )
}

function Kpi({ label, value, sub, accent, icon }: { label: string; value: number | string; sub?: string; accent: "violet" | "emerald" | "rose" | "amber" | "sky" | "fuchsia"; icon: React.ReactNode }) {
  const ic = { violet: "text-violet-600", emerald: "text-emerald-600", rose: "text-rose-600", amber: "text-amber-600", sky: "text-sky-600", fuchsia: "text-fuchsia-600" }[accent]
  const dot = { violet: "bg-violet-500", emerald: "bg-emerald-500", rose: "bg-rose-500", amber: "bg-amber-500", sky: "bg-sky-500", fuchsia: "bg-fuchsia-500" }[accent]
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", ic)}>
          {icon}{label}
        </span>
        <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-slate-900 tabular-nums">{value}</span>
        {sub && <span className="text-[10px] text-slate-500 font-medium tabular-nums">{sub}</span>}
      </div>
    </div>
  )
}

// ─── Charts ────────────────────────────────────────────────────────────

export function FailDistributionChart({ buckets, animate = true }: { buckets: FailBuckets; animate?: boolean }) {
  const data = [
    { bucket: "0 fail",  count: buckets.zero,     color: "#10b981" },
    { bucket: "1 fail",  count: buckets.one,      color: "#f59e0b" },
    { bucket: "2 fail",  count: buckets.two,      color: "#fb923c" },
    { bucket: "3 fail",  count: buckets.three,    color: "#f43f5e" },
    { bucket: "4+ fail", count: buckets.fourPlus, color: "#be123c" },
  ]
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <ChartCard
      title="Fail distribution"
      subtitle={total > 0 ? `${total} students appeared · single-fail (${buckets.one}) and 2-fail (${buckets.two}) need follow-up` : "No students appeared yet"}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="bucket" stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="count" isAnimationActive={animate} radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            <LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#0f172a" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function GradeDistributionChart({ rows, animate = true }: { rows: GradeDistRow[]; animate?: boolean }) {
  const palette: Record<string, string> = {
    "A+": "#059669", "A": "#10b981", "B+": "#22c55e", "B": "#84cc16",
    "C+": "#eab308", "C":  "#f59e0b", "D":  "#fb923c", "NG": "#e11d48",
  }
  const total = rows.reduce((s, d) => s + d.count, 0)
  return (
    <ChartCard title="Grade distribution" subtitle={total > 0 ? `${total} appeared students` : "No students appeared yet"}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="grade" stroke="#94a3b8" tick={{ fontSize: 11, fontWeight: 700 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="count" isAnimationActive={animate} radius={[4, 4, 0, 0]}>
            {rows.map((d, i) => <Cell key={i} fill={palette[d.grade] ?? "#94a3b8"} />)}
            <LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#0f172a" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function SubjectPassRateChart({ rows, animate = true }: { rows: SubjectRollup[]; animate?: boolean }) {
  // Sort ascending so the weakest subjects float to the top of the chart.
  const data = [...rows]
    .sort((a, b) => a.passRate - b.passRate)
    .slice(0, 12)
    .map(r => ({
      label:    `${r.className} · ${r.subjectName}`,
      passRate: r.passRate,
      color:    r.passRate >= 80 ? "#10b981" : r.passRate >= 50 ? "#f59e0b" : "#f43f5e",
    }))
  const height = Math.max(220, data.length * 28)
  return (
    <ChartCard title="Subject pass-rate" subtitle={data.length > 0 ? "Weakest at top — focus remedial here" : "No subjects to rank yet"}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" stroke="#475569" tick={{ fontSize: 10 }} width={170} />
          <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v}%`, "Pass rate"]} />
          <Bar dataKey="passRate" isAnimationActive={animate} radius={[0, 4, 4, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            <LabelList dataKey="passRate" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fontWeight: 700, fill: "#0f172a" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function GpaHistogramChart({ rows, animate = true }: { rows: GpaHistogramRow[]; animate?: boolean }) {
  const palette: Record<string, string> = {
    "0-1": "#e11d48", "1-2": "#fb923c", "2-2.5": "#f59e0b",
    "2.5-3": "#84cc16", "3-3.5": "#22c55e", "3.5-4": "#059669",
  }
  const total = rows.reduce((s, d) => s + d.count, 0)
  return (
    <ChartCard title="Overall GPA distribution" subtitle={total > 0 ? `${total} students with computed GPA` : "No GPAs yet"}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="bucket" stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="count" isAnimationActive={animate} radius={[4, 4, 0, 0]}>
            {rows.map((d, i) => <Cell key={i} fill={palette[d.bucket] ?? "#94a3b8"} />)}
            <LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#0f172a" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Subject table ─────────────────────────────────────────────────────

export function SubjectTable({ rows }: { rows: SubjectRollup[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-sm mb-1">No subjects to report yet</p>
        <p className="text-xs text-muted-foreground">Seed subject evaluations for this evaluation to see roll-ups.</p>
      </div>
    )
  }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-800">Subject-wise summary</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{rows.length} subject × class rows. Pass-rate excludes Incomplete.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/60 border-b border-slate-100">
            <tr>
              <Th>Class</Th>
              <Th>Subject</Th>
              <Th align="right">Taken</Th>
              <Th align="right">Avg obtained</Th>
              <Th align="right">Avg %</Th>
              <Th align="right">Avg GPA</Th>
              <Th align="right">Pass</Th>
              <Th align="right">Fail</Th>
              <Th align="right">Pass rate</Th>
              <Th>Top grades</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {rows.map(r => {
              const topGrades = Object.entries(r.gradeDist).sort((a, b) => b[1] - a[1]).slice(0, 3)
              return (
                <tr key={`${r.className}::${r.subjectId}`} className="hover:bg-primary/5 transition-colors">
                  <Td>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {r.className}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-semibold text-slate-800">{r.subjectName}</span>
                    {r.subjectCode && <code className="ml-1.5 text-[10px] font-mono text-slate-400">{r.subjectCode}</code>}
                    {r.subjectType !== "REGULAR" && (
                      <span className={cn(
                        "ml-1.5 inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-bold",
                        r.subjectType === "EXTRA" ? "bg-violet-50 text-violet-700 border border-violet-200"
                                                  : "bg-amber-50 text-amber-700 border border-amber-200",
                      )}>{r.subjectType}</span>
                    )}
                  </Td>
                  <Td align="right" mono>{r.studentsTaken}</Td>
                  <Td align="right" mono>{r.avgObtained != null ? r.avgObtained.toFixed(1) : "—"}</Td>
                  <Td align="right" mono>{r.avgPercent != null ? `${r.avgPercent.toFixed(1)}%` : "—"}</Td>
                  <Td align="right" mono>{r.avgGpa != null ? r.avgGpa.toFixed(2) : "—"}</Td>
                  <Td align="right" mono><span className="text-emerald-700 font-bold">{r.passCount}</span></Td>
                  <Td align="right" mono>
                    <span className={cn("font-bold", r.failCount > 0 ? "text-rose-600" : "text-slate-400")}>{r.failCount}</span>
                  </Td>
                  <Td align="right">
                    <div className="inline-flex items-center gap-1.5 min-w-[80px] justify-end">
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn(
                          "h-full rounded-full",
                          r.passRate >= 80 ? "bg-emerald-500" : r.passRate >= 50 ? "bg-amber-500" : "bg-rose-500",
                        )} style={{ width: `${r.passRate}%` }} />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-700 w-9 text-right">{r.passRate}%</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1 flex-wrap">
                      {topGrades.map(([g, n]) => (
                        <span key={g} className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {g} <span className="text-slate-500 font-mono">×{n}</span>
                        </span>
                      ))}
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Per-class block ───────────────────────────────────────────────────

export function ClassBlock({ block }: { block: ClassReport }) {
  const r = block.rollup
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden report-section">
      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-primary/5 via-white to-white flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-sm text-slate-900">{block.className}</h3>
        <span className="text-[10px] text-slate-500 font-mono tabular-nums">
          {r.totalStudents} students · {r.pass} pass · {r.fail} fail · avg GPA {r.avgGpa != null ? r.avgGpa.toFixed(2) : "—"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-slate-100">
        <MiniKpi label="Pass"        value={r.pass}     sub={`${r.passPct}%`} tone="emerald" />
        <MiniKpi label="Fail"        value={r.fail}     sub={`${r.failPct}%`} tone="rose" />
        <MiniKpi label="Incomplete"  value={r.incomplete} sub="pending"        tone="amber" />
        <MiniKpi label="Avg %"       value={r.avgPercent != null ? `${r.avgPercent.toFixed(1)}%` : "—"} sub={`GPA ${r.avgGpa != null ? r.avgGpa.toFixed(2) : "—"}`} tone="sky" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-b border-slate-100">
        <PodiumList title="Top 3" tone="emerald" rows={block.top3} />
        <PodiumList title="Bottom 3" tone="rose"  rows={block.bottom3} />
      </div>

      {block.subjects.length > 0 && (
        <div className="p-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Subjects in this class</h4>
          <SubjectTableInline rows={block.subjects} />
        </div>
      )}
    </div>
  )
}

function MiniKpi({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone: "emerald" | "rose" | "amber" | "sky" }) {
  const text = { emerald: "text-emerald-700", rose: "text-rose-700", amber: "text-amber-700", sky: "text-sky-700" }[tone]
  return (
    <div className="bg-slate-50/70 rounded-lg p-2.5 text-center">
      <div className={cn("text-lg font-black tabular-nums", text)}>{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-[9px] text-slate-400 tabular-nums">{sub}</div>
    </div>
  )
}

function PodiumList({ title, tone, rows }: { title: string; tone: "emerald" | "rose"; rows: StudentRollupRow[] }) {
  const accent = tone === "emerald"
    ? { bg: "bg-emerald-50/60", border: "border-emerald-200", text: "text-emerald-700" }
    : { bg: "bg-rose-50/60",    border: "border-rose-200",    text: "text-rose-700" }
  return (
    <div className={cn("rounded-lg border p-3", accent.bg, accent.border)}>
      <h5 className={cn("text-[10px] font-black uppercase tracking-widest mb-2", accent.text)}>{title}</h5>
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">No graded students yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.studentId} className="flex items-center gap-2 text-xs">
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black", accent.text, "bg-white border", accent.border)}>{i + 1}</span>
              <span className="font-semibold text-slate-800 truncate flex-1">{r.fullName}</span>
              {r.rollNumber && <code className="text-[10px] font-mono text-slate-400">#{r.rollNumber}</code>}
              <span className={cn("font-mono tabular-nums text-[11px] font-bold", accent.text)}>{r.gpa?.toFixed(2) ?? "—"}</span>
              {r.grade && <span className={cn("text-[9px] font-black px-1 py-0 rounded", accent.bg, accent.text, accent.border, "border")}>{r.grade}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function SubjectTableInline({ rows }: { rows: SubjectRollup[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full text-xs">
        <thead className="bg-slate-50/80">
          <tr>
            <Th>Subject</Th>
            <Th align="right">Taken</Th>
            <Th align="right">Avg %</Th>
            <Th align="right">Avg GPA</Th>
            <Th align="right">Pass</Th>
            <Th align="right">Fail</Th>
            <Th align="right">Pass %</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/60">
          {rows.map(r => (
            <tr key={r.subjectId}>
              <Td><span className="font-semibold text-slate-800">{r.subjectName}</span></Td>
              <Td align="right" mono>{r.studentsTaken}</Td>
              <Td align="right" mono>{r.avgPercent != null ? `${r.avgPercent.toFixed(1)}%` : "—"}</Td>
              <Td align="right" mono>{r.avgGpa != null ? r.avgGpa.toFixed(2) : "—"}</Td>
              <Td align="right" mono><span className="text-emerald-700 font-bold">{r.passCount}</span></Td>
              <Td align="right" mono><span className={cn(r.failCount > 0 ? "text-rose-600 font-bold" : "text-slate-400")}>{r.failCount}</span></Td>
              <Td align="right" mono>{r.passRate}%</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Roll of honour ────────────────────────────────────────────────────

export function RollOfHonour({ rows }: { rows: StudentRollupRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center report-section">
        <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-sm mb-1">No graded students yet</p>
        <p className="text-xs text-muted-foreground">Roll of honour appears once students have computed GPAs.</p>
      </div>
    )
  }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden report-section">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-amber-50/60 via-white to-white flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-bold text-slate-800">Roll of honour</h3>
        <span className="text-[11px] text-slate-500">Top {rows.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/60 border-b border-slate-100">
            <tr>
              <Th align="right">Rank</Th>
              <Th>Student</Th>
              <Th>Class</Th>
              <Th>Roll</Th>
              <Th align="right">GPA</Th>
              <Th>Grade</Th>
              <Th align="right">%</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {rows.map((r, i) => (
              <tr key={r.studentId} className="hover:bg-primary/5 transition-colors">
                <Td align="right">
                  <span className={cn(
                    "inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black",
                    i === 0 ? "bg-amber-100 text-amber-700"
                    : i === 1 ? "bg-slate-100 text-slate-700"
                    : i === 2 ? "bg-orange-100 text-orange-700"
                    : "bg-slate-50 text-slate-500",
                  )}>{i + 1}</span>
                </Td>
                <Td><span className="font-semibold text-slate-800">{r.fullName}</span></Td>
                <Td>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {r.className}
                  </span>
                </Td>
                <Td mono>{r.rollNumber ?? "—"}</Td>
                <Td align="right" mono><span className="font-bold text-slate-800">{r.gpa?.toFixed(2) ?? "—"}</span></Td>
                <Td>{r.grade && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {r.grade}
                  </span>
                )}</Td>
                <Td align="right" mono>{r.percentage?.toFixed(1) ?? "—"}%</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Failer lists ──────────────────────────────────────────────────────

export function FailerLists({ single, two }: { single: StudentRollupRow[]; two: StudentRollupRow[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <FailerTable
        title="Single-subject failers"
        subtitle="Eligible for supplementary — escalate to admin."
        rows={single}
        emptyText="No single-subject failers — good news."
        accent="amber"
        cols={1}
      />
      <FailerTable
        title="Two-subject failers"
        subtitle="Borderline cases — requires committee review."
        rows={two}
        emptyText="No two-subject failers."
        accent="rose"
        cols={2}
      />
    </div>
  )
}

function FailerTable({
  title, subtitle, rows, emptyText, accent, cols,
}: {
  title:     string
  subtitle:  string
  rows:      StudentRollupRow[]
  emptyText: string
  accent:    "amber" | "rose"
  cols:      1 | 2
}) {
  const a = accent === "amber"
    ? { bar: "bg-amber-50/60", icon: "text-amber-600" }
    : { bar: "bg-rose-50/60",  icon: "text-rose-600" }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden report-section">
      <div className={cn("px-4 py-2.5 border-b border-slate-100 flex items-center gap-2", a.bar)}>
        <AlertTriangle className={cn("w-4 h-4", a.icon)} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
        <span className="text-[11px] font-bold text-slate-500 font-mono tabular-nums">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[11px] italic text-slate-400">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/60 border-b border-slate-100">
              <tr>
                <Th>Student</Th>
                <Th>Class</Th>
                <Th>Roll</Th>
                <Th>Subject 1</Th>
                <Th align="right">Obt / Full</Th>
                {cols === 2 && <Th>Subject 2</Th>}
                {cols === 2 && <Th align="right">Obt / Full</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {rows.map(r => (
                <tr key={r.studentId} className="hover:bg-primary/5">
                  <Td><span className="font-semibold text-slate-800">{r.fullName}</span></Td>
                  <Td>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {r.className}
                    </span>
                  </Td>
                  <Td mono>{r.rollNumber ?? "—"}</Td>
                  <Td><span className="font-semibold text-rose-700">{r.failedSubjects[0]?.subjectName ?? "—"}</span></Td>
                  <Td align="right" mono>
                    {r.failedSubjects[0] ? `${r.failedSubjects[0].obtained} / ${r.failedSubjects[0].full}` : "—"}
                  </Td>
                  {cols === 2 && <Td><span className="font-semibold text-rose-700">{r.failedSubjects[1]?.subjectName ?? "—"}</span></Td>}
                  {cols === 2 && <Td align="right" mono>
                    {r.failedSubjects[1] ? `${r.failedSubjects[1].obtained} / ${r.failedSubjects[1].full}` : "—"}
                  </Td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Sign-off block ────────────────────────────────────────────────────

export function SignoffBlock() {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-6 report-section">
      <div className="flex items-center gap-2 mb-4">
        <FileSignature className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800">Sign-off</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        <SigLine label="Prepared by" sub="Exam coordinator" />
        <SigLine label="Verified by" sub="Vice-principal / Section head" />
        <SigLine label="Approved by" sub="Principal" />
      </div>
      <p className="mt-6 text-[10px] text-slate-400 font-mono tabular-nums">
        Date of issue: ............................................... (BS)        Stamp:
      </p>
    </div>
  )
}

function SigLine({ label, sub }: { label: string; sub: string }) {
  return (
    <div>
      <div className="border-b border-slate-300 h-10" aria-hidden="true" />
      <p className="text-[11px] font-bold text-slate-800 mt-1">{label}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  )
}

// ─── Th / Td helpers ───────────────────────────────────────────────────

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500",
      align === "right" ? "text-right" : "text-left",
    )}>
      {children}
    </th>
  )
}
function Td({ children, align = "left", mono = false }: { children: React.ReactNode; align?: "left" | "right"; mono?: boolean }) {
  return (
    <td className={cn(
      "px-3 py-2 text-xs",
      align === "right" ? "text-right" : "text-left",
      mono && "font-mono tabular-nums",
    )}>
      {children}
    </td>
  )
}

export { ArrowRight }
