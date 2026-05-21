import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Award, ArrowRight, Printer, Sparkles, Users } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar-img"
import { EvaluationFilters } from "../evaluation-filters"
import { EvaluationTabs } from "../evaluation-tabs"
import { BulkPdfButton } from "./bulk-pdf-button"

export const metadata: Metadata = { title: "Gradesheets" }

type SP = { faculty?: string; year?: string; class?: string; evaluationId?: string }

export default async function TranscriptIndexPage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string }>
  searchParams: Promise<SP>
}) {
  const { domain } = await params
  const sp         = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const yearParam     = sp.year         ?? "all"
  const classParam    = sp.class        ?? "all"
  const evalParam     = sp.evaluationId ?? ""

  const [faculties, academicYears, classes] = await Promise.all([
    prisma.faculty.findMany({
      where: { schoolId: school.id }, select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, isCurrent: true, facultyId: true },
      orderBy: [{ isCurrent: "desc" }, { name: "desc" }],
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, facultyId: true },
      orderBy: { name: "asc" },
    }),
  ])

  // Resolve year — mirror the ledger page's resolution so navigation feels consistent.
  const cls = classParam !== "all"
    ? classes.find(c => c.id === classParam) ?? null
    : null
  const facultyYears = cls
    ? academicYears.filter(y => y.facultyId === cls.facultyId)
    : academicYears

  const resolvedYearId =
    yearParam !== "all"
      ? (academicYears.find(y => y.id === yearParam)?.id
        ?? facultyYears.find(y => y.name === yearParam)?.id
        ?? academicYears.find(y => y.name === yearParam)?.id
        ?? facultyYears.find(y => y.isCurrent)?.id
        ?? facultyYears[0]?.id
        ?? null)
      : (facultyYears.find(y => y.isCurrent)?.id ?? facultyYears[0]?.id ?? null)

  // Load students + evaluations only when a class is picked
  const [students, evaluations] = (classParam !== "all" && resolvedYearId !== null)
    ? await Promise.all([
        prisma.student.findMany({
          where:   { schoolId: school.id, classId: classParam, status: "ACTIVE" },
          orderBy: [{ section: { name: "asc" } }, { rollNumber: "asc" }, { admissionNo: "asc" }],
          select: {
            id: true, admissionNo: true, rollNumber: true, symbolNumber: true,
            user:    { select: { fullName: true, avatarUrl: true } },
            section: { select: { name: true } },
          },
        }),
        prisma.evaluation.findMany({
          where: {
            schoolId:          school.id,
            academicYearId:    resolvedYearId,
            evaluationClasses: { some: { classId: classParam } },
          },
          select:  { id: true, name: true, sequenceNumber: true, isFinal: true },
          orderBy: { sequenceNumber: "desc" },
        }),
      ])
    : [[], []]

  const chosenEvaluationId =
    evalParam && evaluations.some(e => e.id === evalParam) ? evalParam
    : evaluations.find(e => e.isFinal)?.id
    ?? evaluations[0]?.id
    ?? ""

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Award className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Gradesheets</h2>
          <p className="text-sm text-muted-foreground">
            NEB-style per-student transcripts — pick a class, open one student or print the whole batch
          </p>
        </div>
      </div>

      <div className="print:hidden">
        <EvaluationTabs />
      </div>

      <div className="print:hidden">
        <EvaluationFilters
          faculties={faculties}
          academicYears={academicYears}
          classes={classes}
          requireClass
        />
      </div>

      {classParam === "all" ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">Pick a class to load students</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Use the filter above. You&apos;ll get a roster with one-click access to each
            student&apos;s gradesheet plus a batch-print option.
          </p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No active students in this class</p>
        </div>
      ) : (
        <>
          {evaluations.length > 0 && (
            <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Evaluation</span>
                {evaluations.map(ev => {
                  const isActive = ev.id === chosenEvaluationId
                  const targetSP = new URLSearchParams()
                  if (sp.faculty) targetSP.set("faculty", sp.faculty)
                  if (sp.year)    targetSP.set("year", sp.year)
                  if (sp.class)   targetSP.set("class", sp.class)
                  targetSP.set("evaluationId", ev.id)
                  return (
                    <Link
                      key={ev.id}
                      href={`/academics/evaluations/transcript?${targetSP.toString()}`}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-1 border transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                      }`}
                    >
                      {ev.name}
                      {ev.isFinal && (
                        <Badge variant="outline" className={`text-[8px] ${isActive ? "border-white/40 text-white" : "border-emerald-200 text-emerald-700 bg-emerald-50"}`}>
                          FINAL
                        </Badge>
                      )}
                    </Link>
                  )
                })}
              </div>
              {chosenEvaluationId && (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/academics/evaluations/transcript/batch?classId=${classParam}&evaluationId=${chosenEvaluationId}`}
                    className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 font-semibold"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print all {students.length}
                  </Link>
                  <BulkPdfButton
                    classId={classParam}
                    evaluationId={chosenEvaluationId}
                    studentsCount={students.length}
                  />
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2.5 w-12">#</th>
                  <th className="text-left px-3 py-2.5">Student</th>
                  <th className="text-left px-3 py-2.5">Admission</th>
                  <th className="text-left px-3 py-2.5">Roll</th>
                  <th className="text-left px-3 py-2.5">Symbol</th>
                  <th className="text-left px-3 py-2.5">Section</th>
                  <th className="text-right px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s, i) => {
                  const link = chosenEvaluationId
                    ? `/academics/evaluations/transcript/${s.id}?evaluationId=${chosenEvaluationId}`
                    : `/academics/evaluations/transcript/${s.id}`
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={s.user.fullName} url={s.user.avatarUrl ?? null} size={26} />
                          <span className="font-medium text-sm">{s.user.fullName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">{s.admissionNo}</td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">{s.rollNumber ?? "—"}</td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">{s.symbolNumber ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{s.section?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button asChild size="sm" variant="outline" className="cursor-pointer h-7 text-[11px]">
                          <Link href={link}>
                            View <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {evaluations.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              No evaluations recorded for this class in the picked session — gradesheets will show empty when opened.
            </p>
          )}
        </>
      )}
    </div>
  )
}
