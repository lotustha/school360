import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClassRoutine } from "@/actions/routine"
import { resolveCurrentForFaculty } from "@/lib/academic-year"
import { ClassRoutinePrintView } from "./print-view"

export const metadata: Metadata = { title: "Print Class Routine" }

export default async function ClassRoutinePrintPage({
  params,
}: {
  params: Promise<{ domain: string; classId: string }>
}) {
  const { domain, classId } = await params

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, name: true },
  })
  if (!school) notFound()

  const [routine, classWithFaculty, academicYears] = await Promise.all([
    getClassRoutine(classId),
    prisma.class.findUnique({
      where:  { id: classId },
      select: { facultyId: true, classroom: true, room: { select: { name: true } }, faculty: { select: { name: true } } },
    }),
    prisma.academicYear.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, isCurrent: true, facultyId: true },
      orderBy: { name: "desc" },
    }),
  ])
  if (!routine || !routine.class) notFound()
  if (!routine.schedule) notFound()

  const scopedFacultyId = classWithFaculty?.facultyId ?? null
  const sessionAY       = resolveCurrentForFaculty(academicYears, scopedFacultyId)

  return (
    <ClassRoutinePrintView
      schoolName={school.name}
      className={routine.class.name}
      facultyName={classWithFaculty?.faculty?.name ?? null}
      roomName={classWithFaculty?.room?.name ?? classWithFaculty?.classroom ?? null}
      scheduleName={routine.schedule.name}
      sessionName={sessionAY?.name ?? null}
      sessionIsCurrent={sessionAY?.isCurrent ?? false}
      workingDays={routine.workingDays}
      slots={routine.slots}
      entries={routine.entries}
    />
  )
}
