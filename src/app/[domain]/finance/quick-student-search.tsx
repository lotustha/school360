"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, ArrowRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { searchStudents } from "@/actions/accounting/fee-payments"

interface Student {
  id: string
  name: string
  admissionNo: string
  className: string | null
  avatarUrl: string | null
}

export function QuickStudentSearch() {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Student[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setResults([]); return }
      try { setResults(await searchStudents(q)) } catch { setResults([]) }
    }, 220)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  function pick(s: Student) {
    setOpen(false)
    setQ("")
    router.push(`/finance/collect?studentId=${s.id}`)
  }

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-[260px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
      <Input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Quick collect — type a student name or admission no…"
        className="pl-10 h-11 bg-white/80 border-slate-200/80"
      />
      {open && q.trim().length >= 2 && (
        <ul role="listbox" aria-label="Student suggestions" className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-xs text-muted-foreground text-center">No students match.</li>
          ) : results.map(s => {
            const initials = s.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
            return (
              <li
                key={s.id}
                role="option"
                aria-selected="false"
                tabIndex={0}
                onMouseDown={e => { e.preventDefault(); pick(s) }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(s) } }}
                className="px-3 py-2 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 focus:outline-none flex items-center gap-3 text-sm"
              >
                {s.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
                    <span className="text-[10px] font-bold text-emerald-700" aria-hidden>{initials}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{s.name}</p>
                  <p className="font-mono text-[10px] text-slate-400">{s.admissionNo}</p>
                </div>
                {s.className && <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">{s.className}</span>}
                <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
