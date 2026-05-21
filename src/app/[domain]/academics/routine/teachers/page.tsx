import { Metadata } from "next"
import { notFound } from "next/navigation"
import { UserCog } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getTeacherWeekRoutines } from "@/actions/routine"
import { RoutineTabs } from "../routine-tabs"
import { TeacherWeekGrid } from "./teacher-week-grid"
import { GlobalFiltersBar } from "@/components/ui/global-filters-bar"
import { SessionBadge } from "@/components/ui/session-badge"
import { resolveCurrentForFaculty } from "@/lib/academic-year"

export const metadata: Metadata = { title: "Routine — Teacher week" }

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{
    facultyId?:      string
    academicYearId?: string
    q?:              string
  }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

export default async function RoutineTeachersPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const facultyIds = parseList(sp.facultyId)
  const q = (sp.q ?? "").trim().toLowerCase()

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true },
  })
  if (!school) notFound()

  const [allTeachers, faculties, classes, academicYears] = await Promise.all([
    getTeacherWeekRoutines({
      schoolId:   school.id,
      facultyIds: facultyIds.length ? facultyIds : undefined,
      academicYearId: sp.academicYearId,
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

  const teachers = q
    ? allTeachers.filter(t => t.teacherName.toLowerCase().includes(q))
    : allTeachers

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserCog className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Routine</h2>
          <p className="text-sm text-muted-foreground">One card per teacher showing the full week — days across, periods down</p>
        </div>
      </div>

      <RoutineTabs />

      {(() => {
        const scopedFacultyId: string | null =
          facultyIds.length === 1 && facultyIds[0] !== "none"
            ? facultyIds[0]
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
          <div className="flex items-center gap-3 flex-wrap">
            <GlobalFiltersBar
              show={sessionLocked ? ["facultyId"] : ["academicYearId", "facultyId"]}
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
            <span className="text-xs text-muted-foreground ml-auto">
              {teachers.length} teacher{teachers.length === 1 ? "" : "s"}
            </span>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {teachers.map(t => <TeacherWeekGrid key={t.teacherId} teacher={t} />)}
      </div>

      {teachers.length === 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-12 text-center">
          <p className="font-semibold text-sm mb-1">No teachers scheduled</p>
          <p className="text-xs text-muted-foreground">No routine entries match this filter.</p>
        </div>
      )}
    </div>
  )
}
