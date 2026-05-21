"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { searchRecentParties, type PartySuggestion } from "@/actions/accounting/vouchers"
import type { VoucherType } from "@/lib/accounting"

interface Props {
  name:    string
  pan:     string
  onPick:  (next: { name: string; pan: string }) => void
  onNameChange: (v: string) => void
  onPanChange:  (v: string) => void
  voucherType?: VoucherType
  nameLabel?:   string
  panLabel?:    string
  required?:    boolean
}

/**
 * Two linked inputs (party name + PAN) backed by a shared search of prior
 * vouchers' parties. Typing in either field queries by both fields; clicking
 * a suggestion fills BOTH inputs together.
 */
export function PartyAutocomplete({
  name, pan, onPick, onNameChange, onPanChange,
  voucherType, nameLabel = "Party name", panLabel = "PAN (9 digits)",
}: Props) {
  const [activeField, setActiveField] = useState<"name" | "pan" | null>(null)
  const [suggestions, setSuggestions] = useState<PartySuggestion[]>([])
  const [highlight, setHighlight]     = useState(0)
  const [loading, setLoading]         = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Whichever value drives the search — the one in the currently focused field.
  const driver = activeField === "pan" ? pan : name

  // Debounced search
  useEffect(() => {
    if (!activeField || driver.trim().length < 2) {
      setSuggestions([])
      return
    }
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchRecentParties(driver, voucherType)
        // Exclude exact current-value matches so the dropdown doesn't suggest what's already entered
        setSuggestions(results.filter(s => s.name !== name || (s.pan ?? "") !== pan))
        setHighlight(0)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => clearTimeout(handle)
  }, [driver, activeField, voucherType, name, pan])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setActiveField(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function pickSuggestion(s: PartySuggestion) {
    onPick({ name: s.name, pan: s.pan ?? "" })
    setActiveField(null)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return
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
        pickSuggestion(s)
      }
    } else if (e.key === "Escape") {
      setActiveField(null)
    }
  }

  // Show the dropdown whenever a field is focused and the user has typed
  // enough to trigger a search. Empty results still render so the user sees
  // "No matches" instead of the dropdown blinking shut.
  const showDropdown = !!activeField && driver.trim().length >= 2

  return (
    <div ref={wrapRef} className="relative">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{nameLabel}</label>
          <Input
            value={name}
            onChange={e => onNameChange(e.target.value)}
            onFocus={() => setActiveField("name")}
            onKeyDown={handleKey}
            placeholder="Name (type to search)"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{panLabel}</label>
          <Input
            value={pan}
            onChange={e => onPanChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
            onFocus={() => setActiveField("pan")}
            onKeyDown={handleKey}
            placeholder="123456789"
            className="font-mono"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
      </div>

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto"
        >
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">Searching…</li>
          )}
          {!loading && suggestions.length === 0 && (
            <li className="px-3 py-3 text-xs text-muted-foreground text-center">
              No matches yet — type the full name and it&apos;ll save with this voucher.
            </li>
          )}
          {suggestions.map((s, i) => (
            <li
              key={i}
              role="option"
              aria-selected={highlight === i}
              onMouseDown={e => { e.preventDefault(); pickSuggestion(s) }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-3",
                highlight === i ? "bg-primary/10" : "hover:bg-slate-50",
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{s.name}</p>
                {s.type && (
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{s.type}</p>
                )}
              </div>
              {s.pan ? (
                <span className="font-mono text-xs text-slate-500 tabular-nums">{s.pan}</span>
              ) : (
                <span className="text-[10px] text-slate-300 italic">no PAN</span>
              )}
            </li>
          ))}
          {suggestions.length > 0 && (
            <li className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50/60">
              ↑/↓ to navigate, Enter to pick — fills both fields
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
