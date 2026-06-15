import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getAttendanceForDate } from "@/actions/attendance"
import { todayBS } from "@/lib/nepali-date"
import { Button } from "@/components/ui/button"
import { AttendanceBoard } from "./attendance-board"
import { getServerSession } from "next-auth"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"
import { authOptions } from "@/auth"
import type { AttendanceStatus } from "@/actions/attendance"

export const metadata: Metadata = { title: "Take Attendance" }

export default async function TakeAttendancePage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{ classId?: string; sectionId?: string; dateBS?: string; period?: string }>
}) {
  const { domain } = await params
  const { classId, sectionId, dateBS: rawDateBS, period: rawPeriod } = await searchParams
  const dateBS = rawDateBS ?? todayBS()

  const [school, session] = await Promise.all([
    prisma.school.findUnique({ where: { slug: domain } }),
    getServerSession(authOptions),
  ])
  if (!school) notFound()

  // Load all classes + sections for the selector
  const rawClasses = await prisma.class.findMany({
    where:   { schoolId: school.id },
    include: {
      sections: { orderBy: { name: "asc" } },
      faculty:  { select: { name: true } },
    },
    orderBy: { name: "asc" },
  })
  const classes = sortClassesByFacultyThenName(
    rawClasses.map(c => ({ ...c, facultyName: c.faculty?.name ?? null })),
  )

  // If no class selected, default to first available
  const activeClassId   = classId   ?? classes[0]?.id
  const activeClass     = classes.find(c => c.id === activeClassId)
  const activeSectionId = sectionId ?? activeClass?.sections[0]?.id
  const activeSection   = activeClass?.sections.find(s => s.id === activeSectionId)

  if (!activeClassId || !activeSectionId || !activeClass || !activeSection) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/attendance"><Button variant="ghost" size="sm" className="cursor-pointer gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</Button></Link>
          <h1 className="text-lg font-semibold">Take Attendance</h1>
        </div>
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-12 text-center">
          <p className="text-muted-foreground">No classes or sections found. Add them in Academics first.</p>
          <Link href="/academics"><Button variant="outline" size="sm" className="mt-4 cursor-pointer">Go to Academics</Button></Link>
        </div>
      </div>
    )
  }

  // Period-wise attendance only for secondary classes (Grade 6+, Nepal guideline).
  const gradeMatch     = activeClass.name.match(/\d+/)
  const gradeNum       = gradeMatch ? parseInt(gradeMatch[0], 10) : null
  const supportsPeriods = gradeNum !== null && gradeNum >= 6
  const parsedPeriod   = rawPeriod ? parseInt(rawPeriod, 10) : NaN
  const period         = supportsPeriods && parsedPeriod >= 1 && parsedPeriod <= 8 ? parsedPeriod : undefined

  // Fetch students in this section
  const students = await prisma.student.findMany({
    where: { schoolId: school.id, classId: activeClassId, sectionId: activeSectionId, status: "ACTIVE" },
    include: { user: { select: { fullName: true } } },
    orderBy: { admissionNo: "asc" },
  })

  // Existing attendance for pre-filling
  const existingRecords = await getAttendanceForDate(school.id, activeClassId, dateBS, activeSectionId, period)
  const existing: Record<string, AttendanceStatus> = {}
  existingRecords.forEach(r => { existing[r.studentId] = r.status as AttendanceStatus })

  const studentRows = students.map(s => ({
    id:          s.id,
    name:        s.user.fullName,
    rollNumber:  s.rollNumber,
    admissionNo: s.admissionNo,
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/attendance">
            <Button variant="ghost" size="sm" className="cursor-pointer gap-1.5 hover:bg-primary/8">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Take Attendance</h1>
            <p className="text-xs text-muted-foreground">
              {dateBS}{period ? ` · Period ${period}` : ""}
            </p>
          </div>
        </div>

        {/* Class / Section switcher */}
        <div className="flex gap-2 flex-wrap">
          {classes.map(cls => (
            cls.sections.map(sec => (
              <Link
                key={sec.id}
                href={`/attendance/take?classId=${cls.id}&sectionId=${sec.id}&dateBS=${dateBS}`}
              >
                <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  cls.id === activeClassId && sec.id === activeSectionId
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}>
                  {cls.name} {sec.name}
                </button>
              </Link>
            ))
          ))}
        </div>
      </div>

      {/* Period selector — secondary classes (Grade 6+) can take period-wise attendance */}
      {supportsPeriods && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">
            Period
          </span>
          <Link href={`/attendance/take?classId=${activeClassId}&sectionId=${activeSectionId}&dateBS=${dateBS}`}>
            <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !period
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}>
              Daily
            </button>
          </Link>
          {Array.from({ length: 8 }, (_, i) => i + 1).map(p => (
            <Link
              key={p}
              href={`/attendance/take?classId=${activeClassId}&sectionId=${activeSectionId}&dateBS=${dateBS}&period=${p}`}
            >
              <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                period === p
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}>
                P{p}
              </button>
            </Link>
          ))}
        </div>
      )}

      {students.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-12 text-center">
          <p className="text-muted-foreground font-medium">No active students in {activeClass.name} — {activeSection.name}.</p>
          <Link href="/students">
            <Button variant="outline" size="sm" className="mt-4 cursor-pointer">Enroll Students</Button>
          </Link>
        </div>
      ) : (
        <AttendanceBoard
          schoolId={school.id}
          takenById={session?.user?.id ?? "system"}
          classId={activeClassId}
          className={activeClass.name}
          sectionId={activeSectionId}
          sectionName={activeSection.name}
          dateBS={dateBS}
          period={period}
          students={studentRows}
          existing={existing}
        />
      )}
    </div>
  )
}
