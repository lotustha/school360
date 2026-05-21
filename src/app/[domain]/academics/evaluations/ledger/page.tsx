import { Metadata } from "next"
import { notFound } from "next/navigation"
import { ClipboardCheck, BookOpenCheck, Sparkles } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getClassLedger } from "@/actions/evaluation-results"
import { EvaluationFilters } from "../evaluation-filters"
import { EvaluationTabs } from "../evaluation-tabs"
import { ClassLedgerTable } from "./class-ledger-table"

export const metadata: Metadata = { title: "Class Ledger" }

type SP = { faculty?: string; year?: string; class?: string }

export default async function ClassLedgerPage({
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

  const yearParam  = sp.year  ?? "all"
  const classParam = sp.class ?? "all"

  const [faculties, academicYears, classes] = await Promise.all([
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
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

  // Resolve year. `sp.year` may arrive as an AcademicYear id OR a year name
  // (e.g. "2082/83" when navigated from the evaluations list which de-dupes
  // by name). For the ledger we need a specific row, so we look up either form
  // and fall back to the current year for the picked class's faculty.
  const cls = classParam !== "all"
    ? classes.find(c => c.id === classParam) ?? null
    : null
  const facultyYears = cls
    ? academicYears.filter(y => y.facultyId === cls.facultyId)
    : academicYears

  const resolvedYearId =
    yearParam !== "all"
      ? (academicYears.find(y => y.id === yearParam)?.id
        ?? facultyYears.find(y => y.name === yearParam)?.id
        ?? academicYears.find(y => y.name === yearParam)?.id
        ?? facultyYears.find(y => y.isCurrent)?.id
        ?? facultyYears[0]?.id
        ?? null)
      : (facultyYears.find(y => y.isCurrent)?.id ?? facultyYears[0]?.id ?? null)

  const ledger = (classParam !== "all" && resolvedYearId !== null)
    ? await getClassLedger({
        schoolId:       school.id,
        classId:        classParam,
        academicYearId: resolvedYearId,
      })
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Class Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Full marks register — all evaluations across the year, all subjects, all students
          </p>
        </div>
      </div>

      <div className="print:hidden">
        <EvaluationTabs />
      </div>

      <div className="print:hidden">
        <EvaluationFilters
          faculties={faculties}
          academicYears={academicYears}
          classes={classes}
          requireClass
        />
      </div>

      {ledger === null ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">Pick a class to load the ledger</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Use the filter above to select a class. The ledger shows all evaluations recorded for
            that class in the chosen session.
          </p>
        </div>
      ) : ledger.evaluations.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <BookOpenCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No evaluations recorded</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            No evaluations exist for {ledger.className} in {ledger.yearName} yet. Create one from
            the Evaluations tab.
          </p>
        </div>
      ) : (
        <ClassLedgerTable ledger={ledger} />
      )}
    </div>
  )
}
