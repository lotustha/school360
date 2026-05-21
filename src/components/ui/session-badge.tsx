import { Lock, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  facultyName: string | null
  yearName:    string | null
  isCurrent?:  boolean
  className?:  string
}

/**
 * Read-only session badge shown wherever the academic year is implicit and
 * shouldn't be picked separately (e.g. routine grids derived from a faculty).
 *
 *   Session: 2082/83 · Science · current   [lock icon]
 */
export function SessionBadge({ facultyName, yearName, isCurrent, className }: Props) {
  if (!yearName) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full border px-2.5 py-1",
        "bg-rose-50/70 text-rose-700 border-rose-200",
        className,
      )} title="No academic session is configured for this scope">
        <Lock className="w-3 h-3" />
        <span className="font-bold">Session</span>
        <span className="opacity-70">not configured</span>
      </span>
    )
  }
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full border px-2.5 py-1",
      "bg-amber-50/70 text-amber-800 border-amber-200",
      className,
    )} title="Academic session is locked for this scope">
      <Lock className="w-3 h-3 text-amber-500" />
      <span className="font-bold uppercase tracking-wider text-[9px] text-amber-600">Session</span>
      <code className="font-mono font-bold text-amber-900">{yearName}</code>
      {facultyName && (
        <>
          <span className="opacity-50">·</span>
          <span className="text-amber-700">{facultyName}</span>
        </>
      )}
      {isCurrent && (
        <>
          <span className="opacity-50">·</span>
          <span className="inline-flex items-center gap-0.5 text-amber-700">
            <Star className="w-2.5 h-2.5 fill-amber-500 stroke-amber-500" />
            current
          </span>
        </>
      )}
    </span>
  )
}
