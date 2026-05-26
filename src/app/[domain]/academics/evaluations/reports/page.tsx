import { Metadata } from "next"
import { notFound } from "next/navigation"
import { FileBarChart, AlertCircle, ClipboardCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getEvaluationReport } from "@/actions/evaluation-report"
import { EvaluationTabs } from "../evaluation-tabs"
import { ReportsClient } from "./reports-client"

export const metadata: Metadata = { title: "Evaluation Reports" }

type SP = { eval?: string; classes?: string }

export default async function EvaluationReportsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string }>
  searchParams: Promise<SP>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  // Resolve a picker list — recent evaluations across the school.
  const evaluations = await prisma.evaluation.findMany({
    where:  { schoolId: school.id },
    select: {
      id: true, name: true, sequenceNumber: true, isFinal: true,
      publishAt: true,
      academicYear: { select: { id: true, name: true, isCurrent: true } },
      _count: { select: { evaluationClasses: true, subjectEvaluations: true } },
    },
    orderBy: [{ academicYear: { name: "desc" } }, { sequenceNumber: "asc" }],
  })

  // Auto-pick: ?eval=… → that one; otherwise newest evaluation in the current
  // year; otherwise the very latest. Returns null if no evaluations exist.
  const explicit = sp.eval ? evaluations.find(e => e.id === sp.eval) : null
  const inCurrent = evaluations.find(e => e.academicYear.isCurrent)
  const picked = explicit ?? inCurrent ?? evaluations[0] ?? null

  const classIds = sp.classes ? sp.classes.split(",").filter(Boolean) : undefined
  const report = picked
    ? await getEvaluationReport({ schoolId: school.id, evaluationId: picked.id, classIds })
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileBarChart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Evaluation Reports</h2>
          <p className="text-sm text-muted-foreground">
            Printable per-evaluation report for the Exam Department — KPIs, fail distribution, subject roll-ups, all in one A4 packet.
          </p>
        </div>
      </div>

      <EvaluationTabs />

      {evaluations.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No evaluations yet</p>
          <p className="text-xs text-muted-foreground">
            Create an evaluation first and enter some marks. Reports appear automatically.
          </p>
        </div>
      ) : !report ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">Couldn&apos;t load report</p>
          <p className="text-xs text-muted-foreground">The picked evaluation may have been removed.</p>
        </div>
      ) : (
        <ReportsClient
          report={report}
          evaluations={evaluations.map(e => ({
            id:             e.id,
            name:           e.name,
            sequenceNumber: e.sequenceNumber,
            isFinal:        e.isFinal,
            publishAt:      e.publishAt,
            yearName:       e.academicYear.name,
            isCurrentYear:  e.academicYear.isCurrent,
            classCount:     e._count.evaluationClasses,
            subjectsCount:  e._count.subjectEvaluations,
          }))}
        />
      )}
    </div>
  )
}
