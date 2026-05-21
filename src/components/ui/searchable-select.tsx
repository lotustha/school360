"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface SearchableSelectOption {
  value: string
  label: string
  hint?:  string
}

interface Props {
  value:    string
  onChange: (v: string) => void
  options:  SearchableSelectOption[]
  placeholder?:       string
  searchPlaceholder?: string
  emptyText?:         string
  disabled?: boolean
  error?:    boolean
  variant?:  "glass" | "plain"
  className?: string
  /** When true, allows the typed-but-not-matched query to be used as the value. */
  allowFreeText?: boolean
}

const glassTrigger = cn(
  "w-full h-11 bg-white/80 border border-slate-200 rounded-xl text-sm font-medium",
  "transition-all outline-none px-4 cursor-pointer",
  "hover:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white",
  "flex items-center justify-between gap-2 text-left",
)

const plainTrigger = cn(
  "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left",
  "transition-colors cursor-pointer outline-none",
  "hover:bg-accent/40 focus:ring-2 focus:ring-ring focus:ring-offset-1",
)

export function SearchableSelect({
  value, onChange, options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  disabled, error, variant = "plain", className, allowFreeText,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const listboxId = React.useId()

  const selected = React.useMemo(
    () => options.find(o => o.value === value),
    [options, value],
  )

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setQuery("")
  }

  const base = variant === "glass" ? glassTrigger : plainTrigger

  return (
    <Popover open={open} onOpenChange={(o) => { if (!disabled) setOpen(o) }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          disabled={disabled}
          className={cn(
            base,
            disabled && "opacity-50 cursor-not-allowed hover:bg-white/80",
            error && "border-rose-300 focus:border-rose-400 focus:ring-rose-300/20",
            className,
          )}
        >
          <span className={cn(
            "truncate",
            !selected && !value && "text-slate-400 font-normal",
          )}>
            {selected?.label ?? value ?? placeholder}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[220px]"
      >
        <Command shouldFilter>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            className="h-10"
          />
          <CommandList id={listboxId} className="max-h-64">
            <CommandEmpty>
              {allowFreeText && query.trim()
                ? (
                  <button
                    type="button"
                    onClick={() => pick(query.trim())}
                    className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md cursor-pointer"
                  >
                    Use &ldquo;<span className="font-semibold">{query.trim()}</span>&rdquo;
                  </button>
                )
                : <span className="block px-3 py-2 text-xs text-slate-500">{emptyText}</span>
              }
            </CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.hint ?? ""}`}
                  onSelect={() => pick(opt.value)}
                  className="cursor-pointer"
                >
                  <span className="flex-1 truncate">
                    {opt.label}
                    {opt.hint && (
                      <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                        {opt.hint}
                      </span>
                    )}
                  </span>
                  {value === opt.value && (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
