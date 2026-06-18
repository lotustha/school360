"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, Pencil, Trash2, Radio, Video, Play, Square, Ban, Users, CalendarClock, ExternalLink, ClipboardList,
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
  scheduleLiveClass, updateLiveClass, setLiveStatus, deleteLiveClass, getLiveAttendance,
  type LiveClassRow, type LivePlatform, type LiveStatus,
} from "@/actions/lms/live-classes"

const PLATFORMS: { value: LivePlatform; label: string }[] = [
  { value: "GOOGLE_MEET", label: "Google Meet" },
  { value: "ZOOM", label: "Zoom" },
  { value: "JITSI", label: "Jitsi" },
  { value: "CUSTOM", label: "Other" },
]
const STATUS_STYLE: Record<LiveStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  LIVE:      "bg-rose-100 text-rose-700 border-rose-200 animate-pulse",
  ENDED:     "bg-slate-100 text-slate-500 border-slate-200",
  CANCELLED: "bg-slate-100 text-slate-400 border-slate-200",
}

type FormState = {
  id?: string
  title: string
  description: string
  scheduledAt: string
  durationMinutes: string
  platform: LivePlatform
  meetingUrl: string
  meetingPassword: string
  recordingUrl: string
}
const EMPTY: FormState = {
  title: "", description: "", scheduledAt: "", durationMinutes: "45",
  platform: "GOOGLE_MEET", meetingUrl: "", meetingPassword: "", recordingUrl: "",
}
function toLocalInput(iso: string): string {
  const d = new Date(iso); const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

interface AttRow { studentId: string; name: string; rollNumber: string | null; className: string; joinedAt: string | null }

export function LiveClassesClient({
  courseId, courseTitle, classes, canManage,
}: {
  courseId: string; courseTitle: string; classes: LiveClassRow[]; canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [del, setDel] = useState<LiveClassRow | null>(null)
  const [att, setAtt] = useState<{ title: string; rows: AttRow[] } | null>(null)

  function openCreate() { setForm(EMPTY); setOpen(true) }
  function openEdit(lc: LiveClassRow) {
    setForm({
      id: lc.id, title: lc.title, description: lc.description ?? "",
      scheduledAt: toLocalInput(lc.scheduledAt), durationMinutes: String(lc.durationMinutes),
      platform: lc.platform, meetingUrl: lc.meetingUrl ?? "", meetingPassword: "",
      recordingUrl: lc.recordingUrl ?? "",
    })
    setOpen(true)
  }

  function submit() {
    if (!form.title.trim()) { toast.error("Title is required"); return }
    if (!form.scheduledAt) { toast.error("Pick a date & time"); return }
    startTransition(async () => {
      try {
        const iso = new Date(form.scheduledAt).toISOString()
        if (form.id) {
          await updateLiveClass({
            id: form.id, title: form.title, description: form.description || null,
            scheduledAt: iso, durationMinutes: Number(form.durationMinutes) || 45,
            platform: form.platform, meetingUrl: form.meetingUrl || null,
            meetingPassword: form.meetingPassword || null, recordingUrl: form.recordingUrl || null,
          })
        } else {
          await scheduleLiveClass({
            courseId, title: form.title, description: form.description || null,
            scheduledAt: iso, durationMinutes: Number(form.durationMinutes) || 45,
            platform: form.platform, meetingUrl: form.meetingUrl || null,
            meetingPassword: form.meetingPassword || null,
          })
        }
        toast.success(form.id ? "Updated" : "Scheduled")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Something went wrong")
      }
    })
  }

  function changeStatus(lc: LiveClassRow, status: LiveStatus) {
    startTransition(async () => {
      try { await setLiveStatus(lc.id, status); router.refresh() }
      catch (e) { toast.error((e as Error).message || "Could not update status") }
    })
  }

  function confirmDelete() {
    if (!del) return
    startTransition(async () => {
      try { await deleteLiveClass(del.id); toast.success("Deleted"); setDel(null); router.refresh() }
      catch (e) { toast.error((e as Error).message || "Could not delete") }
    })
  }

  function viewAttendance(lc: LiveClassRow) {
    startTransition(async () => {
      try {
        const res = await getLiveAttendance(lc.id)
        setAtt({ title: res.liveClass.title, rows: res.rows })
      } catch (e) {
        toast.error((e as Error).message || "Could not load attendance")
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Live Classes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{courseTitle}</p>
        </div>
        {canManage && <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" /> Schedule class</Button>}
      </div>

      {classes.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <Radio className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No live classes scheduled</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map(lc => (
            <div key={lc.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-800 truncate">{lc.title}</h3>
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", STATUS_STYLE[lc.status])}>{lc.status}</span>
                  </div>
                  {lc.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{lc.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {lc.scheduledAtBS || new Date(lc.scheduledAt).toLocaleString()}</span>
                    <span>{lc.durationMinutes} min</span>
                    <span>{PLATFORMS.find(p => p.value === lc.platform)?.label}</span>
                    <button onClick={() => viewAttendance(lc)} className="inline-flex items-center gap-1 text-primary hover:underline"><Users className="w-3 h-3" /> {lc.attendanceCount}/{lc.enrolledCount} attended</button>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(lc)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDel(lc)} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>

              {canManage && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  {lc.status === "SCHEDULED" && <Button size="sm" variant="outline" onClick={() => changeStatus(lc, "LIVE")} className="h-7 gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"><Play className="w-3.5 h-3.5" /> Start</Button>}
                  {lc.status === "LIVE" && <Button size="sm" variant="outline" onClick={() => changeStatus(lc, "ENDED")} className="h-7 gap-1"><Square className="w-3.5 h-3.5" /> End</Button>}
                  {(lc.status === "SCHEDULED" || lc.status === "LIVE") && <Button size="sm" variant="ghost" onClick={() => changeStatus(lc, "CANCELLED")} className="h-7 gap-1 text-slate-400"><Ban className="w-3.5 h-3.5" /> Cancel</Button>}
                  {lc.meetingUrl && <a href={lc.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary inline-flex items-center gap-1 ml-auto"><ExternalLink className="w-3.5 h-3.5" /> Open meeting</a>}
                  {lc.recordingUrl && <a href={lc.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-violet-600 inline-flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Recording</a>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Schedule / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit live class" : "Schedule live class"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Live doubt-solving session" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date & time</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Duration (min)</Label>
                <Input type="number" min={5} value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p.value} type="button" onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                    className={cn("px-2 py-2 rounded-lg border text-xs font-semibold transition-colors", form.platform === p.value ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Meeting link</Label>
              <Input value={form.meetingUrl} onChange={e => setForm(f => ({ ...f, meetingUrl: e.target.value }))} placeholder="https://meet.google.com/…" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Passcode <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input value={form.meetingPassword} onChange={e => setForm(f => ({ ...f, meetingPassword: e.target.value }))} />
              </div>
              {form.id && (
                <div className="space-y-1.5">
                  <Label>Recording link <span className="text-slate-400 font-normal">(after class)</span></Label>
                  <Input value={form.recordingUrl} onChange={e => setForm(f => ({ ...f, recordingUrl: e.target.value }))} placeholder="https://…" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submit} disabled={isPending}>{isPending ? "Saving…" : form.id ? "Save" : "Schedule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance dialog */}
      <Dialog open={!!att} onOpenChange={o => !o && setAtt(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="inline-flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Attendance — {att?.title}</DialogTitle></DialogHeader>
          <div className="divide-y divide-slate-50">
            {att?.rows.map(r => (
              <div key={r.studentId} className="flex items-center gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{r.name}</p>
                  <p className="text-[10px] text-slate-400">{r.className}{r.rollNumber ? ` · Roll ${r.rollNumber}` : ""}</p>
                </div>
                {r.joinedAt
                  ? <span className="text-[11px] font-semibold text-emerald-600">Joined {new Date(r.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  : <span className="text-[11px] text-slate-400">Absent</span>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!del} onOpenChange={o => !o && setDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete live class?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600"><span className="font-semibold">{del?.title}</span> and its attendance records will be removed.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
