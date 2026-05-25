import Link from "next/link"
import { Metadata } from "next"
import { Layers, Plus, ArrowRight, Archive } from "lucide-react"
import { listFeePlans } from "@/actions/billing/fee-plans"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Plans · Fees" }

export default async function PlansPage() {
  const session = await requirePermission("finance:billing:view")
  const [plans, fyCount] = await Promise.all([
    listFeePlans(),
    prisma.fiscalYear.count({ where: { schoolId: session.user.schoolId! } }),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">Templates that generate StudentFee rows when applied to a class, section, or hand-picked students.</p>
        </div>
        <Link href="/finance/plans/new">
          <Button className="gap-1.5 cursor-pointer shadow-sm">
            <Plus className="w-3.5 h-3.5" />New Plan
          </Button>
        </Link>
      </div>

      {fyCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
          No fiscal year configured. <Link href="/accounting/fiscal-years" className="underline font-bold">Set one up →</Link> before creating plans.
        </div>
      )}

      {plans.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No plans yet.</p>
          <p className="text-xs text-slate-400 mt-1">Create a plan once per class per fiscal year, then apply it to roll out fees to all students.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(p => (
            <Link key={p.id} href={`/finance/plans/${p.id}`} className="block group">
              <div className={cn(
                "bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 p-5 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/8 transition-all duration-200 cursor-pointer",
                !p.isActive && "opacity-60",
              )}>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold truncate">{p.name}</p>
                    {p.description && <p className="text-[11px] text-slate-500 truncate">{p.description}</p>}
                  </div>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", p.isActive ? "bg-primary/8" : "bg-slate-100")}>
                    {p.isActive ? <Layers className="w-5 h-5 text-primary" /> : <Archive className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>
                <div className="space-y-1 mb-3">
                  <Row label="FY"        value={p.fiscalYearName} />
                  <Row label="Items"     value={`${p.itemCount}`} />
                  <Row label="Generated" value={`${p.generatedCount} row${p.generatedCount === 1 ? "" : "s"}`} />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</span>
      <span className="font-mono tabular-nums font-bold text-slate-700">{value}</span>
    </div>
  )
}
