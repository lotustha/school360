import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/**
 * Fiscal-year status badge shared across Accounting pages.
 * Colors by status (OPEN / CLOSED / LOCKED) so the FY chip means the same
 * thing on the Overview, Trial Balance, Balance Sheet, Reports, etc.
 */
export function FyBadge({
  fyName, status, className,
}: {
  fyName:   string
  status?:  "OPEN" | "CLOSED" | "LOCKED" | string
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(
      "text-[10px] font-black uppercase tracking-widest",
      status === "OPEN"   && "bg-emerald-50 text-emerald-700 border-emerald-200",
      status === "CLOSED" && "bg-amber-50 text-amber-700 border-amber-200",
      status === "LOCKED" && "bg-slate-100 text-slate-600 border-slate-300",
      !status             && "bg-slate-100 text-slate-600 border-slate-200",
      className,
    )}>
      FY {fyName}{status ? ` · ${status}` : ""}
    </Badge>
  )
}
