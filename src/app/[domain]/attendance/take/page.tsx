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
import { authOptions } from "@/auth"
import type { AttendanceStatus } from "@/actions/attendance"

export const metadata: Metadata = { title: "Take Attendance" }

export default async function TakeAttendancePage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{ classId?: string; sectionId?: string; dateBS?: string }>
}) {
  const { domain } = await params
  const { classId, sectionId, dateBS: rawDateBS } = await searchParams
  const dateBS = rawDateBS ?? todayBS()

  const [school, session] = await Promise.all([
    prisma.school.findUnique({ where: { slug: domain } }),
    getServerSession(authOptions),
  ])
  if (!school) notFound()

  // Load all classes + sections for the selector
  const classes = await prisma.class.findMany({
    where: { schoolId: school.id },
    include: { sections: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  })

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

  // Fetch students in this section
  const students = await prisma.student.findMany({
    where: { schoolId: school.id, classId: activeClassId, sectionId: activeSectionId, status: "ACTIVE" },
    include: { user: { select: { fullName: true } } },
    orderBy: { admissionNo: "asc" },
  })

  // Existing attendance for pre-filling
  const existingRecords = await getAttendanceForDate(school.id, activeClassId, dateBS, activeSectionId)
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
            <p className="text-xs text-muted-foreground">{dateBS}</p>
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
          students={studentRows}
          existing={existing}
        />
      )}
    </div>
  )
}
