"use client"

import { cn } from "@/lib/utils"
import { DAY_LABELS_SHORT } from "@/lib/working-days"

interface Props {
  value:          number[]           // selected days, 0=Sun..6=Sat
  onChange:       (next: number[]) => void
  inheritedFrom?: { label: string; days: number[] }   // for inheritance hint
  disabled?:      boolean
}

/**
 * Sun-first day picker (0=Sun..6=Sat). Empty `value` is rendered as
 * "Inherit from {parent}" — caller passes `inheritedFrom` to show the
 * resolved fallback.
 */
export function WorkingDaysPicker({ value, onChange, inheritedFrom, disabled }: Props) {
  const inheriting = value.length === 0
  const effective  = inheriting && inheritedFrom ? inheritedFrom.days : value

  function toggle(day: number) {
    if (disabled) return
    // First click while inheriting should start from the inherited set, so
    // partial overrides feel additive instead of resetting to just one day.
    const base = inheriting ? [...(inheritedFrom?.days ?? [])] : [...value]
    const next = base.includes(day) ? base.filter(d => d !== day) : [...base, day]
    onChange(next.sort((a, b) => a - b))
  }

  function reset() {
    if (disabled) return
    onChange([])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {DAY_LABELS_SHORT.map((label, i) => {
          const active = effective.includes(i)
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={disabled}
              className={cn(
                "w-12 h-9 rounded-lg border text-xs font-bold transition-colors cursor-pointer flex items-center justify-center",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                  : "bg-white text-slate-500 border-slate-200 hover:border-primary/40",
                disabled && "opacity-60 cursor-not-allowed",
                inheriting && active && "ring-2 ring-amber-300 ring-offset-1",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        {inheriting && inheritedFrom ? (
          <span className="text-amber-700 bg-amber-50/80 border border-amber-100 px-2 py-0.5 rounded-full">
            Inheriting from {inheritedFrom.label}
          </span>
        ) : (
          <span className="text-slate-500">
            {value.length} day{value.length === 1 ? "" : "s"} selected
          </span>
        )}
        {!inheriting && (
          <button type="button" onClick={reset} disabled={disabled}
            className="text-[11px] text-slate-400 hover:text-primary underline cursor-pointer">
            Reset to inherit
          </button>
        )}
      </div>
    </div>
  )
}
