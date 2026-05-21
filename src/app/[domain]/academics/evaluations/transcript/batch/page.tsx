import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Award } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getStudentTranscript } from "@/actions/evaluation-results"
import { TranscriptDocument } from "../transcript-document"
import { PrintButton } from "../../ledger/[studentId]/print-button"

export const metadata: Metadata = { title: "Batch Gradesheets" }

type SP = { classId?: string; evaluationId?: string }

export default async function BatchTranscriptPage({
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

  if (!sp.classId || !sp.evaluationId) {
    return (
      <div className="space-y-5">
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <Award className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">Missing parameters</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Batch transcript requires both <code>classId</code> and <code>evaluationId</code> query parameters.
          </p>
          <Link
            href="/academics/evaluations/ledger"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Class Ledger
          </Link>
        </div>
      </div>
    )
  }

  const students = await prisma.student.findMany({
    where: { schoolId: school.id, classId: sp.classId, status: "ACTIVE" },
    orderBy: [{ section: { name: "asc" } }, { rollNumber: "asc" }, { admissionNo: "asc" }],
    select: { id: true },
  })

  const transcripts = await Promise.all(
    students.map(s =>
      getStudentTranscript({
        schoolId:     school.id,
        studentId:    s.id,
        evaluationId: sp.evaluationId!,
      }),
    ),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <Link
          href="/academics/evaluations/ledger"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Class Ledger
        </Link>
        <div className="text-xs text-slate-500">
          Batch — {transcripts.length} {transcripts.length === 1 ? "student" : "students"}
        </div>
        <PrintButton />
      </div>

      <div className="space-y-6 print:space-y-0">
        {transcripts.map((t, i) => (
          <div key={t.student.id} className="max-w-4xl mx-auto print:max-w-none">
            <TranscriptDocument transcript={t} pageBreakAfter={i < transcripts.length - 1} />
          </div>
        ))}
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
