"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ListChecks, Timer, Play, RotateCcw, Trophy, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getMyQuizzes, startQuizAttempt } from "@/actions/lms/quizzes"

type Quiz = Awaited<ReturnType<typeof getMyQuizzes>>[number]

export function MyQuizzesClient({ courseId, quizzes }: { courseId: string; quizzes: Quiz[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function start(q: Quiz) {
    setBusyId(q.id)
    startTransition(async () => {
      try {
        const res = await startQuizAttempt(q.id)
        router.push(`/lms/learn/${courseId}/quizzes/attempt/${res.attemptId}`)
      } catch (e) {
        toast.error((e as Error).message || "Could not start quiz")
        setBusyId(null)
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href={`/lms/learn/${courseId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to course
      </Link>

      <h1 className="text-xl font-bold tracking-tight text-slate-800">Quizzes</h1>

      {quizzes.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <ListChecks className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No quizzes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(q => {
            const attemptsLeft = q.maxAttempts - q.attemptsUsed
            const canStart = q.isOpen && q.questionCount > 0 && (attemptsLeft > 0 || q.inProgressId)
            return (
              <div key={q.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-primary shrink-0" />
                      <h3 className="font-bold text-sm text-slate-800 truncate">{q.title}</h3>
                    </div>
                    {q.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{q.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                      <span>{q.questionCount} questions · {q.totalMarks} marks</span>
                      <span>Pass {q.passMarks}</span>
                      {q.timeLimitMin && <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" /> {q.timeLimitMin} min</span>}
                      <span>{attemptsLeft} of {q.maxAttempts} attempts left</span>
                    </div>
                  </div>
                  {q.bestScore != null && q.showResult && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Best</p>
                      <p className={cn("text-lg font-bold tabular-nums inline-flex items-center gap-1", q.bestScore >= q.passMarks ? "text-emerald-600" : "text-rose-600")}>
                        {q.bestScore >= q.passMarks && <Trophy className="w-4 h-4" />}{q.bestScore}<span className="text-[10px] text-slate-400">/{q.totalMarks}</span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500">
                    {!q.isOpen ? "Closed" : q.questionCount === 0 ? "No questions yet" : "Available"}
                  </span>
                  {q.inProgressId ? (
                    <Button size="sm" onClick={() => router.push(`/lms/learn/${courseId}/quizzes/attempt/${q.inProgressId}`)} className="gap-1.5 h-8">
                      <RotateCcw className="w-3.5 h-3.5" /> Resume
                    </Button>
                  ) : canStart ? (
                    <Button size="sm" onClick={() => start(q)} disabled={isPending && busyId === q.id} className="gap-1.5 h-8">
                      <Play className="w-3.5 h-3.5" /> {q.attemptsUsed > 0 ? "Retake" : "Start"}
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Lock className="w-3 h-3" /> Unavailable</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
