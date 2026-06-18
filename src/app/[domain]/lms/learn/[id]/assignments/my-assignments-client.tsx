"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, FileText, CalendarClock, Clock, CheckCircle2, Paperclip, Upload, Star, MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { FileUploader, type FileRef } from "../../../_components/file-uploader"
import { submitAssignment, getMyAssignments } from "@/actions/lms/assignments"

type Assignment = Awaited<ReturnType<typeof getMyAssignments>>[number]

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700 border-blue-200",
  GRADED:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  RETURNED:  "bg-violet-100 text-violet-700 border-violet-200",
  RESUBMIT:  "bg-amber-100 text-amber-700 border-amber-200",
}

export function MyAssignmentsClient({
  courseId, assignments,
}: {
  courseId: string
  assignments: Assignment[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [active, setActive] = useState<Assignment | null>(null)
  const [files, setFiles] = useState<FileRef[]>([])
  const [note, setNote] = useState("")

  function openSubmit(a: Assignment) {
    setActive(a)
    setFiles(a.submission?.files ?? [])
    setNote(a.submission?.note ?? "")
  }

  function submit() {
    if (!active) return
    if (files.length === 0 && !note.trim()) { toast.error("Attach a file or write a note"); return }
    startTransition(async () => {
      try {
        const res = await submitAssignment({ assignmentId: active.id, note: note || null, files })
        toast.success(res.isLate ? "Submitted (late)" : "Submitted")
        setActive(null)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not submit")
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href={`/lms/learn/${courseId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to course
      </Link>

      <h1 className="text-xl font-bold tracking-tight text-slate-800">Assignments</h1>

      {assignments.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <FileText className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No assignments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const sub = a.submission
            const locked = a.isPastDue && !a.allowLate && !sub
            return (
              <div key={a.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-800">{a.title}</h3>
                    {a.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1", a.isPastDue && !sub && "text-rose-600 font-semibold")}>
                        <CalendarClock className="w-3 h-3" /> Due {a.dueDateBS ?? a.dueDate.slice(0, 10)}
                      </span>
                      <span>{a.totalMarks} marks</span>
                      {a.attachments.map(f => (
                        <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Paperclip className="w-3 h-3" /> {f.name}
                        </a>
                      ))}
                    </div>
                  </div>
                  {sub && <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0", STATUS_STYLE[sub.status])}>{sub.status}</span>}
                </div>

                {/* Grade / feedback */}
                {sub && sub.marks != null && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2">
                    <Star className="w-4 h-4 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">{sub.marks} / {a.totalMarks}
                        <span className={cn("ml-2 text-[11px] font-semibold", sub.marks >= a.passMarks ? "text-emerald-600" : "text-rose-600")}>
                          {sub.marks >= a.passMarks ? "Pass" : "Below pass"}
                        </span>
                      </p>
                      {sub.feedback && <p className="text-xs text-slate-600 mt-1 inline-flex items-start gap-1"><MessageSquare className="w-3 h-3 mt-0.5 shrink-0" /> {sub.feedback}</p>}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    {sub ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Submitted {new Date(sub.submittedAt).toLocaleDateString()}
                        {sub.isLate && <span className="text-amber-600 font-semibold inline-flex items-center gap-0.5 ml-1"><Clock className="w-3 h-3" /> Late</span>}
                      </span>
                    ) : locked ? (
                      <span className="text-rose-600 font-semibold">Closed — past due</span>
                    ) : (
                      <span>Not submitted</span>
                    )}
                  </div>
                  {!locked && (sub?.status !== "GRADED") && (
                    <Button size="sm" variant={sub ? "outline" : "default"} onClick={() => openSubmit(a)} className="gap-1.5 h-7">
                      <Upload className="w-3.5 h-3.5" /> {sub ? "Resubmit" : "Submit"}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Submit dialog */}
      <Dialog open={!!active} onOpenChange={o => !o && setActive(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Submit — {active?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Files</Label>
              <FileUploader value={files} onChange={setFiles} maxFiles={active?.maxFileSize ? 5 : 5} />
            </div>
            <div className="space-y-1.5">
              <Label>Note <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Anything you'd like your teacher to know…" />
            </div>
            {active?.isPastDue && active?.allowLate && (
              <p className="text-[11px] text-amber-600 font-medium">This will be marked as a late submission.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)} disabled={isPending}>Cancel</Button>
            <Button onClick={submit} disabled={isPending}>{isPending ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
