import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ClipboardCheck, Award } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getStudentLedger } from "@/actions/evaluation-results"
import { EvaluationTabs } from "../../evaluation-tabs"
import { PrintButton } from "./print-button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Student Ledger" }

type SP = { year?: string }

export default async function StudentLedgerPage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string; studentId: string }>
  searchParams: Promise<SP>
}) {
  const { domain, studentId } = await params
  const sp                    = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  // Resolve year: use ?year= or fall back to student's enrolled year or current school year.
  let academicYearId: string | null = sp.year ?? null
  if (!academicYearId) {
    const student = await prisma.student.findFirst({
      where:  { id: studentId, schoolId: school.id },
      select: { academicYearId: true },
    })
    academicYearId = student?.academicYearId ?? null
  }
  if (!academicYearId) {
    const current = await prisma.academicYear.findFirst({
      where:  { schoolId: school.id, isCurrent: true },
      select: { id: true },
    })
    academicYearId = current?.id ?? null
  }
  if (!academicYearId) notFound()

  const ledger = await getStudentLedger({ schoolId: school.id, studentId, academicYearId })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 print:hidden">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Student Academic Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Year-long record across all evaluations
          </p>
        </div>
      </div>

      <div className="print:hidden">
        <EvaluationTabs />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <Link
          href="/academics/evaluations/ledger"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Class Ledger
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/academics/evaluations/transcript/${studentId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <Award className="w-3.5 h-3.5" /> Open Transcript
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Student header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {ledger.student.photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={ledger.student.photoUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-base font-bold text-primary">{initials(ledger.student.fullName)}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base text-slate-800 truncate">{ledger.student.fullName}</h3>
          <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <span><strong className="text-slate-700">Class:</strong> {ledger.student.className}</span>
            {ledger.student.sectionName && <span><strong className="text-slate-700">Section:</strong> {ledger.student.sectionName}</span>}
            <span><strong className="text-slate-700">Roll:</strong> {ledger.student.rollNumber ?? "—"}</span>
            <span><strong className="text-slate-700">Adm. No:</strong> {ledger.student.admissionNo}</span>
            {ledger.student.symbolNumber && <span><strong className="text-slate-700">Symbol:</strong> {ledger.student.symbolNumber}</span>}
            <span><strong className="text-slate-700">Session:</strong> {ledger.yearName}</span>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end flex-shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Year Average</div>
          <div className="text-2xl font-black text-primary">
            {ledger.yearPercent === null ? "—" : `${ledger.yearPercent}%`}
          </div>
        </div>
      </div>

      {/* Term-wise grid */}
      <div className="bg-white/95 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 text-left px-3 py-2 font-bold uppercase tracking-wide text-[10px] text-slate-600 min-w-[14rem]">Subject</th>
                {ledger.evaluations.map(ev => (
                  <th
                    key={ev.id}
                    className={cn(
                      "border border-slate-200 px-2 py-2 font-bold text-[10px] uppercase tracking-wide text-center min-w-[88px]",
                      ev.isFinal ? "bg-emerald-50 text-emerald-800" : "text-slate-700",
                    )}
                  >
                    {ev.name}
                  </th>
                ))}
                <th className="border border-slate-200 px-2 py-2 font-bold text-[10px] uppercase tracking-wide text-center min-w-[88px] bg-amber-50/60 text-amber-800">
                  Year Total
                </th>
              </tr>
            </thead>
            <tbody>
              {ledger.subjects.length === 0 ? (
                <tr>
                  <td colSpan={ledger.evaluations.length + 2} className="border border-slate-200 px-3 py-6 text-center text-xs italic text-slate-400">
                    No subject results recorded for this student in this session yet.
                  </td>
                </tr>
              ) : ledger.subjects.map(s => (
                <tr key={s.subjectId} className="hover:bg-blue-50/40 print:hover:bg-transparent">
                  <td className="border border-slate-200 px-3 py-1.5">
                    <p className="text-xs font-semibold text-slate-800">{s.subjectName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{s.subjectCode}</p>
                  </td>
                  {ledger.evaluations.map(ev => {
                    const cell = s.byEvaluation[ev.id]
                    return (
                      <td key={ev.id} className="border border-slate-200 px-2 py-1.5 text-center">
                        {cell ? (
                          <div className={cn(
                            "text-[11px] font-semibold",
                            cell.status === "FAIL"  && "text-rose-700",
                            cell.status === "ABSENT" && "text-amber-600 italic",
                            cell.status === "PASS"   && "text-slate-800",
                          )}>
                            {cell.status === "ABSENT"
                              ? "ABS"
                              : <>
                                  {cell.totalObtained.toFixed(cell.totalObtained % 1 === 0 ? 0 : 1)}
                                  <span className="text-slate-400 font-normal">/{cell.totalFull}</span>
                                </>}
                            {cell.grade && (
                              <div className={cn(
                                "text-[9px] font-bold mt-0.5",
                                cell.status === "FAIL" ? "text-rose-700" : "text-emerald-700",
                              )}>{cell.grade}{typeof cell.gpa === "number" && ` · ${cell.gpa.toFixed(1)}`}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="border border-slate-200 px-2 py-1.5 text-center bg-amber-50/30">
                    {s.yearFull > 0 ? (
                      <div className="text-[11px] font-bold text-slate-800">
                        {s.yearObtained.toFixed(s.yearObtained % 1 === 0 ? 0 : 1)}<span className="text-slate-400 font-normal">/{s.yearFull}</span>
                        {s.yearPercent !== null && <div className="text-[9px] text-slate-500">{s.yearPercent}%</div>}
                      </div>
                    ) : (
                      <span className="text-slate-300">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {ledger.subjects.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-700">Total</td>
                  {ledger.evaluations.map(ev => {
                    let evObtained = 0, evFull = 0
                    for (const s of ledger.subjects) {
                      const c = s.byEvaluation[ev.id]
                      if (c) { evObtained += c.totalObtained; evFull += c.totalFull }
                    }
                    return (
                      <td key={ev.id} className="border border-slate-200 px-2 py-2 text-center text-[11px]">
                        {evFull > 0
                          ? <>{evObtained.toFixed(1)}<span className="text-slate-400 font-normal">/{evFull}</span></>
                          : <span className="text-slate-300 font-normal">–</span>}
                      </td>
                    )
                  })}
                  <td className="border border-slate-200 px-2 py-2 text-center text-[11px] bg-amber-50/60">
                    {ledger.totalFull > 0
                      ? <>{ledger.totalObtained.toFixed(1)}<span className="text-slate-400 font-normal">/{ledger.totalFull}</span></>
                      : <span className="text-slate-300 font-normal">–</span>}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "?"
}
