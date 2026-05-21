import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, UserCog } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getExamSummary } from "@/actions/exams"
import {
  listInvigilatorsForExam, listTeachers,
} from "@/actions/exam-invigilators"
import { ExamTabs } from "../exam-tabs"
import { InvigilatorBoard } from "./invigilator-board"

export const metadata: Metadata = { title: "Invigilators" }

export default async function InvigilatorsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string; examId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { domain, examId } = await params
  const sp = await searchParams

  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const summary = await getExamSummary(examId, school.id)
  if (!summary) notFound()

  const [schedules, teachers] = await Promise.all([
    listInvigilatorsForExam(examId, school.id),
    listTeachers(school.id),
  ])

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
          <UserCog className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{summary.name} — Invigilators</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick a date, assign teachers per room, and add running invigilators for the day.
            Auto-assign respects rotation across the exam and avoids teachers whose own subject is examined that day.
          </p>
        </div>
      </div>

      <ExamTabs examId={examId} />

      <InvigilatorBoard
        schoolId={school.id}
        examId={examId}
        schedules={schedules}
        teachers={teachers}
        initialDateBS={sp.date ?? schedules[0]?.dateBS ?? ""}
      />
    </div>
  )
}
