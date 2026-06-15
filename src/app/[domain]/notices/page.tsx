import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getNotices, type NoticeRow } from "@/actions/notices"
import { Megaphone, AlertTriangle, CalendarClock, Archive, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { NoticesClient } from "./notices-client"

export const metadata: Metadata = { title: "Notice Board" }

export default async function NoticesPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/notices`)

  let notices: NoticeRow[]
  try {
    notices = await getNotices()
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") {
      return (
        <div className="max-w-3xl mx-auto mt-16">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
            <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h1 className="text-lg font-bold text-slate-800">No access to the Notice Board</h1>
            <p className="text-xs text-slate-500 mt-1">
              You need the <span className="font-mono font-bold">notice:view</span> permission.
              Ask your school administrator to grant it.
            </p>
          </div>
        </div>
      )
    }
    throw e
  }

  const canManage = await hasPermission(session, "notice:manage")

  const now = Date.now()
  const live = notices.filter(n => n.isActive && !n.isExpired)
  const urgent = live.filter(n => n.priority === "URGENT")
  const expiringSoon = live.filter(n =>
    n.expiresAt && new Date(n.expiresAt).getTime() - now < 7 * 24 * 60 * 60 * 1000
  )
  const downCount = notices.length - live.length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notice Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            School-wide announcements for students, staff, and parents.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
          <Megaphone className="w-3 h-3" />
          {live.length} live notice{live.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Live notices"   value={`${live.length}`}         sub="Active & unexpired"        tone="primary" icon={Megaphone} />
        <Stat label="Urgent"         value={`${urgent.length}`}       sub="Needs attention"           tone="rose"    icon={AlertTriangle} />
        <Stat label="Expiring soon"  value={`${expiringSoon.length}`} sub="Within 7 days"             tone="amber"   icon={CalendarClock} />
        <Stat label="Taken down"     value={`${downCount}`}           sub="Expired or deactivated"    tone="slate"   icon={Archive} />
      </div>

      <NoticesClient notices={notices} canManage={canManage} />
    </div>
  )
}

function Stat({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "primary" | "rose" | "amber" | "slate"
  icon: React.ElementType
}) {
  const palette = {
    primary: { ring: "ring-primary/10", icon: "text-primary bg-primary/8",   value: "text-primary" },
    rose:    { ring: "ring-rose-100",   icon: "text-rose-600 bg-rose-50",    value: "text-rose-700" },
    amber:   { ring: "ring-amber-100",  icon: "text-amber-600 bg-amber-50",  value: "text-amber-700" },
    slate:   { ring: "ring-slate-100",  icon: "text-slate-500 bg-slate-100", value: "text-slate-700" },
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 ring-1", palette.ring)}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", palette.icon)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={cn("text-xl font-bold font-mono tabular-nums leading-tight", palette.value)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
