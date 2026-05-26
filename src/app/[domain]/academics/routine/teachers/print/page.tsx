import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getTeacherWeekRoutines } from "@/actions/routine"
import { TeacherPrintView } from "./teacher-print-view"

export const metadata: Metadata = { title: "Print teacher routine" }

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{
    teacherId?:      string
    facultyId?:      string
    academicYearId?: string
    q?:              string
  }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

export default async function TeacherRoutinePrintPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, name: true },
  })
  if (!school) notFound()

  const facultyIds = parseList(sp.facultyId)
  const teacherIds = parseList(sp.teacherId)
  const q = (sp.q ?? "").trim().toLowerCase()

  const allTeachers = await getTeacherWeekRoutines({
    schoolId:       school.id,
    facultyIds:     facultyIds.length ? facultyIds : undefined,
    academicYearId: sp.academicYearId,
  })

  let teachers = allTeachers
  if (teacherIds.length > 0) {
    const idSet = new Set(teacherIds)
    teachers = teachers.filter(t => idSet.has(t.teacherId))
  }
  if (q) {
    teachers = teachers.filter(t => t.teacherName.toLowerCase().includes(q))
  }

  return (
    <TeacherPrintView
      schoolName={school.name}
      teachers={teachers}
    />
  )
}
