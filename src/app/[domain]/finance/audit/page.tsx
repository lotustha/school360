import Link from "next/link"
import { Metadata } from "next"
import { ShieldCheck, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { listBillingAuditLog } from "@/actions/billing/audit"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { AuditLogTable } from "./audit-table"

export const metadata: Metadata = { title: "Billing Audit Log" }

const ENTITIES = ["", "FeeHead", "FeePlan", "PlanItem", "StudentFee"] as const

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; action?: string }> }) {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!
  const sp = await searchParams

  const rows = await listBillingAuditLog({
    entity: sp.entity || undefined,
    action: sp.action || undefined,
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing Audit Log</h1>
          <p className="text-sm text-muted-foreground">{rows.length} entr{rows.length === 1 ? "y" : "ies"} · every plan/bill/group mutation traced</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Entity</span>
          {ENTITIES.map(e => (
            <Link key={e || "ALL"} href={e ? `/finance/audit?entity=${e}${sp.action ? `&action=${sp.action}` : ""}` : `/finance/audit${sp.action ? `?action=${sp.action}` : ""}`}>
              <Badge variant={(sp.entity ?? "") === e ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                {e || "ALL"}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      <div className={cn("bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden")}>
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
