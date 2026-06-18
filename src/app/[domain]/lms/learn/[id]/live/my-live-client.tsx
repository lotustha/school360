"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Radio, CalendarClock, Video, Play, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getMyLiveClasses, joinLiveClass, type LiveStatus } from "@/actions/lms/live-classes"

type LiveClass = Awaited<ReturnType<typeof getMyLiveClasses>>[number]

const STATUS_STYLE: Record<LiveStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  LIVE:      "bg-rose-100 text-rose-700 border-rose-200 animate-pulse",
  ENDED:     "bg-slate-100 text-slate-500 border-slate-200",
  CANCELLED: "bg-slate-100 text-slate-400 border-slate-200",
}

export function MyLiveClassesClient({ courseId, classes }: { courseId: string; classes: LiveClass[] }) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function join(lc: LiveClass) {
    setBusyId(lc.id)
    startTransition(async () => {
      try {
        const res = await joinLiveClass(lc.id)
        window.open(res.meetingUrl, "_blank", "noopener,noreferrer")
      } catch (e) {
        toast.error((e as Error).message || "Could not join")
      } finally {
        setBusyId(null)
      }
    })
  }

  const live = classes.filter(c => c.status === "LIVE")
  const upcoming = classes.filter(c => c.status === "SCHEDULED")
  const past = classes.filter(c => c.status === "ENDED")

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href={`/lms/learn/${courseId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to course
      </Link>

      <h1 className="text-xl font-bold tracking-tight text-slate-800">Live Classes</h1>

      {classes.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <Radio className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No live classes yet</p>
        </div>
      ) : (
        <div className="space-y-5">
          {live.length > 0 && <Group title="Live now" items={live} onJoin={join} busyId={busyId} isPending={isPending} />}
          {upcoming.length > 0 && <Group title="Upcoming" items={upcoming} onJoin={join} busyId={busyId} isPending={isPending} />}
          {past.length > 0 && <Group title="Past" items={past} onJoin={join} busyId={busyId} isPending={isPending} />}
        </div>
      )}
    </div>
  )
}

function Group({
  title, items, onJoin, busyId, isPending,
}: {
  title: string; items: LiveClass[]; onJoin: (lc: LiveClass) => void; busyId: string | null; isPending: boolean
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      {items.map(lc => (
        <div key={lc.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-800 truncate">{lc.title}</h3>
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", STATUS_STYLE[lc.status])}>{lc.status}</span>
                {lc.joined && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
              {lc.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{lc.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {lc.scheduledAtBS || new Date(lc.scheduledAt).toLocaleString()}</span>
                <span>{lc.durationMinutes} min</span>
              </div>
            </div>
            <div className="shrink-0">
              {lc.status === "LIVE" && (
                <Button size="sm" onClick={() => onJoin(lc)} disabled={isPending && busyId === lc.id} className="gap-1.5 h-8 bg-rose-600 hover:bg-rose-700">
                  <Play className="w-3.5 h-3.5" /> Join
                </Button>
              )}
              {lc.status === "ENDED" && lc.recordingUrl && (
                <a href={lc.recordingUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8"><Video className="w-3.5 h-3.5" /> Recording</Button>
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
