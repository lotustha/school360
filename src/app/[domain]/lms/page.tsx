import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { listCourses, listInstructors, listCourseSubjects, type CourseRow } from "@/actions/lms/courses"
import { Layers, BookOpen, Users, FileEdit } from "lucide-react"
import { cn } from "@/lib/utils"
import { lmsAccessState } from "./access-states"
import { LmsClient } from "./lms-client"

export const metadata: Metadata = { title: "Online Learning" }

export default async function LmsPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms`)

  // Students/parents go straight to their learner experience.
  if (session.user.role === "STUDENT" || session.user.role === "PARENT") {
    redirect(`/${domain}/lms/learn`)
  }

  let courses: CourseRow[]
  try {
    courses = await listCourses()
  } catch (e) {
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const canManage = await hasPermission(session, "lms:manage")
  const [instructors, subjects] = canManage
    ? await Promise.all([listInstructors(), listCourseSubjects()])
    : [[], []]

  const published = courses.filter(c => c.status === "PUBLISHED")
  const drafts    = courses.filter(c => c.status === "DRAFT")
  const totalEnrollments = courses.reduce((n, c) => n + c.enrollmentCount, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Online Learning</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build courses, lessons, live classes, quizzes, and track learner progress.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
          <Layers className="w-3 h-3" />
          {courses.length} course{courses.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Courses"      value={`${courses.length}`}     sub="All statuses"        tone="primary" icon={Layers} />
        <Stat label="Published"    value={`${published.length}`}   sub="Live to learners"    tone="emerald" icon={BookOpen} />
        <Stat label="Drafts"       value={`${drafts.length}`}      sub="Not yet published"   tone="amber"   icon={FileEdit} />
        <Stat label="Enrollments"  value={`${totalEnrollments}`}   sub="Across all courses"  tone="indigo"  icon={Users} />
      </div>

      <LmsClient courses={courses} canManage={canManage} instructors={instructors} subjects={subjects} />
    </div>
  )
}

function Stat({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "primary" | "emerald" | "amber" | "indigo"
  icon: React.ElementType
}) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-600 bg-amber-50",     value: "text-amber-700" },
    indigo:  { ring: "ring-indigo-100",  icon: "text-indigo-600 bg-indigo-50",   value: "text-indigo-700" },
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
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
