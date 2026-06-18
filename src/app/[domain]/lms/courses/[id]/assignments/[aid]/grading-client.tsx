"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, FileText, Clock, CheckCircle2, AlertCircle, Paperclip, Users, Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { gradeSubmission, type SubmissionStatus } from "@/actions/lms/assignments"

interface FileRef { name: string; url: string; size?: number }
interface Submission {
  id: string
  submittedAt: string
  isLate: boolean
  status: SubmissionStatus
  marks: number | null
  feedback: string | null
  note: string | null
  files: FileRef[]
  gradedAt: string | null
}
interface Row {
  studentId: string
  name: string
  rollNumber: string | null
  className: string
  sectionName: string | null
  submission: Submission | null
}
interface Assignment {
  id: string; title: string; description: string | null
  dueDate: string; dueDateBS: string | null
  totalMarks: number; passMarks: number; allowLate: boolean; latePenaltyPct: number
  subjectName: string; courseId: string; courseTitle: string; attachments: FileRef[]
}

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700 border-blue-200",
  GRADED:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  RETURNED:  "bg-violet-100 text-violet-700 border-violet-200",
  RESUBMIT:  "bg-amber-100 text-amber-700 border-amber-200",
}

export function GradingClient({
  courseId, assignment, rows, canGrade,
}: {
  courseId: string
  assignment: Assignment
  rows: Row[]
  canGrade: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [grading, setGrading] = useState<Row | null>(null)
  const [marks, setMarks] = useState("")
  const [feedback, setFeedback] = useState("")
  const [status, setStatus] = useState<"GRADED" | "RETURNED" | "RESUBMIT">("GRADED")

  const submitted = rows.filter(r => r.submission)
  const graded = rows.filter(r => r.submission && (r.submission.status === "GRADED" || r.submission.status === "RETURNED"))

  function openGrade(r: Row) {
    if (!r.submission) return
    setGrading(r)
    setMarks(r.submission.marks != null ? String(r.submission.marks) : "")
    setFeedback(r.submission.feedback ?? "")
    setStatus(r.submission.status === "SUBMITTED" ? "GRADED" : (r.submission.status as "GRADED" | "RETURNED" | "RESUBMIT"))
  }

  function submitGrade() {
    if (!grading?.submission) return
    const m = Number(marks)
    if (marks === "" || Number.isNaN(m)) { toast.error("Enter marks"); return }
    if (m > assignment.totalMarks) { toast.error(`Max ${assignment.totalMarks} marks`); return }
    startTransition(async () => {
      try {
        await gradeSubmission({ submissionId: grading.submission!.id, marks: m, feedback: feedback || null, status })
        toast.success("Graded")
        setGrading(null)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not save grade")
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href={`/lms/courses/${courseId}/assignments`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to assignments
      </Link>

      {/* Assignment header */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-slate-800">{assignment.title}</h1>
        </div>
        {assignment.description && <p className="text-sm text-slate-600 mt-2">{assignment.description}</p>}
        <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500 flex-wrap">
          <span>Due {assignment.dueDateBS ?? assignment.dueDate.slice(0, 10)}</span>
          <span>{assignment.subjectName}</span>
          <span>{assignment.totalMarks} marks · pass {assignment.passMarks}</span>
          <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {submitted.length}/{rows.length} submitted</span>
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {graded.length} graded</span>
        </div>
        {assignment.attachments.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {assignment.attachments.map(f => (
              <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline border border-primary/20 rounded-full px-2 py-0.5">
                <Paperclip className="w-3 h-3" /> {f.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Student rows */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden divide-y divide-slate-50">
        {rows.map(r => {
          const sub = r.submission
          return (
            <div key={r.studentId} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{r.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                <p className="text-[11px] text-slate-500">{r.className}{r.sectionName ? ` · ${r.sectionName}` : ""}{r.rollNumber ? ` · Roll ${r.rollNumber}` : ""}</p>
              </div>

              {sub ? (
                <div className="flex items-center gap-2 shrink-0">
                  {sub.files.length > 0 && (
                    <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {sub.files.length}</span>
                  )}
                  {sub.isLate && <span className="text-[10px] font-bold text-amber-600 inline-flex items-center gap-0.5"><Clock className="w-3 h-3" /> Late</span>}
                  {sub.marks != null && <span className="text-sm font-bold text-slate-700 tabular-nums">{sub.marks}<span className="text-[10px] text-slate-400">/{assignment.totalMarks}</span></span>}
                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", STATUS_STYLE[sub.status])}>{sub.status}</span>
                  {canGrade && (
                    <Button size="sm" variant="outline" onClick={() => openGrade(r)} className="gap-1 h-7">
                      <Star className="w-3.5 h-3.5" /> {sub.marks != null ? "Edit" : "Grade"}
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 shrink-0"><AlertCircle className="w-3.5 h-3.5" /> Not submitted</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Grade dialog */}
      <Dialog open={!!grading} onOpenChange={o => !o && setGrading(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Grade — {grading?.name}</DialogTitle></DialogHeader>
          {grading?.submission && (
            <div className="space-y-4 py-1">
              <div className="text-[11px] text-slate-500">
                Submitted {new Date(grading.submission.submittedAt).toLocaleString()}
                {grading.submission.isLate && <span className="text-amber-600 font-semibold"> · Late</span>}
              </div>
              {grading.submission.note && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-sm text-slate-700">{grading.submission.note}</div>
              )}
              {grading.submission.files.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Submitted files</Label>
                  {grading.submission.files.map(f => (
                    <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-primary/40 hover:text-primary">
                      <Paperclip className="w-3.5 h-3.5" /> {f.name}
                    </a>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Marks (out of {assignment.totalMarks})</Label>
                  <Input type="number" min={0} max={assignment.totalMarks} value={marks} onChange={e => setMarks(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 w-full">
                    {(["GRADED", "RETURNED", "RESUBMIT"] as const).map(s => (
                      <button key={s} type="button" onClick={() => setStatus(s)} className={cn("flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md transition-colors", status === s ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Feedback <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} placeholder="Comments for the student…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGrading(null)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitGrade} disabled={isPending}>{isPending ? "Saving…" : "Save grade"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
