import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Grid3X3 } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getCompactRoutineGrid } from "@/actions/routine"
import { RoutineTabs } from "../routine-tabs"
import { CompactGrid } from "./compact-grid"
import { GlobalFiltersBar } from "@/components/ui/global-filters-bar"
import { SessionBadge } from "@/components/ui/session-badge"
import { resolveCurrentForFaculty } from "@/lib/academic-year"

export const metadata: Metadata = { title: "Routine — Class × Period" }

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{
    facultyId?:      string
    classId?:        string
    academicYearId?: string
  }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

export default async function RoutineCompactPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const facultyIds = parseList(sp.facultyId)
  const classIds   = parseList(sp.classId)

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true },
  })
  if (!school) notFound()

  const [columns, faculties, classes, academicYears] = await Promise.all([
    getCompactRoutineGrid({
      schoolId:        school.id,
      facultyIds:      facultyIds.length ? facultyIds : undefined,
      classIds:        classIds.length   ? classIds   : undefined,
      academicYearId:  sp.academicYearId,
    }),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, facultyId: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, isCurrent: true, facultyId: true },
      orderBy: { name: "desc" },
    }),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Grid3X3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Routine</h2>
          <p className="text-sm text-muted-foreground">All classes on one grid — classes down (grouped by faculty), periods across with times, days in parens inside each cell</p>
        </div>
      </div>

      <RoutineTabs />

      {(() => {
        // Resolve the session from scope. If a faculty (or single class) is
        // locked in, the AY is implicit — hide the Year chip and show a badge.
        const scopedFacultyId: string | null =
          facultyIds.length === 1 && facultyIds[0] !== "none"
            ? facultyIds[0]
            : classIds.length === 1
              ? (classes.find(c => c.id === classIds[0])?.facultyId ?? null)
              : null
        const sessionLocked = scopedFacultyId !== null ||
          (facultyIds.length === 1 && facultyIds[0] === "none")
        const sessionAY = sessionLocked
          ? resolveCurrentForFaculty(academicYears, scopedFacultyId)
          : null
        const sessionFacultyName = scopedFacultyId
          ? (faculties.find(f => f.id === scopedFacultyId)?.name ?? null)
          : null

        return (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <GlobalFiltersBar
                show={sessionLocked
                  ? ["facultyId", "classId"]
                  : ["academicYearId", "facultyId", "classId"]}
                faculties={faculties}
                classes={classes}
                academicYears={academicYears}
              />
              {sessionLocked && (
                <SessionBadge
                  facultyName={sessionFacultyName ?? "School-wide"}
                  yearName={sessionAY?.name ?? null}
                  isCurrent={sessionAY?.isCurrent}
                />
              )}
            </div>

            <CompactGrid columns={columns} />
          </>
        )
      })()}
    </div>
  )
}
