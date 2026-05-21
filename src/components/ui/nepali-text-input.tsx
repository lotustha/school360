"use client"

import { useState, useRef } from "react"
import { Languages, X } from "lucide-react"
import { transliterateToNepali } from "@/lib/nepali-transliterate"
import { cn } from "@/lib/utils"

interface Props {
  value:      string
  onChange:   (val: string) => void
  placeholder?: string
  className?: string
}

/**
 * Text input that supports:
 * 1. Direct Devanagari typing (system IME, default)
 * 2. Phonetic Romanized Nepali → Devanagari toggle (type "Ram" → "राम")
 */
export function NepaliTextInput({ value, onChange, placeholder = "देवनागरी", className }: Props) {
  const [phoneticMode, setPhoneticMode] = useState(false)
  const [roman, setRoman]               = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function toggleMode() {
    if (phoneticMode) {
      // switching off — keep current Devanagari value
      setPhoneticMode(false)
      setRoman("")
    } else {
      // switching on — clear roman buffer
      setPhoneticMode(true)
      setRoman("")
      inputRef.current?.focus()
    }
  }

  function handlePhoneticChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setRoman(raw)
    onChange(transliterateToNepali(raw))
  }

  function handleDirectChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
  }

  function clearValue() {
    onChange("")
    setRoman("")
    inputRef.current?.focus()
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative flex items-center gap-0">
        {phoneticMode ? (
          /* Phonetic mode: shows Roman input, value shows transliterated */
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={roman}
              onChange={handlePhoneticChange}
              placeholder="Type Roman (e.g. Ram → राम)"
              className="w-full h-11 pl-3 pr-8 bg-amber-50/60 border border-amber-200 rounded-xl
                text-sm transition-all outline-none
                focus:border-amber-400 focus:ring-4 focus:ring-amber-400/15"
            />
            {roman && (
              <button type="button" onClick={clearValue}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          /* Direct mode: type Devanagari via system IME */
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              lang="ne"
              value={value}
              onChange={handleDirectChange}
              placeholder={placeholder}
              className="w-full h-11 pl-3 pr-8 bg-white border border-slate-200 rounded-xl
                text-sm transition-all outline-none
                focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            {value && (
              <button type="button" onClick={clearValue}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Toggle button */}
        <button
          type="button"
          onClick={toggleMode}
          title={phoneticMode ? "Switch to direct Devanagari input" : "Switch to phonetic Roman input"}
          className={cn(
            "ml-2 h-11 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0",
            phoneticMode
              ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-primary hover:border-primary/40"
          )}
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{phoneticMode ? "Roman" : "अ"}</span>
        </button>
      </div>

      {/* Preview + hint */}
      {phoneticMode && value && (
        <div className="flex items-center gap-2 pl-1">
          <span className="text-xs text-slate-400">Preview:</span>
          <span className="text-sm font-medium text-slate-700">{value}</span>
        </div>
      )}
      {!phoneticMode && (
        <p className="text-[11px] text-slate-400 pl-1">
          Type in Devanagari, or click <strong>अ</strong> to switch to phonetic Roman mode.
        </p>
      )}
    </div>
  )
}
