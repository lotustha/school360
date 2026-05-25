import Link from "next/link"
import { Metadata } from "next"
import { Receipt, History, Layers, Users, ShieldCheck, Calculator, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Overview" }

// Phase A placeholder. Phase B/C/D will replace this with real KPI dashboard
// reading StudentFee aggregates (outstanding, billed, paid, by class).
export default function FeesOverviewPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fees</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The billing module is being redesigned. Each student has a per-month fee schedule;
          edit any cell to adjust amount, apply scholarship, or mark status. Use Plans to bulk-create a year of fees for a class.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard href="/finance/heads"     title="Fee Heads"       desc="Master list of every fee type"        icon={Layers}      color="primary" />
        <ActionCard href="/finance/plans"     title="Plans"           desc="Year templates per class"             icon={Layers}      color="violet" />
        <ActionCard href="/finance/classes"   title="Classes"         desc="Per-class fee schedule grid"          icon={Users}       color="sky" />
        <ActionCard href="/finance/collect"   title="Collect"         desc="Record a payment"                     icon={Receipt}     color="emerald" />
        <ActionCard href="/finance/history"   title="History"         desc="Past receipts"                        icon={History}     color="amber" />
        <ActionCard href="/finance/audit"     title="Audit Log"       desc="Every billing change traced"          icon={ShieldCheck} color="primary" />
        <ActionCard href="/accounting"        title="Accounting"      desc="GL vouchers, books, reports"          icon={Calculator}  color="violet" />
      </div>

      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5">
        <p className="text-sm font-bold text-amber-800 mb-1">Build in progress</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          Phase A (schema + actions) just landed. The student schedule grid (Phase B), class grid (Phase C), and Plans/Heads masters (Phase D) are coming next. Existing routes you see above may be stubs until those phases land.
        </p>
      </div>
    </div>
  )
}

function ActionCard({
  href, title, desc, icon: Icon, color,
}: {
  href: string; title: string; desc: string; icon: React.ElementType
  color: "emerald" | "primary" | "violet" | "sky" | "amber"
}) {
  const palette = {
    emerald: { bg: "bg-emerald-500/8", text: "text-emerald-600" },
    primary: { bg: "bg-primary/8",     text: "text-primary" },
    violet:  { bg: "bg-violet-500/8",  text: "text-violet-600" },
    sky:     { bg: "bg-sky-500/8",     text: "text-sky-600" },
    amber:   { bg: "bg-amber-500/8",   text: "text-amber-600" },
  }[color]
  return (
    <Link href={href} className="block group">
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-5 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/8 transition-all duration-200 cursor-pointer">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", palette.bg)}>
          <Icon className={cn("w-5 h-5", palette.text)} />
        </div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition mt-3" />
      </div>
    </Link>
  )
}
