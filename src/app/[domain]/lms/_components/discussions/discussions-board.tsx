"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, MessageSquare, Pin, Lock, CheckCircle2, HelpCircle, Megaphone, MessagesSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { createThread, type listThreads, type ThreadType } from "@/actions/lms/discussions"

type Data = Awaited<ReturnType<typeof listThreads>>
type Thread = Data["threads"][number]

const TYPE_META: Record<ThreadType, { icon: React.ElementType; label: string; color: string }> = {
  DISCUSSION:   { icon: MessageSquare, label: "Discussion",   color: "text-slate-500" },
  QUESTION:     { icon: HelpCircle,    label: "Question",     color: "text-blue-600" },
  ANNOUNCEMENT: { icon: Megaphone,     label: "Announcement", color: "text-amber-600" },
}

export function DiscussionsBoard({
  courseId, backHref, threadHrefBase, data,
}: {
  courseId: string
  backHref: string
  threadHrefBase: string
  data: Data
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [type, setType] = useState<ThreadType>("DISCUSSION")

  const canAnnounce = data.isStaff || data.canModerate

  function submit() {
    if (!title.trim()) { toast.error("Title is required"); return }
    if (!body.trim()) { toast.error("Write something"); return }
    startTransition(async () => {
      try {
        const res = await createThread({ courseId, title, body, type })
        toast.success("Posted")
        setOpen(false); setTitle(""); setBody(""); setType("DISCUSSION")
        router.push(`${threadHrefBase}/${res.id}`)
      } catch (e) {
        toast.error((e as Error).message || "Could not post")
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to course
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Discussions</h1>
        <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="w-4 h-4" /> New post</Button>
      </div>

      {data.threads.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <MessagesSquare className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No discussions yet</p>
          <p className="text-xs text-slate-500 mt-1">Start a conversation or ask a question.</p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden divide-y divide-slate-50">
          {data.threads.map(t => <ThreadRow key={t.id} t={t} href={`${threadHrefBase}/${t.id}`} />)}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New post</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                {(["DISCUSSION", "QUESTION", ...(canAnnounce ? ["ANNOUNCEMENT"] : [])] as ThreadType[]).map(t => (
                  <button key={t} type="button" onClick={() => setType(t)} className={cn("px-3 py-1.5 text-xs font-semibold rounded-md transition-colors", type === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}>
                    {TYPE_META[t].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What's this about?" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Share details…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submit} disabled={isPending}>{isPending ? "Posting…" : "Post"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ThreadRow({ t, href }: { t: Thread; href: string }) {
  const meta = TYPE_META[t.type]
  const Icon = meta.icon
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
      <div className={cn("w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0", meta.color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {t.isPinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
          {t.isLocked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
          <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
          {t.hasAnswer && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        </div>
        <p className="text-[11px] text-slate-500">{t.authorName} · {new Date(t.lastActivity).toLocaleDateString()}</p>
      </div>
      <div className="text-right shrink-0 text-[11px] text-slate-400">
        <p className="inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {t.replyCount}</p>
        <p>{t.views} views</p>
      </div>
    </Link>
  )
}
