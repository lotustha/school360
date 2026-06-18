"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, Pencil, Trash2, CheckCircle2, Circle, ListChecks, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  getQuizEditor, addQuestion, updateQuestion, deleteQuestion, type QuestionType,
} from "@/actions/lms/quizzes"

type Quiz = Awaited<ReturnType<typeof getQuizEditor>>
type Question = Quiz["questions"][number]
interface Option { id: string; text: string; isCorrect: boolean }

const TYPE_LABEL: Record<QuestionType, string> = {
  MCQ: "Multiple choice", MULTI_SELECT: "Multi-select", TRUE_FALSE: "True / False",
  SHORT_ANSWER: "Short answer", ESSAY: "Essay (manual grading)",
}
const TYPES = Object.keys(TYPE_LABEL) as QuestionType[]

type FormState = {
  id?: string
  type: QuestionType
  questionText: string
  marks: string
  negativeMarks: string
  explanation: string
  options: Option[]
  correctAnswer: string // "true"/"false" for TF, expected text for SHORT_ANSWER
}

function newOption(): Option { return { id: crypto.randomUUID(), text: "", isCorrect: false } }
function emptyForm(): FormState {
  return { type: "MCQ", questionText: "", marks: "1", negativeMarks: "0", explanation: "", options: [newOption(), newOption()], correctAnswer: "" }
}

export function QuizEditorClient({ courseId, quiz }: { courseId: string; quiz: Quiz }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [del, setDel] = useState<Question | null>(null)

  function openCreate() { setForm(emptyForm()); setOpen(true) }
  function openEdit(q: Question) {
    setForm({
      id: q.id, type: q.type as QuestionType, questionText: q.questionText,
      marks: String(q.marks), negativeMarks: String(q.negativeMarks),
      explanation: q.explanation ?? "",
      options: q.options.length ? q.options : [newOption(), newOption()],
      correctAnswer: q.correctAnswer ?? "",
    })
    setOpen(true)
  }

  function setOptionText(id: string, text: string) {
    setForm(f => ({ ...f, options: f.options.map(o => o.id === id ? { ...o, text } : o) }))
  }
  function setCorrect(id: string, multi: boolean) {
    setForm(f => ({
      ...f,
      options: f.options.map(o => o.id === id ? { ...o, isCorrect: multi ? !o.isCorrect : true } : (multi ? o : { ...o, isCorrect: false })),
    }))
  }

  function submit() {
    if (!form.questionText.trim()) { toast.error("Question text is required"); return }
    const marks = Number(form.marks) || 1
    const negativeMarks = Number(form.negativeMarks) || 0
    const cleanOptions = form.options.filter(o => o.text.trim()).map(o => ({ ...o, text: o.text.trim() }))

    startTransition(async () => {
      try {
        const base = {
          type: form.type,
          questionText: form.questionText,
          marks, negativeMarks,
          explanation: form.explanation || null,
          options: (form.type === "MCQ" || form.type === "MULTI_SELECT") ? cleanOptions : [],
          correctAnswer: form.type === "TRUE_FALSE" || form.type === "SHORT_ANSWER" ? form.correctAnswer : null,
        }
        if (form.id) await updateQuestion({ id: form.id, ...base })
        else await addQuestion({ quizId: quiz.id, ...base })
        toast.success(form.id ? "Question updated" : "Question added")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not save question")
      }
    })
  }

  function confirmDelete() {
    if (!del) return
    startTransition(async () => {
      try {
        await deleteQuestion(del.id)
        toast.success("Question deleted")
        setDel(null)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not delete")
      }
    })
  }

  const isChoice = form.type === "MCQ" || form.type === "MULTI_SELECT"

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href={`/lms/courses/${courseId}/quizzes`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to quizzes
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{quiz.questions.length} questions · {quiz.totalMarks} total marks · pass {quiz.passMarks}</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" /> Add question</Button>
      </div>

      {quiz.questions.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <ListChecks className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No questions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quiz.questions.map((q, i) => (
            <div key={q.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400">Q{i + 1}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/8 px-1.5 py-0.5 rounded">{TYPE_LABEL[q.type as QuestionType]}</span>
                    <span className="text-[10px] text-slate-400">{q.marks} mark{q.marks === 1 ? "" : "s"}{q.negativeMarks ? ` · −${q.negativeMarks}` : ""}</span>
                  </div>
                  <p className="text-sm text-slate-800 mt-1.5">{q.questionText}</p>
                  {(q.type === "MCQ" || q.type === "MULTI_SELECT") && (
                    <ul className="mt-2 space-y-1">
                      {q.options.map(o => (
                        <li key={o.id} className={cn("text-xs inline-flex items-center gap-1.5 mr-3", o.isCorrect ? "text-emerald-700 font-semibold" : "text-slate-500")}>
                          {o.isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />} {o.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.type === "TRUE_FALSE" && <p className="text-xs text-emerald-700 font-semibold mt-1.5">Answer: {q.correctAnswer}</p>}
                  {q.type === "SHORT_ANSWER" && <p className="text-xs text-emerald-700 font-semibold mt-1.5">Expected: {q.correctAnswer}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(q)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDel(q)} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Question dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit question" : "Add question"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Question type</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={cn("px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors text-left",
                      form.type === t ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Question</Label>
              <Textarea value={form.questionText} onChange={e => setForm(f => ({ ...f, questionText: e.target.value }))} rows={2} autoFocus />
            </div>

            {isChoice && (
              <div className="space-y-1.5">
                <Label>Options {form.type === "MCQ" ? "(pick one correct)" : "(pick all correct)"}</Label>
                <div className="space-y-2">
                  {form.options.map(o => (
                    <div key={o.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => setCorrect(o.id, form.type === "MULTI_SELECT")} className={cn("shrink-0", o.isCorrect ? "text-emerald-600" : "text-slate-300 hover:text-slate-500")}>
                        {o.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <Input value={o.text} onChange={e => setOptionText(o.id, e.target.value)} placeholder="Option text" className="flex-1" />
                      {form.options.length > 2 && (
                        <button type="button" onClick={() => setForm(f => ({ ...f, options: f.options.filter(x => x.id !== o.id) }))} className="text-slate-300 hover:text-rose-600"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setForm(f => ({ ...f, options: [...f.options, newOption()] }))} className="text-xs font-semibold text-primary inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add option</button>
              </div>
            )}

            {form.type === "TRUE_FALSE" && (
              <div className="space-y-1.5">
                <Label>Correct answer</Label>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {["true", "false"].map(v => (
                    <button key={v} type="button" onClick={() => setForm(f => ({ ...f, correctAnswer: v }))} className={cn("px-4 py-1.5 text-sm font-semibold rounded-md capitalize transition-colors", form.correctAnswer === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}>{v}</button>
                  ))}
                </div>
              </div>
            )}

            {form.type === "SHORT_ANSWER" && (
              <div className="space-y-1.5">
                <Label>Expected answer <span className="text-slate-400 font-normal">(case-insensitive exact match)</span></Label>
                <Input value={form.correctAnswer} onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value }))} />
              </div>
            )}

            {form.type === "ESSAY" && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Essay answers are graded manually from the Results page.</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Marks</Label>
                <Input type="number" min={1} value={form.marks} onChange={e => setForm(f => ({ ...f, marks: e.target.value }))} />
              </div>
              {(form.type === "MCQ" || form.type === "TRUE_FALSE") && (
                <div className="space-y-1.5">
                  <Label>Negative marks</Label>
                  <Input type="number" min={0} value={form.negativeMarks} onChange={e => setForm(f => ({ ...f, negativeMarks: e.target.value }))} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Explanation <span className="text-slate-400 font-normal">(shown after, optional)</span></Label>
              <Textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submit} disabled={isPending}>{isPending ? "Saving…" : form.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!del} onOpenChange={o => !o && setDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete question?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">This question will be removed from the quiz.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
