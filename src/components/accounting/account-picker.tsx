"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface PickerAccount {
  id:      string
  code:    string
  name:    string
  type:    string
  subType?: string | null
}

interface Props {
  value:        string
  onChange:     (id: string) => void
  accounts:     PickerAccount[]
  placeholder?: string
  /** Filter the available accounts (e.g., to CASH/BANK for Contra) */
  filter?:      (a: PickerAccount) => boolean
  className?:   string
  /** Compact mode for table cells: borderless until hover/focus */
  compact?:     boolean
  disabled?:    boolean
}

const TYPE_BADGE: Record<string, string> = {
  ASSET:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  LIABILITY: "bg-rose-50    text-rose-700    border-rose-200",
  EQUITY:    "bg-violet-50  text-violet-700  border-violet-200",
  INCOME:    "bg-sky-50     text-sky-700     border-sky-200",
  EXPENSE:   "bg-amber-50   text-amber-700   border-amber-200",
}

/**
 * Searchable combobox over the Chart of Accounts. Type to filter by code,
 * name, or type. Keyboard-driven (↑/↓/Enter/Esc). Replaces plain <select>
 * everywhere we pick an account.
 */
export function AccountPicker({
  value, onChange, accounts, placeholder = "Select account…",
  filter, className, compact, disabled,
}: Props) {
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState("")
  const [highlight, setHighlight] = useState(0)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const list = useMemo(() => {
    const base = filter ? accounts.filter(filter) : accounts
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(a =>
      a.code.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q),
    )
  }, [accounts, filter, query])

  const selected = accounts.find(a => a.id === value)

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10)
    else { setQuery(""); setHighlight(0) }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(list.length - 1, h + 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)) }
    else if (e.key === "Enter") {
      const a = list[highlight]
      if (a) { e.preventDefault(); pick(a.id) }
    } else if (e.key === "Escape") setOpen(false)
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-left rounded-lg transition-colors outline-none",
          compact
            ? "px-2 py-1.5 text-sm bg-transparent border border-transparent hover:bg-white hover:border-slate-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15"
            : "h-11 px-3 text-sm bg-white/75 border border-slate-200 hover:border-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/15",
          open && (compact ? "bg-white border-primary ring-2 ring-primary/15" : "border-primary ring-4 ring-primary/15 bg-white"),
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer",
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-xs text-slate-500 flex-shrink-0">{selected.code}</span>
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-slate-400 truncate">{placeholder}</span>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden min-w-[260px]">
          <div className="relative border-b border-slate-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlight(0) }}
              onKeyDown={handleKey}
              placeholder="Search by code, name, or type…"
              className="w-full pl-9 pr-3 py-2 text-sm outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {list.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</li>
            ) : list.map((a, i) => (
              <li
                key={a.id}
                role="option"
                aria-selected={a.id === value}
                onMouseDown={e => { e.preventDefault(); pick(a.id) }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "px-3 py-2 cursor-pointer flex items-center gap-2 text-sm",
                  highlight === i ? "bg-primary/10" : "hover:bg-slate-50",
                )}
              >
                <span className="font-mono text-xs text-slate-500 flex-shrink-0 w-12">{a.code}</span>
                <span className="flex-1 truncate">{a.name}</span>
                <span className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border", TYPE_BADGE[a.type] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                  {a.type.slice(0, 3)}
                </span>
                {a.id === value && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              </li>
            ))}
          </ul>
          <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50/60">
            ↑/↓ navigate · Enter to pick · Esc to close
          </div>
        </div>
      )}
    </div>
  )
}
