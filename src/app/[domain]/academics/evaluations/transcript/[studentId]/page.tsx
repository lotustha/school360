import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Award, ClipboardCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getStudentTranscript } from "@/actions/evaluation-results"
import { EvaluationTabs } from "../../evaluation-tabs"
import { PrintButton } from "../../ledger/[studentId]/print-button"
import { EvaluationPicker } from "./evaluation-picker"
import { TranscriptDocument } from "../transcript-document"

export const metadata: Metadata = { title: "Gradesheet" }

type SP = { evaluationId?: string }

export default async function TranscriptPage({
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

  const student = await prisma.student.findFirst({
    where:  { id: studentId, schoolId: school.id },
    select: { id: true, classId: true, academicYearId: true },
  })
  if (!student) notFound()

  // Find all evaluations for this student's class (in their year, or the current year as fallback)
  const fallbackYearId = student.academicYearId ?? (
    await prisma.academicYear.findFirst({
      where:  { schoolId: school.id, isCurrent: true },
      select: { id: true },
    })
  )?.id ?? null

  const evaluations = fallbackYearId
    ? await prisma.evaluation.findMany({
        where: {
          schoolId:          school.id,
          academicYearId:    fallbackYearId,
          evaluationClasses: { some: { classId: student.classId } },
        },
        select:  { id: true, name: true, sequenceNumber: true, isFinal: true },
        orderBy: { sequenceNumber: "desc" },
      })
    : []

  // Resolve which evaluation to render
  const chosenId =
    sp.evaluationId && evaluations.some(e => e.id === sp.evaluationId) ? sp.evaluationId
    : evaluations.find(e => e.isFinal)?.id
    ?? evaluations[0]?.id
    ?? null

  if (!chosenId) {
    return (
      <div className="space-y-5">
        <Header />
        <div className="print:hidden">
          <EvaluationTabs />
        </div>
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <Award className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No evaluations available</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Create an evaluation for this student&apos;s class before generating a transcript.
          </p>
        </div>
      </div>
    )
  }

  const transcript = await getStudentTranscript({
    schoolId:     school.id,
    studentId,
    evaluationId: chosenId,
  })

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Header />
        <EvaluationTabs />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <Link
          href={`/academics/evaluations/ledger/${studentId}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Student Ledger
        </Link>
        <div className="flex items-center gap-2">
          <EvaluationPicker
            studentId={studentId}
            current={chosenId}
            evaluations={evaluations}
          />
          <PrintButton />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <TranscriptDocument transcript={transcript} />
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

function Header() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <ClipboardCheck className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Gradesheet</h2>
        <p className="text-sm text-muted-foreground">
          NEB-style transcript — A4 portrait, school letterhead and signature blocks
        </p>
      </div>
    </div>
  )
}
