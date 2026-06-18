"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, Pencil, Trash2, ListChecks, Users, Timer, Settings2, BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { createQuiz, updateQuiz, deleteQuiz, type QuizRow } from "@/actions/lms/quizzes"

type FormState = {
  id?: string
  title: string
  description: string
  timeLimitMin: string
  passMarks: string
  maxAttempts: string
  shuffleQ: boolean
  shuffleOpts: boolean
  showResult: boolean
  showAnswers: boolean
  startAt: string
  endAt: string
}

const EMPTY: FormState = {
  title: "", description: "", timeLimitMin: "", passMarks: "0", maxAttempts: "1",
  shuffleQ: false, shuffleOpts: false, showResult: true, showAnswers: false, startAt: "", endAt: "",
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export function QuizzesClient({
  courseId, courseTitle, quizzes, canManage,
}: {
  courseId: string; courseTitle: string; quizzes: QuizRow[]; canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [del, setDel] = useState<QuizRow | null>(null)

  function openCreate() { setForm(EMPTY); setOpen(true) }
  function openEdit(q: QuizRow) {
    setForm({
      id: q.id, title: q.title, description: q.description ?? "",
      timeLimitMin: q.timeLimitMin ? String(q.timeLimitMin) : "",
      passMarks: String(q.passMarks), maxAttempts: String(q.maxAttempts),
      shuffleQ: false, shuffleOpts: false, showResult: true, showAnswers: false,
      startAt: toLocalInput(q.startAt), endAt: toLocalInput(q.endAt),
    })
    setOpen(true)
  }

  function submit() {
    if (!form.title.trim()) { toast.error("Title is required"); return }
    startTransition(async () => {
      try {
        const payload = {
          title: form.title,
          description: form.description || null,
          timeLimitMin: form.timeLimitMin ? Number(form.timeLimitMin) : null,
          passMarks: Number(form.passMarks) || 0,
          maxAttempts: Number(form.maxAttempts) || 1,
          shuffleQ: form.shuffleQ,
          shuffleOpts: form.shuffleOpts,
          showResult: form.showResult,
          showAnswers: form.showAnswers,
          startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
          endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        }
        if (form.id) await updateQuiz({ id: form.id, ...payload })
        else {
          const res = await createQuiz({ courseId, ...payload })
          toast.success("Quiz created — now add questions")
          router.push(`/lms/courses/${courseId}/quizzes/${res.id}`)
          return
        }
        toast.success("Quiz updated")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Something went wrong")
      }
    })
  }

  function confirmDelete() {
    if (!del) return
    startTransition(async () => {
      try {
        await deleteQuiz(del.id)
        toast.success("Quiz deleted")
        setDel(null)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not delete")
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href={`/lms/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to course
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Quizzes & Online Exams</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{courseTitle}</p>
        </div>
        {canManage && <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" /> New quiz</Button>}
      </div>

      {quizzes.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <ListChecks className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No quizzes yet</p>
          <p className="text-xs text-slate-500 mt-1">Create a quiz, then add questions to it.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(q => (
            <div key={q.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-bold text-sm text-slate-800 truncate">{q.title}</h3>
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", q.isOpen ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                      {q.isOpen ? "Open" : "Closed"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                    <span>{q.questionCount} questions · {q.totalMarks} marks</span>
                    <span>Pass {q.passMarks}</span>
                    {q.timeLimitMin && <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" /> {q.timeLimitMin} min</span>}
                    <span>{q.maxAttempts} attempt{q.maxAttempts === 1 ? "" : "s"}</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {q.attemptCount} taken</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(q)} title="Settings" className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Settings2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDel(q)} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                {canManage && (
                  <Link href={`/lms/courses/${courseId}/quizzes/${q.id}`} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit questions</Link>
                )}
                <Link href={`/lms/courses/${courseId}/quizzes/${q.id}/results`} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Results</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quiz settings dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Quiz settings" : "New quiz"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Unit 1 Quiz" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Time limit (min)</Label>
                <Input type="number" min={1} value={form.timeLimitMin} onChange={e => setForm(f => ({ ...f, timeLimitMin: e.target.value }))} placeholder="None" />
              </div>
              <div className="space-y-1.5">
                <Label>Pass marks</Label>
                <Input type="number" min={0} value={form.passMarks} onChange={e => setForm(f => ({ ...f, passMarks: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Max attempts</Label>
                <Input type="number" min={1} value={form.maxAttempts} onChange={e => setForm(f => ({ ...f, maxAttempts: e.target.value }))} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Opens <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Closes <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ToggleRow label="Shuffle questions" checked={form.shuffleQ} onChange={v => setForm(f => ({ ...f, shuffleQ: v }))} />
              <ToggleRow label="Shuffle options" checked={form.shuffleOpts} onChange={v => setForm(f => ({ ...f, shuffleOpts: v }))} />
              <ToggleRow label="Show score after" checked={form.showResult} onChange={v => setForm(f => ({ ...f, showResult: v }))} />
              <ToggleRow label="Show correct answers" checked={form.showAnswers} onChange={v => setForm(f => ({ ...f, showAnswers: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submit} disabled={isPending}>{isPending ? "Saving…" : form.id ? "Save" : "Create & add questions"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!del} onOpenChange={o => !o && setDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete quiz?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600"><span className="font-semibold">{del?.title}</span>, its questions, and all attempts will be permanently removed.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
