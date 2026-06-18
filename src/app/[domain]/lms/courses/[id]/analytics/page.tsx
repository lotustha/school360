import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getCourseAnalytics, type CourseAnalytics } from "@/actions/lms/analytics"
import {
  ArrowLeft, Users, Trophy, TrendingUp, Activity, BookOpen, FileText, ListChecks, Radio,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { lmsAccessState } from "../../../access-states"

export const metadata: Metadata = { title: "Course Analytics" }

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/analytics`)

  let a: CourseAnalytics
  try {
    a = await getCourseAnalytics(id)
  } catch (e) {
    if ((e as Error).message === "Course not found") notFound()
    const state = lmsAccessState(e, domain, "lms:analytics:view")
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const maxBucket = Math.max(1, ...a.progressBuckets.map(b => b.count))

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Link href={`/${domain}/lms/courses/${id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to course
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Learning Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{a.course.title}</p>
      </div>

      {/* Top stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Enrolled" value={`${a.totals.enrolled}`} sub={`${a.totals.totalLessons} lessons`} icon={Users} tone="primary" />
        <Stat label="Completed" value={`${a.totals.completed}`} sub={a.totals.enrolled ? `${Math.round(a.totals.completed / a.totals.enrolled * 100)}% of learners` : "—"} icon={Trophy} tone="emerald" />
        <Stat label="Avg progress" value={`${a.totals.avgProgress}%`} sub="Across enrolled" icon={TrendingUp} tone="indigo" />
        <Stat label="Active (7d)" value={`${a.totals.activeLast7d}`} sub="Recently engaged" icon={Activity} tone="amber" />
      </div>

      {/* Progress distribution */}
      <Card title="Progress distribution" icon={BookOpen}>
        <div className="space-y-2">
          {a.progressBuckets.map(b => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 w-24 shrink-0">{b.label}</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                <div className="h-full bg-primary/70 rounded-md transition-all" style={{ width: `${(b.count / maxBucket) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-700 tabular-nums w-8 text-right">{b.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Assignments + quizzes side by side */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Assignments" icon={FileText}>
          {a.assignments.length === 0 ? <Empty /> : (
            <div className="space-y-2.5">
              {a.assignments.map(x => (
                <div key={x.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 truncate pr-2">{x.title}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{x.submitted}/{a.totals.enrolled} · avg {x.avgMarks ?? "—"}/{x.totalMarks}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-emerald-500/70" style={{ width: `${a.totals.enrolled ? (x.submitted / a.totals.enrolled) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Quizzes" icon={ListChecks}>
          {a.quizzes.length === 0 ? <Empty /> : (
            <div className="space-y-2.5">
              {a.quizzes.map(x => (
                <div key={x.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 truncate pr-2">{x.title}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{x.attempts} attempts · avg {x.avgScore ?? "—"}/{x.totalMarks} · {x.passed} passed</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-indigo-500/70" style={{ width: `${x.totalMarks && x.avgScore != null ? (x.avgScore / x.totalMarks) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {a.liveClasses.length > 0 && (
        <Card title="Live class attendance" icon={Radio}>
          <div className="space-y-2">
            {a.liveClasses.map(lc => (
              <div key={lc.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 truncate pr-2">{lc.title}</span>
                <span className="text-[11px] text-slate-500 shrink-0">{lc.scheduledAtBS} · {lc.attended}/{a.totals.enrolled} attended</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Per-student table */}
      <Card title="Students" icon={Users}>
        {a.students.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 text-left">
                  <th className="font-black py-1.5 px-1">Student</th>
                  <th className="font-black py-1.5 px-1">Progress</th>
                  <th className="font-black py-1.5 px-1 text-center">Lessons</th>
                  <th className="font-black py-1.5 px-1 text-center">Assign.</th>
                  <th className="font-black py-1.5 px-1 text-center">Quiz avg</th>
                  <th className="font-black py-1.5 px-1">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {a.students.map(s => (
                  <tr key={s.studentId}>
                    <td className="py-2 px-1">
                      <p className="font-semibold text-slate-700 truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400">{s.className}</p>
                    </td>
                    <td className="py-2 px-1 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
                          <div className={cn("h-full", s.completed ? "bg-emerald-500" : "bg-primary/70")} style={{ width: `${s.progress}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums text-slate-600 w-8">{s.progress}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center text-slate-600 tabular-nums">{s.lessonsDone}/{a.totals.totalLessons}</td>
                    <td className="py-2 px-1 text-center text-slate-600 tabular-nums">{s.assignmentsSubmitted}</td>
                    <td className="py-2 px-1 text-center text-slate-600 tabular-nums">{s.avgQuizScore ?? "—"}</td>
                    <td className="py-2 px-1 text-[11px] text-slate-500">{s.lastAccess ? new Date(s.lastAccess).toLocaleDateString() : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 inline-flex items-center gap-1.5 mb-3"><Icon className="w-3.5 h-3.5" /> {title}</h2>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-xs text-slate-400 italic">No data yet.</p>
}

function Stat({
  label, value, sub, icon: Icon, tone,
}: {
  label: string; value: string; sub: string; icon: React.ElementType; tone: "primary" | "emerald" | "indigo" | "amber"
}) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    indigo:  { ring: "ring-indigo-100",  icon: "text-indigo-600 bg-indigo-50",   value: "text-indigo-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-600 bg-amber-50",     value: "text-amber-700" },
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 ring-1", palette.ring)}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", palette.icon)}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className={cn("text-xl font-bold font-mono tabular-nums leading-tight", palette.value)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
