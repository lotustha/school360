"use client"

import { useState, useRef } from "react"
import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import NepaliDate, { dateConfigMap } from "nepali-date-converter"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// ─── BS month metadata ────────────────────────────────────────────────────────

const MONTH_KEYS = [
  "Baisakh","Jestha","Asar","Shrawan","Bhadra","Aswin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
] as const

const MONTH_LABELS_EN = [
  "Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
]

const MONTH_LABELS_NP = [
  "बैशाख","जेठ","असार","साउन","भदौ","असोज",
  "कात्तिक","मंसिर","पुष","माघ","फागुन","चैत",
]

const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month0: number): number {
  const config = (dateConfigMap as Record<number, Record<string, number>>)[year]
  return config?.[MONTH_KEYS[month0]] ?? 30
}

function todayBSParts(): { year: number; month: number; day: number } {
  try {
    const d = new NepaliDate()
    return { year: d.getYear(), month: d.getMonth(), day: d.getDate() }
  } catch {
    return { year: 2081, month: 0, day: 1 }
  }
}

function parseBS(val: string): { year: number; month: number; day: number } | null {
  const parts = val.split("-").map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  const [year, month, day] = parts
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 32) return null
  return { year, month: month - 1, day }  // month0 indexed
}

function bsToAD(year: number, month0: number, day: number): Date | null {
  try { return new NepaliDate(year, month0, day).toJsDate() } catch { return null }
}

// AD → BS using nepali-date-converter. Returns null on invalid.
function adToBS(adStr: string): { year: number; month0: number; day: number } | null {
  const m = adStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const [, y, mo, da] = m
  const ad = new Date(`${y}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}T00:00:00`)
  if (Number.isNaN(ad.getTime())) return null
  try {
    const bs = new NepaliDate(ad)
    return { year: bs.getYear(), month0: bs.getMonth(), day: bs.getDate() }
  } catch { return null }
}

function bsValueToAdString(bs: string): string {
  const parsed = parseBS(bs)
  if (!parsed) return ""
  const ad = bsToAD(parsed.year, parsed.month, parsed.day)
  if (!ad) return ""
  return `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, "0")}-${String(ad.getDate()).padStart(2, "0")}`
}

function bsValueToBSString(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function getFirstWeekday(year: number, month0: number): number {
  // 0=Sun..6=Sat — get the weekday of the 1st of the month
  const ad = bsToAD(year, month0, 1)
  return ad ? ad.getDay() : 0
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  value:       string
  onChange:    (val: string) => void
  placeholder?: string
  className?:  string
  minYear?:    number
  maxYear?:    number
}

export function NepaliDateInput({
  value, onChange,
  placeholder = "YYYY-MM-DD",
  className,
  minYear = 2040,
  maxYear = 2095,
}: Props) {
  const today = todayBSParts()
  const [open, setOpen]           = useState(false)
  const [pickerYear, setPickerY]  = useState(today.year)
  const [pickerMonth, setPickerM] = useState(today.month)
  const [mode, setMode]           = useState<"BS" | "AD">("BS")
  // Local "as you type" state for AD mode, since `value` is always BS
  const [adDraft, setAdDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // What the input field actually displays
  const displayValue = mode === "BS" ? value : adDraft || bsValueToAdString(value)

  // ── Auto-hyphen mask ──────────────────────────────────────────────────────

  function maskWithHyphens(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 8)
    let out = digits
    if (digits.length > 4) out = digits.slice(0, 4) + "-" + digits.slice(4)
    if (digits.length > 6) out = digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6)
    return out
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskWithHyphens(e.target.value)
    if (mode === "BS") {
      onChange(masked)
    } else {
      // AD mode: keep typed AD locally, convert to BS for the parent value when complete
      setAdDraft(masked)
      const conv = adToBS(masked)
      if (conv) onChange(bsValueToBSString(conv.year, conv.month0, conv.day))
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      const current = mode === "BS" ? value : adDraft
      if (current.endsWith("-")) {
        e.preventDefault()
        const trimmed = current.slice(0, -1)
        if (mode === "BS") onChange(trimmed)
        else               setAdDraft(trimmed)
      }
    }
  }

  function switchMode(next: "BS" | "AD") {
    if (next === mode) return
    if (next === "AD") setAdDraft(bsValueToAdString(value))
    else               setAdDraft("")
    setMode(next)
    inputRef.current?.focus()
  }

  // ── Calendar navigation ───────────────────────────────────────────────────

  function prevMonth() {
    if (pickerMonth === 0) { setPickerY(y => y - 1); setPickerM(11) }
    else setPickerM(m => m - 1)
  }
  function nextMonth() {
    if (pickerMonth === 11) { setPickerY(y => y + 1); setPickerM(0) }
    else setPickerM(m => m + 1)
  }

  function selectDay(day: number) {
    const m = String(pickerMonth + 1).padStart(2, "0")
    const d = String(day).padStart(2, "0")
    onChange(`${pickerYear}-${m}-${d}`)
    setOpen(false)
  }

  function goToday() {
    setPickerY(today.year); setPickerM(today.month)
    const m = String(today.month + 1).padStart(2, "0")
    const d = String(today.day).padStart(2, "0")
    onChange(`${today.year}-${m}-${d}`)
  }

  // Sync picker when opening
  function handleOpen(o: boolean) {
    if (o) {
      const parsed = parseBS(value)
      if (parsed) { setPickerY(parsed.year); setPickerM(parsed.month) }
    }
    setOpen(o)
  }

  // ── Computed values ───────────────────────────────────────────────────────

  const parsed      = parseBS(value)
  const adDate      = parsed ? bsToAD(parsed.year, parsed.month, parsed.day) : null
  const days        = getDaysInMonth(pickerYear, pickerMonth)
  const firstWday   = getFirstWeekday(pickerYear, pickerMonth)
  const daysArr     = Array.from({ length: days }, (_, i) => i + 1)
  const blanks      = Array.from({ length: firstWday })

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        {/* Single unified input field — glass background, single border, single shadow */}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={10}
          className={cn(
            "w-full h-11 pl-[56px] pr-9",
            "bg-white/75 backdrop-blur-md border border-slate-200/80 rounded-xl",
            "text-sm font-mono text-slate-800 placeholder:text-slate-400",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
            "transition-all outline-none",
            "focus:border-primary/60 focus:bg-white focus:ring-4 focus:ring-primary/15",
          )}
        />

        {/* BS/AD toggle — sits inside the input on the left */}
        <div className="absolute left-1 top-1/2 -translate-y-1/2 inline-flex h-7 rounded-md bg-slate-100/80 p-0.5 select-none">
          {(["BS", "AD"] as const).map(m => (
            <button key={m} type="button"
              onClick={() => switchMode(m)}
              className={cn(
                "px-1 min-w-[22px] text-[10px] font-black uppercase tracking-wider cursor-pointer rounded transition-colors",
                mode === m
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}>{m}</button>
          ))}
        </div>

        {/* Calendar trigger — sits inside the input on the right */}
        <Popover open={open} onOpenChange={handleOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md",
                "flex items-center justify-center cursor-pointer",
                "text-slate-400 hover:text-primary hover:bg-primary/8",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              )}
              aria-label="Open date picker"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>

          <PopoverContent
            className={cn(
              "w-72 p-0 overflow-hidden rounded-2xl",
              "bg-white/75 backdrop-blur-2xl backdrop-saturate-150",
              "border border-white/60 ring-1 ring-slate-900/5",
              "shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.4)_inset]",
            )}
            align="start"
            sideOffset={6}
          >
            {/* Decorative gradient halo at the top — adds depth without distraction */}
            <div aria-hidden className="absolute inset-x-0 top-0 h-24 pointer-events-none
              bg-gradient-to-b from-emerald-50/70 via-emerald-50/20 to-transparent" />

            {/* Month/Year navigation */}
            <div className="relative flex items-center justify-between px-3 py-3 border-b border-white/50">
              <button type="button" onClick={prevMonth}
                className="w-7 h-7 rounded-lg bg-white/0 hover:bg-white/80 flex items-center justify-center cursor-pointer transition-all duration-150 hover:shadow-sm">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900">{MONTH_LABELS_EN[pickerMonth]}</span>
                  <span className="text-xs text-slate-500 font-medium">{MONTH_LABELS_NP[pickerMonth]}</span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <button type="button" onClick={() => setPickerY(y => Math.max(minYear, y - 1))}
                    className="text-[10px] text-slate-400 hover:text-primary transition-colors cursor-pointer px-1.5 leading-none">◀</button>
                  <span className="text-[11px] font-mono font-bold text-slate-700 tabular-nums bg-white/60 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/70 shadow-sm">
                    {pickerYear} BS
                  </span>
                  <button type="button" onClick={() => setPickerY(y => Math.min(maxYear, y + 1))}
                    className="text-[10px] text-slate-400 hover:text-primary transition-colors cursor-pointer px-1.5 leading-none">▶</button>
                </div>
              </div>

              <button type="button" onClick={nextMonth}
                className="w-7 h-7 rounded-lg bg-white/0 hover:bg-white/80 flex items-center justify-center cursor-pointer transition-all duration-150 hover:shadow-sm">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="relative grid grid-cols-7 px-3 pt-3 pb-1">
              {WEEKDAYS.map(w => (
                <div key={w} className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1">
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="relative grid grid-cols-7 px-3 pb-3 gap-1">
              {blanks.map((_, i) => <div key={`b${i}`} />)}
              {daysArr.map(day => {
                const isSelected = parsed?.year === pickerYear && parsed?.month === pickerMonth && parsed?.day === day
                const isToday    = today.year === pickerYear && today.month === pickerMonth && today.day === day
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      "relative h-8 w-full rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
                      isSelected
                        ? "text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.6),inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-emerald-600/40"
                        : isToday
                        ? "text-primary bg-white/70 ring-1 ring-primary/40 shadow-sm hover:bg-white"
                        : "text-slate-700 hover:bg-white/80 hover:shadow-sm hover:text-slate-900",
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="relative px-3 pb-3 pt-1 flex items-center justify-between border-t border-white/50 mt-0">
              <button type="button" onClick={goToday}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer",
                  "px-2.5 py-1 rounded-lg",
                  "bg-white/60 backdrop-blur-sm border border-white/70 text-primary",
                  "hover:bg-white hover:shadow-[0_2px_8px_-2px_rgba(16,185,129,0.4)] transition-all duration-150",
                )}>
                <RotateCcw className="w-3 h-3" /> Today
              </button>
              <span className="text-[10px] text-slate-500 font-medium tabular-nums">
                {adDate
                  ? adDate.toLocaleDateString("en-NP", { year:"numeric", month:"short", day:"numeric" }) + " AD"
                  : `${getDaysInMonth(pickerYear, pickerMonth)} days`}
              </span>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Combined BS = AD readout on its own line. Single source of truth so
          callers don't need to render formatBS() separately next to the input. */}
      {adDate && parsed && (
        <p className="text-[11px] text-slate-500 pl-1 tabular-nums font-medium">
          <span className="text-slate-700">
            {MONTH_LABELS_EN[parsed.month]} {parsed.day}, {parsed.year}
          </span>
          <span className="text-slate-400 mx-1.5">=</span>
          <span className="text-slate-600">
            {adDate.toLocaleDateString("en-NP", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </p>
      )}
    </div>
  )
}
