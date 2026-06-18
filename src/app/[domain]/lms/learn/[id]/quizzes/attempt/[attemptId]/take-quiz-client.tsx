"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Timer, CheckCircle2, Circle, Square, CheckSquare, Trophy, XCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { getAttempt, submitQuizAttempt, type QuestionType } from "@/actions/lms/quizzes"

type Data = Awaited<ReturnType<typeof getAttempt>>
type Question = Data["questions"][number]

interface AnswerState { selectedOptions: string[]; textAnswer: string }
type Result = { score: number; totalMarks: number; isPassed: boolean; needsManual: boolean; showResult: boolean } | null

export function TakeQuizClient({
  courseId, attempt, quiz, questions,
}: {
  courseId: string
  attempt: Data["attempt"]
  quiz: Data["quiz"]
  questions: Question[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({})
  const [result, setResult] = useState<Result>(null)
  const submittedRef = useRef(false)

  // Timer
  const deadline = useMemo(() => {
    if (!attempt.timeLimitMin) return null
    return new Date(attempt.startedAt).getTime() + attempt.timeLimitMin * 60_000
  }, [attempt])
  const [remaining, setRemaining] = useState<number | null>(
    deadline ? Math.max(0, deadline - Date.now()) : null,
  )

  function getAns(qid: string): AnswerState {
    return answers[qid] ?? { selectedOptions: [], textAnswer: "" }
  }
  function setAns(qid: string, patch: Partial<AnswerState>) {
    setAnswers(prev => ({ ...prev, [qid]: { ...getAns(qid), ...patch } }))
  }

  function doSubmit(auto = false) {
    if (submittedRef.current) return
    submittedRef.current = true
    startTransition(async () => {
      try {
        const payload = questions.map(q => ({
          questionId: q.id,
          selectedOptions: getAns(q.id).selectedOptions,
          textAnswer: getAns(q.id).textAnswer || null,
        }))
        const res = await submitQuizAttempt({ attemptId: attempt.id, answers: payload })
        if (auto) toast.info("Time's up — quiz submitted")
        setResult({ score: res.score, totalMarks: res.totalMarks, isPassed: res.isPassed, needsManual: res.needsManual, showResult: res.showResult })
      } catch (e) {
        submittedRef.current = false
        toast.error((e as Error).message || "Could not submit")
      }
    })
  }

  useEffect(() => {
    if (deadline == null) return
    const t = setInterval(() => {
      const left = Math.max(0, deadline - Date.now())
      setRemaining(left)
      if (left <= 0) { clearInterval(t); doSubmit(true) }
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline])

  // ── Result screen ──
  if (result) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-8 text-center">
          {result.showResult ? (
            <>
              {result.isPassed
                ? <Trophy className="w-14 h-14 mx-auto text-amber-500 mb-3" />
                : <XCircle className="w-14 h-14 mx-auto text-rose-400 mb-3" />}
              <h1 className="text-2xl font-bold text-slate-800">{result.score} / {result.totalMarks}</h1>
              <p className={cn("text-sm font-semibold mt-1", result.isPassed ? "text-emerald-600" : "text-rose-600")}>
                {result.isPassed ? "Passed" : "Not passed"}
              </p>
              {result.needsManual && (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                  Some essay questions need manual grading — your final score may change.
                </p>
              )}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500 mb-3" />
              <h1 className="text-xl font-bold text-slate-800">Submitted</h1>
              <p className="text-sm text-slate-500 mt-1">Your responses have been recorded.</p>
            </>
          )}
          <Button className="mt-6" onClick={() => router.push(`/lms/learn/${courseId}/quizzes`)}>Back to quizzes</Button>
        </div>
      </div>
    )
  }

  const answeredCount = questions.filter(q => {
    const a = getAns(q.id)
    return a.selectedOptions.length > 0 || a.textAnswer.trim().length > 0
  }).length

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-800 truncate">{quiz.title}</h1>
            <p className="text-[11px] text-slate-500">{answeredCount}/{questions.length} answered</p>
          </div>
          {remaining != null && (
            <div className={cn("inline-flex items-center gap-1.5 font-mono font-bold tabular-nums px-3 py-1.5 rounded-lg",
              remaining < 60_000 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700")}>
              <Timer className="w-4 h-4" /> {fmt(remaining)}
            </div>
          )}
        </div>
        <Progress value={(answeredCount / Math.max(1, questions.length)) * 100} className="h-1.5 mt-3" />
      </div>

      {/* Questions */}
      {questions.map((q, i) => (
        <div key={q.id} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-black text-slate-400 mt-0.5">Q{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{q.questionText}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{q.marks} mark{q.marks === 1 ? "" : "s"}</p>
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.imageUrl} alt="" className="mt-2 max-h-60 rounded-lg border border-slate-100" />
              )}
              <div className="mt-3">
                <QuestionInput question={q} answer={getAns(q.id)} onChange={patch => setAns(q.id, patch)} />
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end gap-2 pb-8">
        <Button onClick={() => doSubmit(false)} disabled={isPending} size="lg" className="gap-1.5">
          {isPending ? "Submitting…" : <>Submit quiz <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </div>
    </div>
  )
}

function QuestionInput({
  question, answer, onChange,
}: {
  question: Question
  answer: AnswerState
  onChange: (patch: Partial<AnswerState>) => void
}) {
  const type = question.type as QuestionType

  if (type === "MCQ") {
    return (
      <div className="space-y-2">
        {question.options.map(o => {
          const sel = answer.selectedOptions[0] === o.id
          return (
            <button key={o.id} type="button" onClick={() => onChange({ selectedOptions: [o.id] })}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors",
                sel ? "border-primary bg-primary/5 text-slate-800" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
              {sel ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
              {o.text}
            </button>
          )
        })}
      </div>
    )
  }

  if (type === "MULTI_SELECT") {
    return (
      <div className="space-y-2">
        {question.options.map(o => {
          const sel = answer.selectedOptions.includes(o.id)
          return (
            <button key={o.id} type="button"
              onClick={() => onChange({ selectedOptions: sel ? answer.selectedOptions.filter(x => x !== o.id) : [...answer.selectedOptions, o.id] })}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors",
                sel ? "border-primary bg-primary/5 text-slate-800" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
              {sel ? <CheckSquare className="w-4 h-4 text-primary shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
              {o.text}
            </button>
          )
        })}
      </div>
    )
  }

  if (type === "TRUE_FALSE") {
    return (
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
        {["true", "false"].map(v => (
          <button key={v} type="button" onClick={() => onChange({ textAnswer: v })}
            className={cn("px-5 py-2 text-sm font-semibold rounded-md capitalize transition-colors",
              answer.textAnswer === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}>{v}</button>
        ))}
      </div>
    )
  }

  if (type === "SHORT_ANSWER") {
    return <Input value={answer.textAnswer} onChange={e => onChange({ textAnswer: e.target.value })} placeholder="Your answer" />
  }

  // ESSAY
  return <Textarea value={answer.textAnswer} onChange={e => onChange({ textAnswer: e.target.value })} rows={5} placeholder="Write your answer…" />
}

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}
