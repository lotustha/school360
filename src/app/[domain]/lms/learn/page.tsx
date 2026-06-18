import { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getMyEnrolledCourses, type MyCourseRow } from "@/actions/lms/progress"
import { BookOpen, GraduationCap, Trophy, PlayCircle, GraduationCap as Cap } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { lmsAccessState } from "../access-states"

export const metadata: Metadata = { title: "My Learning" }

export default async function MyLearningPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/learn`)

  let courses: MyCourseRow[]
  try {
    courses = await getMyEnrolledCourses()
  } catch (e) {
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms/learn`)
    // FORBIDDEN here means "not a learner" — show a friendly empty state.
    if ((e as Error).message === "FORBIDDEN") {
      return (
        <div className="max-w-3xl mx-auto mt-16 text-center">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12">
            <Cap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h1 className="text-lg font-bold text-slate-800">No learner profile</h1>
            <p className="text-xs text-slate-500 mt-1">
              Online Learning courses are available to enrolled students.
            </p>
          </div>
        </div>
      )
    }
    if (state !== undefined) return state
    throw e
  }

  const inProgress = courses.filter(c => !c.completedAt)
  const done = courses.filter(c => c.completedAt)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Learning</h1>
        <p className="text-sm text-muted-foreground mt-1">Continue your courses and track your progress.</p>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-12 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">You&apos;re not enrolled in any courses yet</p>
          <p className="text-xs text-slate-500 mt-1">Your teachers will enroll you in courses as they become available.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {inProgress.length > 0 && (
            <Section title="In progress" courses={inProgress} domain={domain} />
          )}
          {done.length > 0 && (
            <Section title="Completed" courses={done} domain={domain} />
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, courses, domain }: { title: string; courses: MyCourseRow[]; domain: string }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map(c => (
          <Link
            key={c.id}
            href={`/${domain}/lms/learn/${c.id}`}
            className="group bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
          >
            <div className="h-28 bg-gradient-to-br from-primary/15 via-indigo-100 to-emerald-100 relative">
              {c.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-primary/40" />
                </div>
              )}
              {c.completedAt && (
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <Trophy className="w-3 h-3" /> Done
                </span>
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-bold text-sm text-slate-800 leading-snug line-clamp-2 group-hover:text-primary transition-colors">{c.title}</h3>
              <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
                <GraduationCap className="w-3 h-3" /> {c.instructorName}
              </p>
              <div className="mt-auto pt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{c.progress}% complete</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-primary">
                    <PlayCircle className="w-3.5 h-3.5" /> {c.completedAt ? "Review" : "Continue"}
                  </span>
                </div>
                <Progress value={c.progress} className="h-1.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
