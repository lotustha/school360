"use client"

import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

export type MSOption = {
  id:         string
  label:      string
  secondary?: string  // shown small, right-aligned (e.g. "Current", "Class 9")
}

export type MSColor = "emerald" | "violet" | "sky" | "amber" | "rose" | "slate"

interface Props {
  icon:         React.ReactNode
  label:        string
  options:      MSOption[]
  selected:     string[]
  onChange:     (next: string[]) => void
  color:        MSColor
  placeholder?: string
  emptyText?:   string
  className?:   string
}

const COLOR_CLS: Record<MSColor, { badge: string; check: string }> = {
  emerald: { badge: "bg-emerald-500 text-white", check: "bg-emerald-500" },
  violet:  { badge: "bg-violet-500  text-white", check: "bg-violet-500" },
  sky:     { badge: "bg-sky-500     text-white", check: "bg-sky-500" },
  amber:   { badge: "bg-amber-500   text-white", check: "bg-amber-500" },
  rose:    { badge: "bg-rose-500    text-white", check: "bg-rose-500" },
  slate:   { badge: "bg-slate-700   text-white", check: "bg-slate-700" },
}

export function MultiSelectFilter({
  icon, label, options, selected, onChange, color,
  placeholder, emptyText = "No matches.", className,
}: Props) {
  const [open, setOpen] = useState(false)
  const cls   = COLOR_CLS[color]
  const set   = new Set(selected)
  const count = selected.length

  function toggle(id: string) {
    const next = set.has(id) ? selected.filter(x => x !== id) : [...selected, id]
    onChange(next)
  }
  function selectAll() { onChange(options.map(o => o.id)) }
  function clear()     { onChange([]) }

  // Show first selected label in trigger when only one is chosen — feels concrete
  const triggerHint = count === 0
    ? <span className="text-slate-400 text-[11px]">All</span>
    : count === 1
      ? <span className="text-slate-700 truncate max-w-[110px]">{options.find(o => o.id === selected[0])?.label ?? selected[0]}</span>
      : (
        <span className={cn(
          "inline-flex items-center justify-center min-w-5 h-5 rounded-full text-[10px] font-black px-1.5",
          cls.badge,
        )}>{count}</span>
      )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"
          className={cn(
            "h-8 gap-1.5 cursor-pointer text-xs bg-white/80 border-slate-200 font-semibold",
            count > 0 && "border-slate-300 shadow-sm bg-white",
            className,
          )}>
          {icon}
          <span className="text-slate-700">{label}</span>
          {triggerHint}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start"
        className="p-0 w-72 bg-white/95 backdrop-blur-xl border-white/50 shadow-xl max-h-[min(80vh,420px)] overflow-hidden flex flex-col">
        <Command className="flex flex-col min-h-0">
          <CommandInput placeholder={placeholder ?? `Search ${label.toLowerCase()}…`} className="h-9 text-xs" />
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {options.length} option{options.length === 1 ? "" : "s"} · {count} selected
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={selectAll}
                className="text-[10px] font-semibold text-slate-500 hover:text-primary cursor-pointer px-1.5 py-0.5 rounded">
                All
              </button>
              <button type="button" onClick={clear} disabled={count === 0}
                className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                  count > 0 ? "text-rose-600 hover:bg-rose-50 cursor-pointer" : "text-slate-300 cursor-not-allowed"
                )}>
                Clear
              </button>
            </div>
          </div>
          <CommandList className="flex-1 min-h-0 max-h-none overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-xs text-slate-400">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map(o => {
                const sel = set.has(o.id)
                return (
                  <CommandItem key={o.id}
                    value={`${o.label} ${o.secondary ?? ""}`}
                    onSelect={() => toggle(o.id)}
                    className="cursor-pointer gap-2 text-xs">
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      sel ? `${cls.check} border-transparent` : "border-slate-300 bg-white"
                    )}>
                      {sel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.secondary && <span className="text-[10px] font-bold text-slate-400">{o.secondary}</span>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
