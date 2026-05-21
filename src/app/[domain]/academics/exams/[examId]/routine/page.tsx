import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarRange } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getExamSummary, listExamPapers, listExamHolidays } from "@/actions/exams"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"
import { ExamTabs } from "../exam-tabs"
import { RoutineMatrix } from "./routine-matrix"

export const metadata: Metadata = { title: "Exam Routine" }

export default async function ExamRoutinePage({
  params,
}: {
  params: Promise<{ domain: string; examId: string }>
}) {
  const { domain, examId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  // Read the exam's class allow-list. If empty (legacy/unconfigured), fall
  // back to faculty-scoped classes so the page is still useful.
  const examScope = await prisma.exam.findFirst({
    where:  { id: examId, schoolId: school.id },
    select: { facultyId: true, classes: { select: { classId: true } } },
  })
  if (!examScope) notFound()
  const examClassIds = examScope.classes.map(c => c.classId)

  const [summary, papers, holidays, classes] = await Promise.all([
    getExamSummary(examId, school.id),
    listExamPapers(school.id, examId),
    listExamHolidays(examId, school.id),
    prisma.class.findMany({
      where: {
        schoolId: school.id,
        ...(examClassIds.length > 0
          ? { id: { in: examClassIds } }
          : examScope.facultyId !== undefined
            ? { facultyId: examScope.facultyId }
            : {}),
      },
      include: {
        faculty:  { select: { name: true } },
        subjects: {
          select: {
            id: true, name: true, code: true,
            teachers: {
              where:   { isPrimary: true },
              include: { teacher: { select: { fullName: true } } },
              take:    1,
            },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ])
  if (!summary) notFound()

  const classOptions = sortClassesByFacultyThenName(
    classes.map(c => ({
      id:          c.id,
      name:        c.name,
      facultyName: c.faculty?.name ?? null,
      subjects:    c.subjects.map(s => ({
        id:           s.id,
        name:         s.name,
        code:         s.code,
        teacherName:  s.teachers[0]?.teacher.fullName ?? null,
      })),
    })),
  )

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
          <CalendarRange className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{summary.name} — Routine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add papers in the left rail, then <strong>drag</strong> each one onto a day
            to set its sitting. Drag back to the rail to unschedule. Time and duration
            are editable inline.
          </p>
        </div>
      </div>

      <ExamTabs examId={examId} />

      <RoutineMatrix
        schoolId={school.id}
        examId={examId}
        initialPapers={papers}
        initialHolidays={holidays}
        classes={classOptions}
      />
    </div>
  )
}
