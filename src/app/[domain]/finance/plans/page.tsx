import Link from "next/link"
import { Metadata } from "next"
import { Layers, Plus, FileText, Users as UsersIcon, CheckCircle2 } from "lucide-react"
import { listFeePlans } from "@/actions/billing/fee-plans"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PlansClient } from "./plans-client"

export const metadata: Metadata = { title: "Plans · Fees" }

export default async function PlansPage() {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  const [plans, fiscalYears] = await Promise.all([
    listFeePlans(),
    prisma.fiscalYear.findMany({
      where:   { schoolId },
      orderBy: [{ isCurrent: "desc" }, { startBS: "desc" }],
      select:  { id: true, name: true },
    }),
  ])

  const activeCount    = plans.filter(p => p.isActive).length
  const archivedCount  = plans.length - activeCount
  const totalItems     = plans.reduce((s, p) => s + p.itemCount, 0)
  const totalGenerated = plans.reduce((s, p) => s + p.generatedCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Templates that generate StudentFee rows when applied to a class, section, or hand-picked students.
          </p>
        </div>
        <Link href="/finance/plans/new">
          <Button className="gap-1.5 cursor-pointer shadow-sm h-10">
            <Plus className="w-3.5 h-3.5" />New Plan
          </Button>
        </Link>
      </div>

      {fiscalYears.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
          No fiscal year configured. <Link href="/accounting/fiscal-years" className="underline font-bold">Set one up →</Link> before creating plans.
        </div>
      )}

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total plans"    value={`${plans.length}`}    sub="In this school" tone="slate"   icon={Layers} />
        <Stat label="Active"         value={`${activeCount}`}     sub={archivedCount > 0 ? `${archivedCount} archived` : "All live"} tone="emerald" icon={CheckCircle2} />
        <Stat label="Line items"     value={`${totalItems}`}      sub="Across all plans" tone="primary" icon={FileText} />
        <Stat label="Students billed" value={`${totalGenerated}`} sub="Total rows generated" tone="violet" icon={UsersIcon} />
      </div>

      {plans.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No plans yet.</p>
          <p className="text-xs text-slate-400 mt-1">Create a plan once per class per fiscal year, then apply it to roll out fees to all students.</p>
          <Link href="/finance/plans/new" className="inline-flex items-center gap-1.5 mt-4 px-3 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer hover:opacity-90 transition">
            <Plus className="w-3.5 h-3.5" /> Create your first plan
          </Link>
        </div>
      ) : (
        <PlansClient
          plans={plans}
          fiscalYears={fiscalYears.map(f => ({ id: f.id, name: f.name }))}
        />
      )}
    </div>
  )
}

function Stat({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "slate" | "emerald" | "primary" | "violet"
  icon: React.ElementType
}) {
  const palette = {
    slate:   { ring: "ring-slate-100",   icon: "text-slate-500 bg-slate-50",     value: "text-slate-700" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    violet:  { ring: "ring-violet-100",  icon: "text-violet-600 bg-violet-50",   value: "text-violet-700" },
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
