import { Metadata } from "next"
import { ClipboardList, CheckCircle2, CalendarDays, CalendarCheck, Sparkles, PartyPopper } from "lucide-react"
import { listFeeHeads } from "@/actions/billing/fee-heads"
import { listAccounts } from "@/actions/accounting/accounts"
import { cn } from "@/lib/utils"
import { HeadsClient } from "./heads-client"

export const metadata: Metadata = { title: "Fee Heads · Fees" }

export default async function FeeHeadsPage() {
  const [heads, accounts] = await Promise.all([listFeeHeads(), listAccounts()])
  const incomeAccounts = accounts
    .filter(a => a.type === "INCOME" && a.isActive)
    .map(a => ({ id: a.id, code: a.code, name: a.name, type: "INCOME" as const }))
    .sort((a, b) => a.code.localeCompare(b.code))

  // Stats — only over active heads (inactive aren't usable)
  const active = heads.filter(h => h.isActive)
  const byFreq = active.reduce<Record<string, number>>((acc, h) => {
    acc[h.frequency] = (acc[h.frequency] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Heads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalog of every fee type. Each head links to one INCOME account in the chart of accounts.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
          <ClipboardList className="w-3 h-3" />{heads.length} head{heads.length === 1 ? "" : "s"} · {active.length} active
        </div>
      </div>

      {/* Frequency breakdown */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Active heads" value={`${active.length}`}                sub={`${heads.length - active.length} inactive`} tone="emerald" icon={CheckCircle2} />
        <Stat label="Monthly"      value={`${byFreq.MONTHLY  ?? 0}`}        sub="Tuition, transport…"      tone="primary"  icon={CalendarDays} />
        <Stat label="Annual"       value={`${byFreq.ANNUAL   ?? 0}`}        sub="Library, sports…"          tone="sky"      icon={CalendarCheck} />
        <Stat label="One-time"     value={`${byFreq.ONE_TIME ?? 0}`}        sub="Admission, uniform…"       tone="violet"   icon={Sparkles} />
        <Stat label="Event"        value={`${byFreq.EVENT    ?? 0}`}        sub="Picnic, tour, farewell"    tone="amber"    icon={PartyPopper} />
      </div>

      <HeadsClient initialHeads={heads} incomeAccounts={incomeAccounts} />
    </div>
  )
}

function Stat({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string
  tone: "emerald" | "primary" | "sky" | "violet" | "amber"
  icon: React.ElementType
}) {
  const palette = {
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",         value: "text-sky-700" },
    violet:  { ring: "ring-violet-100",  icon: "text-violet-600 bg-violet-50",   value: "text-violet-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-600 bg-amber-50",     value: "text-amber-700" },
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
