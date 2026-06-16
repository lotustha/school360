"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus, Search, Pencil, Trash2, Power, PowerOff, Megaphone,
  AlertTriangle, CalendarClock, Users, Paperclip, X,
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
  updateNotice, toggleNoticeActive, deleteNotice,
  type NoticeRow, type NoticePriority, type NoticeTargetOptions,
} from "@/actions/notices"
import { AudiencePicker, type AudienceValue } from "./audience-picker"

const PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const

// Coarse audience buckets for the list filter (the precise recipient is shown per card).
const AUDIENCE_FILTER = [
  { value: "ALL",      label: "Whole school" },
  { value: "STUDENTS", label: "Students" },
  { value: "STAFF",    label: "Staff" },
  { value: "PARENTS",  label: "Parents" },
] as const

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-rose-100 text-rose-700 border-rose-200",
  HIGH:   "bg-amber-100 text-amber-700 border-amber-200",
  NORMAL: "bg-slate-100 text-slate-600 border-slate-200",
}

interface Props {
  notices:   NoticeRow[]
  canManage: boolean
  targets:   NoticeTargetOptions
}

export function NoticesClient({ notices, canManage, targets }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [q, setQ] = useState("")
  const [filterAudience, setFilterAudience] = useState("")
  const [filterPriority, setFilterPriority] = useState("")
  const [showDown, setShowDown] = useState(false)
  const [editing, setEditing] = useState<NoticeRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<NoticeRow | null>(null)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return notices.filter(n => {
      if (!showDown && (!n.isActive || n.isExpired)) return false
      if (filterAudience && n.audience !== filterAudience) return false
      if (filterPriority && n.priority !== filterPriority) return false
      if (query && !n.title.toLowerCase().includes(query) && !n.body.toLowerCase().includes(query)) return false
      return true
    })
  }, [notices, q, filterAudience, filterPriority, showDown])

  function handleToggle(n: NoticeRow) {
    start(async () => {
      try {
        const res = await toggleNoticeActive(n.id)
        router.refresh()
        toast.success(res.isActive ? "Notice republished" : "Notice taken down")
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  function handleDelete(n: NoticeRow) {
    start(async () => {
      try {
        await deleteNotice(n.id)
        setConfirmDelete(null)
        router.refresh()
        toast.success("Notice deleted")
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search notices…" className="pl-9" />
        </div>
        <select
          value={filterAudience}
          onChange={e => setFilterAudience(e.target.value)}
          className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        >
          <option value="">All audiences</option>
          {AUDIENCE_FILTER.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          onClick={() => setShowDown(v => !v)}
          className={cn(
            "h-10 px-3 rounded-xl border text-xs font-bold cursor-pointer transition",
            showDown ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-white/75 border-slate-200 text-slate-500",
          )}
        >
          {showDown ? "Hide taken-down" : "Show taken-down"}
        </button>
        {canManage && (
          <Link href="/notices/new">
            <Button className="gap-1.5 cursor-pointer shadow-sm">
              <Plus className="w-3.5 h-3.5" />New Notice
            </Button>
          </Link>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <Megaphone className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No notices match.</p>
          <p className="text-xs text-slate-400 mt-1">
            {canManage
              ? <>Try clearing filters or click <strong>New Notice</strong> to publish one.</>
              : "Try clearing filters — new announcements will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => (
            <NoticeCard
              key={n.id}
              notice={n}
              canManage={canManage}
              pending={pending}
              onEdit={() => setEditing(n)}
              onToggle={() => handleToggle(n)}
              onDelete={() => setConfirmDelete(n)}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <EditNoticeDialog
          notice={editing}
          targets={targets}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={open => { if (!open) setConfirmDelete(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete notice?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            “{confirmDelete?.title}” will be permanently removed. Prefer{" "}
            <strong>Take down</strong> if you only want to hide it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Notice Card ──────────────────────────────────────────────────────────────

function NoticeCard({
  notice: n, canManage, pending, onEdit, onToggle, onDelete,
}: {
  notice: NoticeRow; canManage: boolean; pending: boolean
  onEdit: () => void; onToggle: () => void; onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isDown = !n.isActive || n.isExpired
  const long = n.body.length > 280

  return (
    <div className={cn(
      "bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5",
      isDown && "opacity-60",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={cn(
              "text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded border inline-flex items-center gap-1",
              PRIORITY_STYLE[n.priority] ?? PRIORITY_STYLE.NORMAL,
            )}>
              {n.priority === "URGENT" && <AlertTriangle className="w-3 h-3" />}
              {n.priority}
            </span>
            <span className="text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded bg-primary/8 text-primary inline-flex items-center gap-1">
              <Users className="w-3 h-3" />{n.targetLabel}
            </span>
            {!n.isActive && (
              <span className="text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                Taken down
              </span>
            )}
            {n.isActive && n.isExpired && (
              <span className="text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                Expired
              </span>
            )}
            {n.attachmentCount > 0 && (
              <span className="text-[10px] font-bold text-slate-400 inline-flex items-center gap-0.5">
                <Paperclip className="w-3 h-3" />{n.attachmentCount}
              </span>
            )}
          </div>
          <h3 className="font-bold text-slate-800 text-sm leading-snug">{n.title}</h3>
        </div>

        {canManage && (
          <div className="inline-flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/8 cursor-pointer transition-colors" aria-label="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onToggle} disabled={pending} className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors disabled:opacity-40" aria-label={n.isActive ? "Take down" : "Republish"}>
              {n.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onDelete} disabled={pending} className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors disabled:opacity-40" aria-label="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed">
        {expanded || !long ? n.body : `${n.body.slice(0, 280)}…`}
      </p>
      {long && (
        <button onClick={() => setExpanded(v => !v)} className="text-[11px] font-bold text-primary mt-1 cursor-pointer">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
        <span>
          Published {n.publishedAtBS ?? new Date(n.publishedAt).toLocaleDateString()}
          {n.createdByName && <> · by <span className="font-bold text-slate-500">{n.createdByName}</span></>}
        </span>
        {n.expiresAt && (
          <span className={cn(
            "inline-flex items-center gap-1",
            n.isExpired ? "text-slate-400" : "text-amber-600 font-bold",
          )}>
            <CalendarClock className="w-3 h-3" />
            {n.isExpired ? "Expired" : "Expires"} {n.expiresAtBS ?? new Date(n.expiresAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function EditNoticeDialog({
  notice, targets, onClose, onSaved,
}: {
  notice: NoticeRow; targets: NoticeTargetOptions; onClose: () => void; onSaved: () => void
}) {
  const [pending, start] = useTransition()
  const [title, setTitle] = useState(notice.title)
  const [body, setBody] = useState(notice.body)
  const [audience, setAudience] = useState<AudienceValue>({
    targetType: notice.targetType as AudienceValue["targetType"],
    targetIds:  notice.targetIds,
  })
  const [priority, setPriority] = useState<NoticePriority>(notice.priority as NoticePriority)
  const [expiryDate, setExpiryDate] = useState(notice.expiryDate ?? "")

  function handleSave() {
    if ((audience.targetType === "STUDENTS" || audience.targetType === "STAFF") && audience.targetIds.length === 0) {
      toast.error(`Select at least one ${audience.targetType === "STUDENTS" ? "student" : "staff member"}`)
      return
    }
    start(async () => {
      try {
        await updateNotice({
          id: notice.id,
          title,
          body,
          targetType: audience.targetType,
          targetIds:  audience.targetIds,
          priority,
          expiresAt: expiryDate || null,
        })
        toast.success("Notice updated")
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Notice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-body">Body</Label>
            <Textarea id="edit-body" value={body} onChange={e => setBody(e.target.value)} rows={6} />
          </div>
          <div className="space-y-1.5">
            <Label>Send to</Label>
            <AudiencePicker targets={targets} value={audience} onChange={setAudience} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-priority">Priority</Label>
            <select
              id="edit-priority"
              value={priority}
              onChange={e => setPriority(e.target.value as NoticePriority)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-expiry">Expiry date (AD)</Label>
              {expiryDate && (
                <button onClick={() => setExpiryDate("")} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 inline-flex items-center gap-0.5 cursor-pointer">
                  <X className="w-3 h-3" />Clear
                </button>
              )}
            </div>
            <Input id="edit-expiry" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            <p className="text-[10px] text-slate-400">Leave empty to keep the notice up indefinitely.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={pending || !title.trim() || !body.trim()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
