"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Pin, PinOff, Lock, Unlock, Trash2, CheckCircle2, CornerDownRight, Send, Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  getThread, createReply, deleteThread, deleteReply, markAnswer, togglePinThread, toggleLockThread,
} from "@/actions/lms/discussions"

type Data = Awaited<ReturnType<typeof getThread>>
type Reply = Data["replies"][number]

const ROLE_BADGE: Record<string, string> = {
  TEACHER: "Teacher", STAFF: "Staff", SCHOOL_ADMIN: "Admin", SUPER_ADMIN: "Admin",
}

export function ThreadView({ data, listHref }: { data: Data; listHref: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [body, setBody] = useState("")
  const [replyTo, setReplyTo] = useState<Reply | null>(null)

  const { thread, replies, canModerate, currentUserId } = data
  const canAcceptAnswer = canModerate || thread.authorId === currentUserId

  const topLevel = replies.filter(r => !r.parentId)
  const childrenOf = (id: string) => replies.filter(r => r.parentId === id)

  function run(fn: () => Promise<unknown>, okMsg?: string, after?: () => void) {
    startTransition(async () => {
      try { await fn(); if (okMsg) toast.success(okMsg); if (after) after(); else router.refresh() }
      catch (e) { toast.error((e as Error).message || "Something went wrong") }
    })
  }

  function postReply() {
    if (!body.trim()) { toast.error("Write a reply"); return }
    run(
      () => createReply({ threadId: thread.id, body, parentId: replyTo?.id ?? null }),
      "Reply posted",
      () => { setBody(""); setReplyTo(null); router.refresh() },
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href={listHref} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> All discussions
      </Link>

      {/* Thread */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.isPinned && <Pin className="w-4 h-4 text-amber-500" />}
              {thread.isLocked && <Lock className="w-4 h-4 text-slate-400" />}
              <h1 className="text-lg font-bold text-slate-800">{thread.title}</h1>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {thread.authorName}
              {ROLE_BADGE[thread.authorRole] && <span className="ml-1 inline-flex items-center gap-0.5 text-primary font-semibold"><Shield className="w-3 h-3" />{ROLE_BADGE[thread.authorRole]}</span>}
              {" · "}{new Date(thread.createdAt).toLocaleString()} · {thread.views} views
            </p>
          </div>
          {(canModerate || thread.authorId === currentUserId) && (
            <div className="flex items-center gap-1 shrink-0">
              {canModerate && (
                <>
                  <button title={thread.isPinned ? "Unpin" : "Pin"} onClick={() => run(() => togglePinThread(thread.id, !thread.isPinned))} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                    {thread.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button title={thread.isLocked ? "Unlock" : "Lock"} onClick={() => run(() => toggleLockThread(thread.id, !thread.isLocked))} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                    {thread.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
              <button title="Delete" onClick={() => run(() => deleteThread(thread.id), "Thread deleted", () => router.push(listHref))} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{thread.body}</p>
      </div>

      {/* Replies */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{replies.length} {replies.length === 1 ? "reply" : "replies"}</h2>
        {topLevel.map(r => (
          <div key={r.id}>
            <ReplyCard reply={r} canAcceptAnswer={canAcceptAnswer} canModerate={canModerate} currentUserId={currentUserId} onReply={() => setReplyTo(r)} run={run} />
            {childrenOf(r.id).map(c => (
              <div key={c.id} className="ml-8 mt-2">
                <ReplyCard reply={c} canAcceptAnswer={canAcceptAnswer} canModerate={canModerate} currentUserId={currentUserId} onReply={() => setReplyTo(r)} run={run} nested />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Composer */}
      {thread.isLocked && !canModerate ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500 inline-flex items-center justify-center gap-2 w-full">
          <Lock className="w-4 h-4" /> This thread is locked.
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-4">
          {replyTo && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2 bg-slate-50 rounded-lg px-3 py-1.5">
              <span className="inline-flex items-center gap-1"><CornerDownRight className="w-3 h-3" /> Replying to {replyTo.authorName}</span>
              <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          )}
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Write a reply…" />
          <div className="flex justify-end mt-2">
            <Button onClick={postReply} disabled={isPending} className="gap-1.5"><Send className="w-4 h-4" /> {isPending ? "Posting…" : "Reply"}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReplyCard({
  reply, canAcceptAnswer, canModerate, currentUserId, onReply, run, nested,
}: {
  reply: Reply
  canAcceptAnswer: boolean
  canModerate: boolean
  currentUserId: string
  onReply: () => void
  run: (fn: () => Promise<unknown>, okMsg?: string) => void
  nested?: boolean
}) {
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border shadow-sm p-4", reply.isAnswer ? "border-emerald-200 ring-1 ring-emerald-100" : "border-white/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{reply.authorName}</span>
            {ROLE_BADGE[reply.authorRole] && <span className="ml-1 text-primary font-semibold">{ROLE_BADGE[reply.authorRole]}</span>}
            {" · "}{new Date(reply.createdAt).toLocaleString()}
          </p>
        </div>
        {reply.isAnswer && <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0"><CheckCircle2 className="w-3 h-3" /> Answer</span>}
      </div>
      <p className="text-sm text-slate-700 mt-1.5 whitespace-pre-wrap">{reply.body}</p>
      <div className="flex items-center gap-3 mt-2">
        {!nested && <button onClick={onReply} className="text-[11px] font-semibold text-slate-500 hover:text-primary inline-flex items-center gap-1"><CornerDownRight className="w-3 h-3" /> Reply</button>}
        {canAcceptAnswer && (
          <button onClick={() => run(() => markAnswer(reply.id, !reply.isAnswer), reply.isAnswer ? "Unmarked" : "Marked as answer")} className={cn("text-[11px] font-semibold inline-flex items-center gap-1", reply.isAnswer ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600")}>
            <CheckCircle2 className="w-3 h-3" /> {reply.isAnswer ? "Unmark answer" : "Mark answer"}
          </button>
        )}
        {(canModerate || reply.authorId === currentUserId) && (
          <button onClick={() => run(() => deleteReply(reply.id), "Reply deleted")} className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
        )}
      </div>
    </div>
  )
}
