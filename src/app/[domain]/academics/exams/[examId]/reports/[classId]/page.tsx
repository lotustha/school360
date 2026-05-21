import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft, FileBarChart2, GraduationCap, FolderTree,
  CheckCircle2, XCircle, AlertCircle, ShieldCheck,
} from "lucide-react"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar-img"
import { cn } from "@/lib/utils"
import { getClassMarkSheet } from "@/actions/exam-reports"
import { ExamTabs } from "../../exam-tabs"
import { PrintButton } from "./print-button"

export const metadata: Metadata = { title: "Class Mark Sheet" }

export default async function ClassMarkSheetPage({
  params,
}: {
  params: Promise<{ domain: string; examId: string; classId: string }>
}) {
  const { domain, examId, classId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const sheet = await getClassMarkSheet(examId, classId, school.id)
  if (!sheet) notFound()

  const passCount = sheet.students.filter(s => s.status === "PASS").length
  const failCount = sheet.students.filter(s => s.status === "FAIL").length
  const ngCount   = sheet.students.filter(s => s.status === "NOT_GRADED").length

  const totalCells = sheet.subjects.reduce((sum, s) => sum + s.studentCount, 0)
  const enteredCells = sheet.subjects.reduce((sum, s) => sum + s.enteredCount, 0)
  const completionPct = totalCells > 0 ? Math.round((enteredCells / totalCells) * 100) : 0
  const today = new Date().toLocaleDateString("en-NP", { year: "numeric", month: "long", day: "numeric" })

  return (
    <div className="space-y-5 print:space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <Link href={`/academics/exams/${examId}/reports`}>
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Back to reports
          </Button>
        </Link>
      </div>

      {/* Screen header */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4 print:hidden">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileBarChart2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">
            {sheet.examName} — {sheet.className} Mark Sheet
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" />
              {sheet.students.length} students
            </span>
            {sheet.facultyName && (
              <span className="inline-flex items-center gap-1">
                <FolderTree className="w-3.5 h-3.5 text-violet-600" />
                {sheet.facultyName}
              </span>
            )}
            <span className="text-slate-400">·</span>
            <span>Pass mark {sheet.passPercent}%</span>
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Print-only formal header (NEB-style) */}
      <div className="hidden print:flex items-center justify-center gap-4 pb-3 border-b-2 border-slate-800 mb-3">
        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {sheet.schoolLogo
            ? <Image src={sheet.schoolLogo} alt="" width={64} height={64} className="object-contain" unoptimized />
            : <ShieldCheck className="w-8 h-8 text-slate-400" />}
        </div>
        <div className="text-center">
          <div className="text-xl font-black uppercase tracking-wide text-slate-900">{sheet.schoolName}</div>
          {sheet.schoolAddress && (
            <div className="text-[10px] text-slate-600 mt-0.5">{sheet.schoolAddress}</div>
          )}
          <div className="text-sm font-bold text-slate-800 mt-1">
            {sheet.examName} — Class {sheet.className}
            {sheet.facultyName && <span className="font-medium"> · {sheet.facultyName}</span>}
            <span className="font-medium"> · Mark Sheet</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Generated {today} · Pass mark {sheet.passPercent}%
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <ExamTabs examId={examId} />
      </div>

      {/* Summary + subject completion strip */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> {passCount} pass
            </Badge>
            <Badge variant="outline" className="gap-1 bg-rose-50 text-rose-700 border-rose-200">
              <XCircle className="w-3 h-3" /> {failCount} fail
            </Badge>
            {ngCount > 0 && (
              <Badge variant="outline" className="gap-1 bg-slate-50 text-slate-600 border-slate-200">
                <AlertCircle className="w-3 h-3" /> {ngCount} incomplete
              </Badge>
            )}
          </div>
          <div className="text-[11px] font-semibold text-slate-500">
            Overall entry: <span className="text-slate-800 font-bold tabular-nums">{enteredCells} / {totalCells}</span>
            <span className={cn(
              "ml-1.5 font-bold",
              completionPct === 100 ? "text-emerald-600"
                : completionPct >= 50 ? "text-amber-600"
                : "text-rose-600",
            )}>· {completionPct}%</span>
          </div>
        </div>

        {sheet.subjects.length > 0 && (
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Subject-wise entry progress
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {sheet.subjects.map(s => {
                const pct = s.studentCount > 0 ? Math.round((s.enteredCount / s.studentCount) * 100) : 0
                const tone = pct === 100 ? "emerald" : pct === 0 ? "rose" : "amber"
                return (
                  <div key={s.subjectId} className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-white",
                    tone === "emerald" && "border-emerald-200",
                    tone === "amber"   && "border-amber-200",
                    tone === "rose"    && "border-rose-200",
                  )}>
                    <span className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      tone === "emerald" && "bg-emerald-500",
                      tone === "amber"   && "bg-amber-500",
                      tone === "rose"    && "bg-rose-400",
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-800 truncate leading-tight">
                        {s.subjectName}
                      </div>
                      <div className="text-[9px] text-slate-500 tabular-nums">
                        {s.enteredCount} / {s.studentCount} entered
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded",
                      tone === "emerald" && "bg-emerald-100 text-emerald-700",
                      tone === "amber"   && "bg-amber-100 text-amber-800",
                      tone === "rose"    && "bg-rose-100 text-rose-700",
                    )}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {sheet.subjects.length === 0 ? (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          No papers are targeted to this class yet. Add papers in the Routine tab.
        </div>
      ) : sheet.students.length === 0 ? (
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
          No active students in this class.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto print:border-0 print:shadow-none print:rounded-none print:overflow-visible">
            <table className="w-full text-xs print:text-[10px] border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 print:bg-slate-100">
                <tr className="print:border print:border-slate-800">
                  <th className="px-3 py-2 text-left font-black uppercase tracking-wider text-slate-500 text-[10px] sticky left-0 bg-slate-50 print:static print:bg-slate-100 print:border print:border-slate-800 print:text-slate-900">Roll</th>
                  <th className="px-3 py-2 text-left font-black uppercase tracking-wider text-slate-500 text-[10px] sticky left-12 bg-slate-50 min-w-[180px] print:static print:bg-slate-100 print:border print:border-slate-800 print:text-slate-900">Student</th>
                  {sheet.subjects.map(s => (
                    <th key={s.subjectId} className="px-2 py-2 text-center font-bold text-slate-600 text-[10px] border-l border-slate-200 min-w-[72px] print:border print:border-slate-800 print:text-slate-900">
                      <div className="leading-tight">{s.subjectName}</div>
                      <div className="text-[9px] font-mono text-slate-400 tabular-nums print:text-slate-600">
                        {s.fullMarks} · pass {s.passMarks}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-black uppercase tracking-wider text-slate-700 text-[10px] border-l-2 border-slate-300 bg-emerald-50/50 print:border print:border-slate-800 print:bg-slate-100">Total</th>
                  <th className="px-3 py-2 text-center font-black uppercase tracking-wider text-slate-700 text-[10px] bg-emerald-50/50 print:border print:border-slate-800 print:bg-slate-100">%</th>
                  <th className="px-3 py-2 text-center font-black uppercase tracking-wider text-slate-700 text-[10px] bg-emerald-50/50 print:border print:border-slate-800 print:bg-slate-100">Grade</th>
                  <th className="px-3 py-2 text-center font-black uppercase tracking-wider text-slate-700 text-[10px] bg-emerald-50/50 print:border print:border-slate-800 print:bg-slate-100">Result</th>
                </tr>
              </thead>
              <tbody>
                {sheet.students.map((stu, i) => (
                  <tr
                    key={stu.studentId}
                    className={cn(
                      "border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition-colors",
                      "print:break-inside-avoid",
                      stu.status === "FAIL"        && "bg-rose-50/30 print:bg-white",
                      stu.status === "NOT_GRADED"  && "bg-slate-50/40 print:bg-white",
                      stu.status === "ABSENT"      && "bg-slate-50/40 print:bg-white",
                    )}
                  >
                    <td className="px-3 py-1.5 text-slate-500 font-mono tabular-nums text-[11px] sticky left-0 bg-inherit print:static print:bg-white print:border print:border-slate-400 print:text-slate-700">
                      {stu.rollNumber ?? i + 1}
                    </td>
                    <td className="px-3 py-1.5 sticky left-12 bg-inherit print:static print:bg-white print:border print:border-slate-400">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={stu.fullName} url={stu.avatarUrl} size={22} />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{stu.fullName}</div>
                          <div className="text-[9px] text-slate-400 font-mono tabular-nums print:text-slate-600">{stu.admissionNo}</div>
                        </div>
                      </div>
                    </td>
                    {sheet.subjects.map(subj => {
                      const cell = stu.cells[subj.subjectId]
                      return (
                        <td
                          key={subj.subjectId}
                          className={cn(
                            "px-2 py-1.5 text-center border-l border-slate-100 tabular-nums font-medium print:border print:border-slate-400",
                            cell?.optedOut         ? "text-slate-300 italic bg-slate-50/60 print:bg-slate-50 print:text-slate-500"
                              : !cell || cell.raw == null ? "text-slate-300 print:text-slate-500"
                              : cell.isAbsent      ? "text-slate-400 italic print:text-slate-600"
                              : cell.isFail        ? "text-rose-600 font-bold print:text-black print:underline"
                              : "text-slate-700 print:text-black",
                          )}
                          title={cell?.optedOut ? "Not taken (optional)" : undefined}
                        >
                          {!cell ? "—"
                            : cell.optedOut       ? "N/A"
                            : cell.isAbsent       ? "AB"
                            : cell.raw == null    ? "—"
                            : cell.raw}
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 text-center font-bold text-slate-800 border-l-2 border-slate-300 tabular-nums bg-emerald-50/30 print:bg-white print:border print:border-slate-400">
                      {stu.obtained}<span className="text-[10px] text-slate-400 print:text-slate-600">/{stu.total}</span>
                    </td>
                    <td className="px-3 py-1.5 text-center tabular-nums font-bold text-slate-700 bg-emerald-50/30 print:bg-white print:border print:border-slate-400">
                      {stu.status === "NOT_GRADED" ? "—" : stu.percent.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-center font-black text-slate-800 bg-emerald-50/30 print:bg-white print:border print:border-slate-400">
                      {stu.status === "NOT_GRADED" ? "—" : stu.grade}
                    </td>
                    <td className="px-3 py-1.5 text-center bg-emerald-50/30 print:bg-white print:border print:border-slate-400">
                      <ResultBadge status={stu.status} failedSubjects={stu.failedSubjects} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Print-only summary + signature block */}
          <div className="hidden print:block mt-4 pt-3 border-t border-slate-300">
            <div className="grid grid-cols-3 gap-6 text-[10px]">
              <div>
                <div className="font-bold text-slate-700 mb-1">Summary</div>
                <div>Students: <span className="font-mono tabular-nums">{sheet.students.length}</span></div>
                <div>Pass: <span className="font-mono tabular-nums">{passCount}</span></div>
                <div>Fail: <span className="font-mono tabular-nums">{failCount}</span></div>
                {ngCount > 0 && <div>Incomplete: <span className="font-mono tabular-nums">{ngCount}</span></div>}
              </div>
              <div className="text-center pt-4">
                <div className="border-t border-slate-700 pt-1 mx-4">Class Teacher</div>
              </div>
              <div className="text-center pt-4">
                <div className="border-t border-slate-700 pt-1 mx-4">Principal</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Print page setup */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 14mm 10mm; }
          html, body { background: white !important; }
          /* Suppress app chrome */
          aside, header, [data-slot="sidebar"], [data-slot="sidebar-container"], [data-slot="sidebar-gap"] { display: none !important; }
          [data-slot="sidebar-inset"] { margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          main { padding: 0 !important; background: white !important; }
          main > div { padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}

function ResultBadge({
  status, failedSubjects,
}: {
  status:         "PASS" | "FAIL" | "NOT_GRADED" | "ABSENT"
  failedSubjects: number
}) {
  if (status === "PASS") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
        Pass
      </span>
    )
  }
  if (status === "FAIL") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200"
        title={failedSubjects > 0 ? `${failedSubjects} subject(s) below pass mark` : undefined}
      >
        Fail{failedSubjects > 0 && <span className="text-rose-500 font-medium">·{failedSubjects}</span>}
      </span>
    )
  }
  if (status === "ABSENT") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        Absent
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
      Incomplete
    </span>
  )
}
