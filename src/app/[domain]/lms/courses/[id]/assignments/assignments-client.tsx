"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, Pencil, Trash2, FileText, CalendarClock, Users, CheckCircle2, ClipboardList,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { FileUploader, type FileRef } from "../../../_components/file-uploader"
import {
  createAssignment, updateAssignment, deleteAssignment, type AssignmentRow,
} from "@/actions/lms/assignments"

interface SubjectOpt { id: string; name: string; className: string }

type FormState = {
  id?: string
  title: string
  description: string
  subjectId: string
  dueDate: string
  totalMarks: string
  passMarks: string
  allowLate: boolean
  latePenaltyPct: string
  attachments: FileRef[]
}

export function AssignmentsClient({
  courseId, courseTitle, defaultSubjectId, assignments, subjects, canManage, canGrade,
}: {
  courseId: string
  courseTitle: string
  defaultSubjectId: string | null
  assignments: AssignmentRow[]
  subjects: SubjectOpt[]
  canManage: boolean
  canGrade: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm(defaultSubjectId))
  const [del, setDel] = useState<AssignmentRow | null>(null)

  function openCreate() { setForm(emptyForm(defaultSubjectId)); setOpen(true) }
  function openEdit(a: AssignmentRow) {
    setForm({
      id: a.id, title: a.title, description: a.description ?? "",
      subjectId: subjects.find(s => s.name === a.subjectName)?.id ?? defaultSubjectId ?? "",
      dueDate: a.dueDate.slice(0, 10),
      totalMarks: String(a.totalMarks), passMarks: String(a.passMarks),
      allowLate: a.allowLate, latePenaltyPct: String(a.latePenaltyPct),
      attachments: [],
    })
    setOpen(true)
  }

  function submit() {
    if (!form.title.trim()) { toast.error("Title is required"); return }
    if (!form.subjectId) { toast.error("Pick a subject"); return }
    if (!form.dueDate) { toast.error("Pick a due date"); return }

    startTransition(async () => {
      try {
        const payload = {
          subjectId: form.subjectId,
          title: form.title,
          description: form.description || null,
          dueDate: form.dueDate,
          totalMarks: Number(form.totalMarks) || 100,
          passMarks: Number(form.passMarks) || 0,
          allowLate: form.allowLate,
          latePenaltyPct: Number(form.latePenaltyPct) || 0,
          attachments: form.attachments,
        }
        if (form.id) await updateAssignment({ id: form.id, ...payload })
        else await createAssignment({ courseId, ...payload })
        toast.success(form.id ? "Assignment updated" : "Assignment created")
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
        await deleteAssignment(del.id)
        toast.success("Assignment deleted")
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{courseTitle}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" /> New assignment</Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <ClipboardList className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No assignments yet</p>
          <p className="text-xs text-slate-500 mt-1">Create an assignment for enrolled students to submit.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <div key={a.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-bold text-sm text-slate-800 truncate">{a.title}</h3>
                  </div>
                  {a.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Due {a.dueDateBS ?? a.dueDate.slice(0, 10)}</span>
                    <span>{a.subjectName}</span>
                    <span>{a.totalMarks} marks · pass {a.passMarks}</span>
                    {a.allowLate && <span className="text-amber-600">Late allowed{a.latePenaltyPct ? ` (−${a.latePenaltyPct}%/day)` : ""}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canManage && (
                    <>
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDel(a)} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-4 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {a.submissionCount}/{a.enrolledCount} submitted</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {a.gradedCount} graded</span>
                </div>
                {canGrade && (
                  <Link href={`/lms/courses/${courseId}/assignments/${a.id}`} className="text-xs font-semibold text-primary hover:underline">
                    Grade submissions →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit assignment" : "New assignment"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Chapter 3 problem set" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Instructions <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <SearchableSelect
                  value={form.subjectId}
                  onChange={v => setForm(f => ({ ...f, subjectId: v }))}
                  options={subjects.map(s => ({ value: s.id, label: s.name, hint: s.className }))}
                  placeholder="Select subject"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total marks</Label>
                <Input type="number" min={1} value={form.totalMarks} onChange={e => setForm(f => ({ ...f, totalMarks: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Pass marks</Label>
                <Input type="number" min={0} value={form.passMarks} onChange={e => setForm(f => ({ ...f, passMarks: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <div>
                <Label className="text-sm">Allow late submission</Label>
                <p className="text-[11px] text-slate-500">Accept work after the due date</p>
              </div>
              <Switch checked={form.allowLate} onCheckedChange={v => setForm(f => ({ ...f, allowLate: v }))} />
            </div>
            {form.allowLate && (
              <div className="space-y-1.5">
                <Label>Late penalty (% per day)</Label>
                <Input type="number" min={0} max={100} value={form.latePenaltyPct} onChange={e => setForm(f => ({ ...f, latePenaltyPct: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Reference attachments <span className="text-slate-400 font-normal">(optional)</span></Label>
              <FileUploader value={form.attachments} onChange={files => setForm(f => ({ ...f, attachments: files }))} maxFiles={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submit} disabled={isPending}>{isPending ? "Saving…" : form.id ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!del} onOpenChange={o => !o && setDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete assignment?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600"><span className="font-semibold">{del?.title}</span> and all its submissions will be permanently removed.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function emptyForm(defaultSubjectId: string | null): FormState {
  return {
    title: "", description: "", subjectId: defaultSubjectId ?? "", dueDate: "",
    totalMarks: "100", passMarks: "40", allowLate: false, latePenaltyPct: "0", attachments: [],
  }
}
