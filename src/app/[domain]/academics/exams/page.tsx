import { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarRange } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { listExams } from "@/actions/exams"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"
import { ExamsClient } from "./exams-client"

export const metadata: Metadata = { title: "Exams" }

export default async function ExamsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [exams, academicYears, faculties, rawClasses] = await Promise.all([
    listExams(school.id),
    prisma.academicYear.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, isCurrent: true, facultyId: true, startDateBS: true },
      orderBy: [{ isCurrent: "desc" }, { startDateBS: "desc" }],
    }),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      include: { faculty: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  const classes = sortClassesByFacultyThenName(
    rawClasses.map(c => ({
      id:          c.id,
      name:        c.name,
      facultyId:   c.facultyId ?? null,
      facultyName: c.faculty?.name ?? null,
    })),
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarRange className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Exams &amp; Terminals</h2>
          <p className="text-sm text-muted-foreground">
            Pick a faculty, the latest session, then add terminals (Term 1, Final, etc.) and pick which classes sit each one.
          </p>
        </div>
      </div>

      <ExamsClient
        schoolId={school.id}
        initialExams={exams}
        academicYears={academicYears}
        faculties={faculties}
        classes={classes}
      />
    </div>
  )
}
