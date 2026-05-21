import { Metadata } from "next"
import { notFound } from "next/navigation"
import { ClipboardCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { listEvaluations } from "@/actions/evaluations"
import { EvaluationFilters } from "./evaluation-filters"
import { EvaluationTabs } from "./evaluation-tabs"
import { EvaluationsTable } from "./evaluations-table"
import type { EvaluationRow } from "./evaluations-columns"

export const metadata: Metadata = { title: "Evaluations" }

type SP = { faculty?: string; year?: string }

export default async function EvaluationsPage({
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

  // Faculty defaults to General (none); session defaults to the latest year
  // of the resolved faculty (current if marked, else first by name desc).
  const facultyParam = sp.faculty ?? "none"
  const facultyId: string | null = facultyParam === "none" ? null : facultyParam

  const [faculties, academicYears, classes] = await Promise.all([
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "desc" },  // descending per design
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

  const facultyYears = academicYears.filter(y =>
    facultyId === null ? y.facultyId === null : y.facultyId === facultyId,
  )
  // Dedupe by name (Session dropdown collapses same-named years across faculties on this list page).
  // sp.year may arrive as either a name (this page's format) or an AcademicYear id
  // (e.g. when navigating back from /evaluations/ledger which uses ids). Normalize.
  const yearFromUrl = sp.year
    ? (academicYears.find(y => y.id === sp.year)?.name ?? sp.year)
    : undefined
  const academicYearName =
    yearFromUrl
    ?? facultyYears.find(y => y.isCurrent)?.name
    ?? facultyYears[0]?.name
    ?? undefined

  // Resolve the specific AcademicYear row to seed the New Evaluation form with.
  const initialAcademicYearId =
    facultyYears.find(y => y.name === academicYearName)?.id ?? null

  const evaluations = await listEvaluations({ schoolId: school.id, facultyId, academicYearName })

  const rows: EvaluationRow[] = evaluations.map(ev => {
    const subjectsCount    = ev._count.subjectEvaluations
    const componentsTotal  = ev.subjectEvaluations.reduce((sum, s) => sum + s._count.components, 0)
    const resultsEntered   = ev.subjectEvaluations.reduce((sum, s) => sum + s._count.results, 0)
    return {
      id:               ev.id,
      name:             ev.name,
      description:      ev.description,
      sequenceNumber:   ev.sequenceNumber,
      isFinal:          ev.isFinal,
      isLocked:         ev.isLocked,
      publishAt:        ev.publishAt,
      createdAt:        ev.createdAt,
      classes:          ev.evaluationClasses.map(ec => ({
        id:          ec.class.id,
        name:        ec.class.name,
        facultyName: ec.class.faculty?.name ?? null,
      })),
      academicYearId:   ev.academicYearId,
      academicYearName: ev.academicYear.name,
      isCurrentYear:    ev.academicYear.isCurrent,
      subjectsCount,
      componentsTotal,
      resultsEntered,
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Evaluations</h2>
          <p className="text-sm text-muted-foreground">
            One schema can cover multiple classes — group by faculty &amp; session
          </p>
        </div>
      </div>

      <EvaluationTabs />

      <EvaluationFilters
        faculties={faculties}
        academicYears={academicYears}
        classes={classes}
        showClass={false}
        dedupeYearsByName
      />

      <EvaluationsTable
        schoolId={school.id}
        evaluations={rows}
        faculties={faculties}
        classes={classes}
        academicYears={academicYears}
        defaultFacultyId={facultyId}
        defaultAcademicYearId={initialAcademicYearId}
      />
    </div>
  )
}
