"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { searchRecentNarrations } from "@/actions/accounting/vouchers"
import type { VoucherType } from "@/lib/accounting"

interface Props {
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  voucherType?: VoucherType
  className?:   string
}

/**
 * Type-to-search narration field. Pulls distinct narrations from prior posted
 * vouchers (filtered by type when known) and shows them in a dropdown.
 * Falls back to a plain input if the user types something new.
 */
export function NarrationAutocomplete({ value, onChange, placeholder, voucherType, className }: Props) {
  const [open, setOpen]               = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [highlight, setHighlight]     = useState(0)
  const [loading, setLoading]         = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounced fetch
  useEffect(() => {
    if (!open || value.trim().length < 2) {
      setSuggestions([])
      return
    }
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchRecentNarrations(value, voucherType)
        setSuggestions(results.filter(r => r && r !== value))
        setHighlight(0)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => clearTimeout(handle)
  }, [value, voucherType, open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight(h => Math.min(suggestions.length - 1, h + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight(h => Math.max(0, h - 1))
    } else if (e.key === "Enter") {
      const s = suggestions[highlight]
      if (s) {
        e.preventDefault()
        onChange(s)
        setOpen(false)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && value.trim().length >= 2 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
        >
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">Searching…</li>
          )}
          {!loading && suggestions.length === 0 && (
            <li className="px-3 py-3 text-xs text-muted-foreground text-center">
              No matches — your typed narration will be saved as-is.
            </li>
          )}
          {suggestions.map((s, i) => (
            <li
              key={i}
              role="option"
              aria-selected={highlight === i}
              onMouseDown={e => {
                // mousedown fires before blur — prevents the input losing focus
                e.preventDefault()
                onChange(s)
                setOpen(false)
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer truncate flex items-center gap-2",
                highlight === i ? "bg-primary/10 text-primary" : "hover:bg-slate-50",
              )}
            >
              <span className="truncate">{s}</span>
            </li>
          ))}
          {suggestions.length > 0 && (
            <li className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50/60">
              ↑/↓ to navigate, Enter to pick, Esc to close
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
