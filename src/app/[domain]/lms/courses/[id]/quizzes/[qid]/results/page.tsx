import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getQuizResults } from "@/actions/lms/quizzes"
import { ArrowLeft, Trophy, Users, Percent } from "lucide-react"
import { cn } from "@/lib/utils"
import { lmsAccessState } from "../../../../../access-states"
import { QuizResultsActions } from "./results-actions"

export const metadata: Metadata = { title: "Quiz Results" }

export default async function QuizResultsPage({
  params,
}: {
  params: Promise<{ domain: string; id: string; qid: string }>
}) {
  const { domain, id, qid } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/quizzes/${qid}/results`)

  let data: Awaited<ReturnType<typeof getQuizResults>>
  try {
    data = await getQuizResults(qid)
  } catch (e) {
    if ((e as Error).message === "Quiz not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const canManage = await hasPermission(session, "lms:quizzes:manage")
  const { quiz, rows } = data
  const passed = rows.filter(r => r.isPassed).length
  const scores = rows.map(r => r.score ?? 0)
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href={`/${domain}/lms/courses/${id}/quizzes`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to quizzes
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">{quiz.title} — Results</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{quiz.totalMarks} marks · pass {quiz.passMarks} · best attempt per student</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Attempted" value={`${rows.length}`} icon={Users} tone="primary" />
        <Stat label="Passed" value={`${passed}`} icon={Trophy} tone="emerald" />
        <Stat label="Avg score" value={`${avg}`} icon={Percent} tone="indigo" />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <Users className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No attempts yet</p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden divide-y divide-slate-50">
          {rows.map(r => (
            <div key={r.attemptId} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{r.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                <p className="text-[11px] text-slate-500">{r.className}{r.rollNumber ? ` · Roll ${r.rollNumber}` : ""} · attempt {r.attemptNo}{r.timeTaken ? ` · ${Math.round(r.timeTaken / 60)} min` : ""}</p>
              </div>
              <span className="text-sm font-bold text-slate-700 tabular-nums">{r.score ?? "—"}<span className="text-[10px] text-slate-400">/{quiz.totalMarks}</span></span>
              <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", r.isPassed ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-rose-100 text-rose-700 border-rose-200")}>
                {r.isPassed ? "Pass" : "Fail"}
              </span>
              {canManage && <QuizResultsActions attemptId={r.attemptId} currentScore={r.score} totalMarks={quiz.totalMarks} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: "primary" | "emerald" | "indigo" }) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    indigo:  { ring: "ring-indigo-100",  icon: "text-indigo-600 bg-indigo-50",   value: "text-indigo-700" },
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3.5 ring-1", palette.ring)}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", palette.icon)}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className={cn("text-lg font-bold font-mono tabular-nums", palette.value)}>{value}</p>
    </div>
  )
}
