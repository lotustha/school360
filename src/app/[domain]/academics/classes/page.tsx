import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { GraduationCap, Info, Users, BookOpen, FolderTree } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { type ClassColumn } from "./columns"
import { ClassDrawer } from "./class-drawer"
import { ClassesTable } from "./classes-table"
import { StreamFilter } from "./stream-filter"
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
  const { stream } = await searchParams
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

  const [classes, faculties, teachers, rawRooms, totalSections, totalSubjects, totalStudents] = await Promise.all([
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
    prisma.section.count({ where: { schoolId: school.id, ...(facultyFilter ? { class: facultyFilter } : {}) } }),
    prisma.subject.count({ where: { schoolId: school.id } }),
    prisma.student.count({ where: { schoolId: school.id, status: "ACTIVE", ...(facultyFilter ? { class: facultyFilter } : {}) } }),
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

  const hasFilter = !!(stream && stream !== "all")

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One row per class. Assign a faculty (or leave under General), set a class teacher, room, and working days.
            {hasFilter && <span className="text-primary font-bold"> · {activeLabel}</span>}
          </p>
        </div>
        <ClassDrawer
          schoolId={school.id}
          schoolWorkingDays={school.workingDays}
          faculties={faculties}
          teachers={teachers}
          rooms={rooms}
        />
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={hasFilter ? "Classes (filtered)" : "Classes"} value={rows.length} sub={hasFilter ? activeLabel : "Across all streams"} tone="primary" icon={GraduationCap} />
        <Kpi label="Students"   value={totalStudents}  sub={hasFilter ? "In filtered classes" : "Active enrolment"} tone="emerald" icon={Users} />
        <Kpi label="Sections"   value={totalSections}  sub="Student groupings"     tone="sky"     icon={Users} />
        <Kpi label="Subjects"   value={totalSubjects}  sub="School-wide catalog"   tone="amber"   icon={BookOpen} />
      </div>

      {/* Stream filter pills */}
      {faculties.length > 0 && (
        <Suspense>
          <StreamFilter faculties={faculties} />
        </Suspense>
      )}

      {/* No-faculty tip */}
      {faculties.length === 0 && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 flex items-start gap-3">
          <FolderTree className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-violet-900">All classes are under the General stream</p>
            <p className="text-xs text-violet-800 mt-0.5 leading-relaxed">
              Add Faculties only when Grade 11–12 splits into Science / Management / Humanities with separate classes per stream.{" "}
              <Link href="/academics/faculties" className="underline font-bold hover:text-violet-950">Add Faculties →</Link>
            </p>
          </div>
        </div>
      )}

      {classes.length === 0 && faculties.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">No classes match the current stream filter.</p>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
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

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: number; sub: string
  tone: "primary" | "emerald" | "sky" | "amber"
  icon: React.ElementType
}) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",         value: "text-sky-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",     value: "text-amber-700" },
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 ring-1", palette.ring)}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", palette.icon)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={cn("text-xl font-bold font-mono tabular-nums leading-tight", palette.value)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>
    </div>
  )
}
