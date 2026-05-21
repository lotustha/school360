import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Layers, Info } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"
import { SubjectsSubNav } from "../subjects-subnav"
import { GroupsTable, type GroupRow } from "./groups-table"
import { type ClassOpt } from "./group-drawer"
import { GroupsHeader } from "./groups-header"

export const metadata: Metadata = { title: "Subject Groups" }

interface PageProps {
  params: Promise<{ domain: string }>
}

export default async function GroupsPage({ params }: PageProps) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [groups, classesRaw, academicYears, faculties] = await Promise.all([
    prisma.subjectGroup.findMany({
      where: { schoolId: school.id },
      include: {
        class:    {
          include: {
            faculty:  { select: { name: true } },
            _count:   { select: { students: { where: { status: "ACTIVE" } } } },
          },
        },
        subjects: {
          include: { subject: { select: { id: true, name: true, code: true, type: true } } },
        },
        enrollments: { select: { studentId: true, academicYearId: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { kind: "asc" }, { label: "asc" }],
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      include: {
        faculty:  { select: { name: true } },
        subjects: {
          select:  { id: true, name: true, code: true, type: true },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      where:  { schoolId: school.id },
      select: { id: true, name: true, isCurrent: true, startDateBS: true, facultyId: true },
      orderBy: { startDateBS: "desc" },
    }),
    prisma.faculty.findMany({
      where:  { schoolId: school.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const years = academicYears.map(y => ({
    id:          y.id,
    name:        y.name,
    isCurrent:   y.isCurrent,
    startDateBS: y.startDateBS,
    facultyId:   y.facultyId,
  }))

  // Current academic year — used to scope the "enrolled this year" count
  // (enrollments are year-scoped; groups themselves are not).
  const currentYearId = years.find(y => y.isCurrent)?.id ?? years[0]?.id ?? null

  const rows: GroupRow[] = groups.map(g => {
    const enrollmentsThisYear = currentYearId
      ? g.enrollments.filter(e => e.academicYearId === currentYearId)
      : []
    const studentsWithAtLeastOne = new Set(enrollmentsThisYear.map(e => e.studentId)).size
    const classRosterCount      = g.class._count.students
    const unenrolledCount       = Math.max(0, classRosterCount - studentsWithAtLeastOne)

    return {
      id:               g.id,
      label:            g.label,
      kind:             g.kind,
      pickCount:        g.pickCount,
      classId:          g.classId,
      className:        g.class.name,
      facultyName:      g.class.faculty?.name ?? null,
      subjects:         g.subjects.map(s => ({
        id:   s.subject.id,
        name: s.subject.name,
        code: s.subject.code,
        type: s.subject.type,
      })),
      enrolledCount:    enrollmentsThisYear.length,
      enrolledStudents: studentsWithAtLeastOne,
      unenrolledCount,
      classRosterCount,
    }
  })

  const classes: ClassOpt[] = sortClassesByFacultyThenName(
    classesRaw.map(c => ({
      id:          c.id,
      name:        c.name,
      facultyName: c.faculty?.name ?? null,
      facultyId:   c.facultyId ?? null,
      subjects:    c.subjects,
    })),
  )

  // Build predecessor map: { [currentClassId]: groups on its predecessor class }
  // For each class C with previousClassId=P, list every SubjectGroup whose classId=P.
  const groupsByClassId: Record<string, { id: string; label: string; className: string; classId: string }[]> = {}
  for (const g of groups) {
    if (!groupsByClassId[g.classId]) groupsByClassId[g.classId] = []
    groupsByClassId[g.classId].push({ id: g.id, label: g.label, className: g.class.name, classId: g.classId })
  }
  const predecessorGroupsByClass: Record<string, { id: string; label: string; className: string; classId: string }[]> = {}
  for (const c of classesRaw) {
    if (c.previousClassId && groupsByClassId[c.previousClassId]) {
      predecessorGroupsByClass[c.id] = groupsByClassId[c.previousClassId]
    }
  }

  const optionalClassCount = classes.filter(c => c.subjects.some(s => s.type === "OPTIONAL" || s.type === "EXTRA")).length

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <SubjectsSubNav />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Subject Groups</h2>
            <p className="text-sm text-muted-foreground">
              Pick-buckets for optional subjects and cohorts for EXTRA subjects.
            </p>
          </div>
        </div>
        <GroupsHeader schoolId={school.id} faculties={faculties} years={years} classes={classes} />
      </div>

      {optionalClassCount === 0 && (
        <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-xl p-4">
          <div className="flex gap-2.5">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>No OPTIONAL or EXTRA subjects yet.</strong> Mark subjects as Optional or Extra in the{" "}
              <Link href="/academics/subjects" className="underline font-semibold hover:text-blue-900 transition-colors">
                Subjects tab
              </Link>{" "}
              before creating groups.
            </p>
          </div>
        </div>
      )}

      <GroupsTable
        schoolId={school.id}
        rows={rows}
        faculties={faculties}
        classes={classes}
        years={years}
        predecessorGroupsByClass={predecessorGroupsByClass}
      />
    </div>
  )
}
