import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, CalendarClock, GraduationCap, DoorOpen, AlertTriangle, Settings2,
  Printer, FileDown,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getClassRoutine } from "@/actions/routine"
import { listGroupsForClass } from "@/actions/student-groups"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SessionBadge } from "@/components/ui/session-badge"
import { resolveCurrentForFaculty } from "@/lib/academic-year"
import { RoutineGrid } from "./routine-grid"

export const metadata: Metadata = { title: "Class Routine" }

export default async function ClassRoutinePage({
  params,
}: { params: Promise<{ domain: string; classId: string }> }) {
  const { domain, classId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const routine = await getClassRoutine(classId)
  if (!routine || !routine.class) notFound()

  if (!routine.schedule) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/academics/routine">
            <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{routine.class.name} — Routine</h2>
            <p className="text-sm text-muted-foreground">No schedule applied to this class yet</p>
          </div>
        </div>
        <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="font-semibold text-sm text-amber-900 mb-1">No period schedule</p>
          <p className="text-xs text-amber-700 mb-4">
            Apply a schedule from the routine library before building this class&apos;s grid.
          </p>
          <Link href="/academics/routine">
            <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer text-xs h-8 bg-white">
              <Settings2 className="w-3.5 h-3.5" /> Go to schedule library
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const [subjects, classes, groups, classWithFaculty, academicYears] = await Promise.all([
    prisma.subject.findMany({
      where:   { schoolId: school.id, classId },
      include: {
        teachers: {
          include:  { teacher: { select: { id: true, fullName: true, role: true } } },
          orderBy: [{ isPrimary: "desc" }, { teacher: { fullName: "asc" } }],
        },
      },
      orderBy: { name: "asc" },
    }),
    // Other classes sharing the same schedule — needed for the copy-from picker
    prisma.class.findMany({
      where: {
        schoolId:         school.id,
        periodScheduleId: routine.class.periodScheduleId,
        id:               { not: classId },
        routineEntries:   { some: {} },
      },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listGroupsForClass(classId),
    prisma.class.findUnique({
      where:  { id: classId },
      select: { facultyId: true, faculty: { select: { name: true } } },
    }),
    prisma.academicYear.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, isCurrent: true, facultyId: true },
      orderBy: { name: "desc" },
    }),
  ])

  const scopedFacultyId = classWithFaculty?.facultyId ?? null
  const sessionAY       = resolveCurrentForFaculty(academicYears, scopedFacultyId)
  const sessionFaculty  = classWithFaculty?.faculty?.name ?? "School-wide"

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/academics/routine">
          <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{routine.class.name} — Routine</h2>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {routine.class.name}</span>
            {routine.class.classroom && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><DoorOpen className="w-3 h-3" /> {routine.class.classroom}</span>
              </>
            )}
            <span>·</span>
            <span>{routine.schedule.name}</span>
          </div>
        </div>
        <SessionBadge
          facultyName={sessionFaculty}
          yearName={sessionAY?.name ?? null}
          isCurrent={sessionAY?.isCurrent}
        />
        <Badge variant="outline" className="text-[10px] font-bold">
          {routine.slots.length} slots · {routine.workingDays.length} working days
        </Badge>
        <Link
          href={`/academics/routine/${classId}/print`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open printable view (use 'Save as PDF' in the print dialog for PDF)"
        >
          <Button size="sm" variant="outline"
            className="gap-1.5 cursor-pointer text-xs h-8 bg-white border-slate-200 hover:border-primary/30 hover:bg-primary/5">
            <Printer className="w-3.5 h-3.5" /> Print
            <span className="hidden sm:inline text-slate-400">/</span>
            <FileDown className="w-3.5 h-3.5 hidden sm:inline" />
          </Button>
        </Link>
      </div>

      <RoutineGrid
        classId={classId}
        schoolId={school.id}
        workingDays={routine.workingDays}
        slots={routine.slots}
        entries={routine.entries}
        subjects={subjects.map(s => ({
          id: s.id,
          name: s.name,
          code: s.code,
          teachers: s.teachers.map(t => ({
            id:        t.teacher.id,
            fullName:  t.teacher.fullName,
            isPrimary: t.isPrimary,
          })),
        }))}
        groups={groups.map(g => ({
          id: g.id,
          name: g.name,
          memberCount: g._count.members,
          subjectId: g.subject?.id ?? null,
        }))}
        sourceClasses={classes}
      />
    </div>
  )
}
