import { CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── KPI card used across all accounting reports ─────────────────────────────

export function ReportKpi({
  label, value, subtitle, icon: Icon, tone, progress,
}: {
  label:    string
  value:    string
  subtitle?: string
  icon:     React.ElementType
  tone:     "emerald" | "rose" | "sky" | "violet" | "amber" | "primary" | "slate"
  progress?: number  // 0-100
}) {
  const palette = {
    emerald: { ring: "border-emerald-500/20", grad: "from-emerald-50", chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600", bar: "bg-emerald-500" },
    rose:    { ring: "border-rose-500/20",    grad: "from-rose-50",    chip: "bg-rose-500/10 text-rose-700",       icon: "text-rose-600",    bar: "bg-rose-500" },
    sky:     { ring: "border-sky-500/20",     grad: "from-sky-50",     chip: "bg-sky-500/10 text-sky-700",         icon: "text-sky-600",     bar: "bg-sky-500" },
    violet:  { ring: "border-violet-500/20",  grad: "from-violet-50",  chip: "bg-violet-500/10 text-violet-700",   icon: "text-violet-600",  bar: "bg-violet-500" },
    amber:   { ring: "border-amber-500/20",   grad: "from-amber-50",   chip: "bg-amber-500/10 text-amber-700",     icon: "text-amber-600",   bar: "bg-amber-500" },
    primary: { ring: "border-primary/20",     grad: "from-primary/5",  chip: "bg-primary/10 text-primary",         icon: "text-primary",     bar: "bg-primary" },
    slate:   { ring: "border-slate-200",      grad: "from-slate-50",   chip: "bg-slate-500/10 text-slate-700",     icon: "text-slate-500",   bar: "bg-slate-400" },
  }[tone]
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <Icon className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className="font-mono tabular-nums text-2xl font-black tracking-tight">{value}</p>
      {subtitle && <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>}
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-700", palette.bar)} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </div>
  )
}

// ─── Balanced badge ──────────────────────────────────────────────────────────

export function BalancedBadge({ balanced, dr, cr }: { balanced: boolean; dr?: string; cr?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border",
      balanced
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-rose-50 text-rose-700 border-rose-200",
    )}>
      {balanced
        ? <><CheckCircle2 className="w-3.5 h-3.5" /> Balanced</>
        : <><XCircle      className="w-3.5 h-3.5" /> Off{dr && cr ? ` by ${(parseFloat(dr) - parseFloat(cr)).toFixed(2)}` : ""}</>}
    </span>
  )
}
