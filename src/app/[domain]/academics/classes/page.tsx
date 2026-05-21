import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { type ClassColumn } from "./columns"
import { ClassDrawer } from "./class-drawer"
import { ClassesTable } from "./classes-table"
import { StreamFilter } from "./stream-filter"
import { GraduationCap, Info } from "lucide-react"
import Link from "next/link"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"

export const metadata: Metadata = { title: "Classes" }

export default async function ClassesPage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{ stream?: string }>
}) {
  const { domain } = await params
  const { stream }  = await searchParams
  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, workingDays: true },
  })
  if (!school) notFound()

  // Build the facultyId filter from the ?stream= param
  const facultyFilter =
    stream === "none" ? { facultyId: null } :
    stream && stream !== "all" ? { facultyId: stream } :
    {}

  const [classes, faculties, teachers, rawRooms] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: school.id, ...facultyFilter },
      include: {
        faculty:      true,
        classTeacher: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
        room:         { select: { id: true, name: true } },
        sections:     { select: { id: true, name: true }, orderBy: { name: "asc" } },
        subjects:     { select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where: { schoolId: school.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, workingDays: true },
    }),
    prisma.user.findMany({
      where:   { schoolId: school.id, role: { in: ["TEACHER", "STAFF", "SCHOOL_ADMIN"] } },
      select:  { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.room.findMany({
      where:   { schoolId: school.id },
      include: { seats: { select: { kind: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  const rooms = rawRooms.map(r => ({
    id:       r.id,
    name:     r.name,
    isActive: r.isActive,
    capacity: r.seats.filter(s => s.kind === "SEAT").length,
  }))

  const rows: ClassColumn[] = sortClassesByFacultyThenName(
    classes.map(c => ({
      id:                     c.id,
      name:                   c.name,
      facultyId:              c.facultyId ?? null,
      facultyName:            c.faculty?.name ?? null,
      classTeacherId:         c.classTeacherId ?? null,
      classTeacherName:       c.classTeacher?.fullName ?? null,
      classTeacherAvatarUrl:  c.classTeacher?.avatarUrl ?? null,
      classTeacherPhone:      c.classTeacher?.phone ?? null,
      roomId:                 c.roomId   ?? null,
      roomName:               c.room?.name ?? null,
      classroom:              c.classroom ?? null,
      sectionsCount:          c.sections.length,
      subjectsCount:          c.subjects.length,
      sections:               c.sections.map(s => s.name),
      subjects:               c.subjects.map(s => s.name),
      workingDays:            c.workingDays ?? [],
    })),
  )

  const activeLabel =
    stream === "none" ? "General" :
    stream && stream !== "all" ? (faculties.find(f => f.id === stream)?.name ?? "Stream") :
    "All streams"

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Classes</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "class" : "classes"}
              {stream && stream !== "all" && (
                <span className="ml-1 text-primary font-medium">· {activeLabel}</span>
              )}
            </p>
          </div>
        </div>
        <ClassDrawer
          schoolId={school.id}
          schoolWorkingDays={school.workingDays}
          faculties={faculties}
          teachers={teachers}
          rooms={rooms}
        />
      </div>

      {/* Stream filter pills */}
      {faculties.length > 0 && (
        <Suspense>
          <StreamFilter faculties={faculties} />
        </Suspense>
      )}

      {/* No-faculty tip */}
      {faculties.length === 0 && (
        <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-xl p-4">
          <div className="flex gap-2.5">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Tip:</strong> For +2 schools, add faculties first (Science, Management, Humanities) so you can assign classes to streams.{" "}
              <Link href="/academics/faculties" className="underline font-semibold hover:text-blue-900 transition-colors">
                Add Faculties →
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <ClassesTable
          rows={rows}
          schoolId={school.id}
          schoolWorkingDays={school.workingDays}
          faculties={faculties}
          teachers={teachers}
          rooms={rooms}
        />
      </div>
    </div>
  )
}
