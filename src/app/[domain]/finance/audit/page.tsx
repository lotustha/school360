import { Metadata } from "next"
import { ShieldCheck, History, Activity, CalendarRange, FileWarning } from "lucide-react"
import { cn } from "@/lib/utils"
import { listBillingAuditLog } from "@/actions/billing/audit"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { AuditLogTable } from "./audit-table"
import { AuditFilters } from "./audit-filters"

export const metadata: Metadata = { title: "Billing Audit Log" }

const DANGER_ACTIONS = new Set(["DELETE", "CANCEL", "WRITE_OFF", "REVERSE"])

function resolveRange(range: string | undefined): { fromAt?: Date } {
  if (!range || range === "all") return {}
  const now = new Date()
  const fromAt = new Date(now)
  if (range === "24h") fromAt.setHours(fromAt.getHours() - 24)
  else if (range === "7d")  fromAt.setDate(fromAt.getDate() - 7)
  else if (range === "30d") fromAt.setDate(fromAt.getDate() - 30)
  else return {}
  return { fromAt }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; range?: string }>
}) {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!
  const sp = await searchParams

  const { fromAt } = resolveRange(sp.range)
  const rows = await listBillingAuditLog({
    entity: sp.entity || undefined,
    action: sp.action || undefined,
    fromAt,
    limit:  500,
  })

  // Resolve user fullNames for display
  const userIds = Array.from(new Set(rows.map(r => r.userId).filter((id): id is string => !!id)))
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds }, schoolId }, select: { id: true, fullName: true } })
    : []
  const userById = new Map(users.map(u => [u.id, u.fullName]))

  const viewRows = rows.map(r => ({
    id:       r.id,
    at:       r.at.toISOString(),
    userName: r.userId ? (userById.get(r.userId) ?? "(removed user)") : "(system)",
    entity:   r.entity,
    entityId: r.entityId,
    action:   r.action,
    before:   r.before,
    after:    r.after,
  }))

  // KPI aggregates over the current view (not filter-scoped to all-time)
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const last24 = viewRows.filter(r => now.getTime() - new Date(r.at).getTime() < dayMs).length
  const last7  = viewRows.filter(r => now.getTime() - new Date(r.at).getTime() < 7 * dayMs).length
  const dangerCount = viewRows.filter(r => DANGER_ACTIONS.has(r.action)).length
  const uniqueUsers = new Set(viewRows.map(r => r.userName)).size

  const hasFilter = !!(sp.entity || sp.action || (sp.range && sp.range !== "all"))

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Every plan / bill / fee row mutation, traced.
            {hasFilter && <span className="text-amber-600 font-bold"> · filtered</span>}
            {viewRows.length === 500 && <span className="text-slate-400"> · 500 row cap — refine filters to see more</span>}
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Immutable
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label={hasFilter ? "Entries (filtered)" : "Total entries"} value={`${viewRows.length}`} sub={hasFilter ? "Matching filters" : "Visible"} tone="primary" icon={Activity} />
        <KPI label="Last 24 hours"     value={`${last24}`}        sub={`${last7} in last 7 days`} tone="sky"     icon={CalendarRange} />
        <KPI label="Sensitive actions" value={`${dangerCount}`}   sub="Cancel · Reverse · Write-off · Delete" tone={dangerCount > 0 ? "rose" : "emerald"} icon={FileWarning} />
        <KPI label="Distinct users"    value={`${uniqueUsers}`}   sub="Who made changes" tone="violet" icon={History} />
      </div>

      <AuditFilters rows={viewRows} />

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {viewRows.length === 0 ? (
          <div className="p-16 text-center">
            <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600">No audit entries match these filters.</p>
            <p className="text-xs text-slate-400 mt-1">Mutate any billing entity to populate this log.</p>
          </div>
        ) : (
          <AuditLogTable rows={viewRows} />
        )}
      </div>

      <p className="text-xs text-slate-400 inline-flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Audit entries are immutable. Every billing-related mutation writes one or more rows here inside the same transaction.
      </p>
    </div>
  )
}

function KPI({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "primary" | "emerald" | "sky" | "violet" | "rose"
  icon: React.ElementType
}) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",         value: "text-sky-700" },
    violet:  { ring: "ring-violet-100",  icon: "text-violet-600 bg-violet-50",   value: "text-violet-700" },
    rose:    { ring: "ring-rose-100",    icon: "text-rose-600 bg-rose-50",       value: "text-rose-700" },
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
