import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getExamSummary, listExamPapers } from "@/actions/exams"
import { RoutinePrintView, type PrintMode } from "./print-view"

export const metadata: Metadata = { title: "Print Exam Routine" }

interface PageProps {
  params:       Promise<{ domain: string; examId: string }>
  searchParams: Promise<{ mode?: string; facultyId?: string; classId?: string }>
}

function parseMode(s: string | undefined): PrintMode {
  if (s === "faculty" || s === "class") return s
  return "combined"
}
function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

export default async function PrintExamRoutinePage({ params, searchParams }: PageProps) {
  const { domain, examId } = await params
  const sp = await searchParams
  const mode       = parseMode(sp.mode)
  const facultyIds = parseList(sp.facultyId)
  const classIds   = parseList(sp.classId)

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, name: true },
  })
  if (!school) notFound()

  const [summary, papers, faculties, classes] = await Promise.all([
    getExamSummary(examId, school.id),
    listExamPapers(school.id, examId),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, facultyId: true, faculty: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ])
  if (!summary) notFound()

  return (
    <RoutinePrintView
      schoolName={school.name}
      examName={summary.name}
      yearName={summary.academicYearName}
      papers={papers}
      faculties={faculties.map(f => ({ id: f.id, name: f.name }))}
      classes={classes.map(c => ({
        id: c.id, name: c.name, facultyId: c.facultyId, facultyName: c.faculty?.name ?? null,
      }))}
      mode={mode}
      facultyIds={facultyIds}
      classIds={classIds}
    />
  )
}
