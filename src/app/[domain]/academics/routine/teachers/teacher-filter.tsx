"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Search, X, UserCog, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TeacherOpt {
  id: string
  name: string
  avatarUrl: string | null
}

interface Props {
  teachers:    TeacherOpt[]
  selectedIds: string[]
  initialQuery: string
}

export function TeacherFilter({ teachers, selectedIds, initialQuery }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounced text-search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString())
      if (q.trim()) params.set("q", q.trim()); else params.delete("q")
      const next = params.toString()
      const url  = `${pathname}${next ? `?${next}` : ""}`
      if (typeof window !== "undefined" && window.location.search.replace(/^\?/, "") !== next) {
        router.replace(url)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, sp, pathname, router])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const filteredOptions = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return teachers.slice(0, 80)
    return teachers.filter(t => t.name.toLowerCase().includes(query)).slice(0, 80)
  }, [teachers, q])

  function toggleTeacher(id: string) {
    const cur = new Set(selectedIds)
    if (cur.has(id)) cur.delete(id); else cur.add(id)
    const params = new URLSearchParams(sp.toString())
    if (cur.size === 0) params.delete("teacherId")
    else params.set("teacherId", Array.from(cur).join(","))
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`)
  }

  function clearAll() {
    const params = new URLSearchParams(sp.toString())
    params.delete("teacherId")
    params.delete("q")
    setQ("")
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`)
  }

  const selectedTeachers = selectedIds
    .map(id => teachers.find(t => t.id === id))
    .filter((t): t is TeacherOpt => !!t)

  const hasFilter = selectedIds.length > 0 || !!q

  return (
    <div ref={wrapRef} className="flex items-center gap-2 flex-wrap">
      {/* Search field — also opens the dropdown */}
      <div className="relative flex-1 min-w-[240px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
        <Input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search teacher by name…"
          className="pl-10 pr-9 h-10 bg-white/80"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {open && (
          <ul role="listbox" aria-label="Teachers" className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground text-center">No teachers match.</li>
            ) : filteredOptions.map(t => {
              const picked = selectedIds.includes(t.id)
              const initials = t.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
              return (
                <li
                  key={t.id}
                  role="option"
                  aria-selected={picked}
                  onMouseDown={e => { e.preventDefault(); toggleTeacher(t.id) }}
                  className={cn(
                    "px-3 py-2 cursor-pointer flex items-center gap-3 text-sm",
                    picked ? "bg-primary/8" : "hover:bg-slate-50",
                  )}
                >
                  {t.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-white shadow-sm flex-shrink-0">
                      <span className="text-[9px] font-bold text-primary">{initials}</span>
                    </div>
                  )}
                  <span className="font-semibold truncate flex-1">{t.name}</span>
                  {picked && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Selected teacher chips */}
      {selectedTeachers.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
            <UserCog className="w-3 h-3" /> Teachers
          </span>
          {selectedTeachers.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTeacher(t.id)}
              className="inline-flex items-center gap-1 h-7 pl-2 pr-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold cursor-pointer hover:bg-primary/20"
              title={`Remove ${t.name}`}
            >
              {t.name}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {hasFilter && (
        <button
          type="button"
          onClick={clearAll}
          className="h-10 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
        >
          Reset
        </button>
      )}
    </div>
  )
}
